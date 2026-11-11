#!/usr/bin/env tsx
/**
 * SP 5.5.0 pin fill (read-only on chain): turns SP's step-13 manifest pins JSON into the SDK's pin
 * table entry and address-book switch, so neither is typed by hand.
 *
 *   pnpm exec tsx scripts/sp550-pin-fill.ts --network <sepolia|op-sepolia|op-mainnet> --manifest <pins.json> \
 *       --rpc <url> [--rpc2 <url>] [--block <n|finalized|latest>] [--allow-rc] \
 *       [--write --sp-readback-commit <sha> [--sp-readback-path <path>]]
 *
 * Order, each step refusing before the next:
 *  1. the manifest parses as a pins JSON for the network's deploy mode (unknown keys are refused);
 *  2. the read-back gate (sp550CutoverGate, the same one check:sp550-cutover runs) passes on the
 *     manifest pins AND the SDK book with the switch applied: version(), every pinned address's
 *     keccak256(code) against codehashes, the ERC-1967 slot, SP's wiring, aliases, holds. A FAIL
 *     prints the gate's report and writes nothing;
 *  3. without --write: prints the entries it would write and exits 0;
 *  4. --write: refused when the RPC is a local fork (loopback URL or an anvil node); needs two RPCs on
 *     different hosts read at the finalized block (these narrow, but cannot rule out, two hostnames
 *     fronting one remote fork — residual risk accepted by DSR on the next condition); and SP's
 *     own LIVE read-back (aoa-a7-readback/1, source "live"; default path
 *     deployments/release/rc8/<network>.readback.live.json, fetched from GitHub at the given SP
 *     commit) must name every pinned address and codehash — on any mismatch it stops. Otherwise fills the EMPTY SP550_CUTOVER_PINS / SP550_FRESH_DEPLOY_PINS
 *     entry and switches CANONICAL_ADDRESSES, then re-runs check-sp550-cutover.ts with NO --pins, so
 *     the gate reads the written source tables. If that re-run does not exit 0 the files are restored.
 *
 * Exit 2 = refused before the gate; 1 = gate FAIL or the written source did not pass; 0 = PASS.
 * Sends no transaction.
 */
import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { lookup } from 'dns/promises';
import { isIP } from 'net';
import { createPublicClient, http } from 'viem';
import { runSp550CutoverGate, type GateRpc } from '../packages/core/src/sp550CutoverGate.js';
import { resolveSp550Network } from '../packages/core/src/sp550Deployments.js';
import { CANONICAL_ADDRESSES } from '../packages/core/src/addresses.js';
import { sp550PinnedAddressEntries } from '../packages/core/src/sp550Cutover.js';
import { loadReadbackValidator } from './sp550-readback-compare-core.js';
import { applyBookSwitch, bookSwitch, changedEntries, fillPinsTable, isLoopbackHost, isLoopbackUrl, spLiveReadbackProblems, spReadbackApiPath, addressesOverlap, writeAll, parseManifestPins, renderPinsLiteral, switchBook } from './sp550-pin-fill-core.js';

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
    let switched: Record<string, string | null>;
    try { switched = bookSwitch(net.mode, pins); } catch (e) { return refuse((e as Error).message); }
    const shipped = (CANONICAL_ADDRESSES as Record<number, Record<string, unknown>>)[net.chainId] ?? {};
    const book = applyBookSwitch(shipped, switched);

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

    // A fork can sit behind a public host and report any client version, and two hostnames can front ONE
    // remote fork: the endpoint checks below narrow that but cannot close it (all their evidence comes from
    // those endpoints). What closes it is the independent cross-check after them — SP's own live read-back,
    // gathered on SP's providers from another session — plus PR review and the author + DSR hash check.
    if (urls.length < 2) refuse('--write needs --rpc and --rpc2 on two different providers');
    const hosts = urls.map(([, u]) => { try { return new URL(u).hostname.toLowerCase(); } catch { return ''; } });
    if (new Set(hosts).size < 2) refuse('--write needs --rpc and --rpc2 on two different hosts (two paths on one host are one provider)');
    // Two names for one machine are one provider too: the resolved addresses must not overlap.
    // An IP literal is its own address; names are resolved (every family).
    const resolvedSets = await Promise.all(hosts.map((h) => { const bare = h.replace(/^\[|\]$/g, ''); return isIP(bare) ? Promise.resolve([bare]) : lookup(bare, { all: true }).then((r) => r.map((x) => x.address)).catch(() => [] as string[]); }));
    if (resolvedSets.some((r) => !r.length)) refuse('--write: an RPC host does not resolve');
    if (addressesOverlap(resolvedSets[0], resolvedSets[1])) refuse('--write: --rpc and --rpc2 resolve to the same address (one provider behind two names)');
    if (b !== undefined && b !== 'finalized') refuse('--write reads at the finalized block only (no --block override)');

    // Independent cross-check (DSR): SP's own LIVE read-back, committed in its manifest PR and fetched
    // from GitHub at that exact commit, must name every pinned address and codehash. On any mismatch: stop.
    const spCommit = arg('--sp-readback-commit');
    // SP commits it as deployments/release/rc8/<network>.readback.live.json in the data PR after SEND.
    const spPath = arg('--sp-readback-path') ?? `deployments/release/rc8/${net.network}.readback.live.json`;
    if (!spCommit || !/^[0-9a-f]{40}$/.test(spCommit)) refuse('--write needs --sp-readback-commit <40-hex SP commit of the data PR with the live read-back>');
    let apiPath = '';
    try { apiPath = spReadbackApiPath(spPath, spCommit!, net.network); } catch (e) { refuse((e as Error).message); }
    const fetched = spawnSync('gh', ['api', '-H', 'Accept: application/vnd.github.raw', apiPath], { encoding: 'utf8' });
    if (fetched.status !== 0) refuse(`--write: could not fetch SP's live read-back ${spPath}@${spCommit} (${(fetched.stderr || '').trim().split('\n')[0]})`);
    let spRb: unknown;
    try { spRb = JSON.parse(fetched.stdout); } catch { refuse(`--write: SP's live read-back ${spPath}@${spCommit} is not JSON`); }
    const schemaIssues = loadReadbackValidator()(spRb);
    if (schemaIssues.length) refuse(`--write: SP's live read-back is not a valid aoa-a7-readback/1: ${schemaIssues.slice(0, 3).join('; ')}`);
    const spIssues = spLiveReadbackProblems(spRb, pins, net.chainId, sp550PinnedAddressEntries(pins));
    if (spIssues.length) {
        console.error(`STOP: the manifest pins disagree with SP's own live read-back (${spPath}@${spCommit}):`);
        for (const x of spIssues) console.error(`  ❌ ${x}`);
        process.exit(1);
    }
    console.log(`SP's live read-back ${spPath}@${spCommit} names every pinned address and codehash.`);

    // ---- 4. write, then let the gate read the written source ----
    for (const [label, url] of urls) {
        // By spelling, then by what the name resolves to (a hosts-file alias of 127.0.0.1 is a fork too).
        const host = (() => { try { return new URL(url).hostname.replace(/^\[|\]$/g, ''); } catch { return ''; } })();
        const resolved = await lookup(host, { all: true }).catch(() => [] as { address: string }[]);
        if (!resolved.length) refuse(`--write refused: ${label}'s host does not resolve; cannot rule out a local fork`);
        if (resolved.some((r) => isLoopbackHost(r.address))) refuse(`--write refused: ${label} resolves to a loopback address (a local fork); fork addresses never go into the source`);
        if (isLoopbackUrl(url)) refuse(`--write refused: ${label} is a loopback URL (a local fork); fork addresses never go into the source`);
        // Not knowing the node is not "not anvil": a failed or empty answer refuses the write too.
        let client: unknown;
        try { client = await createPublicClient({ transport: http(url) }).request({ method: 'web3_clientVersion' } as never); }
        catch (e) { refuse(`--write refused: ${label} did not answer web3_clientVersion (${(e as Error).name}); cannot rule out a local fork`); }
        if (typeof client !== 'string' || client === '') refuse(`--write refused: ${label} gave no client version; cannot rule out a local fork`);
        if (/^anvil\//i.test(client as string)) refuse(`--write refused: ${label} is an anvil node (${client}); fork addresses never go into the source`);
    }
    // One fill at a time in this checkout: the lock is created exclusively and removed on every exit path.
    const lockBase = path.join(ROOT, '.sp550-pin-fill');
    const lock = `${lockBase}.lock`;
    // The lock doubles as a journal: a run killed between the two renames leaves it behind, naming the
    // files that may be half-written and how to recover (they are tracked: git restore puts them back).
    const tableFile0 = net.mode === 'fresh' ? FILES.fresh : FILES.upgrade;
    // Before-images go next to the lock, so recovery never depends on git (which would also drop
    // unrelated local edits): copy each .before back over its file, then delete the lock and backups.
    const backups = [tableFile0, FILES.book].map((f) => [f, `${lockBase}.${path.basename(f)}.before`] as const);
    const journal = `pid ${process.pid} · ${new Date().toISOString()}\n` +
        backups.map(([f, bk]) => `writing ${path.relative(ROOT, f)} · before-image ${path.relative(ROOT, bk)}`).join('\n') +
        `\nif this file outlives the run, the source may be half-written: restore each file from its before-image (cp), then delete this lock and the before-images\n`;
    try {
        fs.writeFileSync(lock, journal, { flag: 'wx' });
        for (const [f, bk] of backups) fs.copyFileSync(f, bk);
    }
    catch {
        let prev = ''; try { prev = fs.readFileSync(lock, 'utf8'); } catch { /* unreadable */ }
        console.error(`nothing written: ${path.relative(ROOT, lock)} exists — another fill is running, or an earlier one stopped mid-write:\n${prev}`);
        process.exit(1);
    }
    let code = 1;
    let keepLock = false;
    try { write: {
        const tableFile = net.mode === 'fresh' ? FILES.fresh : FILES.upgrade;
        const before = { table: fs.readFileSync(tableFile, 'utf8'), book: fs.readFileSync(FILES.book, 'utf8') };
        let after;
        try { after = { table: fillPinsTable(before.table, table, net.chainId, pins), book: switchBook(before.book, net.chainId, changed, note) }; }
        catch (e) { console.error(`nothing written: ${(e as Error).message}`); break write; }
        let restore: () => string[];
        try { restore = writeAll([{ path: tableFile, before: before.table, after: after.table }, { path: FILES.book, before: before.book, after: after.book }], ROOT); }
        catch (e) {
            console.error((e as Error).message);
            // A rename failed and a rollback did too: the checkout is half-written — keep the recovery data.
            // Keep the recovery data unless writeAll positively reports a clean rollback.
            const unrestored = (e as { unrestored?: string[] }).unrestored;
            if (!Array.isArray(unrestored) || unrestored.length) keepLock = true;
            break write;
        }
        const recheck = ['exec', 'tsx', 'scripts/check-sp550-cutover.ts', '--network', net.network, ...urls.flat(),
            ...(b !== undefined ? ['--block', b] : []), ...(args.includes('--allow-rc') ? ['--allow-rc'] : [])];
        const rc = spawnSync('pnpm', recheck, { cwd: ROOT, stdio: 'inherit' });
        if (rc.status !== 0) {
            const left = restore();
            console.error(`\nthe gate did not pass on the written source (exit ${rc.status}); ${left.length ? left.join('; ') : 'both files restored'}.`);
            if (left.length) keepLock = true; // unrestored files: the journal and before-images stay
            break write;
        }
        console.log(`\nwritten and re-verified from source: ${path.relative(ROOT, tableFile)}, ${path.relative(ROOT, FILES.book)}`);
        code = 0;
    } } catch (e) {
        keepLock = true; // an unexpected failure mid-write: keep the journal and before-images for recovery
        throw e;
    } finally {
        if (keepLock) console.error(`\n${path.relative(ROOT, lock)} kept: recover from the before-images it names`);
        else { fs.rmSync(lock, { force: true }); for (const [, bk] of backups) fs.rmSync(bk, { force: true }); }
    }
    process.exit(code);
}

main().catch((e) => { console.error(e); process.exit(1); });
