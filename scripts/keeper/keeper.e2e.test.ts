/**
 * End-to-end: the REAL scripts/keeper.ts main loop, in --dry-run, against a fake JSON-RPC server.
 * PaymasterV4 is resolved once at startup. A boot failure leaves V4 disabled for the process.
 * A resolved V4 is still refreshed when a SuperPaymaster read fails.
 *
 * Isolation: the child runs in an empty temp dir with TELEGRAM_* and key variables set to empty
 * strings (dotenv never overrides an existing variable), so no .env file, real key or Telegram bot
 * is reachable. Nothing is signed or sent: --dry-run, and the only RPC is the local fake.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { AddressInfo } from 'node:net';
import { encodeFunctionResult, getAddress, parseAbi, toFunctionSelector } from 'viem';

const KEEPER = join(process.cwd(), 'scripts/keeper.ts');
// The keeper runs IN this node process via the repo's pinned tsx loader — not through the tsx
// CLI (which forks a second node that a SIGKILL on the launcher would orphan), and never via npx
// (which could download an unpinned tsx or prompt). Missing loader = fail, not fall back.
const TSX_LOADER = join(process.cwd(), 'node_modules', 'tsx', 'dist', 'loader.mjs');
if (!existsSync(TSX_LOADER)) throw new Error(`keeper e2e: pinned tsx loader not installed at ${TSX_LOADER}`);

const SP = '0x09df0d2e3722ec0e401fe3819e64278a42ae4de9';
const V4 = '0x2118e9a404c15f70b1d4f53b400c8a566a5ea4b6';
const FEED = '0x694aa1769357215de4fac081bf1f309adc325306';
const REGISTRY = getAddress('0xf5Bf37ca83AfdAab73691bA7eCcDfA69b8708E71');
const SIGNER = getAddress('0x1111111111111111111111111111111111111111');
const OWNER = getAddress('0x9999999999999999999999999999999999999999');
const OWNER_SEL = toFunctionSelector('function owner()');

const abi = parseAbi([
    'function latestRoundData() view returns (uint80, int256, uint256, uint256, uint80)',
    'function decimals() view returns (uint8)',
    'function priceStalenessThreshold() view returns (uint256)',
    'function ethUsdPriceFeed() view returns (address)',
]);
const spCache = parseAbi(['function cachedPrice() view returns (int256, uint256, uint80, uint8)']);
const v4Cache = parseAbi(['function cachedPrice() view returns (uint208, uint48)']);
const sel = (sig: string) => toFunctionSelector(sig);

type Fake = { server: Server; url: string; methods: string[]; calls: { to: string; data: string }[]; codeCalls: () => number };

/** `codeFails` makes getCode(V4) fail. Startup is the only resolution, so later ticks must not retry it. */
async function fakeRpc(opts: { spBroken?: boolean; balanceWei?: bigint; balanceFails?: boolean; spOwner?: string; registryOwner?: string; codeFails?: boolean } = {}): Promise<Fake> {
    const methods: string[] = [];
    const calls: { to: string; data: string }[] = [];
    let codeCalls = 0;
    const spOwner = opts.spOwner ?? OWNER;
    const registryOwner = opts.registryOwner ?? OWNER;
    const now = () => BigInt(Math.floor(Date.now() / 1000));
    const answer = (method: string, params: any[]): { result?: unknown; error?: { code: number; message: string } } => {
        switch (method) {
            case 'eth_chainId': return { result: '0xaa36a7' };
            case 'eth_blockNumber': return { result: '0x100' };
            case 'eth_getBlockByNumber':
                return { result: { number: '0x100', hash: '0x' + '11'.repeat(32), parentHash: '0x' + '22'.repeat(32), timestamp: '0x' + now().toString(16), baseFeePerGas: '0x3b9aca00', gasLimit: '0x1c9c380', gasUsed: '0x0', transactions: [], uncles: [], logsBloom: '0x' + '00'.repeat(256), miner: '0x' + '00'.repeat(20), difficulty: '0x0', extraData: '0x', nonce: '0x0000000000000000', mixHash: '0x' + '00'.repeat(32), sha3Uncles: '0x' + '00'.repeat(32), stateRoot: '0x' + '00'.repeat(32), receiptsRoot: '0x' + '00'.repeat(32), transactionsRoot: '0x' + '00'.repeat(32), size: '0x0', totalDifficulty: '0x0' } };
            case 'eth_getCode': {
                if (String(params[0]).toLowerCase() !== V4) return { result: '0x6080' };
                codeCalls++;
                if (opts.codeFails) return { error: { code: -32000, message: 'header not found' } };
                return { result: '0x6080' };
            }
            case 'eth_getBalance': {
                if (opts.balanceFails) return { error: { code: -32000, message: 'fake: balance unavailable' } };
                const wei = opts.balanceWei ?? 10n ** 18n;
                return { result: '0x' + wei.toString(16) };
            }
            case 'eth_call': {
                const to = String(params[0].to).toLowerCase();
                const data = String(params[0].data ?? params[0].input).slice(0, 10);
                calls.push({ to, data });
                if (data === OWNER_SEL && to === SP) return { result: encodeFunctionResult({ abi: parseAbi(['function owner() view returns (address)']), functionName: 'owner', result: getAddress(spOwner) }) };
                if (data === OWNER_SEL && to === REGISTRY.toLowerCase()) return { result: encodeFunctionResult({ abi: parseAbi(['function owner() view returns (address)']), functionName: 'owner', result: getAddress(registryOwner) }) };
                if (data === OWNER_SEL) return { result: encodeFunctionResult({ abi: parseAbi(['function owner() view returns (address)']), functionName: 'owner', result: OWNER }) };
                if (data === sel('function latestRoundData()')) return { result: encodeFunctionResult({ abi, functionName: 'latestRoundData', result: [1n, 3000n * 10n ** 8n, now(), now(), 1n] }) };
                if (data === sel('function decimals()')) return { result: encodeFunctionResult({ abi, functionName: 'decimals', result: 8 }) };
                if (data === sel('function priceStalenessThreshold()')) return { result: encodeFunctionResult({ abi, functionName: 'priceStalenessThreshold', result: 3600n }) };
                if (data === sel('function ethUsdPriceFeed()')) return { result: encodeFunctionResult({ abi, functionName: 'ethUsdPriceFeed', result: FEED }) };
                if (to === SP && opts.spBroken) return { error: { code: -32000, message: 'fake: SuperPaymaster read failing' } };
                if (data === sel('function cachedPrice()') && to === SP) return { result: encodeFunctionResult({ abi: spCache, functionName: 'cachedPrice', result: [3000n * 10n ** 8n, now(), 1n, 8] }) };
                // V4 cache never written → the keeper must decide to update it.
                if (data === sel('function cachedPrice()') && to === V4) return { result: encodeFunctionResult({ abi: v4Cache, functionName: 'cachedPrice', result: [0n, 0] }) };
                return { error: { code: 3, message: `fake: unexpected eth_call ${to} ${data}` } };
            }
            default: return { error: { code: -32601, message: `fake: unexpected ${method}` } };
        }
    };
    const server = createServer((req, res) => {
        let body = '';
        req.on('data', (c) => (body += c));
        req.on('end', () => {
            const msg = JSON.parse(body);
            const one = (m: any) => { methods.push(m.method); return { jsonrpc: '2.0', id: m.id, ...answer(m.method, m.params ?? []) }; };
            res.setHeader('content-type', 'application/json');
            res.end(JSON.stringify(Array.isArray(msg) ? msg.map(one) : one(msg)));
        });
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    return { server, url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, methods, calls, codeCalls: () => codeCalls };
}

const cleanups: (() => Promise<void> | void)[] = [];
afterEach(async () => {
    for (const c of cleanups.splice(0).reverse()) await c();
}, 30_000);

function closeServer(server: Server): Promise<void> {
    return new Promise((r) => { server.closeAllConnections?.(); server.close(() => r()); });
}

/**
 * Run the keeper until `done(output)` or the timeout. Resolves only after the process has exited
 * AND its pipes have closed, so nothing outlives the test.
 */
async function runKeeper(rpc: string, extraArgs: string[], done: (out: string) => boolean, timeoutMs = 40_000): Promise<string> {
    const cwd = mkdtempSync(join(tmpdir(), 'keeper-e2e-'));
    cleanups.push(() => rmSync(cwd, { recursive: true, force: true }));
    const child: ChildProcess = spawn(
        process.execPath,
        ['--import', pathToFileURL(TSX_LOADER).href, KEEPER, '--network', 'sepolia', '--dry-run', '--no-logo', '--poll-interval', '1',
            '--superpaymaster', SP, '--paymaster', V4, ...extraArgs],
        {
            cwd,
            env: {
                PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '', RPC_URL: rpc,
                TELEGRAM_BOT_TOKEN: '', TELEGRAM_CHAT_ID: '',
            },
            stdio: ['ignore', 'pipe', 'pipe'],
        },
    );
    let out = '';
    let killed = false;
    const kill = () => { if (!killed && child.exitCode === null && child.signalCode === null) { killed = true; child.kill('SIGKILL'); } };
    // 'close' fires after exit AND after stdout/stderr are drained and closed.
    const closed = new Promise<void>((r) => { child.once('close', () => r()); child.once('error', (e) => { out += `\n[spawn error] ${e.message}`; r(); }); });
    cleanups.push(async () => { kill(); await closed; });
    const timer = setTimeout(kill, timeoutMs);
    const onData = (d: Buffer) => { out += d.toString(); if (done(out)) kill(); };
    child.stdout!.on('data', onData);
    child.stderr!.on('data', onData);
    await closed;
    clearTimeout(timer);
    return out;
}

// runKeeper spawns keeper.ts and kills it at 40s. The cases already budget 60s for the process
// to exit and for the pipes to drain; a per-test timeout overrides this default.
const SPAWN_VERDICT_TIMEOUT_MS = 60_000;

describe('keeper.ts main loop: configured V4 is guarded at startup', { timeout: SPAWN_VERDICT_TIMEOUT_MS }, () => {
    it('unreadable PaymasterV4 bytecode refuses start and does not print the rpc error', async () => {
        const fake = await fakeRpc({ codeFails: true });
        cleanups.push(() => closeServer(fake.server));
        const out = await runKeeper(fake.url, [], (o) => o.includes('keeper: paymaster bytecode unreadable'));
        expect(out).toContain('keeper: paymaster bytecode unreadable');
        expect(out).not.toContain('header not found');
        expect(out).not.toContain('getBytecode');
        expect(out).not.toMatch(/TICK #1/);
        expect(fake.codeCalls()).toBe(1);
    }, 60_000);

    it('a resolved PaymasterV4 still updates on tick 1 when SuperPaymaster reads fail', async () => {
        const fake = await fakeRpc({ spBroken: true });
        cleanups.push(() => closeServer(fake.server));
        const updateLine = `action=sendtx kind=paymaster method=updateprice() target=${V4}`;
        const out = await runKeeper(fake.url, [], (o) => o.toLowerCase().includes(updateLine));
        expect(out).toMatch(/keeper: superpaymaster read failed/);
        expect(out).not.toContain('fake: SuperPaymaster read failing');
        expect(out.toLowerCase()).toMatch(new RegExp(`tick #1[\\s\\S]*action=sendtx kind=paymaster method=updateprice\\(\\) target=${V4.toLowerCase()}`));
    }, 60_000);

    it('--disable-paymaster still reads the configured V4 and sends no V4 update', async () => {
        const fake = await fakeRpc();
        cleanups.push(() => closeServer(fake.server));
        const out = await runKeeper(fake.url, ['--disable-paymaster'], (o) => /TICK #2/.test(o));
        expect(out).toMatch(/paymaster=disabled/);
        expect(fake.codeCalls()).toBeGreaterThanOrEqual(1);
        expect(out).not.toMatch(/kind=paymaster/);
    }, 60_000);

    it('dry-run against 5.4.2 owner() reads runs the price path for a non-privileged signer', async () => {
        const fake = await fakeRpc();
        cleanups.push(() => closeServer(fake.server));
        const updateLine = `action=sendTx kind=paymaster method=updatePrice() target=${V4}`;
        const out = await runKeeper(fake.url, ['--signer', SIGNER, '--registry', REGISTRY], (o) => o.toLowerCase().includes(updateLine.toLowerCase()));
        expect(out).toContain('signer-identity=ok');
        expect(out.toLowerCase()).toContain(updateLine.toLowerCase());
        expect(fake.calls.some((c) => c.to === SP && c.data === OWNER_SEL)).toBe(true);
        expect(fake.calls.some((c) => c.to === REGISTRY.toLowerCase() && c.data === OWNER_SEL)).toBe(true);
        expect(out).not.toContain('signer identity refused');
    }, 60_000);

    it('dry-run alerts a low signer balance once across two ticks', async () => {
        const fake = await fakeRpc({ balanceWei: 1n });
        cleanups.push(() => closeServer(fake.server));
        const out = await runKeeper(fake.url, ['--signer', SIGNER, '--registry', REGISTRY], (o) => /TICK #2/.test(o));
        expect(out).toContain('signer-identity=ok');
        expect(out.split('low signer balance').length - 1).toBe(1);
        expect(out).toContain('balanceWei=1');
    }, 60_000);

    it('dry-run alerts a failed balance read', async () => {
        const fake = await fakeRpc({ balanceFails: true });
        cleanups.push(() => closeServer(fake.server));
        const out = await runKeeper(fake.url, ['--signer', SIGNER, '--registry', REGISTRY, '--once'], (o) => o.includes('balance read failed') || /TICK #2/.test(o));
        expect(out).toContain('balance read failed');
        expect(out).not.toContain('low signer balance');
    }, 60_000);
});
