#!/usr/bin/env tsx
/**
 * Provenance gate for the vendored SuperPaymaster 5.5.0 ABIs (CC-122 R2, SDK #417).
 *
 * 5.5.0 is not deployed anywhere, and the generic gates (`abi:sync`, `check:abi-drift`) compare
 * against whatever `../SuperPaymaster/out` happens to be built from — usually NOT the 5.5.0 tag.
 * So these three files get their own, narrower chain of custody:
 *
 *   1. the tag must still resolve to the pinned commit (a moved tag fails, it does not re-pin);
 *   2. each SDK file must be byte-identical to the git BLOB at that commit (`git show`, never the
 *      working tree — an uncommitted upstream edit must not decide this);
 *   3. optionally (SP550_OUT=<forge out/ built from that commit>), each vendored union must equal
 *      the union of its compiled halves by function/event/error signature AND function outputs,
 *      so a stale upstream `abis/*.json` cannot be laundered through step 2.
 *
 * Every run prints what it checked. A run that checked nothing says SKIP, and REQUIRE_UPSTREAM=1
 * turns that into a failure.
 *
 *   pnpm run check:sp550-abis
 *   SP_REPO=/path/to/SuperPaymaster SP550_OUT=/path/to/sp-tag-checkout/out pnpm run check:sp550-abis
 */
import { execFileSync } from 'child_process';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

const SDK_ROOT = process.cwd();
const ABIS_DIR = path.join(SDK_ROOT, 'packages/core/src/abis');
const TAG = 'v5.5.0-rc.4';
const PINNED_COMMIT = 'fbd74fb1e2e9d948996e6d6c02c48dc1c1778107';
const SP_REPO = path.resolve(SDK_ROOT, process.env.SP_REPO ?? '../SuperPaymaster');
const SP_OUT = process.env.SP550_OUT ? path.resolve(SDK_ROOT, process.env.SP550_OUT) : undefined;
const REQUIRE_UPSTREAM = process.env.REQUIRE_UPSTREAM === '1';

/** SDK file -> upstream blob path, and the compiled contracts whose union it must equal. */
const FILES: { sdk: string; upstream: string; parts: string[] }[] = [
    { sdk: 'SuperPaymaster-5.5.0.full.json', upstream: 'abis/SuperPaymaster.full.json', parts: ['SuperPaymaster', 'SuperPaymasterAdmin'] },
    { sdk: 'SuperPaymasterLens.json', upstream: 'abis/SuperPaymasterLens.json', parts: ['SuperPaymasterLens'] },
    { sdk: 'xPNTsTokenV2.full.json', upstream: 'abis/xPNTsTokenV2.full.json', parts: ['xPNTsTokenV2', 'xPNTsTokenV2Ext'] },
    { sdk: 'xPNTsFactoryV2.json', upstream: 'abis/xPNTsFactoryV2.json', parts: ['xPNTsFactoryV2'] },
    { sdk: 'APNTsCapped.json', upstream: 'abis/APNTsCapped.json', parts: ['APNTsCapped'] },
    { sdk: 'AOAProtocolRegistry.json', upstream: 'abis/AOAProtocolRegistry.json', parts: ['AOAProtocolRegistry'] },
    { sdk: 'GlobalTierSource.json', upstream: 'abis/GlobalTierSource.json', parts: ['GlobalTierSource'] },
];

/**
 * Differences between a vendored union and its compiled halves that are KNOWN upstream defects,
 * each with the evidence. Printed on every run (never silent) and matched EXACTLY — anything else
 * still fails. Remove an entry when the tag that fixes it is vendored.
 */
const KNOWN_UPSTREAM_GAPS: Record<string, Record<string, string>> = {
    'SuperPaymaster-5.5.0.full.json': {
        'error:InvalidContextLength()':
            'SP v5.5.0-rc.4 abis/SuperPaymaster.full.json is stale by the SP repo\'s own gate: ' +
            '`python3 scripts/gen-sp-full-abi.py --check` at fbd74fb1 prints STALE. The error was added to the core ' +
            '(SuperPaymasterStorage.sol:271, reverted in postOp at SuperPaymaster.sol:393) after full.json was last ' +
            'regenerated (6e72d025). Error-only: no selector the SDK encodes is affected.',
    },
};

const sha = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
const abiOf = (raw: string): any[] => { const j = JSON.parse(raw); return Array.isArray(j) ? j : j.abi; };
const renderType = (i: any): string =>
    typeof i?.type === 'string' && i.type.startsWith('tuple') && Array.isArray(i.components)
        ? `(${i.components.map(renderType).join(',')})${i.type.slice('tuple'.length)}`
        : (i?.type ?? '?');
/** Canonical entry keys: kind:name(inputs)->(outputs). Outputs included (the guardianSlashCases lesson). */
const keys = (abi: any[]) => new Set(
    abi.filter((e) => ['function', 'event', 'error'].includes(e.type)).map((e) =>
        `${e.type}:${e.name}(${(e.inputs || []).map(renderType).join(',')})` +
        (e.type === 'function' ? `->(${(e.outputs || []).map(renderType).join(',')})` : '') +
        (e.type === 'event' ? `[${(e.inputs || []).map((i: any) => (i.indexed ? 'i' : '-')).join('')}]` : '')),
);
const count = (abi: any[], t: string) => abi.filter((e) => e.type === t).length;

const failures: string[] = [];
let checked = 0;
let unionChecked = 0;

if (!fs.existsSync(path.join(SP_REPO, '.git'))) {
    const msg = `SuperPaymaster repo not found at ${SP_REPO}`;
    if (REQUIRE_UPSTREAM) { console.error(`FAIL: ${msg} (REQUIRE_UPSTREAM=1)`); process.exit(1); }
    console.log(`⚠️  ${msg} — checked 0 file(s). This is a SKIP, not a verification.`);
    process.exit(0);
}

const git = (...args: string[]) => execFileSync('git', ['-C', SP_REPO, ...args], { maxBuffer: 64 * 1024 * 1024 });
let resolved = '';
try { resolved = git('rev-parse', `${TAG}^{commit}`).toString().trim(); } catch (e) { failures.push(`cannot resolve ${TAG}: ${String(e).slice(0, 120)}`); }
if (resolved && resolved !== PINNED_COMMIT) failures.push(`${TAG} resolves to ${resolved}, pinned ${PINNED_COMMIT} — the tag moved; re-vendor deliberately`);
console.log(`=== SP 5.5.0 vendored ABI provenance (${TAG} = ${PINNED_COMMIT.slice(0, 12)}) ===`);

for (const f of FILES) {
    const local = fs.readFileSync(path.join(ABIS_DIR, f.sdk));
    let blob: Buffer;
    try { blob = git('show', `${PINNED_COMMIT}:${f.upstream}`); } catch (e) { failures.push(`${f.upstream}: not in ${PINNED_COMMIT.slice(0, 12)}`); continue; }
    const abi = abiOf(local.toString('utf8'));
    const same = sha(new Uint8Array(local)) === sha(new Uint8Array(blob));
    checked++;
    console.log(`${same ? '✅' : '❌'} ${f.sdk}  fn ${count(abi, 'function')} · ev ${count(abi, 'event')} · err ${count(abi, 'error')}  ${same ? 'byte-identical to' : 'DIFFERS from'} ${f.upstream}@${PINNED_COMMIT.slice(0, 12)} (sha256 ${sha(new Uint8Array(local)).slice(0, 16)}…)`);
    if (!same) failures.push(`${f.sdk} is not byte-identical to ${f.upstream}@${PINNED_COMMIT.slice(0, 12)}`);

    if (SP_OUT) {
        const halves = f.parts.map((p) => path.join(SP_OUT, `${p}.sol`, `${p}.json`));
        const missing = halves.filter((h) => !fs.existsSync(h));
        if (missing.length) { failures.push(`${f.sdk}: compiled half missing: ${missing.map((m) => path.relative(SP_OUT, m)).join(', ')}`); continue; }
        const union = new Set<string>();
        for (const h of halves) for (const k of keys(abiOf(fs.readFileSync(h, 'utf8')))) union.add(k);
        const mine = keys(abi);
        const onlyMine = [...mine].filter((k) => !union.has(k));
        const gaps = KNOWN_UPSTREAM_GAPS[f.sdk] ?? {};
        const onlyCompiledAll = [...union].filter((k) => !mine.has(k));
        const onlyCompiled = onlyCompiledAll.filter((k) => !(k in gaps));
        for (const k of onlyCompiledAll.filter((k) => k in gaps)) console.log(`   ⚠️  known upstream gap (compiled-only): ${k} — ${gaps[k]}`);
        for (const k of Object.keys(gaps).filter((k) => !onlyCompiledAll.includes(k))) {
            failures.push(`${f.sdk}: KNOWN_UPSTREAM_GAPS entry ${k} no longer reproduces — remove it`);
        }
        unionChecked++;
        if (onlyMine.length || onlyCompiled.length) {
            failures.push(`${f.sdk} != union(${f.parts.join(' ∪ ')}) of compiled out/: +${onlyMine.length} vendored-only, +${onlyCompiled.length} compiled-only ` +
                `(${[...onlyMine.slice(0, 3), ...onlyCompiled.slice(0, 3)].join('; ')})`);
            console.log(`   ❌ union(${f.parts.join(' ∪ ')}) mismatch`);
        } else {
            console.log(`   ✅ = union(${f.parts.join(' ∪ ')}) of compiled out/ — ${mine.size} entries incl. outputs`);
        }
    }
}

console.log(`\nchecked ${checked}/${FILES.length} file(s) against the pinned blob; ${SP_OUT ? `${unionChecked}/${FILES.length} against compiled out/` : 'compiled-out/ check NOT run (set SP550_OUT)'}.`);
if (failures.length) { console.error(`\nFAIL:\n - ${failures.join('\n - ')}`); process.exit(1); }
if (checked === 0) { console.log('SKIP: nothing compared.'); process.exit(REQUIRE_UPSTREAM ? 1 : 0); }
console.log('PASS');
