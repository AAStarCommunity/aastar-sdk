/**
 * End-to-end: the REAL scripts/keeper.ts main loop, in --dry-run, against a fake JSON-RPC server.
 * The unit tests prove the resolver; this proves keeper.ts actually calls it every tick, ahead of
 * the SuperPaymaster reads, and then refreshes V4 — removing that wiring turns this red.
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
import type { AddressInfo } from 'node:net';
import { encodeFunctionResult, parseAbi, toFunctionSelector } from 'viem';

const KEEPER = join(process.cwd(), 'scripts/keeper.ts');
const TSX_BIN = join(process.cwd(), 'node_modules', '.bin', 'tsx');
const [LAUNCHER, LAUNCH_ARGS] = existsSync(TSX_BIN) ? [TSX_BIN, [] as string[]] : ['npx', ['tsx']];

const SP = '0x09df0d2e3722ec0e401fe3819e64278a42ae4de9';
const V4 = '0x2118e9a404c15f70b1d4f53b400c8a566a5ea4b6';
const FEED = '0x694aa1769357215de4fac081bf1f309adc325306';

const abi = parseAbi([
    'function latestRoundData() view returns (uint80, int256, uint256, uint256, uint80)',
    'function decimals() view returns (uint8)',
    'function priceStalenessThreshold() view returns (uint256)',
    'function ethUsdPriceFeed() view returns (address)',
]);
const spCache = parseAbi(['function cachedPrice() view returns (int256, uint256, uint80, uint8)']);
const v4Cache = parseAbi(['function cachedPrice() view returns (uint208, uint48)']);
const sel = (sig: string) => toFunctionSelector(sig);

type Fake = { server: Server; url: string; methods: string[]; codeCalls: () => number };

/** getCode(V4) fails until the first eth_getBlockByNumber — i.e. through INIT and tick 1's resolution. */
async function fakeRpc(opts: { spBroken?: boolean } = {}): Promise<Fake> {
    const methods: string[] = [];
    let blockSeen = false;
    let codeCalls = 0;
    const now = () => BigInt(Math.floor(Date.now() / 1000));
    const answer = (method: string, params: any[]): { result?: unknown; error?: { code: number; message: string } } => {
        switch (method) {
            case 'eth_chainId': return { result: '0xaa36a7' };
            case 'eth_blockNumber': return { result: '0x100' };
            case 'eth_getBlockByNumber':
                blockSeen = true;
                return { result: { number: '0x100', hash: '0x' + '11'.repeat(32), parentHash: '0x' + '22'.repeat(32), timestamp: '0x' + now().toString(16), baseFeePerGas: '0x3b9aca00', gasLimit: '0x1c9c380', gasUsed: '0x0', transactions: [], uncles: [], logsBloom: '0x' + '00'.repeat(256), miner: '0x' + '00'.repeat(20), difficulty: '0x0', extraData: '0x', nonce: '0x0000000000000000', mixHash: '0x' + '00'.repeat(32), sha3Uncles: '0x' + '00'.repeat(32), stateRoot: '0x' + '00'.repeat(32), receiptsRoot: '0x' + '00'.repeat(32), transactionsRoot: '0x' + '00'.repeat(32), size: '0x0', totalDifficulty: '0x0' } };
            case 'eth_getCode': {
                if (String(params[0]).toLowerCase() !== V4) return { result: '0x6080' };
                codeCalls++;
                return blockSeen ? { result: '0x6080' } : { error: { code: -32000, message: 'header not found' } };
            }
            case 'eth_call': {
                const to = String(params[0].to).toLowerCase();
                const data = String(params[0].data ?? params[0].input).slice(0, 10);
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
    return { server, url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, methods, codeCalls: () => codeCalls };
}

const cleanups: (() => void)[] = [];
afterEach(() => { for (const c of cleanups.splice(0)) c(); });

/** Run the keeper until `done(stdout)` or the timeout; returns everything it printed. */
async function runKeeper(rpc: string, extraArgs: string[], done: (out: string) => boolean, timeoutMs = 40_000): Promise<string> {
    const cwd = mkdtempSync(join(tmpdir(), 'keeper-e2e-'));
    cleanups.push(() => rmSync(cwd, { recursive: true, force: true }));
    const child: ChildProcess = spawn(
        LAUNCHER,
        [...LAUNCH_ARGS, KEEPER, '--network', 'sepolia', '--dry-run', '--no-logo', '--poll-interval', '1',
            '--superpaymaster', SP, '--paymaster', V4, ...extraArgs],
        {
            cwd,
            env: {
                PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '', RPC_URL: rpc,
                TELEGRAM_BOT_TOKEN: '', TELEGRAM_CHAT_ID: '', KEEPER_PRIVATE_KEY: '', PRIVATE_KEY_SUPPLIER: '', PRIVATE_KEY: '',
            },
            stdio: ['ignore', 'pipe', 'pipe'],
        },
    );
    cleanups.push(() => child.kill('SIGKILL'));
    let out = '';
    return await new Promise<string>((resolve) => {
        const finish = () => { clearTimeout(timer); child.kill('SIGKILL'); resolve(out); };
        const timer = setTimeout(finish, timeoutMs);
        const onData = (d: Buffer) => { out += d.toString(); if (done(out)) finish(); };
        child.stdout!.on('data', onData);
        child.stderr!.on('data', onData);
        child.on('exit', finish);
    });
}

describe('keeper.ts main loop: a boot-time V4 failure is retried and V4 is refreshed', () => {
    it('getCode(V4) fails at INIT and tick 1, succeeds at tick 2 → tick 2 sends V4 updatePrice (dry-run)', async () => {
        const fake = await fakeRpc();
        cleanups.push(() => fake.server.close());
        const updateLine = `action=sendTx kind=paymaster method=updatePrice() target=${V4}`;
        const out = await runKeeper(fake.url, [], (o) => o.toLowerCase().includes(updateLine.toLowerCase()));
        const lower = out.toLowerCase();

        expect(lower).toMatch(/paymaster=not-found \(transient error=getbytecode/);
        expect(lower).toMatch(/tick #1[\s\S]*paymaster decision=skip reason=not-found transient/);
        expect(lower).toMatch(new RegExp(`tick #2[\\s\\S]*paymaster resolved=${V4}`));
        expect(lower).toContain(updateLine.toLowerCase());
        expect(fake.codeCalls()).toBeGreaterThanOrEqual(3); // INIT, tick 1, tick 2
    }, 60_000);

    it('a persistently failing SuperPaymaster read does not stop V4 from being resolved', async () => {
        // Codex review: resolution used to sit after the SP reads, so an SP failure skipped it.
        const fake = await fakeRpc({ spBroken: true });
        cleanups.push(() => fake.server.close());
        const out = await runKeeper(fake.url, [], (o) => new RegExp(`paymaster resolved=${V4}`, 'i').test(o) || /TICK #4/.test(o));
        expect(out).toMatch(/SuperPaymaster read failing/);
        expect(out.toLowerCase()).toMatch(new RegExp(`tick #2[\\s\\S]*paymaster resolved=${V4}`));
    }, 60_000);

    it('--disable-paymaster: V4 is never resolved', async () => {
        const fake = await fakeRpc();
        cleanups.push(() => fake.server.close());
        const out = await runKeeper(fake.url, ['--disable-paymaster'], (o) => /TICK #2/.test(o));
        expect(out).toMatch(/paymaster=disabled/);
        expect(fake.codeCalls()).toBe(0);
        expect(out).not.toMatch(/kind=paymaster/);
    }, 60_000);
});
