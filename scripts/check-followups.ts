/**
 * The follow-up ledger, checked for the ways it goes wrong silently.
 *
 * WHY THE ID COLLISION IS NOT CAUGHT BY GIT
 * -----------------------------------------
 * `followups.sh` allocates the next id as `max(existing) + 1`, read from the ledger on the CURRENT
 * branch. Two branches adding an entry the same evening both see the same maximum and both mint the
 * same number — observed three times in one night here.
 *
 * Git does object: both append at end of file, so the merge conflicts. That is the LOUD half, and it
 * is why FU-26's original description ("merge passes silently") was wrong. The silent half is what
 * happens next: the conflict is resolved by taking the union — which is correct, both entries are
 * real work — and two entries carrying the same id then coexist happily, because nothing downstream
 * has an opinion about ids.
 *
 * From then on "FU-22" names two different things. Every reference to it is ambiguous, and
 * `followups.sh done FU-22` closes whichever one it finds first.
 *
 * WHAT THIS FIXES AND WHAT IT DOES NOT
 * ------------------------------------
 * This is the DETECTION half. The allocator lives in the pilot skill, outside this repository and
 * shared with every other repo that uses it, so changing how ids are minted is not something a
 * repo-level follow-up gets to decide — it is recorded for the human instead.
 *
 * Detection is still worth having on its own: a collision that fails a gate gets renumbered in the
 * same session, while one that only shows up as an ambiguous reference is found weeks later by
 * someone reading a task that points at the wrong entry.
 *
 * Usage:  pnpm exec tsx scripts/check-followups.ts [path]
 * Exit 0 when the ledger is well-formed; 1 otherwise.
 */
import { readFileSync, existsSync } from 'node:fs';

const LEDGER = process.argv[2] ?? 'docs/agent/followups.md';

export interface LedgerProblem {
  // No 'gap' kind, deliberately. Ids are names, not a sequence, and a `check-followups.test.ts`
  // case asserts that gaps are NOT reported — an earlier draft declared the kind here anyway, and a
  // declared-but-unreachable member is worse than nothing: it tells a reader the gate watches
  // something it does not, and it contradicts the test that says it must not. (Raised in review.)
  kind: 'duplicate-id' | 'conflict-marker' | 'malformed-entry';
  detail: string;
}

/** Entry lines look like `- [ ] FU-12 · B · src=… · 2026-09-05 · <text>`. */
const ENTRY = /^- \[( |x)\] FU-(\d+) · ([A-D]) · /;

export function checkLedger(text: string): LedgerProblem[] {
  const problems: LedgerProblem[] = [];
  const lines = text.split('\n');

  // Conflict markers first: a ledger with them is not merely wrong, it is mid-merge, and every other
  // reading below would be describing a file nobody intended to commit.
  lines.forEach((line, i) => {
    if (/^(<{7}|={7}|>{7})/.test(line)) {
      problems.push({ kind: 'conflict-marker', detail: `line ${i + 1}: ${line.slice(0, 40)}` });
    }
  });
  if (problems.length) return problems;

  const seen = new Map<number, number[]>();
  lines.forEach((line, i) => {
    if (!line.startsWith('- [')) return;
    const m = ENTRY.exec(line);
    if (!m) {
      problems.push({ kind: 'malformed-entry', detail: `line ${i + 1}: ${line.slice(0, 70)}` });
      return;
    }
    const id = Number(m[2]);
    seen.set(id, [...(seen.get(id) ?? []), i + 1]);
  });

  for (const [id, at] of [...seen].sort((a, b) => a[0] - b[0])) {
    if (at.length > 1) {
      problems.push({
        kind: 'duplicate-id',
        detail:
          `FU-${id} appears ${at.length} times (lines ${at.join(', ')}). Two branches minted it from the ` +
          'same max, and the conflict resolution kept both. Renumber the later one to the next free id ' +
          'and update any PR text that already referenced it.',
      });
    }
  }
  return problems;
}

if (process.argv[1]?.endsWith('check-followups.ts')) {
  if (!existsSync(LEDGER)) {
    console.error(`check-followups: no ledger at ${LEDGER}`);
    process.exit(1);
  }
  const problems = checkLedger(readFileSync(LEDGER, 'utf8'));
  // Entry-SHAPED lines, which is not the same as entries that parsed — a malformed one is counted
  // here and reported below. Naming it accurately because the number is printed as evidence.
  const entryShapedLines = readFileSync(LEDGER, 'utf8').split('\n').filter((l) => l.startsWith('- [')).length;
  // The count is printed unconditionally. A gate that says only "OK" cannot be told apart from one
  // that parsed nothing — the failure this repo keeps rediscovering.
  console.log(`check-followups: ${LEDGER} — ${entryShapedLines} entry-shaped lines`);
  if (entryShapedLines === 0) {
    console.error('check-followups: parsed 0 entries. The ledger is empty or the entry format changed.');
    process.exit(1);
  }
  for (const p of problems) console.error(`  ❌ ${p.kind}: ${p.detail}`);
  if (problems.length) {
    console.error(`\ncheck-followups: ${problems.length} problem(s).`);
    process.exit(1);
  }
  console.log('check-followups: ✅ ids unique, entries well-formed.');
}
