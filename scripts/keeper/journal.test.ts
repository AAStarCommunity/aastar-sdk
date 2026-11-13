/**
 * Journal identity, lock, prune, and parent-directory rules.
 */
import { spawn } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { keccak256, type Address, type Hex } from 'viem';
import { acquireKeeperLock, atomicWriteFile, Journal, resyncJournal, type JournalEntry } from './journal';

const SIGNER = '0x3333333333333333333333333333333333333333' as Address;
const OTHER = '0x4444444444444444444444444444444444444444' as Address;
const TO = '0x1111111111111111111111111111111111111111' as Address;
const SPAWN_VERDICT_TIMEOUT_MS = 180_000;

const dirs: string[] = [];
afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
}, SPAWN_VERDICT_TIMEOUT_MS);

function dir(): string {
    const path = mkdtempSync(join(tmpdir(), 'keeper-journal-'));
    chmodSync(path, 0o700);
    dirs.push(path);
    return path;
}

function entry(nonce: number, status: JournalEntry['status']): JournalEntry {
    const raw = (`0x${nonce.toString(16).padStart(4, '0')}`) as Hex;
    return {
        nonce,
        kind: 'pause',
        to: TO,
        data: '0x1234',
        raws: [raw],
        hashes: [keccak256(raw)],
        gasLimit: 100_000n,
        maxFeePerGas: 20n,
        maxPriorityFeePerGas: 1n,
        status,
        attempts: 1,
        createdAt: 1_700_000_000_000,
    };
}

describe('journal', { timeout: SPAWN_VERDICT_TIMEOUT_MS }, () => {
    it('keeps the last 16 included entries and reloads under the size cap', async () => {
        const path = join(dir(), 'journal.json');
        const journal = new Journal(path, { chainId: 11155111, signer: SIGNER });
        await journal.init(0);
        for (let nonce = 0; nonce < 20; nonce++) {
            await journal.append(entry(nonce, 'signed'));
            await journal.updateInFlight({ status: 'included' });
        }
        const body = JSON.parse(readFileSync(path, 'utf8')) as { baseNonce: number; entries: { nonce: number }[] };
        expect(body.baseNonce).toBe(4);
        expect(body.entries.map((row) => row.nonce)).toEqual([4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
        expect(journal.nextNonce()).toBe(20);
        const again = new Journal(path, { chainId: 11155111, signer: SIGNER });
        expect(await again.load()).toBe('ok');
        expect(again.nextNonce()).toBe(20);

        const bulk = join(dir(), 'bulk.json');
        const many = new Journal(bulk, { chainId: 11155111, signer: SIGNER });
        await many.init(0);
        for (let nonce = 0; nonce < 2000; nonce++) {
            await many.append(entry(nonce, 'signed'));
            await many.updateInFlight({ status: 'included' });
        }
        expect(statSync(bulk).size).toBeLessThan(1_000_000);
        const reloaded = new Journal(bulk, { chainId: 11155111, signer: SIGNER });
        expect(await reloaded.load()).toBe('ok');
        expect(reloaded.nextNonce()).toBe(2000);
    });

    it('loads a journal written before cancel entries, and a cancel entry', async () => {
        const path = join(dir(), 'journal.json');
        const journal = new Journal(path, { chainId: 11155111, signer: SIGNER });
        await journal.init(4);
        await journal.append(entry(4, 'sent'));
        const old = JSON.parse(readFileSync(path, 'utf8')) as { entries: Record<string, unknown>[] };
        expect(old.entries[0]?.cancelled).toBeUndefined();
        expect(await new Journal(path, { chainId: 11155111, signer: SIGNER }).load()).toBe('ok');

        const raw = '0xabcd' as Hex;
        await journal.updateInFlight({
            raw,
            hash: keccak256(raw),
            kind: 'cancel',
            cancelled: true,
            status: 'sent',
        });
        const again = new Journal(path, { chainId: 11155111, signer: SIGNER });
        expect(await again.load()).toBe('ok');
        expect(again.inFlight()).toMatchObject({ kind: 'cancel', cancelled: true, nonce: 4 });

        const broken = JSON.parse(readFileSync(path, 'utf8')) as { entries: Record<string, unknown>[] };
        broken.entries[0]!.extra = true;
        const badPath = join(dir(), 'bad.json');
        writeFileSync(badPath, JSON.stringify(broken));
        expect(await new Journal(badPath, { chainId: 11155111, signer: SIGNER }).load()).toBe('corrupt');
    });

    it('refuses a journal bound to another signer and does not reuse the file', async () => {
        const path = join(dir(), 'journal.json');
        const journal = new Journal(path, { chainId: 11155111, signer: SIGNER });
        await journal.init(4);
        const before = readFileSync(path, 'utf8');
        const other = new Journal(path, { chainId: 11155111, signer: OTHER });
        expect(await other.load()).toBe('mismatch');
        expect(readFileSync(path, 'utf8')).toBe(before);
        const same = new Journal(path, { chainId: 11155111, signer: SIGNER });
        expect(await same.load()).toBe('ok');
    });

    it('creates a fresh journal directory before the lock and refuses a second chain signer', async () => {
        const root = dir();
        const path = join(root, 'fresh', 'nested', 'journal.json');
        const release = await acquireKeeperLock({ journalPath: path, chainId: 11155111, signer: SIGNER });
        expect(statSync(join(root, 'fresh')).mode & 0o777).toBe(0o700);
        expect(statSync(join(root, 'fresh')).uid).toBe(process.getuid?.());
        const otherPath = join(root, 'elsewhere', 'journal.json');
        await expect(acquireKeeperLock({ journalPath: otherPath, chainId: 11155111, signer: SIGNER })).rejects.toThrow('journal: lock held');
        await release();
        const again = await acquireKeeperLock({ journalPath: path, chainId: 11155111, signer: SIGNER });
        await again();

        const open = join(root, 'open');
        mkdirSync(open, { mode: 0o755 });
        chmodSync(open, 0o755);
        const kept = await acquireKeeperLock({ journalPath: join(open, 'journal.json'), chainId: 11155111, signer: OTHER });
        expect(statSync(open).mode & 0o777).toBe(0o755);
        await kept();
    });

    it('refuses resync when the nonce is unsettled or an entry is in flight, and realigns otherwise', async () => {
        const path = join(dir(), 'journal.json');
        const journal = new Journal(path, { chainId: 11155111, signer: SIGNER });
        expect(await resyncJournal(journal, 1n, 1n)).toEqual({ ok: false, reason: 'journal: resync refused missing' });
        await journal.init(4);
        await journal.append(entry(4, 'included'));
        const open = await resyncJournal(new Journal(path, { chainId: 11155111, signer: SIGNER }), 3n, 4n);
        expect(open).toEqual({ ok: false, reason: 'journal: resync refused unsettled nonce' });
        const flight = new Journal(path, { chainId: 11155111, signer: SIGNER });
        expect(await flight.load()).toBe('ok');
        await flight.append(entry(5, 'sent'));
        const busy = await resyncJournal(new Journal(path, { chainId: 11155111, signer: SIGNER }), 6n, 6n);
        expect(busy).toEqual({ ok: false, reason: 'journal: resync refused in-flight' });
        expect(readFileSync(path, 'utf8')).toContain('"status":"sent"');
        const clean = join(dir(), 'clean.json');
        const ready = new Journal(clean, { chainId: 11155111, signer: SIGNER });
        await ready.init(2);
        await ready.append(entry(2, 'included'));
        const done = await resyncJournal(new Journal(clean, { chainId: 11155111, signer: SIGNER }), 9n, 9n);
        expect(done).toEqual({ ok: true, from: 3, to: 9, dropped: 1 });
        const after = new Journal(clean, { chainId: 11155111, signer: SIGNER });
        expect(await after.load()).toBe('ok');
        expect(after.nextNonce()).toBe(9);
        expect(after.inFlight()).toBeNull();
    });

    it('does not chmod an existing directory and refuses a group-writable parent', async () => {
        const root = dir();
        const open = join(root, 'open');
        mkdirSync(open, { mode: 0o755 });
        chmodSync(open, 0o755);
        await atomicWriteFile(join(open, 'file.json'), '{"ok":true}\n');
        expect(statSync(open).mode & 0o777).toBe(0o755);

        const loose = join(root, 'loose');
        mkdirSync(loose, { mode: 0o775 });
        chmodSync(loose, 0o775);
        await expect(atomicWriteFile(join(loose, 'file.json'), '{}\n')).rejects.toThrow('journal: parent is group or world writable');
        expect(statSync(loose).mode & 0o777).toBe(0o775);

        const created = join(root, 'missing', 'nested', 'file.json');
        await atomicWriteFile(created, '{}\n');
        expect(statSync(join(root, 'missing')).mode & 0o777).toBe(0o700);
        expect(statSync(join(root, 'missing', 'nested')).mode & 0o777).toBe(0o700);
    });

    it('releases the lock when a keeper --once process exits, and after SIGKILL', async () => {
        const holder = '0x8888888888888888888888888888888888888888' as Address;
        const onceSigner = '0x9999999999999999999999999999999999999999' as Address;
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

        const { createServer } = await import('node:http');
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
                        number: '0x10',
                        hash: '0x' + 'ab'.repeat(32),
                        parentHash: '0x' + '22'.repeat(32),
                        timestamp: '0x1',
                        baseFeePerGas: '0x1',
                        gasLimit: '0x1c9c380',
                        gasUsed: '0x0',
                        transactions: [],
                        uncles: [],
                        logsBloom: '0x' + '00'.repeat(256),
                        miner: '0x' + '00'.repeat(20),
                        difficulty: '0x0',
                        extraData: '0x',
                        nonce: '0x0000000000000000',
                        mixHash: '0x' + '00'.repeat(32),
                        sha3Uncles: '0x' + '00'.repeat(32),
                        stateRoot: '0x' + '00'.repeat(32),
                        receiptsRoot: '0x' + '00'.repeat(32),
                        transactionsRoot: '0x' + '00'.repeat(32),
                        size: '0x0',
                        totalDifficulty: '0x0',
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
        chmodSync(ks, 0o700);
        const keystore = join(ks, 'keystore');
        const password = join(ks, 'password');
        writeFileSync(keystore, '{}\n');
        chmodSync(keystore, 0o600);
        writeFileSync(password, 'pw\n');
        chmodSync(password, 0o600);
        const keeper = join(process.cwd(), 'scripts/keeper.ts');
        const once = spawn(process.execPath, ['--import', pathToFileURL(tsx).href, keeper, '--network', 'sepolia', '--once', '--no-logo', '--no-superpaymaster', '--disable-paymaster', '--keystore', keystore, '--password-file', password, '--signer', onceSigner, '--journal', journalPath], {
            cwd: root,
            env: { PATH: process.env.PATH ?? '', HOME: root, RPC_URL: `http://127.0.0.1:${address.port}` },
        });
        let onceOut = '';
        once.stdout.on('data', (chunk) => { onceOut += chunk.toString(); });
        once.stderr.on('data', (chunk) => { onceOut += chunk.toString(); });
        const code = await new Promise<number | null>((resolve) => {
            const timer = setTimeout(() => { once.kill('SIGKILL'); resolve(null); }, 25_000);
            once.once('exit', (status) => { clearTimeout(timer); resolve(status); });
        });
        server.close();
        expect(code, onceOut).toBe(0);
        const released = await acquireKeeperLock({ journalPath, chainId: 11155111, signer: onceSigner });
        await released();
    });

    it('runs --resync-journal only when latest equals pending and nothing is in flight', async () => {
        const root = dir();
        const signer = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as Address;
        const journalPath = join(root, 'journal.json');
        const ready = new Journal(journalPath, { chainId: 11155111, signer });
        await ready.init(2);
        await ready.append(entry(2, 'included'));
        const tsx = join(process.cwd(), 'node_modules', 'tsx', 'dist', 'loader.mjs');
        const keeper = join(process.cwd(), 'scripts/keeper.ts');
        const { createServer } = await import('node:http');
        const serve = async (latest: string, pending: string) => {
            const server = createServer((req, res) => {
                let body = '';
                req.on('data', (chunk) => { body += chunk; });
                req.on('end', () => {
                    const parsed = JSON.parse(body) as { id: unknown; method: string; params?: unknown[] } | { id: unknown; method: string; params?: unknown[] }[];
                    const msgs = Array.isArray(parsed) ? parsed : [parsed];
                    const replies = msgs.map((msg) => {
                        let result = '0x0';
                        if (msg.method === 'eth_chainId') result = '0xaa36a7';
                        else if (msg.method === 'eth_getTransactionCount') result = msg.params?.[1] === 'pending' ? pending : latest;
                        return { jsonrpc: '2.0', id: msg.id, result };
                    });
                    res.end(JSON.stringify(Array.isArray(parsed) ? replies : replies[0]));
                });
            });
            await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
            const address = server.address();
            if (!address || typeof address === 'string') throw new Error('rpc listen failed');
            return { server, url: `http://127.0.0.1:${address.port}` };
        };
        const run = async (url: string) => {
            const child = spawn(process.execPath, ['--import', pathToFileURL(tsx).href, keeper, '--network', 'sepolia', '--no-logo', '--resync-journal', '--signer', signer, '--journal', journalPath], {
                cwd: root,
                env: { PATH: process.env.PATH ?? '', HOME: root, RPC_URL: url },
            });
            let out = '';
            child.stdout.on('data', (chunk) => { out += chunk.toString(); });
            child.stderr.on('data', (chunk) => { out += chunk.toString(); });
            const code = await new Promise<number | null>((resolve) => child.once('exit', resolve));
            return { code, out };
        };
        const badNonce = await serve('0x3', '0x4');
        const unsettled = await run(badNonce.url);
        badNonce.server.close();
        expect(unsettled.code, unsettled.out).toBe(1);
        expect(unsettled.out).toContain('journal: resync refused unsettled nonce');
        expect(unsettled.out).not.toContain('TICK');
        const flight = new Journal(journalPath, { chainId: 11155111, signer });
        expect(await flight.load()).toBe('ok');
        await flight.append(entry(3, 'sent'));
        const blockedRpc = await serve('0x4', '0x4');
        const blocked = await run(blockedRpc.url);
        blockedRpc.server.close();
        expect(blocked.code, blocked.out).toBe(1);
        expect(blocked.out).toContain('journal: resync refused in-flight');
        const clean = join(root, 'clean.json');
        const again = new Journal(clean, { chainId: 11155111, signer });
        await again.init(2);
        await again.append(entry(2, 'included'));
        const okRpc = await serve('0x9', '0x9');
        const child = spawn(process.execPath, ['--import', pathToFileURL(tsx).href, keeper, '--network', 'sepolia', '--no-logo', '--resync-journal', '--signer', signer, '--journal', clean], {
            cwd: root,
            env: { PATH: process.env.PATH ?? '', HOME: root, RPC_URL: okRpc.url },
        });
        let out = '';
        child.stdout.on('data', (chunk) => { out += chunk.toString(); });
        child.stderr.on('data', (chunk) => { out += chunk.toString(); });
        const code = await new Promise<number | null>((resolve) => child.once('exit', resolve));
        okRpc.server.close();
        expect(code, out).toBe(0);
        expect(out).toContain('journal resynced base 3 -> 9 dropped 1');
        expect(out).not.toContain('TICK');
        const after = new Journal(clean, { chainId: 11155111, signer });
        expect(await after.load()).toBe('ok');
        expect(after.nextNonce()).toBe(9);
    });
});
