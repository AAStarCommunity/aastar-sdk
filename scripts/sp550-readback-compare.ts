#!/usr/bin/env tsx
/**
 * Compare SP's read-back file ("aoa-a7-readback/1") with the SDK pins and the SDK's own reads
 * (scripts/sp550-readback-compare-core.ts). Read-only; sends nothing.
 *
 *   pnpm exec tsx scripts/sp550-readback-compare.ts --network <sepolia|op-sepolia|op-mainnet> \
 *       --readback <a7-readback.json> --pins <pins.json> --rpc <url> [--rpc2 <url>] [--allow-rc] \
 *       [--fork-block <n> --dump-sha256 <hex> --anvil-commit <sha> [--probe]] [--hardfork <name>] [--sp-commit <sha>]
 *
 * The file is first validated against the binding aoa-a7-readback/1 schema (sha256-pinned). Every
 * read is taken at pins.readbackBlock (the block the file and the pins describe; no override) on
 * every RPC, and the RPCs must agree. With --dump-sha256 the read-back is a fork one (source
 * "fork"): --fork-block and --anvil-commit are then required. Otherwise it is a live one.
 *
 * --probe (fork only, loopback RPC): runs SP's amsterdamProbe AFTER every read — eth_simulateV1 of
 * the initcode at forkBlock on the SDK's own upstream (SP550_FORK_URL, never printed), eth_call with
 * gas = expected.gasUsed there and on the fork, then the tx sent on the fork (anvil impersonation)
 * and its whole-tx receipt gasUsed. This changes the fork's state (one contract, the sender's nonce).
 * Exit 0 = no problem; 1 = problems (each printed); 2 = usage.
 */
import * as fs from 'fs';
import { createPublicClient, getAddress, http, keccak256, type Abi, type Address } from 'viem';
import { SuperPaymasterLensABI, SuperPaymasterV550ABI } from '../packages/core/src/abis/index.js';
import { resolveSp550Network } from '../packages/core/src/sp550Deployments.js';
import { classifyCallError, probeProblems, readbackProblems, type Measured, type Observed, type ReadKind } from './sp550-readback-compare-core.js';
import { isLoopbackUrl } from './sp550-pin-fill-core.js';

const USAGE = 'usage: sp550-readback-compare.ts --network <sepolia|op-sepolia|op-mainnet> --readback <file> --pins <file> --rpc <url> [--rpc2 <url>] [--allow-rc] [--fork-block <n> --dump-sha256 <hex> --anvil-commit <sha> [--probe]] [--hardfork <name>] [--sp-commit <sha>]';
const ERC1967_IMPL_SLOT = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc' as const;
const args = process.argv.slice(2);
const arg = (k: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const refuse = (m: string): never => { console.error(`${m}\n${USAGE}`); process.exit(2); };
const pick = (abi: Abi, name: string) => abi.filter((e: any) => e.type === 'function' && e.name === name && e.inputs.length === 0);
// Zero-arg views taken from @aastar/core: version() from the Lens, owner / pendingOwner / EXTENSION from SP.
const ABI = [...pick(SuperPaymasterLensABI as Abi, 'version'), ...['owner', 'pendingOwner', 'EXTENSION'].flatMap((n) => pick(SuperPaymasterV550ABI as Abi, n))] as Abi;

async function main() {
    let net: ReturnType<typeof resolveSp550Network>;
    try { net = resolveSp550Network(arg('--network')); } catch (e) { return refuse((e as Error).message); }
    if (args.includes('--block')) refuse('--block is not accepted: reads are taken at pins.readbackBlock, the block the file describes');
    const rbFile = arg('--readback') ?? refuse('--readback is required');
    const pinsFile = arg('--pins') ?? refuse('--pins is required');
    const urls = [arg('--rpc'), arg('--rpc2')].filter((u): u is string => !!u);
    if (!urls.length) refuse('--rpc is required');
    const j = JSON.parse(fs.readFileSync(pinsFile, 'utf8'));
    const rb = j.readbackBlock;
    if (!(typeof rb === 'number' || (typeof rb === 'string' && /^\d+$/.test(rb)))) refuse(`pins.readbackBlock ${JSON.stringify(rb)} is not a block number`);
    const pins = { ...j, readbackBlock: BigInt(rb) };
    const blockNumber = pins.readbackBlock as bigint;
    const clients = urls.map((url) => createPublicClient({ transport: http(url) }));
    for (const [i, c] of clients.entries()) {
        const id = await c.getChainId();
        if (id !== net.chainId) refuse(`RPC ${i + 1} reports chainId ${id}, not ${net.chainId} (${net.network})`);
    }
    const one = async (c: (typeof clients)[number], address: string, what: ReadKind): Promise<Observed> => {
        try {
            if (what === 'blockHash') {
                const blk = await c.getBlock({ blockNumber });
                return blk?.hash ? { kind: 'value', value: blk.hash } : { kind: 'error', detail: `no block ${blockNumber}` };
            }
            if (what === 'codehash') {
                const code = await c.getCode({ address: address as Address, blockNumber });
                return { kind: 'value', value: code && code !== '0x' ? keccak256(code) : 'none' };
            }
            if (what === 'erc1967Impl') {
                const slot = await c.getStorageAt({ address: address as Address, slot: ERC1967_IMPL_SLOT, blockNumber });
                return slot && /^0x0{24}[0-9a-fA-F]{40}$/.test(slot) ? { kind: 'value', value: getAddress('0x' + slot.slice(-40)) } : { kind: 'error', detail: `malformed slot ${slot}` };
            }
            return { kind: 'value', value: String(await c.readContract({ address: address as Address, abi: ABI, functionName: what, blockNumber })) };
        } catch (e) { return classifyCallError(e); }
    };
    const read = async (address: string, what: ReadKind): Promise<Observed> => {
        const all = await Promise.all(clients.map((c) => one(c, address, what)));
        const k = JSON.stringify(all[0]);
        return all.every((o) => JSON.stringify(o) === k) ? all[0] : { kind: 'error', detail: `RPCs disagree: ${all.map((o) => JSON.stringify(o)).join(' vs ')}` };
    };
    const fb = arg('--fork-block');
    if (fb !== undefined && !/^\d+$/.test(fb)) refuse('--fork-block must be a block number');
    const source = arg('--dump-sha256') !== undefined ? 'fork' : 'live';
    const probe = args.includes('--probe');
    if (probe && (source !== 'fork' || urls.length !== 1 || !isLoopbackUrl(urls[0]))) refuse('--probe sends a transaction: fork read-backs only, on one loopback RPC');
    if (probe && !process.env.SP550_FORK_URL) refuse('--probe needs SP550_FORK_URL (the upstream the fork was started from) for the live estimate');
    if (probe) {
        // The live estimate must come from the real chain, never from the fork itself (or another local node).
        const up = process.env.SP550_FORK_URL!;
        if (isLoopbackUrl(up)) refuse('--probe: SP550_FORK_URL is a loopback URL; the live estimate must come from the upstream chain, not a local node');
        let same = false;
        try { same = new URL(up).host.toLowerCase() === new URL(urls[0]).host.toLowerCase(); } catch { refuse('--probe: SP550_FORK_URL is not a URL'); }
        if (same) refuse('--probe: SP550_FORK_URL is the --rpc endpoint; the live estimate must be independent of the fork');
        const upstream = createPublicClient({ transport: http(up) });
        // Errors here never print the URL (it embeds a provider key).
        const upId = await upstream.getChainId().catch(() => undefined);
        if (upId !== net.chainId) refuse(`--probe: the upstream reports chainId ${upId ?? '(no answer)'}, not ${net.chainId}`);
        const cv = await upstream.request({ method: 'web3_clientVersion' } as never).catch(() => '') as string;
        if (/^anvil\//i.test(cv)) refuse('--probe: the upstream is an anvil node, not the live chain');
    }
    const rbJson = JSON.parse(fs.readFileSync(rbFile, 'utf8'));
    const problems = await readbackProblems(rbJson, pins, {
        chainId: net.chainId, mode: net.mode, source, allowRc: args.includes('--allow-rc'),
        forkBlock: fb !== undefined ? BigInt(fb) : undefined, dumpSha256: arg('--dump-sha256'), hardfork: arg('--hardfork'),
        anvilCommit: arg('--anvil-commit'), spCommit: arg('--sp-commit'),
    }, read);
    // The probe changes the fork: only after every read above, and only on a file that compared clean.
    if (probe && !problems.length) problems.push(...probeProblems(rbJson.amsterdamProbe, await runProbe(urls[0], process.env.SP550_FORK_URL!, rbJson.amsterdamProbe, BigInt(fb!))));
    else if (probe) problems.push('amsterdamProbe: not run (the read-back did not compare clean)');
    console.log(`=== SP read-back ${rbFile} (${source}) vs pins ${pinsFile} and the SDK's reads at block ${blockNumber} on ${urls.length} RPC(s)${probe ? ', + amsterdamProbe' : ''} ===`);
    for (const x of problems) console.log(`❌ ${x}`);
    console.log(problems.length ? `\nFAIL: ${problems.length} problem(s).` : '\nPASS: the read-back, the pins and the SDK\'s reads agree on every compared field.');
    process.exit(problems.length ? 1 : 0);
}

/**
 * The SDK's own probe measurements (revision 3): eth_simulateV1 of the initcode on its upstream at
 * forkBlock (n/a when the upstream has no such method), eth_call with gas = expected.gasUsed on the
 * upstream and on the fork (both must succeed), then the same tx sent on the fork (anvil
 * impersonation) and its whole-tx receipt gasUsed. No estimate is measured: estimates are recorded only.
 */
async function runProbe(forkUrl: string, upstreamUrl: string, probe: { initcode: string; sender: string; expected: { gasUsed: number } }, forkBlock: bigint) {
    const fork = createPublicClient({ transport: http(forkUrl) });
    const upstream = createPublicClient({ transport: http(upstreamUrl) });
    const tx = { from: probe.sender, data: probe.initcode };
    const at = `0x${forkBlock.toString(16)}`;
    const gas = `0x${BigInt(probe.expected.gasUsed).toString(16)}`;
    // The upstream URL embeds a provider key: errors report their class / RPC code, never the message text.
    const why = (e: unknown) => `${(e as Error).name}${(e as { code?: number }).code !== undefined ? ` ${(e as { code?: number }).code}` : ''}`;
    const measure = async (f: () => Promise<unknown>): Promise<Measured> => {
        try { return { kind: 'value', value: BigInt(await f() as string) }; } catch (e) { return { kind: 'error', detail: why(e) }; }
    };
    const call = async (c: typeof fork): Promise<Measured> => {
        try { await c.request({ method: 'eth_call', params: [{ ...tx, gas }, at] } as never); return { kind: 'value', value: 1n }; }
        catch (e) { return { kind: 'error', detail: why(e) }; }
    };
    let simulateUpstream: Measured;
    try {
        const r = await upstream.request({ method: 'eth_simulateV1', params: [{ blockStateCalls: [{ calls: [tx] }], validation: false }, at] } as never) as any[];
        const used = r?.[0]?.calls?.[0]?.gasUsed;
        const status = r?.[0]?.calls?.[0]?.status;
        simulateUpstream = typeof used === 'string' && status !== '0x0' ? { kind: 'value', value: BigInt(used) } : { kind: 'error', detail: `eth_simulateV1 call status ${status}` };
    } catch (e) {
        const code = (e as { code?: number }).code;
        // -32601 (method not found) / -32600: the provider has no eth_simulateV1 — recorded as n/a, not judged.
        simulateUpstream = code === -32601 || code === -32600 ? { kind: 'n/a', detail: `upstream has no eth_simulateV1 (${code})` } : { kind: 'error', detail: why(e) };
    }
    const callUpstream = await call(upstream);
    const callFork = await call(fork);
    const gasUsedFork = await measure(async () => {
        await fork.request({ method: 'anvil_impersonateAccount', params: [probe.sender] } as never);
        const bal = BigInt(await fork.request({ method: 'eth_getBalance', params: [probe.sender, 'latest'] } as never) as string);
        if (bal === 0n) await fork.request({ method: 'anvil_setBalance', params: [probe.sender, '0x56BC75E2D63100000'] } as never);
        const hash = await fork.request({ method: 'eth_sendTransaction', params: [tx] } as never) as `0x${string}`;
        const r = await fork.waitForTransactionReceipt({ hash });
        if (r.status !== 'success') throw Object.assign(new Error('probe tx reverted'), { name: 'ProbeReverted' });
        return `0x${r.gasUsed.toString(16)}`;
    });
    return { gasUsedFork, simulateUpstream, callUpstream, callFork };
}

main().catch((e) => { console.error(e); process.exit(1); });
