#!/usr/bin/env tsx
/**
 * SP 5.5.0 pin fill (read-only on chain): turns SP's step-13 manifest pins JSON into the SDK's pin
 * table entry and address-book switch, so neither is typed by hand.
 *
 *   pnpm exec tsx scripts/sp550-pin-fill.ts --network <sepolia|op-sepolia|op-mainnet> --manifest <pins.json> \
 *       --rpc <url> [--rpc2 <url>] [--block <n|finalized|latest>] [--allow-rc] [--write]
 *
 * Order, each step refusing before the next:
 *  1. the manifest parses as a pins JSON for the network's deploy mode (unknown keys are refused);
 *  2. the read-back gate (sp550CutoverGate, the same one check:sp550-cutover runs) passes on the
 *     manifest pins AND the SDK book with the switch applied: version(), every pinned address's
 *     keccak256(code) against codehashes, the ERC-1967 slot, SP's wiring, aliases, holds. A FAIL
 *     prints the gate's report and writes nothing;
 *  3. without --write: prints the entries it would write and exits 0;
 *  4. --write: refused when the RPC is a local fork (loopback URL or an anvil node) — fork addresses
 *     never reach the source. Otherwise fills the EMPTY SP550_CUTOVER_PINS / SP550_FRESH_DEPLOY_PINS
 *     entry and switches CANONICAL_ADDRESSES, then re-runs check-sp550-cutover.ts with NO --pins, so
 *     the gate reads the written source tables. If that re-run does not exit 0 the files are restored.
 *
 * Exit 2 = refused before the gate; 1 = gate FAIL or the written source did not pass; 0 = PASS.
 * Sends no transaction.
 */
import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { createPublicClient, http } from 'viem';
import { runSp550CutoverGate, type GateRpc } from '../packages/core/src/sp550CutoverGate.js';
import { resolveSp550Network } from '../packages/core/src/sp550Deployments.js';
import { CANONICAL_ADDRESSES } from '../packages/core/src/addresses.js';
import { bookSwitch, changedEntries, fillPinsTable, parseManifestPins, renderPinsLiteral, switchBook } from './sp550-pin-fill-core.js';

const USAGE = 'usage: sp550-pin-fill.ts --network <sepolia|op-sepolia|op-mainnet> --manifest <pins.json> --rpc <url> [--rpc2 <url>] [--block <n|finalized|latest>] [--allow-rc] [--write]';
const ROOT = path.resolve(import.meta.dirname, '..');
const FILES = {
    upgrade: path.join(ROOT, 'packages/core/src/sp550Cutover.ts'),
    fresh: path.join(ROOT, 'packages/core/src/sp550Deployments.ts'),
    book: path.join(ROOT, 'packages/core/src/addresses.ts'),
};
const args = process.argv.slice(2);
const arg = (k: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const refuse = (m: string): never => { console.error(`${m}\n${USAGE}`); process.exit(2); };
const LOOPBACK = /^https?:\/\/(127\.\d+\.\d+\.\d+|localhost|\[::1\])(:\d+)?(\/|$)/i;

async function main() {
    const net = (() => { try { return resolveSp550Network(arg('--network')); } catch (e) { return refuse((e as Error).message); } })();
    const file = arg('--manifest') ?? refuse('--manifest <pins.json> is required');
    let pins;
    try { pins = parseManifestPins(JSON.parse(fs.readFileSync(file, 'utf8')), net.mode); } catch (e) { return refuse((e as Error).message); }
    const urls = [['--rpc', arg('--rpc')], ['--rpc2', arg('--rpc2')]].filter((x): x is [string, string] => !!x[1]);
    if (!urls.length) refuse('--rpc <url> is required');
    const rpcs: GateRpc[] = urls.map(([label, url]) => ({ label, url, client: createPublicClient({ transport: http(url) }) as unknown as GateRpc['client'] }));
    const b = arg('--block');
    if (b !== undefined && !/^(\d+|finalized|latest)$/.test(b)) refuse('--block must be a block number, finalized or latest');
    const block = b === undefined ? undefined : b === 'finalized' || b === 'latest' ? b : BigInt(b);
    let switched: Record<string, string>;
    try { switched = bookSwitch(net.mode, pins); } catch (e) { return refuse((e as Error).message); }
    const shipped = (CANONICAL_ADDRESSES as Record<number, Record<string, unknown>>)[net.chainId] ?? {};
    const book = { ...shipped, ...switched };

    // ---- 2. the gate, on exactly what would be written ----
    const r = await runSp550CutoverGate({ network: net.network, rpcs, pins, pinsSource: file, book, block, allowRc: args.includes('--allow-rc') });
    if (r.exitCode === 2) refuse(r.error ?? 'gate refused');
    console.log(r.header);
    for (const c of r.results) console.log(`${c.ok ? '✅' : '❌'} ${c.check} — ${c.detail}`);
    if (r.exitCode !== 0) {
        console.log(`\nFAIL: ${r.results.filter((c) => !c.ok).length}/${r.results.length} check(s) failed; nothing written.`);
        process.exit(1);
    }
    const table = net.mode === 'fresh' ? 'SP550_FRESH_DEPLOY_PINS' : 'SP550_CUTOVER_PINS';
    const note = `SP ${pins.tag} cutover, read back at block ${pins.readbackBlock} (scripts/sp550-pin-fill.ts)`;
    console.log(`\nPASS. ${table}[${net.chainId}] = ${renderPinsLiteral(pins, '')}`);
    const changed = changedEntries(switched, shipped);
    console.log(`CANONICAL_ADDRESSES[${net.chainId}] switch (entries that change): ${JSON.stringify(changed)}`);
    if (!args.includes('--write')) { console.log('\n(preview only: pass --write to fill the source)'); return; }

    // ---- 4. write, then let the gate read the written source ----
    for (const [label, url] of urls) {
        if (LOOPBACK.test(url)) refuse(`--write refused: ${label} is a loopback URL (a local fork); fork addresses never go into the source`);
        const client = await createPublicClient({ transport: http(url) }).request({ method: 'web3_clientVersion' } as never).catch(() => '') as string;
        if (/^anvil\//i.test(client)) refuse(`--write refused: ${label} is an anvil node (${client}); fork addresses never go into the source`);
    }
    const tableFile = net.mode === 'fresh' ? FILES.fresh : FILES.upgrade;
    const before = { table: fs.readFileSync(tableFile, 'utf8'), book: fs.readFileSync(FILES.book, 'utf8') };
    let after;
    try { after = { table: fillPinsTable(before.table, table, net.chainId, pins), book: switchBook(before.book, net.chainId, changed, note) }; }
    catch (e) { console.error(`nothing written: ${(e as Error).message}`); process.exit(1); }
    fs.writeFileSync(tableFile, after.table);
    fs.writeFileSync(FILES.book, after.book);
    const recheck = ['exec', 'tsx', 'scripts/check-sp550-cutover.ts', '--network', net.network, ...urls.flat(),
        ...(b !== undefined ? ['--block', b] : []), ...(args.includes('--allow-rc') ? ['--allow-rc'] : [])];
    const rc = spawnSync('pnpm', recheck, { cwd: ROOT, stdio: 'inherit' });
    if (rc.status !== 0) {
        fs.writeFileSync(tableFile, before.table);
        fs.writeFileSync(FILES.book, before.book);
        console.error(`\nthe gate did not pass on the written source (exit ${rc.status}); both files restored.`);
        process.exit(1);
    }
    console.log(`\nwritten and re-verified from source: ${path.relative(ROOT, tableFile)}, ${path.relative(ROOT, FILES.book)}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
