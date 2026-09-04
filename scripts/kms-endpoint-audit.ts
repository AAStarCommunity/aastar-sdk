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
/**
 * SECOND, INDEPENDENT extractor — by how a path is USED, not by what it looks like (FU-27).
 *
 * `sdkPaths()` below finds every string literal shaped like a path. This one finds the first
 * argument of an HTTP call. The mechanisms share nothing: this needs no comment stripping (a path in
 * a comment is not passed to `.get()`) and no extension filter (the `.json` endpoints are arguments
 * like any other), so the two do not fail the same way. Their DISAGREEMENT is the signal, which is
 * what the old remembered path count was standing in for — a number a human had to remember, and which anyone
 * could make a red run green by editing.
 *
 * It also reports how many calls pass a VARIABLE rather than a literal. That number is what makes
 * the comparison interpretable: this repo's KMS client has a generic wrapper whose callers hand it a
 * path, so the literal scan legitimately finds more than this one does.
 */
function calledPaths(): { paths: Set<string>; indirectCalls: number } {
  const files = execFileSync('bash', ['-c', `ls ${SERVICES_DIR}/kms-*.ts`], { encoding: 'utf8' })
    .trim()
    .split('\n')
    .filter(Boolean);
  const paths = new Set<string>();
  let indirectCalls = 0;
  for (const file of files) {
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(/\.(get|post|put|patch|delete)\s*(?:<[^>]*>)?\s*\(\s*([^,)]+)/g)) {
      const literal = /^["'`](\/[^"'`]*)["'`]$/.exec(m[2].trim());
      if (literal) paths.add(literal[1]);
      else indirectCalls += 1;
    }
  }
  return { paths, indirectCalls };
}

/**
 * THIRD extractor — path literals that sit in an EXPRESSION position (FU-27).
 *
 * The call-site scan closes one direction only. Measured, replaying both historical bugs against it:
 *
 *   re-add the `.json` filter (the real one)   → caught, and it names both endpoints
 *   remove comment stripping (the "/60" one)   → NOT caught: 37 → 38, and the extra hides among
 *                                                the sixteen paths the literal scan legitimately
 *                                                finds that no call site uses
 *
 * `EXPECTED_SDK_PATHS` would have caught the second (38 ≠ 37), so dropping it without replacing that
 * half would have shipped a regression dressed as an improvement. This is the replacement: a path
 * that is really an endpoint is passed, assigned, or returned — it appears after `(`, `,`, `=`, `:`,
 * `[`, or `return`. A path scraped out of prose (`m/44'/60'/0'/0/0`) is preceded by an ordinary
 * character and fails that, with no number for anyone to remember.
 */
function expressionPositionPaths(): Set<string> {
  const files = execFileSync('bash', ['-c', `ls ${SERVICES_DIR}/kms-*.ts`], { encoding: 'utf8' })
    .trim()
    .split('\n')
    .filter(Boolean);
  const paths = new Set<string>();
  for (const file of files) {
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(/(\(|,|=|:|\[|\breturn)\s*["'`](\/[a-zA-Z0-9/_.-]*)["'`]/g)) {
      paths.add(m[2]);
    }
  }
  return paths;
}

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

  // ── checks on the INSTRUMENT ───────────────────────────────────────────────────────────────
  //
  // (1) Two extractors, built on different mechanisms, cross-checked (FU-27).
  //
  // This replaces the old remembered path count, which was independence outsourced to a human memory:
  // the number lived in this file, so making a red run green took one edit, and nothing recorded
  // whether that edit was a deliberate endpoint change or a shrug.
  //
  // The invariant: every path that appears AT A CALL SITE must also be found by the literal scan.
  // A violation means `sdkPaths()` is filtering out real endpoints — which is exactly the bug that
  // happened: the `.json` filter dropped two `.well-known` endpoints and, worse, moved them into
  // "the spec documents it, the SDK never calls it", asserting the opposite of the truth.
  const called = calledPaths();
  const missedByLiteralScan = [...called.paths].filter((p) => !sdk.has(p)).sort();
  const literalOnly = [...sdk.keys()].filter((p) => !called.paths.has(p)).sort();

  console.log(
    `   (instrument: literal scan ${sdk.size} · call-site scan ${called.paths.size} + ` +
      `${called.indirectCalls} indirect call(s) · literal-only ${literalOnly.length})`,
  );

  if (missedByLiteralScan.length) {
    console.error(
      `\n❌ instrument check: ${missedByLiteralScan.length} path(s) are passed to an HTTP call but the\n` +
        `   literal scan does not report them: ${missedByLiteralScan.join(', ')}\n` +
        '   sdkPaths() is dropping real endpoints. Every row about them in the report above is wrong\n' +
        '   in the most misleading direction: they appear as "documented but never called".',
    );
    process.exit(1);
  }

  // (2) The literal scan may legitimately find MORE, but only because some calls take a variable.
  // With no indirect calls there is no such excuse, and an extra path means the literal scan invented
  // one — the other direction of the same bug, which once produced "/60" out of a BIP-44 path in a
  // comment. This is weaker than (1) and says so: while indirect calls exist, an invented path hides
  // among the legitimate extras.
  // (2) Every reported path must occupy an expression position. This is the other direction: the
  // literal scan inventing an endpoint out of prose. It replaces what `EXPECTED_SDK_PATHS` covered,
  // without asking anyone to remember a number.
  const inExpression = expressionPositionPaths();
  const notUsed = [...sdk.keys()].filter((p) => !inExpression.has(p)).sort();
  if (notUsed.length) {
    console.error(
      `\n❌ instrument check: ${notUsed.length} reported path(s) never appear in an expression —\n` +
        `   ${notUsed.join(', ')}\n` +
        '   They are not passed, assigned, or returned anywhere, so they are not endpoints the SDK\n' +
        '   calls. The literal scan is reading them out of prose; comment stripping is the usual cause.',
    );
    process.exit(1);
  }

  // (3) With no indirect calls there is no excuse for the literal scan finding more at all.
  if (called.indirectCalls === 0 && literalOnly.length > 0) {
    console.error(
      `\n❌ instrument check: no call passes a variable, yet the literal scan reports ${literalOnly.length}\n` +
        `   path(s) no call site uses: ${literalOnly.join(', ')}\n` +
        '   With no indirect calls there is nothing to explain them — the literal scan is inventing paths.',
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
  console.log(`   (instrument: bipartition ${documented.length}+${notInSpec.length} == ${sdk.size} ✅)`);

  // Exit non-zero only for the thing a human must act on: a documented addition the SDK never calls.
  const missing = KNOWN_UNDOCUMENTED.filter((u) => !sdk.has(u.path));
  if (missing.length) {
    console.error(`\n❌ ${missing.length} endpoint(s) known to exist upstream are not called by the SDK: ${missing.map((m) => m.path).join(', ')}`);
    process.exit(1);
  }
  console.log('\n✅ every endpoint this baseline can speak for is accounted for.');
}

main();
