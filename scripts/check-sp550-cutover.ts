#!/usr/bin/env tsx
/**
 * SuperPaymaster 5.5.0 cutover gate (read-only). Compares the 5.5.0 pins for the selected network
 * (packages/core/src/sp550Cutover.ts / sp550Deployments.ts, or a --pins JSON file) against the
 * chain, field by field.
 *
 *   pnpm exec tsx scripts/check-sp550-cutover.ts --network <sepolia|op-sepolia|op-mainnet> \
 *       --rpc <url> [--rpc2 <url>] [--pins <file.json>] [--block <n>] [--allow-rc]
 *
 * The network alone selects the pins and the deploy mode: `upgrade` (Sepolia, in-place 5.4.2 ->
 * 5.5.0) or `fresh` (OP chains, a new full V5 stack). Before any other read, every RPC's chainId
 * is asserted to be the network's; a mismatch exits 2. A fresh deploy is read back from TWO
 * distinct RPC endpoints (--rpc2 required): both must serve the same block hash at the snapshot
 * block, and every state read is taken on both and must agree. The logic lives in
 * packages/core/src/sp550CutoverGate.ts (tested there with injected clients); this is the CLI.
 *
 * Every read is taken at ONE block (--block, default: the lower of the RPC heads when the run
 * starts), so a PASS describes a single consistent snapshot rather than values read across a
 * concurrent upgrade.
 *
 * Exit 0 only if every required pin is filled, no release hold applies, AND every check reads back
 * as pinned. A missing pin is a failure that prints the value observed on chain — the pin must be
 * written from a readback, never from this script's output alone (DSR cutover work order). Sends
 * no transaction.
 */
import * as fs from 'fs';
import { createPublicClient, http } from 'viem';
import { runSp550CutoverGate, type GateRpc } from '../packages/core/src/sp550CutoverGate.js';

const USAGE = 'usage: check-sp550-cutover.ts --network <sepolia|op-sepolia|op-mainnet> --rpc <url> [--rpc2 <url>] [--pins <file.json>] [--block <n>] [--allow-rc]';
const args = process.argv.slice(2);
const arg = (k: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };

async function main() {
    const rpcs: GateRpc[] = [['--rpc', arg('--rpc') || process.env.RPC_URL], ['--rpc2', arg('--rpc2')]]
        .filter((x): x is [string, string] => !!x[1])
        .map(([label, url]) => ({ label, url, client: createPublicClient({ transport: http(url) }) as unknown as GateRpc['client'] }));
    const file = arg('--pins');
    let pins;
    if (file) {
        const j = JSON.parse(fs.readFileSync(file, 'utf8'));
        pins = { ...j, readbackBlock: j.readbackBlock !== undefined ? BigInt(j.readbackBlock) : undefined };
    }
    const r = await runSp550CutoverGate({
        network: arg('--network'), rpcs, pins, pinsSource: file,
        block: arg('--block') ? BigInt(arg('--block')!) : undefined, allowRc: args.includes('--allow-rc'),
    });
    if (r.exitCode === 2) { console.error(`${r.error}\n${USAGE}`); process.exit(2); }
    console.log(r.header);
    for (const c of r.results) console.log(`${c.ok ? '✅' : '❌'} ${c.check} — ${c.detail}`);
    const bad = r.results.filter((c) => !c.ok).length;
    console.log(bad ? `\nFAIL: ${bad}/${r.results.length} check(s) failed.` : `\nPASS: ${r.results.length}/${r.results.length} checks.`);
    process.exit(r.exitCode);
}

main().catch((e) => { console.error(e); process.exit(1); });
