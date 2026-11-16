/**
 * cast mktx is the only signer. Stderr and the process environment stay out of errors.
 * The real-cast case prints SKIP and passes when KEEPER_CAST_BIN is unset and `cast` is not on PATH.
 */
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { chmodSync, constants, existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const io = vi.hoisted(() => ({ opens: [] as { path: string; flags: number }[], reads: [] as string[] }));

vi.mock('node:fs', async (importOriginal) => {
    const actual = await importOriginal<typeof import('node:fs')>();
    return {
        ...actual,
        openSync(path: Parameters<typeof actual.openSync>[0], flags: Parameters<typeof actual.openSync>[1]) {
            io.opens.push({ path: String(path), flags: typeof flags === 'number' ? flags : 0 });
            return actual.openSync(path, flags);
        },
        readFileSync(...args: Parameters<typeof actual.readFileSync>) {
            io.reads.push(String(args[0]));
            return actual.readFileSync(...args);
        },
    };
});
import { getAddress, type Address, type Hex, type TransactionSerializable } from 'viem';
import { privateKeyToAccount, signTransaction } from 'viem/accounts';
import { createCastSigner, validateSecretFiles, type SignRequest } from './castSigner';
import { trustedScratch } from './trustScratch.js';

const SPAWN_VERDICT_TIMEOUT_MS = 90_000;

const dirs: string[] = [];
afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
}, SPAWN_VERDICT_TIMEOUT_MS);

function layout(opts: { pw?: number; dir?: number; ks?: number; linkPw?: boolean } = {}) {
    const dir = mkdtempSync(join(tmpdir(), 'cast-signer-'));
    dirs.push(dir);
    chmodSync(dir, opts.dir ?? 0o700);
    const pw = join(dir, 'password');
    const ks = join(dir, 'keystore');
    writeFileSync(ks, '{}\n');
    chmodSync(ks, opts.ks ?? 0o600);
    writeFileSync(pw, 'not-a-real-password\n');
    chmodSync(pw, opts.pw ?? 0o600);
    const passwordFile = opts.linkPw ? join(dir, 'link') : pw;
    if (opts.linkPw) symlinkSync(pw, passwordFile);
    return { dir, pw: passwordFile, ks };
}

const REQ: SignRequest = {
    to: getAddress('0x00000000000000000000000000000000000000aa'),
    data: '0x1234',
    nonce: 3,
    gasLimit: 50_000n,
    maxFeePerGas: 200n,
    maxPriorityFeePerGas: 10n,
    chainId: 11155111,
};

/** The binary's ancestors must be trusted. Secret files may stay in the temp directory. */
function script(body: string): string {
    const dir = trustedScratch('cast-bin');
    dirs.push(dir);
    const path = join(dir, 'cast');
    writeFileSync(path, `#!/bin/sh\n${body}\n`);
    chmodSync(path, 0o755);
    return path;
}

describe('cast signer', { timeout: SPAWN_VERDICT_TIMEOUT_MS }, () => {
    it('registers one process exit cleanup for every signer', () => {
        const before = process.listenerCount('exit');
        const first = layout();
        const second = layout();
        const bin = script('exit 0');
        createCastSigner({ castBin: bin, keystorePath: first.ks, passwordFilePath: first.pw, signerAddress: getAddress('0x00000000000000000000000000000000000000aa') });
        createCastSigner({ castBin: bin, keystorePath: second.ks, passwordFilePath: second.pw, signerAddress: getAddress('0x00000000000000000000000000000000000000bb') });
        expect(process.listenerCount('exit') - before).toBe(1);
    });

    it('refuses spawn when authorization is false or throws', async () => {
        const lay = layout();
        const stamp = join(lay.dir, 'spawned');
        const bin = script(`echo spawned > ${JSON.stringify(stamp)}\nexit 0`);
        const refused = createCastSigner({
            castBin: bin, keystorePath: lay.ks, passwordFilePath: lay.pw,
            signerAddress: REQ.to, authorize: () => false,
        });
        await expect(refused.sign(REQ)).rejects.toThrow('cast signer: authorization refused');
        expect(existsSync(stamp)).toBe(false);
        const boom = createCastSigner({
            castBin: bin, keystorePath: lay.ks, passwordFilePath: lay.pw,
            signerAddress: REQ.to, authorize: () => { throw new Error('secret-acl-text'); },
        });
        try {
            await boom.sign(REQ);
            throw new Error('signed');
        } catch (error) {
            expect((error as Error).message).toBe('cast signer: authorization refused');
            expect((error as Error).message).not.toContain('secret-acl-text');
        }
        expect(existsSync(stamp)).toBe(false);
    });

    it('refuses mode 0644, directory 0755, and a symlink', () => {
        const loose = layout({ pw: 0o644 });
        expect(() => validateSecretFiles(loose.ks, loose.pw)).toThrow(/password file mode is not 0600/);
        const openDir = layout({ dir: 0o755 });
        expect(() => validateSecretFiles(openDir.ks, openDir.pw)).toThrow(/password directory mode is not 0700/);
        const linked = layout({ linkPw: true });
        expect(() => validateSecretFiles(linked.ks, linked.pw)).toThrow(/password file is not a regular file/);
    });

    it('refuses a recovered sender that is not the configured signer', async () => {
        const account = privateKeyToAccount(('0x' + 'ab'.repeat(32)) as Hex);
        const raw = await account.signTransaction({
            type: 'eip1559',
            chainId: REQ.chainId,
            nonce: REQ.nonce,
            gas: REQ.gasLimit,
            maxFeePerGas: REQ.maxFeePerGas,
            maxPriorityFeePerGas: REQ.maxPriorityFeePerGas,
            to: REQ.to,
            data: REQ.data,
            value: 0n,
        });
        const files = layout();
        const rawPath = join(files.dir, 'raw');
        writeFileSync(rawPath, raw);
        const bin = script( `cat ${JSON.stringify(rawPath)}`);
        const signer = createCastSigner({
            castBin: bin,
            keystorePath: files.ks,
            passwordFilePath: files.pw,
            signerAddress: getAddress('0x00000000000000000000000000000000000000bb'),
        });
        await expect(signer.sign(REQ)).rejects.toThrow(/^cast signer: recovered sender mismatch$/);
    });

    it('refuses extra cast output with a fixed message and does not copy stderr', async () => {
        const account = privateKeyToAccount(('0x' + 'cd'.repeat(32)) as Hex);
        const raw = await account.signTransaction({
            type: 'eip1559',
            chainId: REQ.chainId,
            nonce: REQ.nonce,
            gas: REQ.gasLimit,
            maxFeePerGas: REQ.maxFeePerGas,
            maxPriorityFeePerGas: REQ.maxPriorityFeePerGas,
            to: REQ.to,
            data: REQ.data,
            value: 0n,
        });
        const files = layout();
        const bin = script( `echo "keystore-path-sentinel /tmp/secret-keystore" >&2\nprintf '%s\\nextra\\n' ${JSON.stringify(raw)}`);
        const signer = createCastSigner({
            castBin: bin,
            keystorePath: files.ks,
            passwordFilePath: files.pw,
            signerAddress: account.address,
            timeoutMs: 5_000,
        });
        await expect(signer.sign(REQ)).rejects.toThrow(/^cast signer: output rejected$/);
    });

    it('does not pass ETH_PASSWORD or ETH_RPC_URL to cast', async () => {
        const files = layout();
        const envPath = join(files.dir, 'env');
        const argPath = join(files.dir, 'args');
        const bin = script( `env > ${JSON.stringify(envPath)}\nprintf "%s\\n" "$@" > ${JSON.stringify(argPath)}\nexit 1`);
        const signer = createCastSigner({
            castBin: bin,
            keystorePath: files.ks,
            passwordFilePath: files.pw,
            signerAddress: getAddress('0x00000000000000000000000000000000000000bb'),
        });
        const previous = process.env.ETH_PASSWORD;
        process.env.ETH_PASSWORD = 'leak-sentinel';
        process.env.ETH_RPC_URL = 'http://leak.invalid';
        process.env.ETH_KEYSTORE = '/tmp/leak-keystore';
        try {
            await expect(signer.sign(REQ)).rejects.toThrow(/^cast signer: signing failed$/);
        } finally {
            if (previous === undefined) delete process.env.ETH_PASSWORD;
            else process.env.ETH_PASSWORD = previous;
            delete process.env.ETH_RPC_URL;
            delete process.env.ETH_KEYSTORE;
        }
        const dumped = await import('node:fs').then((fs) => fs.readFileSync(envPath, 'utf8'));
        const args = await import('node:fs').then((fs) => fs.readFileSync(argPath, 'utf8'));
        expect(dumped).not.toContain('leak-sentinel');
        expect(dumped).not.toContain('ETH_PASSWORD');
        expect(dumped).not.toContain('ETH_RPC_URL');
        expect(dumped).not.toContain('ETH_KEYSTORE');
        expect(args).not.toContain('--rpc-url');
        expect(args).toContain('--keystore');
        expect(args).toContain('mktx');
    });

    it('SKIP when KEEPER_CAST_BIN is unset and cast is not on PATH; otherwise a throwaway mktx recovers', async () => {
        const fromEnv = process.env.KEEPER_CAST_BIN;
        const foundry = join(homedir(), '.foundry', 'bin', 'cast');
        const bin = (fromEnv && fromEnv.startsWith('/')) ? fromEnv : (existsSync(foundry) ? foundry : '');
        if (!bin.startsWith('/')) {
            console.log('SKIP real cast: set KEEPER_CAST_BIN to an absolute cast');
            return;
        }
        const dir = mkdtempSync(join(tmpdir(), 'cast-real-'));
        dirs.push(dir);
        chmodSync(dir, 0o700);
        const pw = randomBytes(16).toString('hex');
        const pwFile = join(dir, 'password');
        writeFileSync(pwFile, pw);
        chmodSync(pwFile, 0o600);
        const ksDir = join(dir, 'keys');
        mkdirSync(ksDir, { mode: 0o700 });
        const created = spawnSync(bin, ['wallet', 'new', ksDir, '--unsafe-password', pw, '--json'], { encoding: 'utf8' });
        expect(created.status).toBe(0);
        const parsed = JSON.parse(created.stdout) as { address: string; path: string }[];
        const row = parsed[0];
        expect(row?.address).toBeTruthy();
        chmodSync(row!.path, 0o600);
        const signer = createCastSigner({
            castBin: bin,
            keystorePath: row!.path,
            passwordFilePath: pwFile,
            signerAddress: getAddress(row!.address as Address),
            timeoutMs: 30_000,
        });
        const raw = await signer.sign(REQ);
        expect(raw.startsWith('0x')).toBe(true);
        const { recoverTransactionAddress } = await import('viem');
        const from = await recoverTransactionAddress({ serializedTransaction: raw as `0x02${string}` });
        expect(from.toLowerCase()).toBe(row!.address.toLowerCase());
    }, 60_000);

    it('refuses a replaced executable before spawn', async () => {
        const lay = layout();
        const mark = join(lay.dir, 'ran');
        const bin = script(`echo ran > ${JSON.stringify(mark)}`);
        const signer = createCastSigner({
            castBin: bin,
            keystorePath: lay.ks,
            passwordFilePath: lay.pw,
            signerAddress: getAddress('0x1111111111111111111111111111111111111111'),
        });
        unlinkSync(bin);
        writeFileSync(bin, `#!/bin/sh\necho ran > ${JSON.stringify(mark)}\n`);
        chmodSync(bin, 0o755);
        await expect(signer.sign(REQ)).rejects.toThrow(/^cast signer: executable refused$/);
        expect(existsSync(mark)).toBe(false);
    });

    it('refuses a password symlink swapped in after construction', async () => {
        const lay = layout();
        const bin = script( 'echo 0x02');
        const signer = createCastSigner({
            castBin: bin,
            keystorePath: lay.ks,
            passwordFilePath: lay.pw,
            signerAddress: getAddress('0x1111111111111111111111111111111111111111'),
        });
        const other = join(lay.dir, 'other');
        writeFileSync(other, 'other\n');
        chmodSync(other, 0o600);
        unlinkSync(lay.pw);
        symlinkSync(other, lay.pw);
        await expect(signer.sign(REQ)).rejects.toThrow('secret file: password file is not a regular file');
    });

    it('refuses a group-writable keystore and a group-writable keystore directory', () => {
        const lay = layout({ ks: 0o664 });
        expect(() => validateSecretFiles(lay.ks, lay.pw)).toThrow('secret file: keystore mode is not 0600');
        const root = mkdtempSync(join(tmpdir(), 'cast-ksdir-'));
        dirs.push(root);
        const pwDir = join(root, 'pw');
        const ksDir = join(root, 'ks');
        mkdirSync(pwDir, { mode: 0o700 });
        mkdirSync(ksDir, { mode: 0o775 });
        chmodSync(pwDir, 0o700);
        chmodSync(ksDir, 0o775);
        const pw = join(pwDir, 'password');
        const ks = join(ksDir, 'keystore');
        writeFileSync(pw, 'pw\n');
        writeFileSync(ks, '{}\n');
        chmodSync(pw, 0o600);
        chmodSync(ks, 0o600);
        expect(() => validateSecretFiles(ks, pw)).toThrow('secret file: keystore directory is group or world writable');
    });

    it('opens the keystore and password with O_NOFOLLOW|O_NONBLOCK and does not read bytes', () => {
        const lay = layout();
        io.opens.length = 0;
        io.reads.length = 0;
        validateSecretFiles(lay.ks, lay.pw);
        const paths = io.opens.map((call) => call.path);
        expect(paths).toContain(lay.ks);
        expect(paths).toContain(lay.pw);
        for (const call of io.opens) {
            if (call.path !== lay.ks && call.path !== lay.pw) continue;
            expect(call.flags & constants.O_NOFOLLOW).toBe(constants.O_NOFOLLOW);
            expect(call.flags & constants.O_NONBLOCK).toBe(constants.O_NONBLOCK);
        }
        expect(io.reads).not.toContain(lay.ks);
        expect(io.reads).not.toContain(lay.pw);
    });

    it('signs in a fresh empty 0700 directory', async () => {
        const lay = layout();
        const mark = join(lay.dir, 'cwd.txt');
        const bin = script( `pwd > '${mark}'\necho 0x02`);
        const signer = createCastSigner({
            castBin: bin,
            keystorePath: lay.ks,
            passwordFilePath: lay.pw,
            signerAddress: getAddress('0x1111111111111111111111111111111111111111'),
        });
        await signer.sign(REQ).catch(() => {});
        const cwd = readFileSync(mark, 'utf8').trim();
        expect(cwd).toContain('keeper-cast-');
        expect(readdirSync(cwd)).toEqual([]);
        expect(statSync(cwd).mode & 0o777).toBe(0o700);
    });

    it('refuses a correctly signed transaction whose fields do not match the request', async () => {
        const key = ('0x' + 'ab'.repeat(32)) as Hex;
        const account = privateKeyToAccount(key);
        const other = getAddress('0x00000000000000000000000000000000000000bb');
        const cases: TransactionSerializable[] = [
            { type: 'eip1559', chainId: REQ.chainId, nonce: REQ.nonce, gas: REQ.gasLimit, maxFeePerGas: REQ.maxFeePerGas, maxPriorityFeePerGas: REQ.maxPriorityFeePerGas, to: other, data: REQ.data, value: 0n },
            { type: 'eip1559', chainId: REQ.chainId, nonce: REQ.nonce, gas: REQ.gasLimit, maxFeePerGas: REQ.maxFeePerGas, maxPriorityFeePerGas: REQ.maxPriorityFeePerGas, to: REQ.to, data: '0x99', value: 0n },
            { type: 'eip1559', chainId: REQ.chainId, nonce: REQ.nonce + 1, gas: REQ.gasLimit, maxFeePerGas: REQ.maxFeePerGas, maxPriorityFeePerGas: REQ.maxPriorityFeePerGas, to: REQ.to, data: REQ.data, value: 0n },
            { type: 'eip1559', chainId: 1, nonce: REQ.nonce, gas: REQ.gasLimit, maxFeePerGas: REQ.maxFeePerGas, maxPriorityFeePerGas: REQ.maxPriorityFeePerGas, to: REQ.to, data: REQ.data, value: 0n },
            { type: 'eip1559', chainId: REQ.chainId, nonce: REQ.nonce, gas: 60_000n, maxFeePerGas: REQ.maxFeePerGas, maxPriorityFeePerGas: REQ.maxPriorityFeePerGas, to: REQ.to, data: REQ.data, value: 0n },
            { type: 'eip1559', chainId: REQ.chainId, nonce: REQ.nonce, gas: REQ.gasLimit, maxFeePerGas: 300n, maxPriorityFeePerGas: REQ.maxPriorityFeePerGas, to: REQ.to, data: REQ.data, value: 0n },
            { type: 'eip1559', chainId: REQ.chainId, nonce: REQ.nonce, gas: REQ.gasLimit, maxFeePerGas: REQ.maxFeePerGas, maxPriorityFeePerGas: 11n, to: REQ.to, data: REQ.data, value: 0n },
            { type: 'eip1559', chainId: REQ.chainId, nonce: REQ.nonce, gas: REQ.gasLimit, maxFeePerGas: REQ.maxFeePerGas, maxPriorityFeePerGas: REQ.maxPriorityFeePerGas, to: REQ.to, data: REQ.data, value: 1n },
            { type: 'legacy', chainId: REQ.chainId, nonce: REQ.nonce, gas: REQ.gasLimit, gasPrice: REQ.maxFeePerGas, to: REQ.to, data: REQ.data, value: 0n },
            { type: 'eip1559', chainId: REQ.chainId, nonce: REQ.nonce, gas: REQ.gasLimit, maxFeePerGas: REQ.maxFeePerGas, maxPriorityFeePerGas: REQ.maxPriorityFeePerGas, to: REQ.to, data: REQ.data, value: 0n, accessList: [{ address: REQ.to, storageKeys: [] }] },
        ];
        for (const transaction of cases) {
            const lay = layout();
            const raw = await signTransaction({ privateKey: key, transaction });
            const bin = script( `printf '%s' '${raw}'`);
            const signer = createCastSigner({
                castBin: bin,
                keystorePath: lay.ks,
                passwordFilePath: lay.pw,
                signerAddress: account.address,
            });
            await expect(signer.sign(REQ), JSON.stringify(transaction.type) + String(transaction.value)).rejects.toThrow('cast signer: signed fields mismatch');
        }
    });

    it('accepts a zero priority fee (viem parses it as undefined) (#447 clestons M1\')', async () => {
        const key = ('0x' + 'ab'.repeat(32)) as Hex;
        const account = privateKeyToAccount(key);
        const zeroTip = { ...REQ, maxPriorityFeePerGas: 0n };
        const raw = await signTransaction({
            privateKey: key,
            transaction: { type: 'eip1559', chainId: zeroTip.chainId, nonce: zeroTip.nonce, gas: zeroTip.gasLimit, maxFeePerGas: zeroTip.maxFeePerGas, maxPriorityFeePerGas: 0n, to: zeroTip.to, data: zeroTip.data, value: 0n },
        });
        const lay = layout();
        const signer = createCastSigner({ castBin: script(`printf '%s' '${raw}'`), keystorePath: lay.ks, passwordFilePath: lay.pw, signerAddress: account.address });
        await expect(signer.sign(zeroTip)).resolves.toBe(raw);
    });
});
