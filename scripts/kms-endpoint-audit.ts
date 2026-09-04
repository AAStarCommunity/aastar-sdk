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

  // A cross-check on the instrument, not on the SDK. Every path the SDK calls must land in exactly
  // one of the first two buckets, so their sum must equal the SDK path count — and that count was
  // arrived at independently (37, counted by hand and by a reviewer's separate script before this
  // tool existed).
  //
  // This exists because the two filters in sdkPaths() have already been wrong in both directions:
  // comment-stripping was missing (invented "/60" from a BIP-44 path) and the extension blacklist
  // was too broad (hid two real .well-known endpoints by filing them under "SDK never calls it").
  // Neither showed up as an error — each produced a confident, plausible, wrong report, and the
  // second one was only caught because 34+1 did not match a 37 living in a different document.
  // Numbers that must agree should be made to agree HERE, where disagreeing is loud.
  const bucketed = documented.length + notInSpec.length;
  if (bucketed !== sdk.size) {
    console.error(
      `\n❌ instrument check: ${documented.length} + ${notInSpec.length} = ${bucketed}, but sdkPaths() ` +
        `found ${sdk.size}. Every SDK path must be in exactly one bucket — a mismatch means the ` +
        'classification dropped or duplicated something, so no other number in this report is trustworthy.',
    );
    process.exit(1);
  }
  console.log(`   (instrument check: ${documented.length} + ${notInSpec.length} = ${sdk.size} SDK paths ✅)`);

  // Exit non-zero only for the thing a human must act on: a documented addition the SDK never calls.
  const missing = KNOWN_UNDOCUMENTED.filter((u) => !sdk.has(u.path));
  if (missing.length) {
    console.error(`\n❌ ${missing.length} endpoint(s) known to exist upstream are not called by the SDK: ${missing.map((m) => m.path).join(', ')}`);
    process.exit(1);
  }
  console.log('\n✅ every endpoint this baseline can speak for is accounted for.');
}

main();
