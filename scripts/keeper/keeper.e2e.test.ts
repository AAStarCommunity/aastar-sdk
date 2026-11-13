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
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { AddressInfo } from 'node:net';
import { encodeEventTopics, encodeFunctionResult, getAddress, keccak256, pad, parseAbi, toFunctionSelector, type Hex } from 'viem';
import { REGISTRY_PAUSE_ABI, SUPER_PAYMASTER_PAUSE_ABI } from './spPausePin';

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

/** getCode(V4) fails until the first eth_getBlockByNumber — i.e. through INIT and tick 1's resolution. */
async function fakeRpc(opts: { spBroken?: boolean; balanceWei?: bigint; balanceFails?: boolean; spOwner?: string; registryOwner?: string } = {}): Promise<Fake> {
    const methods: string[] = [];
    const calls: { to: string; data: string }[] = [];
    let blockSeen = false;
    let codeCalls = 0;
    const spOwner = opts.spOwner ?? OWNER;
    const registryOwner = opts.registryOwner ?? OWNER;
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
                TELEGRAM_BOT_TOKEN: '', TELEGRAM_CHAT_ID: '', KEEPER_PRIVATE_KEY: '', PRIVATE_KEY_SUPPLIER: '', PRIVATE_KEY: '',
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

describe('keeper.ts main loop: a boot-time V4 failure is retried and V4 is refreshed', { timeout: SPAWN_VERDICT_TIMEOUT_MS }, () => {
    it('getCode(V4) fails at INIT and tick 1, succeeds at tick 2 → tick 2 sends V4 updatePrice (dry-run)', async () => {
        const fake = await fakeRpc();
        cleanups.push(() => closeServer(fake.server));
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
        cleanups.push(() => closeServer(fake.server));
        const out = await runKeeper(fake.url, [], (o) => new RegExp(`paymaster resolved=${V4}`, 'i').test(o) || /TICK #4/.test(o));
        expect(out).toMatch(/SuperPaymaster read failing/);
        expect(out.toLowerCase()).toMatch(new RegExp(`tick #2[\\s\\S]*paymaster resolved=${V4}`));
    }, 60_000);

    it('--disable-paymaster: V4 is never resolved', async () => {
        const fake = await fakeRpc();
        cleanups.push(() => closeServer(fake.server));
        const out = await runKeeper(fake.url, ['--disable-paymaster'], (o) => /TICK #2/.test(o));
        expect(out).toMatch(/paymaster=disabled/);
        expect(fake.codeCalls()).toBe(0);
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

    it('dry-run with --pause-config logs the pause it would send', async () => {
        const code = '0x6080' as Hex;
        const impl = getAddress('0x0000000000000000000000000000000000000a11');
        const registry = getAddress('0x0000000000000000000000000000000000000b22');
        const operator = getAddress('0x0000000000000000000000000000000000000c33');
        const codeHash = keccak256(code);
        const topic0 = encodeEventTopics({ abi: SUPER_PAYMASTER_PAUSE_ABI, eventName: 'OperatorConfigured' })[0];
        const pauseDir = mkdtempSync(join(tmpdir(), 'keeper-pause-cfg-'));
        cleanups.push(() => rmSync(pauseDir, { recursive: true, force: true }));
        const pausePath = join(pauseDir, 'pause.json');
        const journalPath = join(pauseDir, 'journal.json');
        writeFileSync(pausePath, JSON.stringify({
            superPaymaster: getAddress(SP),
            registry,
            startBlock: 1,
            registryStartBlock: 1,
            implementation: impl,
            implementationCodeHash: codeHash,
            proxyCodeHash: codeHash,
            spRelease: 'v5.5.0-rc.8',
        }));
        const registrySel = toFunctionSelector('function REGISTRY()');
        const operatorsSel = toFunctionSelector('function operators(address)');
        const hasRoleSel = toFunctionSelector('function hasRole(bytes32,address)');
        const roleSel = toFunctionSelector('function getRoleConfig(bytes32)');
        const stakeSel = toFunctionSelector('function getEffectiveStake(address,bytes32)');
        const methods: string[] = [];
        const server = createServer((req, res) => {
            let body = '';
            req.on('data', (c) => (body += c));
            req.on('end', () => {
                const msg = JSON.parse(body);
                const now = BigInt(Math.floor(Date.now() / 1000));
                const one = (m: { id: unknown; method: string; params?: unknown[] }) => {
                    methods.push(m.method);
                    const params = m.params ?? [];
                    if (m.method === 'eth_chainId') return { jsonrpc: '2.0', id: m.id, result: '0xaa36a7' };
                    if (m.method === 'eth_blockNumber') return { jsonrpc: '2.0', id: m.id, result: '0x100' };
                    if (m.method === 'eth_getBlockByNumber') {
                        return { jsonrpc: '2.0', id: m.id, result: { number: '0x100', hash: '0x' + '11'.repeat(32), parentHash: '0x' + '22'.repeat(32), timestamp: '0x' + now.toString(16), baseFeePerGas: '0x3b9aca00', gasLimit: '0x1c9c380', gasUsed: '0x0', transactions: [], uncles: [], logsBloom: '0x' + '00'.repeat(256), miner: '0x' + '00'.repeat(20), difficulty: '0x0', extraData: '0x', nonce: '0x0000000000000000', mixHash: '0x' + '00'.repeat(32), sha3Uncles: '0x' + '00'.repeat(32), stateRoot: '0x' + '00'.repeat(32), receiptsRoot: '0x' + '00'.repeat(32), transactionsRoot: '0x' + '00'.repeat(32), size: '0x0', totalDifficulty: '0x0' } };
                    }
                    if (m.method === 'eth_getCode') return { jsonrpc: '2.0', id: m.id, result: code };
                    if (m.method === 'eth_getStorageAt') return { jsonrpc: '2.0', id: m.id, result: pad(impl, { size: 32 }) };
                    if (m.method === 'eth_getLogs') {
                        return { jsonrpc: '2.0', id: m.id, result: [{ address: getAddress(SP), topics: [topic0, pad(operator, { size: 32 })], blockNumber: '0x10', removed: false }] };
                    }
                    if (m.method === 'eth_call') {
                        const tx = params[0] as { to?: string; data?: string };
                        const data = String(tx.data ?? '').slice(0, 10).toLowerCase();
                        const to = String(tx.to ?? '').toLowerCase();
                        let result = '0x' + '00'.repeat(32);
                        if (data === registrySel) result = encodeFunctionResult({ abi: SUPER_PAYMASTER_PAUSE_ABI, functionName: 'REGISTRY', result: registry });
                        else if (data === operatorsSel) result = encodeFunctionResult({ abi: SUPER_PAYMASTER_PAUSE_ABI, functionName: 'operators', result: [0n, true, false, operator, 0, 0, operator, 0n, 0n] });
                        else if (data === hasRoleSel) result = encodeFunctionResult({ abi: REGISTRY_PAUSE_ABI, functionName: 'hasRole', result: false });
                        else if (data === roleSel) result = encodeFunctionResult({ abi: REGISTRY_PAUSE_ABI, functionName: 'getRoleConfig', result: { minStake: 1000n, ticketPrice: 0n, slashThreshold: 0, slashBase: 0, slashInc: 0, slashMax: 0, exitFeePercent: 0, isActive: true, minExitFee: 0n, description: 'role', owner: operator, roleLockDuration: 0n } });
                        else if (data === stakeSel) result = encodeFunctionResult({ abi: REGISTRY_PAUSE_ABI, functionName: 'getEffectiveStake', result: 1n });
                        else if (data === sel('function latestRoundData()')) result = encodeFunctionResult({ abi, functionName: 'latestRoundData', result: [1n, 3000n * 10n ** 8n, now, now, 1n] });
                        else if (data === sel('function decimals()')) result = encodeFunctionResult({ abi, functionName: 'decimals', result: 8 });
                        else if (data === sel('function priceStalenessThreshold()')) result = encodeFunctionResult({ abi, functionName: 'priceStalenessThreshold', result: 3600n });
                        else if (data === sel('function ethUsdPriceFeed()')) result = encodeFunctionResult({ abi, functionName: 'ethUsdPriceFeed', result: FEED });
                        else if (data === sel('function cachedPrice()') && to === SP) result = encodeFunctionResult({ abi: spCache, functionName: 'cachedPrice', result: [3000n * 10n ** 8n, now, 1n, 8] });
                        else if (data === sel('function cachedPrice()') && to === V4) result = encodeFunctionResult({ abi: v4Cache, functionName: 'cachedPrice', result: [0n, 0] });
                        return { jsonrpc: '2.0', id: m.id, result };
                    }
                    return { jsonrpc: '2.0', id: m.id, error: { code: -32601, message: `fake: unexpected ${m.method}` } };
                };
                res.setHeader('content-type', 'application/json');
                res.end(JSON.stringify(Array.isArray(msg) ? msg.map(one) : one(msg)));
            });
        });
        await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
        cleanups.push(() => closeServer(server));
        const rpc = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
        const would = `action=sendTx kind=pause method=pauseUnderstakedOperator(address) target=${getAddress(SP)} operator=${operator} (dry-run)`;
        const out = await runKeeper(rpc, ['--once', '--pause-config', pausePath, '--pause-offset-sec', '86400', '--journal', journalPath], (o) => o.includes('pause-round=ok') || o.includes('pause-round=FAILED'));
        expect(out).toContain(would);
        expect(out).toContain('pause-round=ok');
        expect(out).not.toMatch(/nothing understaked/);
        expect(methods).toContain('eth_getLogs');
        expect(existsSync(`${journalPath}.pause-state.json`)).toBe(false);
    }, 60_000);
});
