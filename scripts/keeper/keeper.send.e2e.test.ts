/**
 * The REAL scripts/keeper.ts, live (no --dry-run), against a fake JSON-RPC chain on 127.0.0.1. It pins the send
 * boundary (FU-112 ③) for the Daybreak 6c240b42 round-1 fixes:
 * - privateKey mode: the raw transaction the keeper broadcasts is decoded (chain id, target, max fee per gas);
 *   a reverted receipt is a failure; SuperPaymaster failing does not stop PaymasterV4; a wrong chain refuses.
 * - cast mode: a fake `cast` first on PATH records its argv, its environment and its pid. The keeper needs a
 *   terminal for the keystore password, so it runs under a pty (python3's pty module) and the test types it.
 * - The Mini's current start-up form (DSR 2026-11-17) still starts.
 *
 * Isolation: each child runs in an empty temp dir (no .env file is reachable) with HOME pointed there, no Telegram
 * variables, and anvil's public test key #0. The only RPC is the local fake; privateKey runs also load the
 * no-egress preload. Nothing reaches a real chain.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { AddressInfo } from 'node:net';
import { encodeFunctionResult, keccak256, parseAbi, parseTransaction, recoverTransactionAddress, toFunctionSelector, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const KEEPER = join(process.cwd(), 'scripts/keeper.ts');
const TSX_LOADER = join(process.cwd(), 'node_modules', 'tsx', 'dist', 'loader.mjs');
if (!existsSync(TSX_LOADER)) throw new Error(`keeper send e2e: pinned tsx loader not installed at ${TSX_LOADER}`);
const PRELOAD = join(process.cwd(), 'scripts/keeper/no-egress.preload.mjs');

const KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'; // anvil #0, public
const KEY_ADDR = privateKeyToAccount(KEY).address;
// anvil #1 / #2, public: decoys for the deployer variables the keeper must not sign with.
const DECOY_ENV = {
    PRIVATE_KEY: '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
    PRIVATE_KEY_SUPPLIER: '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a',
};
const signerOf = (raw: Hex) => recoverTransactionAddress({ serializedTransaction: raw as any });
const SEPOLIA = 11155111;
const SP = '0x09df0d2e3722ec0e401fe3819e64278a42ae4de9';
const V4 = '0x2118e9a404c15f70b1d4f53b400c8a566a5ea4b6';
const FEED = '0x694aa1769357215de4fac081bf1f309adc325306';
const CAST_TX = `0x${'ab'.repeat(32)}`;

const abi = parseAbi([
    'function latestRoundData() view returns (uint80, int256, uint256, uint256, uint80)',
    'function decimals() view returns (uint8)',
    'function priceStalenessThreshold() view returns (uint256)',
    'function ethUsdPriceFeed() view returns (address)',
]);
const spCache = parseAbi(['function cachedPrice() view returns (int256, uint256, uint80, uint8)']);
const v4Cache = parseAbi(['function cachedPrice() view returns (uint208, uint48)']);
const sel = (sig: string) => toFunctionSelector(sig);
const UPDATE_PRICE = sel('function updatePrice()');

type ChainOpts = {
    /** chain id answered on the n-th eth_chainId call (0-based). */
    chainId?: (n: number) => number;
    spUpdatedAt?: 'empty' | 'fresh' | 'broken';
    v4UpdatedAt?: 'empty' | 'fresh';
    receiptStatus?: '0x1' | '0x0';
    /** Transactions are accepted but never mined (no receipt, ever). */
    neverMined?: boolean;
    /** eth_chainId answers an error. */
    chainIdError?: boolean;
    /** decimals() on the price feed fails. */
    decimalsBroken?: boolean;
    /** Called when a raw transaction arrives; the node answers it only after the returned delay (ms). */
    onSend?: () => number;
    /** Called on eth_estimateGas; the node answers only after the returned delay (ms). */
    onEstimate?: () => number;
};
type Chain = { url: string; raw: Hex[]; methods: string[]; close: () => Promise<void> };

async function fakeChain(o: ChainOpts = {}): Promise<Chain> {
    const raw: Hex[] = [];
    const methods: string[] = [];
    const hashes = new Set<string>([CAST_TX]);
    let chainIdCalls = 0;
    let block = 0x100;
    const now = () => BigInt(Math.floor(Date.now() / 1000));
    const cacheAt = (s: 'empty' | 'fresh') => (s === 'empty' ? 0n : now());
    const answer = (method: string, params: any[]): { result?: unknown; error?: { code: number; message: string } } => {
        switch (method) {
            // The error text echoes the RPC key outside URL syntax, as some providers do (Codex F6).
            case 'eth_chainId': if (o.chainIdError) return { error: { code: -32000, message: 'fake: invalid API key SECRETRPCKEY' } }; return { result: `0x${(o.chainId ?? (() => SEPOLIA))(chainIdCalls++).toString(16)}` };
            case 'eth_blockNumber': return { result: `0x${(block++).toString(16)}` };
            case 'eth_getBlockByNumber':
                return { result: { number: `0x${block.toString(16)}`, hash: '0x' + '11'.repeat(32), parentHash: '0x' + '22'.repeat(32), timestamp: '0x' + now().toString(16), baseFeePerGas: '0x3b9aca00', gasLimit: '0x1c9c380', gasUsed: '0x0', transactions: [], uncles: [], logsBloom: '0x' + '00'.repeat(256), miner: '0x' + '00'.repeat(20), difficulty: '0x0', extraData: '0x', nonce: '0x0000000000000000', mixHash: '0x' + '00'.repeat(32), sha3Uncles: '0x' + '00'.repeat(32), stateRoot: '0x' + '00'.repeat(32), receiptsRoot: '0x' + '00'.repeat(32), transactionsRoot: '0x' + '00'.repeat(32), size: '0x0', totalDifficulty: '0x0' } };
            case 'eth_getCode': return { result: '0x6080' };
            case 'eth_getTransactionCount': return { result: '0x0' };
            case 'eth_estimateGas': return { result: '0x186a0', delayMs: o.onEstimate?.() ?? 0 } as any;
            case 'eth_maxPriorityFeePerGas': return { result: '0x3b9aca00' };
            case 'eth_gasPrice': return { result: '0x77359400' };
            case 'eth_sendRawTransaction': {
                raw.push(params[0]);
                const h = keccak256(params[0]);
                hashes.add(h);
                return { result: h, delayMs: o.onSend?.() ?? 0 } as any;
            }
            case 'eth_getTransactionByHash': return { result: null };
            case 'eth_getTransactionReceipt': {
                if (!hashes.has(String(params[0])) || o.neverMined) return { result: null };
                return { result: {
                    transactionHash: params[0], transactionIndex: '0x0', blockHash: '0x' + '33'.repeat(32), blockNumber: `0x${block.toString(16)}`,
                    from: KEY_ADDR.toLowerCase(), to: SP, cumulativeGasUsed: '0x5208', gasUsed: '0x5208', effectiveGasPrice: '0x3b9aca00',
                    contractAddress: null, logs: [], logsBloom: '0x' + '00'.repeat(256), status: o.receiptStatus ?? '0x1', type: '0x2',
                } };
            }
            case 'eth_call': {
                const to = String(params[0].to).toLowerCase();
                const data = String(params[0].data ?? params[0].input).slice(0, 10);
                if (data === sel('function latestRoundData()')) return { result: encodeFunctionResult({ abi, functionName: 'latestRoundData', result: [1n, 3000n * 10n ** 8n, now(), now(), 1n] }) };
                if (data === sel('function decimals()') && o.decimalsBroken) return { error: { code: 3, message: 'fake: decimals failing' } };
                if (data === sel('function decimals()')) return { result: encodeFunctionResult({ abi, functionName: 'decimals', result: 8 }) };
                if (to === SP && o.spUpdatedAt === 'broken') return { error: { code: -32000, message: 'fake: SuperPaymaster read failing' } };
                if (data === sel('function priceStalenessThreshold()')) return { result: encodeFunctionResult({ abi, functionName: 'priceStalenessThreshold', result: 3600n }) };
                if (data === sel('function ethUsdPriceFeed()')) return { result: encodeFunctionResult({ abi, functionName: 'ethUsdPriceFeed', result: FEED }) };
                if (data === sel('function cachedPrice()') && to === SP) return { result: encodeFunctionResult({ abi: spCache, functionName: 'cachedPrice', result: [3000n * 10n ** 8n, cacheAt(o.spUpdatedAt === 'empty' ? 'empty' : 'fresh'), 1n, 8] }) };
                if (data === sel('function cachedPrice()') && to === V4) return { result: encodeFunctionResult({ abi: v4Cache, functionName: 'cachedPrice', result: [0n, Number(cacheAt(o.v4UpdatedAt ?? 'fresh'))] }) };
                return { error: { code: 3, message: `fake: unexpected eth_call ${to} ${data}` } };
            }
            default: return { error: { code: -32601, message: `fake: unexpected ${method}` } };
        }
    };
    const server: Server = createServer((req, res) => {
        let body = '';
        req.on('data', (c) => (body += c));
        req.on('end', () => {
            const msg = JSON.parse(body);
            let delayMs = 0;
            const one = (m: any) => {
                methods.push(m.method);
                const { delayMs: d, ...a } = answer(m.method, m.params ?? []) as any;
                delayMs = Math.max(delayMs, d ?? 0);
                return { jsonrpc: '2.0', id: m.id, ...a };
            };
            const body2 = JSON.stringify(Array.isArray(msg) ? msg.map(one) : one(msg));
            setTimeout(() => { res.setHeader('content-type', 'application/json'); res.end(body2); }, delayMs);
        });
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    return {
        url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, raw, methods,
        close: () => new Promise((r) => { server.closeAllConnections?.(); server.close(() => r()); }),
    };
}

const cleanups: (() => Promise<void> | void)[] = [];
afterEach(async () => { for (const c of cleanups.splice(0).reverse()) await c(); }, 30_000);

type Run = { code: number | null; out: string; child: ChildProcess };

/** Start the keeper; resolves when it exits (or is killed at `timeoutMs`). `onOut` may act on the output so far. */
function startKeeper(p: {
    chain: Chain; args: string[]; env?: Record<string, string>; fakeCastDir?: string;
    /**
     * Run under a pty. With `password`, answer the prompt with it: in one write (a paste) or one byte at a time.
     * Without, the test answers itself (onOut).
     */
    pty?: { password?: string; oneByteAtATime?: boolean };
    egress?: boolean; extraPorts?: number[]; onOut?: (out: string, child: ChildProcess) => void; timeoutMs?: number;
}): Promise<Run> {
    const cwd = mkdtempSync(join(tmpdir(), 'keeper-send-'));
    cleanups.push(() => rmSync(cwd, { recursive: true, force: true }));
    const node = [process.execPath, '--import', pathToFileURL(TSX_LOADER).href, KEEPER, '--no-logo', ...p.args];
    const env: Record<string, string> = {
        PATH: p.fakeCastDir ? `${p.fakeCastDir}:${process.env.PATH}` : (process.env.PATH ?? ''), HOME: cwd, RPC_URL: p.chain.url, ...p.env,
    };
    if (p.egress) {
        const log = join(cwd, 'egress.log');
        writeFileSync(log, '');
        Object.assign(env, { NO_EGRESS_LOG: log, NO_EGRESS_ALLOW_PORTS: [p.chain.url.split(':').pop()!, ...(p.extraPorts ?? [])].join(','), NODE_OPTIONS: `--import=${PRELOAD}` });
        cleanups.push(() => { expect(readFileSync(log, 'utf8').trim(), 'no egress other than the fake RPC').toBe(''); });
    }
    const cmd = p.pty ? 'python3' : node[0]!;
    const args = p.pty
        ? ['-c', 'import os,pty,sys; sys.exit(os.waitstatus_to_exitcode(pty.spawn(sys.argv[1:])))', ...node]
        : node.slice(1);
    const child = spawn(cmd, args, { cwd, env, stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '';
    let typed = false;
    const closed = new Promise<Run>((r) => child.once('close', (code) => r({ code, out, child })));
    const timer = setTimeout(() => child.kill('SIGKILL'), p.timeoutMs ?? 50_000);
    cleanups.push(async () => { clearTimeout(timer); if (child.exitCode === null) child.kill('SIGKILL'); await closed; });
    const onData = (d: Buffer) => {
        out += d.toString();
        if (p.pty?.password !== undefined && !typed && out.includes('Keystore password:')) {
            typed = true;
            const answer = `${p.pty.password}\n`;
            if (!p.pty.oneByteAtATime) child.stdin!.write(answer);
            else [...answer].forEach((c, i) => setTimeout(() => child.stdin!.write(c), 30 * i));
        }
        p.onOut?.(out, child);
    };
    child.stdout!.on('data', onData);
    child.stderr!.on('data', onData);
    return closed.then((r) => { clearTimeout(timer); return r; });
}

/** A fake `cast` that records argv, env and pid; with `hang`, it sleeps instead of answering. */
function fakeCast(hang = false): string {
    const dir = mkdtempSync(join(tmpdir(), 'fake-cast-'));
    cleanups.push(() => rmSync(dir, { recursive: true, force: true }));
    const bin = join(dir, 'bin');
    mkdirSync(bin);
    writeFileSync(join(bin, 'cast'), [
        '#!/bin/sh',
        `echo $$ > ${dir}/pid`,
        `echo $$ >> ${dir}/invocations`,
        `printf '%s\\n' "$@" > ${dir}/argv`,
        `env > ${dir}/env`,
        // Ignore SIGHUP (inherited across exec): under the test's pty the session leader's exit would SIGHUP the
        // child and hide a keeper that never terminates it. Under launchd there is no such SIGHUP.
        hang ? "trap '' HUP\nexec sleep 30" : `echo "transactionHash ${CAST_TX}"`,
        '',
    ].join('\n'));
    chmodSync(join(bin, 'cast'), 0o755);
    return bin;
}
const castFile = (bin: string, f: string) => join(bin, '..', f);
const alive = (pid: number) => { try { process.kill(pid, 0); return true; } catch { return false; } };

const BASE = ['--network', 'sepolia', '--superpaymaster', SP, '--paymaster', V4, '--poll-interval', '1'];
// One spawned keeper per case, each bounded by startKeeper's own kill timer; this is the per-test verdict budget.
const SPAWN_VERDICT_TIMEOUT_MS = 90_000;

describe('keeper send boundary, privateKey mode', { timeout: SPAWN_VERDICT_TIMEOUT_MS }, () => {
    it('signs for the configured chain, the target and --hard-max-fee-gwei as max fee per gas', async () => {
        const chain = await fakeChain({ spUpdatedAt: 'empty' });
        cleanups.push(chain.close);
        const r = await startKeeper({ chain, egress: true, args: [...BASE, '--once', '--hard-max-fee-gwei', '5'], env: { KEEPER_PRIVATE_KEY: KEY, ...DECOY_ENV } });
        expect(r.out).toContain('confirmed: receipt kind=super');
        // The signature itself, not a log line: recovered from the broadcast bytes (Codex R10).
        expect(await signerOf(chain.raw[0]!)).toBe(KEY_ADDR);
        expect(r.code).toBe(0);
        expect(chain.raw).toHaveLength(1);
        const tx = parseTransaction(chain.raw[0]!);
        expect(tx.chainId).toBe(SEPOLIA);
        expect(tx.to?.toLowerCase()).toBe(SP);
        expect(tx.data?.slice(0, 10)).toBe(UPDATE_PRICE);
        expect(tx.maxFeePerGas).toBe(5_000_000_000n);
    });

    it('a reverted receipt is reported as reverted, not updated, and --once exits 1', async () => {
        const chain = await fakeChain({ spUpdatedAt: 'empty', receiptStatus: '0x0' });
        cleanups.push(chain.close);
        const r = await startKeeper({ chain, egress: true, args: [...BASE, '--once'], env: { KEEPER_PRIVATE_KEY: KEY } });
        expect(chain.raw).toHaveLength(1);
        expect(r.out).toMatch(/reverted: kind=super tx=0x[0-9a-f]{64}/);
        expect(r.out).not.toMatch(/confirmed: receipt kind=super/);
        expect(r.out).not.toMatch(/updated: superPaymaster/);
        expect(r.code).toBe(1);
    });

    it('a failing SuperPaymaster does not stop the PaymasterV4 update in the same tick', async () => {
        const chain = await fakeChain({ spUpdatedAt: 'broken', v4UpdatedAt: 'empty' });
        cleanups.push(chain.close);
        const r = await startKeeper({ chain, egress: true, args: [...BASE, '--once'], env: { KEEPER_PRIVATE_KEY: KEY } });
        expect(chain.raw.map((t) => parseTransaction(t).to?.toLowerCase())).toEqual([V4]);
        expect(r.out).toMatch(/superPaymaster reads: .*SuperPaymaster read failing/s);
        expect(r.code).toBe(1);
    });

    it('a SuperPaymaster update that fails (reverted) does not stop the PaymasterV4 update in the same tick', async () => {
        const chain = await fakeChain({ spUpdatedAt: 'empty', v4UpdatedAt: 'empty', receiptStatus: '0x0' });
        cleanups.push(chain.close);
        const r = await startKeeper({ chain, egress: true, args: [...BASE, '--once'], env: { KEEPER_PRIVATE_KEY: KEY, ...DECOY_ENV } });
        expect(chain.raw.map((t) => parseTransaction(t).to?.toLowerCase())).toEqual([SP, V4]);
        for (const t of chain.raw) expect(await signerOf(t)).toBe(KEY_ADDR);
        expect(r.out).toMatch(/superPaymaster: superPaymaster updatePrice reverted/);
        expect(r.code).toBe(1);
    });

    it('an RPC serving another chain is refused before any read or signature', async () => {
        const chain = await fakeChain({ chainId: () => 10, spUpdatedAt: 'empty' });
        cleanups.push(chain.close);
        const r = await startKeeper({ chain, egress: true, args: [...BASE, '--once'], env: { KEEPER_PRIVATE_KEY: KEY } });
        expect(r.out).toMatch(/refused: startup: the RPC serves chain 10, the configured network is chain 11155111/);
        expect(r.code).toBe(1);
        expect(chain.raw).toEqual([]);
        expect(chain.methods).toEqual(['eth_chainId']);
    });

    it('a base fee above --hard-max-fee-gwei sends nothing, even with the cache empty (KPR-006)', async () => {
        const chain = await fakeChain({ spUpdatedAt: 'empty' }); // the fake's base fee is 1 gwei
        cleanups.push(chain.close);
        const r = await startKeeper({ chain, egress: true, args: [...BASE, '--once', '--hard-max-fee-gwei', '0.5'], env: { KEEPER_PRIVATE_KEY: KEY } });
        expect(r.out).toMatch(/skip superPaymaster update: base fee 1 gwei is above --hard-max-fee-gwei; nothing is sent/);
        expect(chain.raw).toEqual([]);
        expect(r.code).toBe(0);
    });

    it('a failing startup RPC call is logged without the RPC URL or its key (Codex R4)', async () => {
        const chain = await fakeChain({ chainIdError: true });
        cleanups.push(chain.close);
        const r = await startKeeper({ chain, egress: true, args: [...BASE, '--once'], env: { KEEPER_PRIVATE_KEY: KEY, RPC_URL: `${chain.url}/v2/SECRETRPCKEY` } });
        expect(r.code).toBe(1);
        expect(r.out).toMatch(/fatal: /);
        expect(r.out).not.toContain('SECRETRPCKEY');
        expect(r.out).not.toContain(KEY.slice(2));
    });

    it('a slow external price endpoint cannot hold the tick; a failing feed decimals() does not stop either refresh (Codex R6/R7)', async () => {
        const chain = await fakeChain({ v4UpdatedAt: 'empty', decimalsBroken: true });
        cleanups.push(chain.close);
        // Headers at once, then a body that never ends.
        const drip = createServer((_req, res) => { res.writeHead(200, { 'content-type': 'application/json' }); res.write('{"price":'); });
        await new Promise<void>((r) => drip.listen(0, '127.0.0.1', r));
        cleanups.push(() => new Promise((r) => { drip.closeAllConnections?.(); drip.close(() => r()); }));
        const port = (drip.address() as AddressInfo).port;
        const slow = await startKeeper({
            chain, egress: true, extraPorts: [port], timeoutMs: 40_000, env: { KEEPER_PRIVATE_KEY: KEY },
            args: [...BASE, '--once', '--volatility-threshold-bps', '150', '--external-ethusd-url', `http://127.0.0.1:${port}/ticker`],
        });
        expect(slow.code).toBe(0);
        expect(chain.raw.map((t) => parseTransaction(t).to?.toLowerCase())).toEqual([V4]);
        // A complete answer reaches the Chainlink comparison, whose decimals() read fails: logged, the refreshes go on.
        const ok = createServer((_req, res) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end('{"price":"3000"}'); });
        await new Promise<void>((r) => ok.listen(0, '127.0.0.1', r));
        cleanups.push(() => new Promise((r) => { ok.closeAllConnections?.(); ok.close(() => r()); }));
        const okPort = (ok.address() as AddressInfo).port;
        const before = chain.raw.length;
        const r = await startKeeper({
            chain, egress: true, extraPorts: [okPort], env: { KEEPER_PRIVATE_KEY: KEY },
            args: [...BASE, '--once', '--volatility-threshold-bps', '150', '--external-ethusd-url', `http://127.0.0.1:${okPort}/ticker`],
        });
        expect(r.out).toMatch(/market monitoring failed this tick/);
        expect(r.out).toMatch(/paymaster decision=/);
        expect(chain.raw.length).toBe(before + 1);
        expect(r.code).toBe(0);
    });

    it('an external price body over 64 KiB is discarded; a small one is used (Codex F2)', async () => {
        const chain = await fakeChain();
        cleanups.push(chain.close);
        const serve = (body: string) => createServer((_req, res) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(body); });
        const run = async (body: string) => {
            const srv = serve(body);
            await new Promise<void>((r) => srv.listen(0, '127.0.0.1', r));
            cleanups.push(() => new Promise((r) => { srv.closeAllConnections?.(); srv.close(() => r()); }));
            const port = (srv.address() as AddressInfo).port;
            // 4000 vs the feed's 3000: a used answer raises the deviation alert.
            return startKeeper({
                chain, egress: true, extraPorts: [port], env: { KEEPER_PRIVATE_KEY: KEY },
                args: [...BASE, '--once', '--volatility-threshold-bps', '150', '--external-ethusd-url', `http://127.0.0.1:${port}/ticker`],
            });
        };
        const small = await run('{"price":"4000"}');
        expect(small.out).toMatch(/alert kind=market reason=external-vs-chainlink/);
        const big = await run(JSON.stringify({ price: '4000', pad: 'x'.repeat(70_000) }));
        expect(big.out).not.toMatch(/alert kind=market/);
        expect(big.code).toBe(0);
    });

    it('--disable-superpaymaster: a broken SuperPaymaster is not read and does not fail the run (Codex R16)', async () => {
        const chain = await fakeChain({ spUpdatedAt: 'broken' });
        cleanups.push(chain.close);
        const r = await startKeeper({ chain, egress: true, args: [...BASE, '--once', '--disable-superpaymaster'], env: { KEEPER_PRIVATE_KEY: KEY } });
        expect(r.out).not.toMatch(/superPaymaster reads/);
        expect(r.out).toMatch(/paymaster decision=wait/);
        expect(r.code).toBe(0);
    });

    it("the Mini's current start-up form still starts (only KEEPER_PRIVATE_KEY and RPC_URL; DSR 2026-11-17)", async () => {
        const chain = await fakeChain();
        cleanups.push(chain.close);
        // run.sh on the Mini: exec tsx scripts/keeper.ts --network sepolia with these flags, no --mode/--keystore/--cast-account.
        // --once is added so the test ends; values are run-keeper.sh's defaults.
        const r = await startKeeper({
            // An RPC URL with a key in its path, as a provider gives it: it must not be logged (KPR-018).
            chain, egress: true, env: { KEEPER_PRIVATE_KEY: KEY, RPC_URL: `${chain.url}/v2/SECRETRPCKEY` },
            args: ['--network', 'sepolia', '--superpaymaster', SP, '--paymaster', V4,
                '--external-ethusd-url', 'http://127.0.0.1:9/ticker', '--poll-interval', '180', '--safety-margin', '600',
                '--health-interval', '1800', '--chainlink-stale-sec', '600', '--volatility-threshold-bps', '150',
                '--volatility-cooldown', '600', '--once'],
        });
        expect(r.out).not.toMatch(/refused: /);
        expect(r.out).toContain(`wallet signer: ${KEY_ADDR}`);
        expect(r.out).toMatch(/rpcUrl=http:\/\/127\.0\.0\.1:\d+\/…/);
        expect(r.out).not.toContain('SECRETRPCKEY');
        expect(r.out).toMatch(/super decision=wait reason=still-valid/);
        expect(r.out).toMatch(/paymaster decision=wait reason=still-valid/);
        expect(r.code).toBe(0);
        expect(chain.raw).toEqual([]);
    });
});

describe('keeper send boundary, cast mode (under a pty)', { timeout: SPAWN_VERDICT_TIMEOUT_MS }, () => {
    it('cast gets the chain, the hard ceiling and an allowlisted env; no key, password, Telegram or RPC URL on argv', async () => {
        const chain = await fakeChain({ spUpdatedAt: 'empty' });
        cleanups.push(chain.close);
        const bin = fakeCast();
        const r = await startKeeper({
            chain, fakeCastDir: bin, pty: { password: 'test-password' },
            args: [...BASE, '--once', '--cast-account', 'keeper', '--hard-max-fee-gwei', '5'],
            // CAST_KEYSTORE_PASSWORD is set on purpose: it must not be read (KPR-015), so the keeper still prompts.
            env: {
                KEEPER_PRIVATE_KEY: KEY, PRIVATE_KEY: KEY, TELEGRAM_BOT_TOKEN: '', TELEGRAM_CHAT_ID: '', DEPLOYER_ACCOUNT: 'optimism-deployer',
                CAST_KEYSTORE_PASSWORD: 'env-password-must-not-be-used',
            },
        });
        expect(r.out).toContain('Keystore password:');
        expect(r.out, 'the pasted password must not be echoed').not.toContain('test-password');
        expect(r.out).toContain('cast signer args: --account keeper');
        const argv = readFileSync(castFile(bin, 'argv'), 'utf8').trim().split('\n');
        expect(argv.slice(0, 6)).toEqual(['send', '--async', '--timeout', '60', '--chain', String(SEPOLIA)]);
        expect(argv[argv.indexOf('--account') + 1]).toBe('keeper');
        expect(argv[argv.indexOf('--gas-price') + 1]).toBe('5000000000');
        expect(argv.slice(-2)).toEqual([SP, 'updatePrice()']);
        expect(argv.join(' ')).not.toContain(chain.url);
        const env = Object.fromEntries(readFileSync(castFile(bin, 'env'), 'utf8').trim().split('\n').map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
        expect(env.ETH_RPC_URL).toBe(chain.url);
        for (const k of ['KEEPER_PRIVATE_KEY', 'PRIVATE_KEY', 'TELEGRAM_BOT_TOKEN', 'DEPLOYER_ACCOUNT', 'RPC_URL', 'CAST_KEYSTORE_PASSWORD']) expect(env[k], k).toBeUndefined();
        expect(JSON.stringify(env)).not.toContain(KEY.slice(2));
        expect(r.out).toContain('confirmed: receipt kind=super');
    });

    it('re-checks the chain right before cast: a switched RPC means cast never runs', async () => {
        // Startup's eth_chainId answers Sepolia, every later one answers chain 10.
        const chain = await fakeChain({ spUpdatedAt: 'empty', chainId: (n) => (n === 0 ? SEPOLIA : 10) });
        cleanups.push(chain.close);
        const bin = fakeCast();
        const r = await startKeeper({ chain, fakeCastDir: bin, pty: { password: 'p' }, args: [...BASE, '--once', '--cast-account', 'keeper'] });
        expect(r.out).toMatch(/before cast send: the RPC serves chain 10, expected 11155111; nothing was signed/);
        expect(existsSync(castFile(bin, 'argv'))).toBe(false);
        expect(r.code).toBe(1);
    });

    it('SIGTERM while cast is in flight: cast is terminated before the keeper exits', async () => {
        const chain = await fakeChain({ spUpdatedAt: 'empty' });
        cleanups.push(chain.close);
        const bin = fakeCast(true);
        let castPid = 0;
        let signalled = false;
        const r = await startKeeper({
            chain, fakeCastDir: bin, pty: { password: 'p' }, args: [...BASE, '--cast-account', 'keeper'],
            onOut: (out) => {
                if (signalled || !out.includes('action=sendTx kind=super')) return;
                const pidFile = castFile(bin, 'pid');
                const poll = setInterval(() => {
                    if (!existsSync(pidFile)) return;
                    const pid = Number(readFileSync(pidFile, 'utf8').trim());
                    if (!pid) return;
                    clearInterval(poll);
                    castPid = pid;
                    // The keeper is the fake cast's parent: signal it, not the pty wrapper.
                    const ps = spawn('ps', ['-o', 'ppid=', '-p', String(pid)]);
                    let ppid = '';
                    ps.stdout.on('data', (d) => (ppid += d));
                    ps.on('close', () => process.kill(Number(ppid.trim()), 'SIGTERM'));
                }, 50);
                signalled = true;
            },
        });
        expect(castPid).toBeGreaterThan(0);
        // A cast terminated mid-send may or may not have broadcast: never reported as a clean stop.
        expect(r.out).toMatch(/exited \(SIGTERM\) with a send in an unknown state: a send was interrupted by the shutdown/);
        expect(r.out).not.toMatch(/stopped \(SIGTERM\)/);
        expect(alive(castPid), 'cast still running after the keeper exited').toBe(false);
    });

    it('a password typed one byte at a time is not echoed either (Codex R2)', async () => {
        const chain = await fakeChain();
        cleanups.push(chain.close);
        const bin = fakeCast();
        const r = await startKeeper({ chain, fakeCastDir: bin, pty: { password: 'typed-secret-xyz', oneByteAtATime: true }, args: [...BASE, '--once', '--cast-account', 'keeper'] });
        expect(r.out).toContain('Keystore password:');
        // Fragments of the password only (dotenv's own tips can contain ordinary words such as "secrets").
        for (const part of ['typed-secret-xyz', 'd-secr', 'ret-xy', 'yped-s']) expect(r.out).not.toContain(part);
        expect(r.code).toBe(0);
    });

    it.each([
        ['end of input (Ctrl-D)', '\u0004', /keystore password not entered \(end of input\)/],
        ['Ctrl-C', '\u0003', /keystore password not entered \(Ctrl-C\)/],
        ['an empty answer', '\n', /keystore password not entered \(empty\)/],
    ])('%s at the password prompt refuses; nothing is signed', async (_name, keys, why) => {
        const chain = await fakeChain({ spUpdatedAt: 'empty' });
        cleanups.push(chain.close);
        const bin = fakeCast();
        let sent = false;
        const r = await startKeeper({
            chain, fakeCastDir: bin, args: [...BASE, '--once', '--cast-account', 'keeper'], pty: {},
            onOut: (out, child) => { if (!sent && out.includes('Keystore password:')) { sent = true; setTimeout(() => child.stdin!.write(keys as string), 200); } },
        });
        expect(r.out).toMatch(why as RegExp);
        expect(r.code).toBe(1);
        expect(existsSync(castFile(bin, 'argv'))).toBe(false);
    });

    it('SIGTERM while cast is in flight: the other target is not sent afterwards (Codex R1)', async () => {
        const chain = await fakeChain({ spUpdatedAt: 'empty', v4UpdatedAt: 'empty' });
        cleanups.push(chain.close);
        const bin = fakeCast(true);
        let signalled = false;
        const r = await startKeeper({
            chain, fakeCastDir: bin, pty: { password: 'p' }, args: [...BASE, '--cast-account', 'keeper'],
            onOut: (out) => {
                if (signalled || !out.includes('action=sendTx kind=super')) return;
                signalled = true;
                const poll = setInterval(() => {
                    if (!existsSync(castFile(bin, 'pid'))) return;
                    clearInterval(poll);
                    const pid = Number(readFileSync(castFile(bin, 'pid'), 'utf8').trim());
                    const ps = spawn('ps', ['-o', 'ppid=', '-p', String(pid)]);
                    let ppid = '';
                    ps.stdout.on('data', (d) => (ppid += d));
                    ps.on('close', () => process.kill(Number(ppid.trim()), 'SIGTERM'));
                }, 50);
            },
        });
        expect(readFileSync(castFile(bin, 'invocations'), 'utf8').trim().split('\n')).toHaveLength(1);
        expect(r.out).toMatch(/action=sendTx kind=paymaster/);
        expect(r.out).toMatch(/shutting down: no new transaction is signed/);
        expect(r.out).toMatch(/exited \(SIGTERM\) with a send in an unknown state: a send was interrupted/);
    });
});

describe('keeper shutdown, privateKey mode (the form the Mini runs)', { timeout: SPAWN_VERDICT_TIMEOUT_MS }, () => {
    it('a tick still waiting 15 s after SIGTERM (broadcast, never mined): the exit says so, never "stopped" (DSR)', async () => {
        let keeperChild: ChildProcess | null = null;
        let signalled = false;
        const chain = await fakeChain({
            spUpdatedAt: 'empty', neverMined: true,
            onSend: () => { if (!signalled && keeperChild) { signalled = true; setTimeout(() => keeperChild!.kill('SIGTERM'), 300); } return 0; },
        });
        cleanups.push(chain.close);
        const r = await startKeeper({ chain, egress: true, args: BASE, env: { KEEPER_PRIVATE_KEY: KEY }, onOut: (_o, child) => { keeperChild = child; } });
        expect(chain.raw).toHaveLength(1);
        expect(r.out).toMatch(/exited \(SIGTERM\) with a send in an unknown state: the tick did not finish within 15 s/);
        expect(r.out).not.toMatch(/stopped \(SIGTERM\)/);
    });

    it('a send whose request times out during shutdown: the exit says the send state is unknown, never "stopped" (DSR)', async () => {
        let keeperChild: ChildProcess | null = null;
        let signalled = false;
        const chain = await fakeChain({
            spUpdatedAt: 'empty',
            onSend: () => {
                if (signalled || !keeperChild) return 0;
                signalled = true;
                keeperChild.kill('SIGTERM');
                return 25_000; // the RPC request times out first: whether the node took the tx is unknown
            },
        });
        cleanups.push(chain.close);
        const r = await startKeeper({ chain, egress: true, args: BASE, env: { KEEPER_PRIVATE_KEY: KEY }, onOut: (_o, child) => { keeperChild = child; } });
        expect(r.out).toMatch(/exited \(SIGTERM\) with a send in an unknown state/);
        expect(r.out).not.toMatch(/stopped \(SIGTERM\)/);
    });

    it('SIGTERM while a sent update awaits its receipt: no further transaction is signed, then "stopped" (Codex R1)', async () => {
        let keeperChild: ChildProcess | null = null;
        let signalled = false;
        const chain = await fakeChain({
            spUpdatedAt: 'empty', v4UpdatedAt: 'empty',
            // The first broadcast is SuperPaymaster's. Signal then and answer it 500 ms later, so the tick goes on to
            // PaymasterV4 while shutdown is under way.
            onSend: () => {
                if (signalled || !keeperChild) return 0;
                signalled = true;
                keeperChild.kill('SIGTERM');
                return 500;
            },
        });
        cleanups.push(chain.close);
        const r = await startKeeper({
            chain, egress: true, args: BASE, env: { KEEPER_PRIVATE_KEY: KEY },
            onOut: (_out, child) => { keeperChild = child; },
        });
        expect(chain.raw.map((t) => parseTransaction(t).to?.toLowerCase())).toEqual([SP]);
        expect(r.out).toMatch(/action=sendTx kind=paymaster/);
        expect(r.out).toMatch(/shutting down: no new transaction is signed/);
        // The SuperPaymaster transaction was signed before the signal and broadcast after it: named, not hidden.
        expect(r.out).toMatch(/stopped \(SIGTERM\); a transaction signed before the signal was broadcast: 0x[0-9a-f]{64}/);
        expect(r.out).not.toMatch(/unknown state/);
    });

    it('SIGTERM while viem prepares a send (gas estimate pending): nothing is signed afterwards (Codex F1)', async () => {
        let keeperChild: ChildProcess | null = null;
        let signalled = false;
        const chain = await fakeChain({
            spUpdatedAt: 'empty',
            onEstimate: () => {
                if (signalled || !keeperChild) return 0;
                signalled = true;
                keeperChild.kill('SIGTERM');
                return 500; // the estimate returns after the signal; viem would sign next
            },
        });
        cleanups.push(chain.close);
        const r = await startKeeper({ chain, egress: true, args: BASE, env: { KEEPER_PRIVATE_KEY: KEY }, onOut: (_o, child) => { keeperChild = child; } });
        expect(signalled).toBe(true);
        expect(chain.raw).toEqual([]);
        expect(r.out).toMatch(/shutting down: no new transaction is signed/);
        // Refused before signing: known not sent, so a clean stop.
        expect(r.out).toMatch(/stopped \(SIGTERM\)$/m);
    });
});
