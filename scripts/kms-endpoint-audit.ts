/**
 * KMS endpoint audit — what the SDK calls vs what the KMS spec documents.
 *
 * READ THIS BEFORE TRUSTING THE OUTPUT
 * ------------------------------------
 * The baseline is `kms/docs/api/openapi.yaml` in the airaccount-node repo, and that file declares
 * `info.version: 0.28.1`. The repo's latest tag is v0.30.0-beta.1, and **the spec has not been
 * touched since 2026-07-09** — measured: `git log -1 -- kms/docs/api/openapi.yaml` predates the
 * v0.30.0-beta.1 tag, and `git log <tag>..HEAD -- <spec>` is empty.
 *
 * That is not a detail; it decides what this audit can conclude. Concretely, the KMS CHANGELOG says
 * 0.29.0 shipped a `/pop` endpoint (CC-37, BLS Proof-of-Possession, with an on-chain register tx
 * quoted), and `/pop` appears **zero** times in the spec. So the spec is authoritative for the
 * 0.28.1 surface and silent about everything added after.
 *
 * Therefore this tool answers exactly one question:
 *
 *     Does the SDK's client agree with the 0.28.1 DOCUMENTED surface?
 *
 * It cannot answer "does the SDK agree with the deployed server". Endpoints added in 0.29.0+ show
 * up here as `spec-only: absent` at best, or not at all — they are invisible to this comparison,
 * and the `undocumented-additions` section names the ones the CHANGELOG lets us know about rather
 * than pretending the list is complete.
 *
 * Making that limitation loud is the point. A green audit against a stale baseline is exactly the
 * "gate that reads like coverage" this repo keeps finding.
 *
 * Usage:  pnpm exec tsx scripts/kms-endpoint-audit.ts [--spec <path>]
 * Exit 0 when every SDK path is accounted for; 1 when something is unclassified.
 */
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import * as path from 'node:path';

const SDK_ROOT = process.cwd();
const SERVICES_DIR = path.join(SDK_ROOT, 'packages/airaccount/src/server/services');

const argv = process.argv.slice(2);
const specArg = argv.includes('--spec') ? argv[argv.indexOf('--spec') + 1] : null;
const DEFAULT_SPEC = path.join(
  process.env.HOME ?? '',
  'Dev/aastar/AirAccount/kms/docs/api/openapi.yaml',
);
const SPEC = specArg ?? DEFAULT_SPEC;

/** Endpoints the KMS CHANGELOG says exist but the 0.28.1 spec does not document. */
const KNOWN_UNDOCUMENTED: { path: string; since: string; why: string }[] = [
  {
    path: '/pop',
    since: '0.29.0',
    why: 'CC-37 BLS Proof-of-Possession for key-less DVT nodes. In CHANGELOG with an on-chain register tx; absent from the 0.28.1 spec.',
  },
];

function fail(msg: string): never {
  console.error(`kms-endpoint-audit: ${msg}`);
  process.exit(1);
}

/** Paths the SDK's KMS services actually call, as string literals. */
function sdkPaths(): Map<string, string[]> {
  if (!existsSync(SERVICES_DIR)) fail(`no services dir at ${SERVICES_DIR}`);
  const files = execFileSync('bash', ['-c', `ls ${SERVICES_DIR}/kms-*.ts`], { encoding: 'utf8' })
    .trim()
    .split('\n')
    .filter(Boolean);
  const found = new Map<string, string[]>();
  for (const file of files) {
    // Comments are stripped first. Without this, `// defaults to m/44'/60'/0'/0/0` yielded a
    // phantom endpoint "/60" that showed up under "SDK calls it, spec does not document it" —
    // a finding invented entirely by the measuring instrument. Any audit whose output includes
    // something that obviously is not an endpoint should be treated as broken until that is
    // explained, not read past.
    const src = readFileSync(file, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');
    for (const m of src.matchAll(/["'`](\/[a-zA-Z0-9/_.-]*)["'`]/g)) {
      const p = m[1];
      // "/" alone and source-file references are not endpoints.
      //
      // `.json` is deliberately NOT in this list. Two real KMS endpoints end in it —
      // /.well-known/attestation-measurements.json and its -proof sidecar — and the SDK calls both
      // (kms-monitor-service.ts, `this.http.get(...)`). Filtering them out did not merely lose two
      // rows: it moved them into "spec documents it, SDK never calls it", which asserts the OPPOSITE
      // of the truth. Upstream deleting those endpoints would then read here as "no impact" while
      // the SDK broke.
      //
      // Note the pairing with the comment-stripping above: that filter was too LOOSE and invented an
      // endpoint (/60, from a BIP-44 path in a comment); this one was too TIGHT and hid two. Both
      // directions produce a confident, wrong audit.
      if (p === '/' || /\.(ts|js|md)$/.test(p)) continue;
      const list = found.get(p) ?? [];
      const base = path.basename(file);
      if (!list.includes(base)) list.push(base);
      found.set(p, list);
    }
  }
  return found;
}

/** Paths the spec declares, plus the version it claims to describe. */
function specPaths(): { paths: Set<string>; version: string } {
  if (!existsSync(SPEC)) {
    fail(
      `no KMS spec at ${SPEC}. Pass --spec <path>, or clone airaccount-node next to this repo. ` +
        'Refusing to report an audit with no baseline — an empty baseline would make every SDK ' +
        'path look "undocumented" and the run would read as a catastrophe rather than a missing file.',
    );
  }
  const text = readFileSync(SPEC, 'utf8');
  const paths = new Set<string>();
  for (const line of text.split('\n')) {
    const m = /^ {2}(\/[^:]*):\s*$/.exec(line);
    if (m) paths.add(m[1]);
  }
  const v = /^\s*version:\s*(.+)$/m.exec(text.split('paths:')[0] ?? '');
  return { paths, version: v ? v[1].trim() : '(unknown)' };
}

function main() {
  const sdk = sdkPaths();
  const { paths: spec, version } = specPaths();

  if (spec.size === 0) fail(`parsed 0 paths out of ${SPEC} — the parser, not the spec, is probably wrong`);

  const documented: string[] = [];
  const notInSpec: string[] = [];
  for (const p of [...sdk.keys()].sort()) (spec.has(p) ? documented : notInSpec).push(p);
  const specOnly = [...spec].filter((p) => !sdk.has(p)).sort();

  console.log(`\n== KMS endpoint audit ==`);
  console.log(`   SDK services : ${SERVICES_DIR.replace(SDK_ROOT + '/', '')}`);
  console.log(`   spec         : ${SPEC}  (info.version ${version})`);
  console.log(`   ⚠️  baseline is the DOCUMENTED ${version} surface, NOT the deployed server.`);
  console.log(`      Endpoints added after ${version} are invisible here — see 'undocumented additions'.\n`);

  console.log(`-- SDK calls it, spec documents it (${documented.length}) --`);
  for (const p of documented) console.log(`  ✅ ${p}`);

  console.log(`\n-- SDK calls it, spec does NOT document it (${notInSpec.length}) --`);
  for (const p of notInSpec) console.log(`  ⚠️  ${p}   [${(sdk.get(p) ?? []).join(', ')}]`);
  if (notInSpec.length) {
    console.log(
      '     Each is one of: added after the spec froze · renamed upstream · never documented ·\n' +
        '     or an SDK typo. This tool cannot tell them apart — that needs the deployed server.',
    );
  }

  console.log(`\n-- spec documents it, SDK never calls it (${specOnly.length}) --`);
  for (const p of specOnly) console.log(`  ·  ${p}`);
  console.log('     Not necessarily a gap: the SDK is a client, not a conformance suite.');

  console.log(`\n-- known additions the baseline cannot see (${KNOWN_UNDOCUMENTED.length}) --`);
  for (const u of KNOWN_UNDOCUMENTED) {
    const used = sdk.has(u.path);
    console.log(`  ${used ? '✅' : '❌'} ${u.path}  (since ${u.since}) — SDK ${used ? 'calls it' : 'does NOT call it'}`);
    console.log(`     ${u.why}`);
  }
  console.log('     This list is what the CHANGELOG happens to mention. It is NOT complete, and a');
  console.log('     complete one needs the deployed server or a refreshed spec.');

  console.log(
    `\nsummary: ${documented.length} documented · ${notInSpec.length} not in spec · ` +
      `${specOnly.length} spec-only · ${KNOWN_UNDOCUMENTED.filter((u) => !sdk.has(u.path)).length} known-missing`,
  );

  // ── two checks on the INSTRUMENT, with very different power ────────────────────────────────
  //
  // (1) The externally-derived count. This is the one that can actually catch a broken extractor.
  //
  // 37 did not come from this file. It was counted by hand and, independently, by a reviewer's own
  // script, before this tool existed — and the only reason the `.json` bug was ever found is that
  // this tool said 35 while that 37 sat in a different document. Pinning it here moves that
  // cross-document disagreement into the one place where disagreeing is loud.
  //
  // Changing this number is allowed and will happen — but it must be a deliberate edit in the same
  // commit that adds or removes an endpoint, with the endpoint named. Bumping it to make a red run
  // green is the exact move this guard exists to make visible.
  const EXPECTED_SDK_PATHS = 37;
  if (sdk.size !== EXPECTED_SDK_PATHS) {
    console.error(
      `\n❌ instrument check: sdkPaths() found ${sdk.size} paths, but ${EXPECTED_SDK_PATHS} are expected.\n` +
        '   This number is derived OUTSIDE this file (hand count + an independent reviewer script).\n' +
        '   Either an endpoint was added/removed in the SDK — in which case update EXPECTED_SDK_PATHS\n' +
        '   in the same commit and name the endpoint — or the extractor in sdkPaths() is wrong again.\n' +
        '   It has been wrong twice: too loose (invented "/60" from a BIP-44 path in a comment) and\n' +
        '   too tight (hid two real .well-known endpoints). Neither raised an error on its own.',
    );
    process.exit(1);
  }

  // (2) The bipartition identity. Cheap, and STRUCTURALLY TAUTOLOGICAL as the code stands today:
  // `documented` and `notInSpec` are a strict two-way split of `sdk.keys()`, so this can only fail
  // if someone later inserts a filter between the split and this line. It is kept for exactly that
  // — and for nothing else.
  //
  // It is NOT a check on the extractor, and an earlier version of this comment claimed it was.
  // Measured, by the reviewer: reintroducing the `.json` bug produced a wrong report (34·1·10·1)
  // that this identity happily passed, and the `/60` bug likewise (38 = 37+1, passed). Hit rate on
  // the two failure modes named in its own comment: 0 of 2. The mistake was choosing the wrong
  // subject — both bugs live INSIDE sdkPaths(), and `sdk.size` is that function's own output, so
  // the loss was already absorbed into both sides of the comparison.
  const bucketed = documented.length + notInSpec.length;
  if (bucketed !== sdk.size) {
    console.error(
      `\n❌ bipartition broken: ${documented.length} + ${notInSpec.length} = ${bucketed}, but sdkPaths() ` +
        `returned ${sdk.size}. Something now drops or duplicates a path between the split and here.`,
    );
    process.exit(1);
  }
  console.log(`   (instrument: ${sdk.size} SDK paths == expected ${EXPECTED_SDK_PATHS} ✅ · bipartition ${documented.length}+${notInSpec.length} ✅)`);

  // Exit non-zero only for the thing a human must act on: a documented addition the SDK never calls.
  const missing = KNOWN_UNDOCUMENTED.filter((u) => !sdk.has(u.path));
  if (missing.length) {
    console.error(`\n❌ ${missing.length} endpoint(s) known to exist upstream are not called by the SDK: ${missing.map((m) => m.path).join(', ')}`);
    process.exit(1);
  }
  console.log('\n✅ every endpoint this baseline can speak for is accounted for.');
}

main();
