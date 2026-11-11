#!/usr/bin/env tsx
/**
 * Compare SP's read-back file ("aoa-a7-readback/1") with the SDK pins and the SDK's own reads
 * (scripts/sp550-readback-compare-core.ts). Read-only; sends nothing.
 *
 *   pnpm exec tsx scripts/sp550-readback-compare.ts --network <sepolia|op-sepolia|op-mainnet> \
 *       --readback <a7-readback.json> --pins <pins.json> --rpc <url> [--rpc2 <url>] [--allow-rc] \
 *       [--fork-block <n> --dump-sha256 <hex> --hardfork <name>] [--sp-commit <sha>]
 *
 * Every read is taken at pins.readbackBlock (the block the file and the pins describe; there is no
 * override) on every RPC, and the RPCs must agree. The fork facts are given on an A7 fork run; a
 * live read-back leaves them out and those header fields are only required to be present.
 * Exit 0 = no problem; 1 = problems (each printed); 2 = usage.
 */
import * as fs from 'fs';
import { createPublicClient, getAddress, http, keccak256, type Abi, type Address } from 'viem';
import { SuperPaymasterLensABI, SuperPaymasterV550ABI } from '../packages/core/src/abis/index.js';
import { resolveSp550Network } from '../packages/core/src/sp550Deployments.js';
import { classifyCallError, readbackProblems, type Observed, type ReadKind } from './sp550-readback-compare-core.js';

const USAGE = 'usage: sp550-readback-compare.ts --network <sepolia|op-sepolia|op-mainnet> --readback <file> --pins <file> --rpc <url> [--rpc2 <url>] [--allow-rc] [--fork-block <n> --dump-sha256 <hex> --hardfork <name>] [--sp-commit <sha>]';
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
    const problems = await readbackProblems(JSON.parse(fs.readFileSync(rbFile, 'utf8')), pins, {
        chainId: net.chainId, mode: net.mode, allowRc: args.includes('--allow-rc'),
        forkBlock: fb !== undefined ? BigInt(fb) : undefined, dumpSha256: arg('--dump-sha256'), hardfork: arg('--hardfork'), spCommit: arg('--sp-commit'),
    }, read);
    console.log(`=== SP read-back ${rbFile} vs pins ${pinsFile} and the SDK's reads at block ${blockNumber} on ${urls.length} RPC(s) ===`);
    for (const x of problems) console.log(`❌ ${x}`);
    console.log(problems.length ? `\nFAIL: ${problems.length} problem(s).` : '\nPASS: the read-back, the pins and the SDK\'s reads agree on every compared field.');
    process.exit(problems.length ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
