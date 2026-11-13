/**
 * Single in-flight journal: durability, file checks, and the process-lifetime lock.
 */
import { spawn } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { open } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { connect } from 'node:net';
import { createServer } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import type { Address, Hex } from 'viem';
import { acquireKeeperLock, atomicWriteFile, Journal, keeperLockPort, journalFileLockPort, setDurabilityHooks, JOURNAL_HASH_CAP, FEE_DIGIT_MAX } from './journal';

const SIGNER = '0x3333333333333333333333333333333333333333' as Address;
const OTHER = '0x4444444444444444444444444444444444444444' as Address;
const SPAWN_VERDICT_TIMEOUT_MS = 180_000;

const dirs: string[] = [];
afterEach(() => {
    setDurabilityHooks(null);
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
}, SPAWN_VERDICT_TIMEOUT_MS);

function dir(): string {
    const path = mkdtempSync(join(tmpdir(), 'keeper-journal-'));
    chmodSync(path, 0o700);
    dirs.push(path);
    return path;
}

function flight(over: Record<string, unknown> = {}) {
    return {
        kind: 'price-super',
        nonce: 4,
        raws: ['0xabcd'],
        hashes: ['0x' + 'ab'.repeat(32)],
        gasLimit: '21000',
        maxFeePerGas: '20',
        maxPriorityFeePerGas: '1',
        attempts: 0,
        firstSentAt: 1,
        ...over,
    };
}

describe('journal', { timeout: SPAWN_VERDICT_TIMEOUT_MS }, () => {
    it('stores one in-flight tx and drops hashes past the cap', async () => {
        const path = join(dir(), 'journal.json');
        const journal = new Journal(path, { chainId: 11155111, signer: SIGNER });
        await journal.init();
        const hashes = Array.from({ length: JOURNAL_HASH_CAP + 6 }, (_, i) => (`0x${i.toString(16).padStart(64, '0')}`) as Hex);
        await journal.writeInFlight({
            kind: 'price-super',
            nonce: 4,
            raws: ['0xabcd', '0xabce', '0xabcf', '0xabd0'] as Hex[],
            hashes,
            gasLimit: 21_000n,
            maxFeePerGas: 20n,
            maxPriorityFeePerGas: 1n,
            attempts: 1,
            firstSentAt: 1,
        });
        const body = JSON.parse(readFileSync(path, 'utf8')) as { version: number; inFlight: { hashes: string[]; raws: string[] } };
        expect(body.version).toBe(2);
        expect(body.inFlight.hashes).toHaveLength(JOURNAL_HASH_CAP);
        expect(body.inFlight.hashes[0]).toBe(hashes[6]);
        expect(body.inFlight.raws).toHaveLength(3);
        const again = new Journal(path, { chainId: 11155111, signer: SIGNER });
        expect(await again.load()).toBe('ok');
        expect(again.inFlight()?.nonce).toBe(4);
        const copy = again.inFlight();
        if (copy) copy.nonce = 99;
        expect(again.inFlight()?.nonce).toBe(4);
    });

    it('refuses a journal bound to another signer and an older file shape', async () => {
        const path = join(dir(), 'journal.json');
        const journal = new Journal(path, { chainId: 11155111, signer: SIGNER });
        await journal.init();
        const before = readFileSync(path, 'utf8');
        const other = new Journal(path, { chainId: 11155111, signer: OTHER });
        expect(await other.load()).toBe('mismatch');
        expect(readFileSync(path, 'utf8')).toBe(before);
        expect(await new Journal(path, { chainId: 11155111, signer: SIGNER }).load()).toBe('ok');

        const old = join(dir(), 'old.json');
        writeFileSync(old, JSON.stringify({ version: 1, chainId: 11155111, signer: SIGNER, entries: [], foreignNonce: 3 }));
        chmodSync(old, 0o600);
        expect(await new Journal(old, { chainId: 11155111, signer: SIGNER }).load()).toBe('corrupt');
    });

    it('shares the uint256 digit bound between the writer and the parser', async () => {
        const path = join(dir(), 'journal.json');
        const journal = new Journal(path, { chainId: 11155111, signer: SIGNER });
        await journal.init();
        const ok = 10n ** BigInt(FEE_DIGIT_MAX - 1);
        expect(ok.toString().length).toBe(FEE_DIGIT_MAX);
        await journal.writeInFlight({
            kind: 'cancel', nonce: 1, raws: ['0xab'] as Hex[], hashes: [('0x' + '11'.repeat(32)) as Hex],
            gasLimit: 21_000n, maxFeePerGas: ok, maxPriorityFeePerGas: 1n, attempts: 0, firstSentAt: 1,
        });
        expect(await new Journal(path, { chainId: 11155111, signer: SIGNER }).load()).toBe('ok');
        const tooBig = 10n ** BigInt(FEE_DIGIT_MAX);
        await expect(journal.writeInFlight({
            kind: 'cancel', nonce: 1, raws: ['0xab'] as Hex[], hashes: [('0x' + '11'.repeat(32)) as Hex],
            gasLimit: 21_000n, maxFeePerGas: tooBig, maxPriorityFeePerGas: 1n, attempts: 0, firstSentAt: 1,
        })).rejects.toThrow('journal: fee rejected');
        const bad = join(dir(), 'wide.json');
        writeFileSync(bad, JSON.stringify({
            version: 2, chainId: 11155111, signer: SIGNER,
            inFlight: flight({ maxFeePerGas: tooBig.toString() }),
        }));
        chmodSync(bad, 0o600);
        expect(await new Journal(bad, { chainId: 11155111, signer: SIGNER }).load()).toBe('corrupt');
    });

    it('creates a fresh journal directory before the lock and refuses a second chain signer', async () => {
        const root = dir();
        const path = join(root, 'fresh', 'nested', 'journal.json');
        const release = await acquireKeeperLock({ journalPath: path, chainId: 11155111, signer: SIGNER });
        expect(statSync(join(root, 'fresh')).mode & 0o777).toBe(0o700);
        const otherPath = join(root, 'elsewhere', 'journal.json');
        await expect(acquireKeeperLock({ journalPath: otherPath, chainId: 11155111, signer: SIGNER })).rejects.toThrow('journal: lock held');
        await release();
        const again = await acquireKeeperLock({ journalPath: path, chainId: 11155111, signer: SIGNER });
        await again();
    });

    it('does not chmod an existing directory and refuses a group-writable parent', async () => {
        const root = dir();
        const openDir = join(root, 'open');
        mkdirSync(openDir, { mode: 0o755 });
        chmodSync(openDir, 0o755);
        await atomicWriteFile(join(openDir, 'file.json'), '{"ok":true}\n');
        expect(statSync(openDir).mode & 0o777).toBe(0o755);
        const loose = join(root, 'loose');
        mkdirSync(loose, { mode: 0o775 });
        chmodSync(loose, 0o775);
        await expect(atomicWriteFile(join(loose, 'file.json'), '{}\n')).rejects.toThrow('journal: parent is group or world writable');
    });

    it('production fsync runs on the file and the directory', async () => {
        const sample = await open(join(dir(), 'probe'), 'w');
        const proto = Object.getPrototypeOf(sample) as { sync: () => Promise<void> };
        await sample.close();
        const seen: string[] = [];
        const orig = proto.sync;
        proto.sync = async function (this: { stat: () => Promise<{ isDirectory: () => boolean }> }) {
            const st = await this.stat();
            seen.push(st.isDirectory() ? 'dir' : 'file');
            return orig.call(this);
        };
        try {
            const path = join(dir(), 'journal.json');
            const journal = new Journal(path, { chainId: 11155111, signer: SIGNER });
            await journal.init();
            expect(seen).toContain('file');
            expect(seen).toContain('dir');
            expect(seen.indexOf('file')).toBeLessThan(seen.lastIndexOf('dir'));
        } finally {
            proto.sync = orig;
        }
    });

    it('refuses a fifo immediately', async () => {
        const root = dir();
        const fifo = join(root, 'journal.fifo');
        const made = spawn('mkfifo', [fifo]);
        const code = await new Promise<number | null>((resolve) => made.once('exit', resolve));
        expect(code).toBe(0);
        const journal = new Journal(fifo, { chainId: 11155111, signer: SIGNER });
        const started = Date.now();
        const loaded = await journal.load();
        expect(Date.now() - started).toBeLessThan(1_000);
        expect(loaded).toBe('unsafe');
    });

    it('destroys an accepted lock socket so release does not wait', async () => {
        const root = dir();
        const release = await acquireKeeperLock({ journalPath: join(root, 'journal.json'), chainId: 11155111, signer: SIGNER });
        const sock = connect({ host: '127.0.0.1', port: keeperLockPort(11155111, SIGNER) });
        await new Promise<void>((resolve, reject) => {
            sock.once('connect', () => resolve());
            sock.once('error', reject);
        });
        const started = Date.now();
        await release();
        expect(Date.now() - started).toBeLessThan(1_000);
        sock.destroy();
    });

    it('refuses a symlink and a mode other than 0600', async () => {
        const root = dir();
        const file = join(root, 'journal.json');
        const journal = new Journal(file, { chainId: 1, signer: SIGNER });
        await journal.init();
        chmodSync(file, 0o644);
        expect(await new Journal(file, { chainId: 1, signer: SIGNER }).load()).toBe('unsafe');
        chmodSync(file, 0o600);
        const real = join(root, 'real.json');
        writeFileSync(real, readFileSync(file, 'utf8'));
        chmodSync(real, 0o600);
        rmSync(file);
        const { symlinkSync } = await import('node:fs');
        symlinkSync(real, file);
        expect(await new Journal(file, { chainId: 1, signer: SIGNER }).load()).toBe('unsafe');
    });

    it('releases the lock when a keeper --once process exits, and after SIGKILL', async () => {
        const holder = '0x8888888888888888888888888888888888888888' as Address;
        // Distinct from every other test file's signer: the lock port is derived from (chain, signer) and files run in parallel.
        const onceSigner = '0x5555555555555555555555555555555555555555' as Address;
        const root = dir();
        const journalPath = join(root, 'once', 'journal.json');
        const tsx = join(process.cwd(), 'node_modules', 'tsx', 'dist', 'loader.mjs');
        if (!existsSync(tsx)) throw new Error('tsx loader missing');
        const holdScript = join(root, 'hold.ts');
        writeFileSync(holdScript, `import { acquireKeeperLock } from ${JSON.stringify(join(process.cwd(), 'scripts/keeper/journal.ts'))};\nasync function main() {\n  await acquireKeeperLock({ journalPath: ${JSON.stringify(join(root, 'held', 'journal.json'))}, chainId: 11155111, signer: ${JSON.stringify(holder)} });\n  console.log('held');\n  setInterval(() => {}, 1000);\n}\nmain();\n`);
        const child = spawn(process.execPath, ['--import', pathToFileURL(tsx).href, holdScript], { cwd: root, env: { PATH: process.env.PATH ?? '', HOME: root } });
        let heldOut = '';
        const held = await new Promise<boolean>((resolve) => {
            const timer = setTimeout(() => resolve(false), 20_000);
            child.stdout.on('data', (chunk) => {
                heldOut += chunk.toString();
                if (heldOut.includes('held')) {
                    clearTimeout(timer);
                    resolve(true);
                }
            });
            child.stderr.on('data', (chunk) => { heldOut += chunk.toString(); });
            child.once('exit', () => { clearTimeout(timer); resolve(false); });
        });
        expect(held, heldOut).toBe(true);
        await expect(acquireKeeperLock({ journalPath: join(root, 'other.json'), chainId: 11155111, signer: holder })).rejects.toThrow('journal: lock held');
        child.kill('SIGKILL');
        await new Promise<void>((resolve) => child.once('exit', () => resolve()));
        const afterKill = await acquireKeeperLock({ journalPath: join(root, 'after-kill.json'), chainId: 11155111, signer: holder });
        await afterKill();

        const server = createServer((req, res) => {
            let body = '';
            req.on('data', (chunk) => { body += chunk; });
            req.on('end', () => {
                const msg = JSON.parse(body) as { id: unknown; method: string };
                let result: unknown = '0x' + '0'.repeat(64);
                if (msg.method === 'eth_chainId') result = '0xaa36a7';
                else if (msg.method === 'eth_blockNumber') result = '0x10';
                else if (msg.method === 'eth_getBlockByNumber') {
                    result = {
                        number: '0x10', hash: '0x' + 'ab'.repeat(32), parentHash: '0x' + '22'.repeat(32),
                        timestamp: '0x1', baseFeePerGas: '0x1', gasLimit: '0x1c9c380', gasUsed: '0x0',
                        transactions: [], uncles: [], logsBloom: '0x' + '00'.repeat(256), miner: '0x' + '00'.repeat(20),
                        difficulty: '0x0', extraData: '0x', nonce: '0x0000000000000000', mixHash: '0x' + '00'.repeat(32),
                        sha3Uncles: '0x' + '00'.repeat(32), stateRoot: '0x' + '00'.repeat(32), receiptsRoot: '0x' + '00'.repeat(32),
                        transactionsRoot: '0x' + '00'.repeat(32), size: '0x0', totalDifficulty: '0x0',
                    };
                } else if (msg.method === 'eth_getTransactionCount') result = '0x0';
                res.end(JSON.stringify({ jsonrpc: '2.0', id: msg.id, result }));
            });
        });
        await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
        const address = server.address();
        if (!address || typeof address === 'string') throw new Error('rpc listen failed');
        const ks = join(root, 'keys');
        mkdirSync(ks, { mode: 0o700 });
        const keystore = join(ks, 'keystore');
        const password = join(ks, 'password');
        writeFileSync(keystore, '{}\n');
        chmodSync(keystore, 0o600);
        writeFileSync(password, 'pw\n');
        chmodSync(password, 0o600);
        const keeper = join(process.cwd(), 'scripts/keeper.ts');
        const once = spawn(process.execPath, [
            '--import', pathToFileURL(tsx).href, keeper,
            '--network', 'sepolia', '--once', '--no-logo', '--no-superpaymaster', '--disable-paymaster',
            '--max-fee-gwei', '100',
            '--keystore', keystore, '--password-file', password, '--signer', onceSigner, '--journal', journalPath,
        ], {
            cwd: root,
            env: { PATH: process.env.PATH ?? '', HOME: root, RPC_URL: `http://127.0.0.1:${address.port}` },
        });
        let onceOut = '';
        once.stdout.on('data', (chunk) => { onceOut += chunk.toString(); });
        once.stderr.on('data', (chunk) => { onceOut += chunk.toString(); });
        const onceCode = await new Promise<number | null>((resolve) => {
            const timer = setTimeout(() => { once.kill('SIGKILL'); resolve(null); }, 25_000);
            once.once('exit', (status) => { clearTimeout(timer); resolve(status); });
        });
        server.close();
        expect(onceCode, onceOut).toBe(0);
        const released = await acquireKeeperLock({ journalPath, chainId: 11155111, signer: onceSigner });
        await released();
    });
});

describe('lock port bands (#447 clestons N2)', () => {
    it('keeps both lock bands disjoint and below every common ephemeral range', () => {
        for (let i = 0; i < 2000; i++) {
            const signer = `0x${i.toString(16).padStart(40, '0')}`;
            const a = keeperLockPort(11155111, signer);
            const b = journalFileLockPort(`/tmp/keeper-${i}/journal.json`);
            expect(a).toBeGreaterThanOrEqual(20_000);
            expect(a).toBeLessThan(26_000);
            expect(b).toBeGreaterThanOrEqual(26_000);
            expect(b).toBeLessThan(32_000);
        }
    });
});

