#!/usr/bin/env tsx
/**
 * Compare SP's read-back file ("aoa-a7-readback/1") with the SDK pins and the SDK's own reads
 * (scripts/sp550-readback-compare-core.ts). Read-only; sends nothing.
 *
 *   pnpm exec tsx scripts/sp550-readback-compare.ts --readback <a7-readback.json> --pins <pins.json> \
 *       --chain-id <n> --rpc <url> [--rpc2 <url>] [--block <n>] \
 *       [--fork-block <n> --dump-sha256 <hex> --hardfork <name>] [--sp-commit <sha>]
 *
 * Reads are taken at --block (default pins.readbackBlock) on every RPC and must agree. The fork
 * facts (--fork-block, --dump-sha256, --hardfork) are given on an A7 fork run; a live read-back
 * leaves them out and the header fields are then only required to be present.
 * Exit 0 = no problem; 1 = problems (each printed); 2 = usage.
 */
import * as fs from 'fs';
import { BaseError, ContractFunctionRevertedError, ContractFunctionZeroDataError, createPublicClient, http, type Abi, type Address } from 'viem';
import { SuperPaymasterLensABI, SuperPaymasterV550ABI } from '../packages/core/src/abis/index.js';
import { readbackProblems, type Observed } from './sp550-readback-compare-core.js';

const USAGE = 'usage: sp550-readback-compare.ts --readback <file> --pins <file> --chain-id <n> --rpc <url> [--rpc2 <url>] [--block <n>] [--fork-block <n> --dump-sha256 <hex> --hardfork <name>] [--sp-commit <sha>]';
const args = process.argv.slice(2);
const arg = (k: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const refuse = (m: string): never => { console.error(`${m}\n${USAGE}`); process.exit(2); };
const pick = (abi: Abi, name: string) => abi.filter((e: any) => e.type === 'function' && e.name === name && e.inputs.length === 0);
// version() from the Lens ABI, owner()/pendingOwner() from SP's: one zero-arg shape each, taken from @aastar/core.
const ABI = [...pick(SuperPaymasterLensABI as Abi, 'version'), ...pick(SuperPaymasterV550ABI as Abi, 'owner'), ...pick(SuperPaymasterV550ABI as Abi, 'pendingOwner')] as Abi;

async function main() {
    const rbFile = arg('--readback') ?? refuse('--readback is required');
    const pinsFile = arg('--pins') ?? refuse('--pins is required');
    const chainId = Number(arg('--chain-id') ?? refuse('--chain-id is required'));
    const urls = [arg('--rpc'), arg('--rpc2')].filter((u): u is string => !!u);
    if (!urls.length) refuse('--rpc is required');
    const j = JSON.parse(fs.readFileSync(pinsFile, 'utf8'));
    const pins = { ...j, readbackBlock: j.readbackBlock !== undefined ? BigInt(j.readbackBlock) : undefined };
    const b = arg('--block');
    const blockNumber = b !== undefined ? BigInt(b) : pins.readbackBlock ?? refuse('no --block and no pins.readbackBlock');
    const clients = urls.map((url) => createPublicClient({ transport: http(url) }));
    for (const [i, c] of clients.entries()) {
        const id = await c.getChainId();
        if (id !== chainId) refuse(`RPC ${i + 1} reports chainId ${id}, not ${chainId}`);
    }
    const one = async (c: (typeof clients)[number], address: string, fn: string): Promise<Observed> => {
        try { return { kind: 'value', value: String(await c.readContract({ address: address as Address, abi: ABI, functionName: fn, blockNumber })) }; }
        catch (e) {
            const absent = e instanceof BaseError && e.walk((x) => x instanceof ContractFunctionRevertedError || x instanceof ContractFunctionZeroDataError);
            return absent ? { kind: 'reverted' } : { kind: 'error', detail: (e as BaseError).shortMessage ?? String(e) };
        }
    };
    const read = async (address: string, fn: 'version' | 'owner' | 'pendingOwner'): Promise<Observed> => {
        const all = await Promise.all(clients.map((c) => one(c, address, fn)));
        const k = JSON.stringify(all[0]);
        return all.every((o) => JSON.stringify(o) === k) ? all[0] : { kind: 'error', detail: `RPCs disagree: ${all.map((o) => JSON.stringify(o)).join(' vs ')}` };
    };
    const fb = arg('--fork-block');
    const problems = await readbackProblems(JSON.parse(fs.readFileSync(rbFile, 'utf8')), pins, {
        chainId, forkBlock: fb !== undefined ? BigInt(fb) : undefined, dumpSha256: arg('--dump-sha256'), hardfork: arg('--hardfork'), spCommit: arg('--sp-commit'),
    }, read);
    console.log(`=== SP read-back ${rbFile} vs pins ${pinsFile} and the SDK's reads at block ${blockNumber} on ${urls.length} RPC(s) ===`);
    for (const x of problems) console.log(`❌ ${x}`);
    console.log(problems.length ? `\nFAIL: ${problems.length} problem(s).` : '\nPASS: the read-back matches the pins and the chain.');
    process.exit(problems.length ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
