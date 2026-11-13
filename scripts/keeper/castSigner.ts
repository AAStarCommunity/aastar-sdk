/**
 * Offline signer. `cast mktx` builds and signs a raw transaction and does not broadcast.
 * Stderr from cast is never copied into an error: it can contain paths.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { chmodSync, closeSync, constants, fstatSync, lstatSync, mkdtempSync, openSync, rmSync, type Stats } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import {
    parseTransaction,
    recoverTransactionAddress,
    type Address,
    type Hex,
    type TransactionSerialized,
} from 'viem';
import { pinCastBin, type PinnedExecutable } from './trustedExecutable.js';

export interface SignRequest {
    to: Address;
    data: Hex;
    nonce: number;
    gasLimit: bigint;
    maxFeePerGas: bigint;
    maxPriorityFeePerGas: bigint;
    chainId: number;
}

export interface RawSigner {
    sign(req: SignRequest): Promise<Hex>;
}

const OUTPUT_CAP = 1_000_000;
const castWorkDirs = new Set<string>();
const castChildren = new Set<ChildProcess>();

/** Stop every cast child this process started. Shutdown calls this before it drops the lock. */
export function killCastChildren(): void {
    for (const child of castChildren) {
        try { child.kill('SIGKILL'); } catch { /* already gone */ }
    }
}
let castExitHooked = false;

function hookCastExit(): void {
    if (castExitHooked) return;
    castExitHooked = true;
    process.on('exit', () => {
        for (const dir of castWorkDirs) {
            try { rmSync(dir, { recursive: true, force: true }); } catch { /* the process is leaving */ }
        }
        castWorkDirs.clear();
    });
}

function modeBits(mode: number): number {
    return mode & 0o777;
}

function uid(): number {
    const id = process.getuid?.();
    if (id === undefined) throw new Error('secret file: process uid unavailable');
    return id;
}

/** Open with O_NOFOLLOW|O_NONBLOCK, fstat, and close. The bytes are not read. */
function openSecretStat(filePath: string, missing: string): Stats {
    let fd: number;
    try {
        fd = openSync(filePath, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    } catch {
        throw new Error(missing);
    }
    try {
        return fstatSync(fd);
    } finally {
        try { closeSync(fd); } catch { /* the descriptor is already gone */ }
    }
}

/** Refuse to start unless the password file and its directory match the mode/owner rules. */
export function validateSecretFiles(keystorePath: string, passwordFilePath: string): void {
    const owner = uid();
    const pw = openSecretStat(passwordFilePath, 'secret file: password file is not a regular file');
    if (!pw.isFile()) throw new Error('secret file: password file is not a regular file');
    if (modeBits(pw.mode) !== 0o600) throw new Error('secret file: password file mode is not 0600');
    if (pw.uid !== owner) throw new Error('secret file: password file owner is not the process uid');

    let dir;
    try {
        dir = lstatSync(dirname(passwordFilePath));
    } catch {
        throw new Error('secret file: password directory mode is not 0700');
    }
    if (!dir.isDirectory() || dir.isSymbolicLink()) throw new Error('secret file: password directory mode is not 0700');
    if (modeBits(dir.mode) !== 0o700) throw new Error('secret file: password directory mode is not 0700');
    if (dir.uid !== owner) throw new Error('secret file: password directory owner is not the process uid');

    const ks = openSecretStat(keystorePath, 'secret file: keystore is not a regular file');
    if (!ks.isFile()) throw new Error('secret file: keystore is not a regular file');
    if (ks.uid !== owner) throw new Error('secret file: keystore owner is not the process uid');
    if ((modeBits(ks.mode) & 0o022) !== 0) throw new Error('secret file: keystore is group or world writable');
    let ksDir;
    try {
        ksDir = lstatSync(dirname(keystorePath));
    } catch {
        throw new Error('secret file: keystore directory is group or world writable');
    }
    if (!ksDir.isDirectory() || ksDir.isSymbolicLink()) throw new Error('secret file: keystore directory is group or world writable');
    if (ksDir.uid !== owner) throw new Error('secret file: keystore directory owner is not the process uid');
    if ((modeBits(ksDir.mode) & 0o022) !== 0) throw new Error('secret file: keystore directory is group or world writable');
}

function hexChars(value: string): boolean {
    if (value.length < 2 || value.length > OUTPUT_CAP) return false;
    if (value.charCodeAt(0) !== 48) return false;
    const x = value.charCodeAt(1);
    if (x !== 120 && x !== 88) return false;
    if ((value.length - 2) % 2 !== 0) return false;
    for (let i = 2; i < value.length; i++) {
        const c = value.charCodeAt(i);
        const ok = (c >= 48 && c <= 57) || (c >= 97 && c <= 102) || (c >= 65 && c <= 70);
        if (!ok) return false;
    }
    return true;
}

function oneHexLine(stdout: string): Hex | null {
    if (stdout.length > OUTPUT_CAP) return null;
    let line = stdout;
    if (line.endsWith('\n')) line = line.slice(0, -1);
    if (line.endsWith('\r')) line = line.slice(0, -1);
    if (line.includes('\n') || line.includes('\r')) return null;
    if (!hexChars(line)) return null;
    return line as Hex;
}

async function verifyRaw(raw: Hex, req: SignRequest, signerAddress: Address): Promise<void> {
    let tx;
    try {
        tx = parseTransaction(raw);
    } catch {
        throw new Error('cast signer: output rejected');
    }
    let from: Address;
    try {
        from = await recoverTransactionAddress({ serializedTransaction: raw as TransactionSerialized });
    } catch {
        throw new Error('cast signer: output rejected');
    }
    const data = (tx.data ?? '0x').toLowerCase();
    const value = tx.value ?? 0n;
    const same =
        tx.type === 'eip1559' &&
        tx.to?.toLowerCase() === req.to.toLowerCase() &&
        data === req.data.toLowerCase() &&
        tx.nonce === req.nonce &&
        tx.chainId === req.chainId &&
        tx.gas === req.gasLimit &&
        (tx.maxFeePerGas ?? 0n) === req.maxFeePerGas &&
        (tx.maxPriorityFeePerGas ?? 0n) === req.maxPriorityFeePerGas &&
        value === 0n &&
        (!tx.accessList || tx.accessList.length === 0);
    if (!same) throw new Error('cast signer: signed fields mismatch');
    if (from.toLowerCase() !== signerAddress.toLowerCase()) throw new Error('cast signer: recovered sender mismatch');
}

export function createCastSigner(opts: {
    castBin: string;
    keystorePath: string;
    passwordFilePath: string;
    signerAddress: Address;
    timeoutMs?: number;
}): RawSigner {
    if (typeof opts.castBin !== 'string' || opts.castBin.length === 0 || opts.castBin.length > 4_096) {
        throw new Error('cast signer: cast bin rejected');
    }
    const timeoutMs = opts.timeoutMs ?? 30_000;
    if (!Number.isInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 120_000) {
        throw new Error('cast signer: timeout rejected');
    }
    const pinned: PinnedExecutable = pinCastBin(opts.castBin);
    const spawnPath = pinned.path;
    const recheck = pinned.recheck;
    validateSecretFiles(opts.keystorePath, opts.passwordFilePath);
    const signerAddress = opts.signerAddress;
    const work = mkdtempSync(join(tmpdir(), 'keeper-cast-'));
    chmodSync(work, 0o700);
    castWorkDirs.add(work);
    hookCastExit();
    return {
        async sign(req: SignRequest): Promise<Hex> {
            validateSecretFiles(opts.keystorePath, opts.passwordFilePath);
            if (!Number.isSafeInteger(req.nonce) || req.nonce < 0) throw new Error('cast signer: request rejected');
            if (!Number.isSafeInteger(req.chainId) || req.chainId <= 0) throw new Error('cast signer: request rejected');
            if (req.gasLimit <= 0n || req.maxFeePerGas < req.maxPriorityFeePerGas || req.maxPriorityFeePerGas < 0n) {
                throw new Error('cast signer: request rejected');
            }
            const args = [
                'mktx',
                '--color', 'never',
                '--keystore', opts.keystorePath,
                '--password-file', opts.passwordFilePath,
                '--nonce', String(req.nonce),
                '--gas-limit', req.gasLimit.toString(),
                '--gas-price', req.maxFeePerGas.toString(),
                '--priority-gas-price', req.maxPriorityFeePerGas.toString(),
                '--chain', String(req.chainId),
                req.to,
                req.data,
            ];
            try {
                recheck();
            } catch {
                throw new Error('cast signer: executable refused');
            }
            const raw = await new Promise<Hex>((resolve, reject) => {
                const child = spawn(spawnPath, args, {
                    cwd: work,
                    stdio: ['ignore', 'pipe', 'pipe'],
                    env: { PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '' },
                });
                castChildren.add(child);
                child.once('close', () => { castChildren.delete(child); });
                let out = '';
                let settled = false;
                const fail = () => {
                    if (settled) return;
                    settled = true;
                    clearTimeout(timer);
                    reject(new Error('cast signer: signing failed'));
                };
                const timer = setTimeout(() => {
                    child.kill('SIGKILL');
                    fail();
                }, timeoutMs);
                child.stdout.on('data', (chunk: Buffer) => {
                    if (out.length > OUTPUT_CAP) return;
                    out += chunk.toString('utf8');
                    if (out.length > OUTPUT_CAP) {
                        child.kill('SIGKILL');
                        fail();
                    }
                });
                child.stderr.on('data', () => {
                    // Discard. Cast stderr may contain the keystore path.
                });
                child.on('error', fail);
                child.on('close', (code) => {
                    if (settled) return;
                    settled = true;
                    clearTimeout(timer);
                    if (code !== 0) {
                        reject(new Error('cast signer: signing failed'));
                        return;
                    }
                    const line = oneHexLine(out);
                    if (!line) {
                        reject(new Error('cast signer: output rejected'));
                        return;
                    }
                    resolve(line);
                });
            });
            await verifyRaw(raw, req, signerAddress);
            return raw;
        },
    };
}
