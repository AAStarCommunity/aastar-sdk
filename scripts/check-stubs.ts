#!/usr/bin/env tsx
/**
 * Silent-stub guard.
 *
 * #169 root cause: `CommunityClient.launchCommunity` shipped `roleData = '0x'` with the comment
 * "Simplified - needs proper encoding" — a stub that SILENTLY submitted invalid data (looked like a
 * working function, reverted on-chain). Mock-only unit tests never caught it. This greps shipped
 * `src/` for the markers that mean "known-incomplete but shipped anyway", so an incomplete write
 * path is flagged before release instead of reverting in a consumer's hands.
 *
 * Policy: an incomplete encoding/arg must `throw` (NotImplemented), never silently submit a
 * placeholder. A throwing stub fails loudly in tests; a silent one ships broken.
 *
 *   pnpm run check:stubs
 */
import * as fs from 'fs';
import * as path from 'path';

const SDK_ROOT = process.cwd();
const PKG_DIR = path.join(SDK_ROOT, 'packages');

// High-signal markers of a silent / incomplete shipped path. Case-insensitive.
const MARKERS = [
  /needs proper encoding/i,
  /\bSimplified\b\s*[-—:]/i, // "Simplified -" style stub notes (not the adjective in prose)
  /placeholder\s+(value|encoding|data|address|for now)/i,
  /TODO:?\s*(encode|implement|proper|real|wire)/i,
  /\bFIXME\b/,
  /for now,?\s*(just\s+)?(return|use|pass)\s+['"]?0x/i,
  /,\s*\/\/\s*placeholder/i, // an arg passed with a "// placeholder" note (#169: target-as-token)
  /\/\/\s*placeholder:/i, // "// Placeholder: <real impl missing>" stub comments
  /(\bmock\b.*\bplaceholder\b|\bplaceholder\b.*\bmock\b)/i, // "Mock … or placeholder" (#169: proof='0x')
];

// Allowlist: file:line substrings intentionally exempt (with a reason). These are NOT silent stubs:
const ALLOW: string[] = [
  'admin/src/ProtocolGovernance.ts', // updateEntryPoint THROWS (the "Placeholder:" note explains why, not a silent path)
  'enduser/src/testAccountManager.ts', // test/experiment harness placeholder account, not a shipped consumer path
];

function* walk(dir: string): Generator<string> {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (/(^|\/)(node_modules|dist|__tests__|abis)$/.test(p)) continue;
      yield* walk(p);
    } else if (/\.ts$/.test(e.name) && !/\.test\.ts$/.test(e.name) && !/\.d\.ts$/.test(e.name)) {
      yield p;
    }
  }
}

const hits: string[] = [];
for (const file of walk(PKG_DIR)) {
  // only shipped source
  if (!file.includes(`${path.sep}src${path.sep}`)) continue;
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (MARKERS.some((m) => m.test(line))) {
      const loc = `${path.relative(SDK_ROOT, file)}:${i + 1}`;
      if (ALLOW.some((a) => loc.includes(a))) return;
      hits.push(`  ${loc}  ${line.trim().slice(0, 110)}`);
    }
  });
}

console.log('=== silent-stub guard (shipped packages/*/src) ===\n');
if (hits.length === 0) {
  console.log('PASS: no silent-stub markers in shipped source.');
  process.exit(0);
}
console.error(`${hits.length} potential silent stub(s) — make them throw NotImplemented, or finish them (NEVER ship a placeholder arg):\n`);
console.error(hits.join('\n'));
console.error('\n(If one is a false positive, add its file:line to ALLOW in scripts/check-stubs.ts with a reason.)');
process.exit(1);
