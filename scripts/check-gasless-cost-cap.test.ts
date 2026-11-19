import { describe, it, expect } from 'vitest';
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { GASLESS_SEND_APIS, NOT_GASLESS_SENDERS, REVIEWED_SENDERS, fileProblems, senderClosure, unclassifiedSenders } from './check-gasless-cost-cap.js';
import { TEST_CHAIN_IDS, refuseMainnetUserOps, reportedChainId, resetVerifiedEndpoints, resolveUserOpCostCap, testChainHttp, verifiedTestChainEndpoints } from '../tests/regression/userop-chain-gate.js';
import * as http from 'http';
import { createPublicClient, fallback } from 'viem';
import { assertGaslessNetworkConfig } from '../tests/regression/config.js';
import { gaslessCostCapFromEnv } from '../examples/for-iri/ts/src/costCap.js';

const SPAWN_VERDICT_TIMEOUT_MS = 60_000;
const LOADER = `const config = await loadGaslessNetworkConfig(n);\n`;
const send = (opts: string) => `${LOADER}await PaymasterClient.submitGaslessUserOperation(a, b, c, d, e, f, g, h, ${opts});`;

describe('check:gasless-cost-cap: SDK send calls carry the loader\'s ceiling (rule L, parsed, not matched as text)', { timeout: SPAWN_VERDICT_TIMEOUT_MS }, () => {
    it('every call passing `maxUserOpCostWei: config.maxUserOpCostWei` in its options argument is clean', () => {
        expect(fileProblems('x.ts', send('{ autoEstimate: true, maxUserOpCostWei: config.maxUserOpCostWei }'))).toEqual([]);
        // A `.then` on the loader and a GaslessNetworkConfig parameter bind too.
        expect(fileProblems('x.ts', `loadGaslessNetworkConfig(n).then((cfg) => X.executeGasless({ maxUserOpCostWei: cfg.maxUserOpCostWei }));`)).toEqual([]);
        expect(fileProblems('x.ts', `${LOADER}export async function run(c: GaslessNetworkConfig) { await assertGaslessNetworkConfig(c); await u.executeGaslessTx({ target, maxUserOpCostWei: c.maxUserOpCostWei }); }`)).toEqual([]);
    });
    it.each([
        ['no options argument', `${LOADER}await PaymasterClient.submitGaslessUserOperation(a, b, c, d, e, f, g, h);`, /has no options argument/],
        ['the ceiling only in a comment', send('{ /* maxUserOpCostWei: config.maxUserOpCostWei */ }'), /does not pass maxUserOpCostWei/],
        ['the ceiling in the wrong argument', `${LOADER}await PaymasterClient.submitGaslessUserOperation({ maxUserOpCostWei: config.maxUserOpCostWei }, b, c, d, e, f, g, h, {});`, /does not pass maxUserOpCostWei/],
        ['a literal ceiling', send('{ maxUserOpCostWei: 10n ** 30n }'), /is not `<x>\.maxUserOpCostWei`/],
        ['an unrelated object', `const other = {};\n` + send('{ maxUserOpCostWei: other.maxUserOpCostWei }'), /comes from `other`, which does not resolve to a const/],
        ['a spread after the ceiling', send('{ maxUserOpCostWei: config.maxUserOpCostWei, ...extra }'), /a spread after maxUserOpCostWei can override it/],
        ['a later override', send('{ maxUserOpCostWei: config.maxUserOpCostWei, maxUserOpCostWei: undefined }'), /is not `<x>\.maxUserOpCostWei`/],
        ['an options variable', send('opts'), /is not an object literal/],
        ['whitespace before the paren', `${LOADER}await u.executeGasless ({ target });`, /does not pass maxUserOpCostWei/],
        ['bracket access', `${LOADER}await u['executeGasless']({ target });`, /does not pass maxUserOpCostWei/],
        ['an alias', `${LOADER}const f = u.executeGasless;\nawait f({ target });`, /referenced without being called directly/],
        // Codex L2 round 2 (M3, H2): provenance is resolved lexically and must not be rewritten.
        ['a GaslessNetworkConfig parameter that is not checked', `${LOADER}export async function run(c: GaslessNetworkConfig) { await u.executeGaslessTx({ target, maxUserOpCostWei: c.maxUserOpCostWei }); }`, /does not resolve to a const from/],
        ['a parameter shadowing the loaded config', `${LOADER}function f(config: any) { return u.executeGasless({ target, maxUserOpCostWei: config.maxUserOpCostWei }); }`, /does not resolve to a const from/],
        ['a `let` loaded config', `let config = await loadGaslessNetworkConfig(n);\nawait u.executeGasless({ target, maxUserOpCostWei: config.maxUserOpCostWei });`, /does not resolve to a const from/],
        // Codex L2 round 5 (M1): the loader is async; unawaited, `config.maxUserOpCostWei` is undefined.
        ['an unawaited loader', `const config = loadGaslessNetworkConfig('op-mainnet');\nawait u.executeGasless({ target, maxUserOpCostWei: config.maxUserOpCostWei });`, /does not resolve to a const from/],
        // Codex L2 round 5 (M2): a bound send method escapes both rules, even when another, direct send is gated.
        ['a bound send method next to a gated direct one', `export async function live(u: any) { const send = u.executeGasless.bind(u); await send({ target }); }\nasync function test(u: any) { await refuseMainnetUserOps(rpc); await u.executeGasless({ target }); }\ntest(x);`, /referenced without being called directly/],
        ['the ceiling cleared after loading', `${LOADER}config.maxUserOpCostWei = undefined;\nawait u.executeGasless({ target, maxUserOpCostWei: config.maxUserOpCostWei });`, /writes maxUserOpCostWei after it was resolved/],
        ['the ceiling deleted', `${LOADER}delete (config as any).maxUserOpCostWei;\nawait u.executeGasless({ target, maxUserOpCostWei: config.maxUserOpCostWei });`, /writes maxUserOpCostWei after it was resolved/],
        ['Object.assign onto the loaded config', `${LOADER}Object.assign(config, { maxUserOpCostWei: undefined });\nawait u.executeGasless({ target, maxUserOpCostWei: config.maxUserOpCostWei });`, /writes maxUserOpCostWei after it was resolved/],
    ])('%s fails', (_label, src, why) => {
        expect(fileProblems('x.ts', src)).toEqual(expect.arrayContaining([expect.stringMatching(why)]));
    });
    it('regex and template literals with brackets do not confuse the parser', () => {
        expect(fileProblems('x.ts', send('{ re: /[)]/, t: `${a(")")}`, maxUserOpCostWei: config.maxUserOpCostWei }'))).toEqual([]);
    });
    it('an SDK send with no loader fails, whatever network it appears to use', () => {
        expect(fileProblems('x.ts', `const rpc = process.env.RPC_URL;\nawait bob.executeGaslessTx({ target, value: 0n, data });`)).toEqual(expect.arrayContaining([expect.stringMatching(/without a cost ceiling loader/)]));
        expect(fileProblems('x.ts', `const c = loadNetworkConfig(n);\nawait bob.executeGaslessTx({ target });`)).toEqual(expect.arrayContaining([expect.stringMatching(/without a cost ceiling loader/)]));
    });
});

describe('check:gasless-cost-cap: every hand-signing path is reached only after an awaited chain gate, or every signature after a guard (rules R / G)', { timeout: SPAWN_VERDICT_TIMEOUT_MS }, () => {
    const UNGATED = /no awaited chain gate .* precedes/;
    it.each([
        ['a raw bundler call', `await fetch(url, { body: JSON.stringify({ method: 'eth_sendUserOperation' }) });`],
        ['handleOps', `ep.handleOps(ops, b);`],
        ['a hand-built hash', `const h = getUserOpHashV07(op, ep, 10n); await acc.signMessage({ message: { raw: h } });`],
        ['UserOpScenarioBuilder', `const op = await UserOpScenarioBuilder.buildTransferScenario(t, p);`],
        ['a hash read from the EntryPoint by name', `const h = await c.readContract({ address: ep, abi, functionName: 'getUserOpHash', args: [op] });`],
        ['handleOps sent by name', `await w.writeContract({ address: ep, abi, functionName: 'handleOps', args: [ops, b] });`],
    ])('%s without a gate fails; after an awaited gate it passes', (_l, src) => {
        expect(fileProblems('x.ts', src)).toEqual([expect.stringMatching(UNGATED)]);
        expect(fileProblems('x.ts', `await refuseMainnetUserOps(rpc);\n${src}`)).toEqual([]);
    });
    it('rule G: every signature after an awaited guard with a const from resolveUserOpCostCap', () => {
        const sign = `const h = getUserOpHashV07(op, ep, 10n);\nawait acc.signMessage({ message: { raw: h } });`;
        const head = `const cap = resolveUserOpCostCap(id);\nconst h = getUserOpHashV07(op, ep, 10n);\n`;
        expect(fileProblems('x.ts', `${head}await guardUserOpSignature(view, { maxUserOpCostWei: cap });\nawait acc.signMessage({ message: { raw: h } });`)).toEqual([]);
        // The guard after the signature, a guard in a function nothing calls, a ceiling that is not resolved: all fail.
        expect(fileProblems('x.ts', `${head}await acc.signMessage({ message: { raw: h } });\nawait guardUserOpSignature(view, { maxUserOpCostWei: cap });`)).toEqual([expect.stringMatching(UNGATED)]);
        expect(fileProblems('x.ts', `const cap = resolveUserOpCostCap(id);\nasync function unused() { await guardUserOpSignature(view, { maxUserOpCostWei: cap }); }\n${sign}`)).toEqual([expect.stringMatching(UNGATED)]);
        expect(fileProblems('x.ts', `const cap = 10n ** 30n;\nawait guardUserOpSignature(view, { maxUserOpCostWei: cap });\n${sign}`)).toEqual([expect.stringMatching(UNGATED)]);
        // Codex L2 round 4 (M4): a spread after the ceiling may override it; a signer used as a value escapes the check.
        expect(fileProblems('x.ts', `${head}await guardUserOpSignature(view, { maxUserOpCostWei: cap, ...opts });\nawait acc.signMessage({ message: { raw: h } });`)).toEqual([expect.stringMatching(UNGATED)]);
        expect(fileProblems('x.ts', `${head}await guardUserOpSignature(view, { maxUserOpCostWei: cap });\nawait acc.signMessage({ message: { raw: h } });\nconst sign = acc.signMessage.bind(acc);\nawait sign({ message: { raw: h } });`)).toEqual([expect.stringMatching(UNGATED)]);
        // The guard may sit in a loop / try body, as long as the signature follows it in the same block.
        expect(fileProblems('x.ts', `const cap = resolveUserOpCostCap(id);\nasync function main() { for (const op of ops) { try { const h = getUserOpHashV07(op, ep, 10n); await guardUserOpSignature(view, { maxUserOpCostWei: cap }); await acc.signMessage({ message: { raw: h } }); } catch (e) { log(e); } } }\nmain();`)).toEqual([]);
        expect(fileProblems('x.ts', `const cap = resolveUserOpCostCap(id);\nasync function main() { for (const op of ops) { try { await guardUserOpSignature(view, { maxUserOpCostWei: cap }); } catch {} const h = getUserOpHashV07(op, ep, 10n); await acc.signMessage({ message: { raw: h } }); } }\nmain();`)).toEqual([expect.stringMatching(UNGATED)]);
    });
    it.each([
        // Codex L2 round 2 (M3)
        ['a gate in a function nothing calls', `async function unused() { await refuseMainnetUserOps(rpc); }\nasync function main() { ep.handleOps(ops, b); }\nmain();`],
        ['a gate that is not awaited', `async function main() { refuseMainnetUserOps(rpc); ep.handleOps(ops, b); }\nmain();`],
        ['a gate inside a callback', `async function main() { [rpc].forEach(async (u) => { await refuseMainnetUserOps(u); }); ep.handleOps(ops, b); }\nmain();`],
        // Codex L2 round 3 (M1)
        ['the signing before the gate', `async function main() { ep.handleOps(ops, b); await refuseMainnetUserOps(rpc); }\nmain();`],
        ['an unused gated main while an IIFE signs', `async function main() { await refuseMainnetUserOps(rpc); }\n(async () => { ep.handleOps(ops, b); })();`],
        ['a top-level await of an ungated function', `async function main() { await refuseMainnetUserOps(rpc); }\nasync function send() { ep.handleOps(ops, b); }\nawait send();\nawait main();`],
        ['a function handed to an orchestrator as a value', `async function main() { await refuseMainnetUserOps(rpc); }\nasync function send() { ep.handleOps(ops, b); }\nrunAll([send]);\nmain();`],
        ['an exported class method', `export class S { async go() { ep.handleOps(ops, b); } }\nawait refuseMainnetUserOps(rpc);`],
        ['an anonymous default export', `await refuseMainnetUserOps(rpc);\nexport default async function () { ep.handleOps(ops, b); }`],
        // Codex L2 round 4 (M1-M4)
        ['a conditional gate', `async function main() { if (live) await refuseMainnetUserOps(rpc); ep.handleOps(ops, b); }\nmain();`],
        ['a gate whose refusal is swallowed', `async function main() { try { await refuseMainnetUserOps(rpc); } catch {} ep.handleOps(ops, b); }\nmain();`],
        ['a function exported through an export list', `async function send() { ep.handleOps(ops, b); }\nexport { send };`],
        ['an aliased hash import', `import { getUserOpHashV07 as hash } from 'viem/account-abstraction';\nconst h = hash(op);\nawait acc.signMessage({ message: { raw: h } });`],
        ['an exported function that signs through a local helper, gated only in main', `async function sendOp() { ep.handleOps(ops, b); }\nexport async function run() { await sendOp(); }\nasync function main() { await refuseMainnetUserOps(rpc); await run(); }\nmain();`],
    ])('%s fails', (_l, src) => {
        expect(fileProblems('x.ts', src)).toEqual([expect.stringMatching(UNGATED)]);
    });
    it.each([
        ['a helper called (twice) only from a gated main, main called at the top level', `async function build() { return c.readContract({ functionName: 'getUserOpHash' }); }\nasync function run() { await build(); await build(); }\nasync function main() { await refuseMainnetUserOps(rpc); await run(); }\nmain();`],
        ['a top-level gate before main()', `async function main() { ep.handleOps(ops, b); }\nawait refuseMainnetUserOps(rpc);\nawait main();`],
        ['an exported function with its own gate', `async function sendOp() { ep.handleOps(ops, b); }\nexport async function run() { await refuseMainnetUserOps(rpc); await sendOp(); }`],
        ['a callback written after the gate', `async function main() { await refuseMainnetUserOps(rpc); await retry(async (cl) => cl.readContract({ functionName: 'getUserOpHash' })); }\nmain();`],
        ['an unused hand-signing helper (it never runs)', `async function never() { ep.handleOps(ops, b); }`],
    ])('%s passes', (_l, src) => {
        expect(fileProblems('x.ts', src)).toEqual([]);
    });
    it('without a loader, SDK sends are uses the gate must cover: a gate in a function nothing calls does not (Codex L2 round 4 M2)', () => {
        expect(fileProblems('x.ts', `async function unused() { await refuseMainnetUserOps(rpc); }\nawait bob.executeGaslessTx({ target });`)).toEqual([expect.stringMatching(/not after an awaited chain gate/)]);
        expect(fileProblems('x.ts', `await refuseMainnetUserOps(rpc);\nawait bob.executeGaslessTx({ target });`)).toEqual([]);
    });
    it('a GaslessNetworkConfig parameter checked AFTER the send is not bound (Codex L2 round 3 M1)', () => {
        expect(fileProblems('x.ts', `${LOADER}export async function run(c: GaslessNetworkConfig) { await u.executeGaslessTx({ target, maxUserOpCostWei: c.maxUserOpCostWei }); await assertGaslessNetworkConfig(c); }`))
            .toEqual([expect.stringMatching(/does not resolve to a const from/)]);
    });
    it('a raw signer that ALSO sends through the SDK with a loader still passes the ceiling on every send call', () => {
        const src = `${LOADER}await refuseMainnetUserOps(config.rpcUrl);\nep.handleOps(ops, b);\nawait u.executeGasless({ target });`;
        expect(fileProblems('x.ts', src)).toEqual([expect.stringMatching(/executeGasless does not pass maxUserOpCostWei/)]);
    });
    it('a primitive\'s name in an ABI (fragment or JSON), a log line, an import, a type or a declaration is not a use', () => {
        expect(fileProblems('x.ts', `const abi = parseAbi(['function handleOps(tuple[] ops, address b)']); // handleOps`)).toEqual([]);
        expect(fileProblems('x.ts', `const abi = [{ type: 'function', name: 'handleOps', inputs: [] }];\nconsole.log('handleOps ok');`)).toEqual([]);
        expect(fileProblems('x.ts', `import { getUserOpHashV07 } from 'x';\ntype T = typeof getUserOpHash;`)).toEqual([]);
    });
    it('a file importing a local signing module is a sender itself', () => {
        const files = new Map([
            ['tests/a/helper.ts', `export async function go() { await fetch(u, { body: 'eth_sendUserOperation' }); }`],
            ['tests/a/runner.ts', `import { go } from './helper.js';\nawait go();`],
            ['tests/a/other.ts', `import { x } from './nothing.js';`],
        ]);
        expect([...senderClosure(files)].sort()).toEqual(['tests/a/helper.ts', 'tests/a/runner.ts']);
        expect(fileProblems('tests/a/runner.ts', files.get('tests/a/runner.ts')!, true)).toEqual([expect.stringMatching(/imports a local module that signs/)]);
    });
});

describe('check:gasless-cost-cap: lists and the library catch-all', { timeout: SPAWN_VERDICT_TIMEOUT_MS }, () => {
    it('the lists do not overlap, and every entry carries a reason', () => {
        for (const api of Object.keys(GASLESS_SEND_APIS)) expect(Object.prototype.hasOwnProperty.call(NOT_GASLESS_SENDERS, api)).toBe(false);
        for (const [k, why] of [...Object.entries(NOT_GASLESS_SENDERS), ...Object.entries(REVIEWED_SENDERS)]) expect(why.length, k).toBeGreaterThan(10);
    });
    it('the catch-all flags a new gasless / submit function in neither list, in every definition form', () => {
        const src = 'export async function submitGaslessBatch(ops) {}\nclass C { async executeGasless(p) {} static async checkGaslessReadiness() {} }\nconst o = { sendGasless: async (op) => {} };\nconst submitAnything = (x) => x;';
        expect(unclassifiedSenders([{ path: 'p.ts', src }])).toEqual(['sendGasless (p.ts)', 'submitAnything (p.ts)', 'submitGaslessBatch (p.ts)']);
        // An inherited property name is not a send API (`'toString' in {}` is true).
        expect(fileProblems('x.ts', 'const s = n.toString(16);')).toEqual([]);
    });
    it('the repository passes', () => {
        const r = spawnSync('pnpm', ['exec', 'tsx', 'scripts/check-gasless-cost-cap.ts'], { encoding: 'utf8', timeout: SPAWN_VERDICT_TIMEOUT_MS });
        expect(r.status, r.stderr).toBe(0);
        expect(r.stdout).toMatch(/[1-9][0-9]* UserOp sender\(s\) held to the rules/);
    });
});

describe('userop-chain-gate: the endpoints decide the chain; outside the test chains a ceiling is required (no default)', { timeout: SPAWN_VERDICT_TIMEOUT_MS }, () => {
    const reader = (m: Record<string, number>) => async (u: string) => { if (!Object.prototype.hasOwnProperty.call(m, u)) throw new Error('unreachable'); return m[u]; };
    it('a testnet name in front of a mainnet RPC, or a bundler on another chain, is refused', async () => {
        await expect(reportedChainId('rpc', undefined, 11155111, reader({ rpc: 10 }))).rejects.toThrow(/the RPC reports chain 10, but the configuration is for chain 11155111/);
        await expect(reportedChainId('rpc', 'b', 11155111, reader({ rpc: 11155111, b: 10 }))).rejects.toThrow(/the bundler reports chain 10/);
        expect(await reportedChainId('rpc', 'b', 11155111, reader({ rpc: 11155111, b: 11155111 }))).toBe(11155111);
    });
    it('the ceiling: optional on a test chain, required on any other (an unknown chain counts as real money), never malformed', () => {
        for (const id of TEST_CHAIN_IDS) expect(resolveUserOpCostCap(id, ['node'], {})).toBeUndefined();
        for (const id of [1, 10, 8453, 42161]) expect(() => resolveUserOpCostCap(id, ['node'], {}), String(id)).toThrow(/needs an explicit per-UserOp cost ceiling/);
        expect(resolveUserOpCostCap(10, ['node', '--max-userop-cost-wei', '5'], { AASTAR_MAX_USEROP_COST_WEI: '9' })).toBe(5n);
        expect(resolveUserOpCostCap(10, ['node', '--max-userop-cost-wei=6'], {})).toBe(6n);
        expect(resolveUserOpCostCap(10, ['node'], { AASTAR_MAX_USEROP_COST_WEI: '9' })).toBe(9n);
        for (const v of ['0', '-1', '1e18', '0x10', '', ' 5']) {
            expect(() => resolveUserOpCostCap(11155111, ['node', '--max-userop-cost-wei', v], {}), v).toThrow(/positive integer in wei/);
            expect(() => resolveUserOpCostCap(11155111, ['node'], { AASTAR_MAX_USEROP_COST_WEI: v }), v).toThrow(/positive integer in wei/);
        }
        // A flag with no value is refused, not skipped in favour of the env.
        expect(() => resolveUserOpCostCap(10, ['node', '--max-userop-cost-wei'], { AASTAR_MAX_USEROP_COST_WEI: '9' })).toThrow(/positive integer in wei/);
    });
    it('refuseMainnetUserOps: only the test chains', async () => {
        await expect(refuseMainnetUserOps('rpc', undefined, reader({ rpc: 10 }))).rejects.toThrow(/chain 10 is not a test chain/);
        await expect(refuseMainnetUserOps('rpc', 'b', reader({ rpc: 11155111, b: 1 }))).rejects.toThrow(/the bundler reports chain 1/);
        expect(await refuseMainnetUserOps('rpc', 'b', reader({ rpc: 31337, b: 31337 }))).toBe(31337);
    });
    it('verifiedTestChainEndpoints: a non-test or disagreeing RPC refuses, none answering refuses; one that is down is NOT dropped (Codex L2 round 3 M2)', async () => {
        resetVerifiedEndpoints();
        expect(await verifiedTestChainEndpoints(['a', undefined, 'down', 'b'], undefined, reader({ a: 11155111, b: 11155111 }))).toEqual({ chainId: 11155111 });
        await expect(verifiedTestChainEndpoints(['a', 'main'], undefined, reader({ a: 11155111, main: 1 }))).rejects.toThrow(/reports chain 1, not a test chain/);
        await expect(verifiedTestChainEndpoints(['a', 'op'], undefined, reader({ a: 11155111, op: 11155420 }))).rejects.toThrow(/disagree/);
        await expect(verifiedTestChainEndpoints(['down'], undefined, reader({}))).rejects.toThrow(/no RPC endpoint answered/);
        await expect(verifiedTestChainEndpoints(['a'], 'b', reader({ a: 11155111, b: 10 }))).rejects.toThrow(/the bundler reports chain 10/);
        resetVerifiedEndpoints();
    });
    it('testChainHttp behind a fallback: a mainnet endpoint never serves a request; one that was down rejoins, in the configured order, once it answers (Codex L2 round 2 H1 / round 3 M2)', async () => {
        resetVerifiedEndpoints();
        // Two loopback JSON-RPC nodes: each answers eth_chainId with its chain, and records every other method it serves.
        const node = (chain: () => number | 'down') => {
            const served: string[] = [];
            const srv = http.createServer((req, res) => {
                let body = '';
                req.on('data', (d) => { body += d; });
                req.on('end', () => {
                    const { id, method } = JSON.parse(body);
                    const c = chain();
                    if (c === 'down') { res.statusCode = 503; res.end('down'); return; }
                    if (method !== 'eth_chainId') served.push(method);
                    res.setHeader('content-type', 'application/json');
                    res.end(JSON.stringify({ jsonrpc: '2.0', id, result: method === 'eth_chainId' ? `0x${c.toString(16)}` : '0x10' }));
                });
            });
            return new Promise<{ url: string; served: string[]; close: () => void }>((ok) => srv.listen(0, '127.0.0.1', () => {
                ok({ url: `http://127.0.0.1:${(srv.address() as any).port}`, served, close: () => srv.close() });
            }));
        };
        let bState: number | 'down' = 'down';
        const mainnet = await node(() => 10);
        const a = await node(() => 11155111);
        const b = await node(() => bState);
        try {
            const client = createPublicClient({ transport: fallback([testChainHttp(mainnet.url, { retryCount: 0 }), testChainHttp(b.url, { retryCount: 0 }), testChainHttp(a.url, { retryCount: 0 })], { rank: false }) });
            expect(await client.getBlockNumber({ cacheTime: 0 })).toBe(16n);
            expect(mainnet.served).toEqual([]); // asked its chain, refused, never served
            expect(b.served).toEqual([]);       // down: skipped, not removed
            expect(a.served).toEqual(['eth_blockNumber']);
            // A client for a chain is not served by a test-chain endpoint on ANOTHER chain (the signed hash binds the client's chain).
            const opSepolia = await node(() => 11155420);
            try {
                const forSepolia = createPublicClient({ chain: { id: 11155111 } as any, transport: testChainHttp(opSepolia.url, { retryCount: 0 }) });
                await expect(forSepolia.getBlockNumber({ cacheTime: 0 })).rejects.toThrow(/this client is for chain 11155111/);
                expect(opSepolia.served).toEqual([]);
            } finally { opSepolia.close(); }
            bState = 11155111;                  // b comes back on the same test chain: it is verified and serves, ahead of a
            expect(await client.getBlockNumber({ cacheTime: 0 })).toBe(16n);
            expect(b.served).toEqual(['eth_blockNumber']);
            expect(mainnet.served).toEqual([]);
        } finally {
            mainnet.close(); a.close(); b.close(); resetVerifiedEndpoints();
        }
    });
    it('assertGaslessNetworkConfig refuses a hand-built config: a mainnet config without a ceiling, a wrong chain, a non-positive ceiling (Codex L2 round 2 H2)', async () => {
        const cfg = (id: number, cap: unknown, bundlerUrl = '') => ({ rpcUrl: 'rpc', bundlerUrl, chain: { id }, maxUserOpCostWei: cap }) as any;
        await expect(assertGaslessNetworkConfig(cfg(10, undefined), { read: reader({ rpc: 10 }) })).rejects.toThrow(/needs an explicit per-UserOp cost ceiling/);
        await expect(assertGaslessNetworkConfig(cfg(10, 0n), { read: reader({ rpc: 10 }) })).rejects.toThrow(/positive bigint/);
        await expect(assertGaslessNetworkConfig(cfg(11155111, undefined), { read: reader({ rpc: 10 }) })).rejects.toThrow(/the RPC reports chain 10/);
        await expect(assertGaslessNetworkConfig(cfg(10, 5n), { read: reader({ rpc: 10 }) })).resolves.toBeUndefined();
        await expect(assertGaslessNetworkConfig(cfg(11155111, undefined), { read: reader({ rpc: 11155111 }) })).resolves.toBeUndefined();
        // Codex L2 round 3 (Low): the configured bundler is checked too.
        await expect(assertGaslessNetworkConfig(cfg(11155111, undefined, 'b'), { read: reader({ rpc: 11155111, b: 10 }) })).rejects.toThrow(/the bundler reports chain 10/);
    });
    it('loadGaslessNetworkConfig reads the ceiling after .env.<network> is loaded, and refuses a chain mismatch', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gasless-cap-'));
        try {
            fs.copyFileSync('config.op-sepolia.json', path.join(dir, 'config.op-sepolia.json'));
            fs.writeFileSync(path.join(dir, '.env.op-sepolia'), 'RPC_URL=http://127.0.0.1:1\nBUNDLER_URL=http://127.0.0.1:2\nAASTAR_MAX_USEROP_COST_WEI=777\n');
            const cfg = path.resolve('tests/regression/config.ts');
            const env = { ...process.env };
            delete env.AASTAR_MAX_USEROP_COST_WEI; delete env.RPC_URL; delete env.BUNDLER_URL;
            // The temp dir has no package.json, so run the repo's own tsx by path.
            const tsx = path.resolve('node_modules/.bin/tsx');
            const probe = (chain: number) => spawnSync(tsx, ['-e',
                `import(${JSON.stringify(cfg)}).then(async (m) => { const c = await m.loadGaslessNetworkConfig('op-sepolia', { argv: ['node'], read: async () => ${chain} }); console.log('CAP=' + c.maxUserOpCostWei); }).catch((e) => { console.log('ERR=' + e.message); });`,
            ], { cwd: dir, encoding: 'utf8', timeout: SPAWN_VERDICT_TIMEOUT_MS, env });
            const ok = probe(11155420);
            expect(ok.stdout, ok.stderr).toMatch(/CAP=777/);
            const mismatch = probe(10);
            expect(mismatch.stdout, mismatch.stderr).toMatch(/ERR=the RPC reports chain 10, but the configuration is for chain 11155420/);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });
});

describe('the for-iri examples\' gaslessCostCapFromEnv: the chain the endpoints report decides', { timeout: SPAWN_VERDICT_TIMEOUT_MS }, () => {
    const at = (id: number) => ({ getChainId: async () => id });
    const withEnv = async <T>(v: string | undefined, f: () => Promise<T>) => {
        const old = process.env.AASTAR_MAX_USEROP_COST_WEI;
        if (v === undefined) delete process.env.AASTAR_MAX_USEROP_COST_WEI; else process.env.AASTAR_MAX_USEROP_COST_WEI = v;
        try { return await f(); } finally { if (old === undefined) delete process.env.AASTAR_MAX_USEROP_COST_WEI; else process.env.AASTAR_MAX_USEROP_COST_WEI = old; }
    };
    it.each([1, 10, 8453])('chain %i without a ceiling throws (not a test chain)', async (id) => {
        await withEnv(undefined, () => expect(gaslessCostCapFromEnv(at(id))).rejects.toThrow(/needs an explicit per-UserOp cost ceiling/));
    });
    it('a test chain without a ceiling is allowed; a given ceiling is returned; malformed or a bundler on another chain is refused', async () => {
        await withEnv(undefined, async () => expect(await gaslessCostCapFromEnv(at(11155420), at(11155420))).toEqual({ maxUserOpCostWei: undefined }));
        await withEnv('5000', async () => expect(await gaslessCostCapFromEnv(at(10))).toEqual({ maxUserOpCostWei: 5000n }));
        await withEnv('1e18', () => expect(gaslessCostCapFromEnv(at(11155420))).rejects.toThrow(/positive integer in wei/));
        await withEnv(undefined, () => expect(gaslessCostCapFromEnv(at(11155420), at(10))).rejects.toThrow(/the bundler reports chain 10/));
    });
});
