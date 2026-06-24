#!/usr/bin/env tsx
/**
 * ABI change triage — decide what to DO about each upstream ABI change.
 *
 * `abi-sync.ts` finds WHAT changed (added/removed functions, new contracts). This decides HOW to
 * handle each one, per the maintenance policy:
 *   • LOW-frequency / admin / internal  → expose via the raw ABI only (consumers call with viem). No wrapper.
 *   • HIGH-frequency / consumer-facing  → add or adjust a client/action wrapper (+ test).
 *   • REMOVED upstream but still used in SDK source → BREAKAGE; fix the wrapper.
 *
 * It runs `abi-sync.ts --json` to get the change set, greps the SDK source to see what's already
 * wrapped, and prints a per-change recommendation. Heuristic — the final call is the developer's
 * (the abi-sync skill walks you through acting on it).
 *
 *   pnpm run abi:triage
 */
import { execSync } from 'child_process';

const SRC_GLOB = 'packages --include=*.ts';
const EXCLUDE = ":(exclude)"; // unused placeholder; grep filters below

// name → admin/internal (expose-only). Owner/governance/config/lifecycle verbs.
const LOW = /^(set|add|remove|grant|revoke|pause|unpause|initialize|init|reinitialize|upgrade|withdraw|transferOwnership|renounce|configure|update|register[A-Z]?role|setApprovalForAll|_|on[A-Z]|supportsInterface|proxiableUUID|eip712Domain)/i;
// name → consumer-facing flow (wrap). User actions + common reads.
const HIGH = /^(buy|sell|transfer|mint|burn|stake|unstake|claim|redeem|open|close|settle|execute|deposit|send|permit|swap|repay|recordDebt|createAccount|grantSession|revokeSession|sign|verify|get[A-Z]|balanceOf|quote|prepare|submit)/i;

interface FnChange { contract: string; kind: string; sig: string; change: 'added' | 'removed' }
interface Report { missing: { contract: string; level: string }[]; drifted: string[]; changes: FnChange[]; newContracts: string[] }

let report: Report;
try {
  report = JSON.parse(execSync('tsx scripts/abi-sync.ts --json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
} catch (e: any) {
  console.error('failed to run abi-sync --json:', e?.message);
  process.exit(1);
}

const fnName = (sig: string) => sig.slice(0, sig.indexOf('('));
function wrappedIn(name: string): string | null {
  try {
    // referenced in any non-ABI, non-test SDK source as 'name' or functionName: 'name'
    const out = execSync(`grep -rl "['\\\"]${name}['\\\"]" ${SRC_GLOB} 2>/dev/null | grep -vE "/abis/|\\.test\\.|/dist/" | head -1`, { encoding: 'utf8' }).trim();
    return out || null;
  } catch {
    return null;
  }
}

const classify = (name: string) => (HIGH.test(name) ? 'HIGH' : LOW.test(name) ? 'LOW' : 'REVIEW');

const added = report.changes.filter((c) => c.kind === 'function' && c.change === 'added');
const removed = report.changes.filter((c) => c.kind === 'function' && c.change === 'removed');

console.log('=== ABI change triage ===\n');

if (report.missing.length) {
  console.log(`🆕 ${report.missing.length} new contract(s): ${report.missing.map((m) => m.contract).join(', ')}`);
  console.log('   → run `abi:sync --fix` to copy the ABI, export it in abis/index.ts, then triage its consumer-facing functions.\n');
}

console.log('— ADDED upstream (decide: wrap vs expose) —');
const toWrap: string[] = [];
for (const c of added) {
  const name = fnName(c.sig);
  const where = wrappedIn(name);
  const cls = classify(name);
  const action = where ? `already referenced (${where}) — adjust if signature changed` : cls === 'HIGH' ? 'WRAP (add client/action method + test)' : cls === 'LOW' ? 'expose via ABI only' : 'REVIEW manually';
  if (!where && cls === 'HIGH') toWrap.push(`${c.contract}.${c.sig}`);
  console.log(`  [${cls}] ${c.contract}.${c.sig}  →  ${action}`);
}
if (!added.length) console.log('  (none)');

console.log('\n— REMOVED upstream (breakage if still used) —');
let breakage = 0;
for (const c of removed) {
  const name = fnName(c.sig);
  const where = wrappedIn(name);
  if (where) { breakage++; console.log(`  ⚠️  ${c.contract}.${c.sig}  STILL USED in ${where} — fix/remove the wrapper`); }
  else console.log(`  ok   ${c.contract}.${c.sig}  (not referenced in SDK)`);
}
if (!removed.length) console.log('  (none)');

console.log('\n=== summary ===');
console.log(`${toWrap.length} consumer-facing function(s) to WRAP:`);
for (const t of toWrap) console.log(`  • ${t}`);
console.log(`${breakage} removed function(s) still used in SDK (breakage to fix).`);
console.log('\nHeuristic — confirm each before acting. The `abi-sync` skill drives the wrap/expose/fix steps.');
process.exit(breakage > 0 ? 1 : 0);
