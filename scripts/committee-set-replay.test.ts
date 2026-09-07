/**
 * The distinguishing case the chain could not produce.
 *
 * #415 review measured that on the live validator, ordered replay and a set difference BOTH returned
 * 4 — zero nodeIds had ever been re-assigned after a clear, so the live data could not tell the two
 * implementations apart. Every assertion here exists to construct that difference synthetically.
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { replaySetEvents, setDifferenceSet, type SetEvent } from './committee-set-replay.js';

const ev = (nodeId: string, add: boolean, block: number, idx = 0): SetEvent => ({
    nodeId,
    add,
    block: BigInt(block),
    idx,
});

describe('replaySetEvents', () => {
    it('append-only history: every assigned node is live', () => {
        const live = replaySetEvents([ev('a', true, 1), ev('b', true, 2), ev('c', true, 3)]);
        expect([...live].sort()).toEqual(['a', 'b', 'c']);
    });

    it('a cleared node is not live — the bug this replaced returned it', () => {
        const live = replaySetEvents([ev('a', true, 1), ev('b', true, 2), ev('b', false, 3)]);
        expect([...live].sort()).toEqual(['a']);
    });

    // THE case. `freeSlots` recycling makes assign→clear→assign reachable on chain; it had simply
    // never happened yet when this code was written.
    it('assign → clear → assign leaves the node LIVE', () => {
        const live = replaySetEvents([ev('x', true, 1), ev('x', false, 2), ev('x', true, 3)]);
        expect([...live]).toEqual(['x']);
    });

    // The reason for choosing ordered replay, stated as a measurement rather than a claim.
    it('a set difference gets exactly that input wrong', () => {
        const events = [ev('x', true, 1), ev('x', false, 2), ev('x', true, 3)];
        expect(setDifferenceSet(events).has('x'), 'set difference drops a node that came back').toBe(false);
        expect(replaySetEvents(events).has('x'), 'ordered replay keeps it').toBe(true);
    });

    // And the two must AGREE on the shape the chain actually has today, or this test would be
    // pinning a difference that never applies to the caller.
    it('the two agree when no node is ever re-assigned — which is why live data could not decide', () => {
        const events = [ev('a', true, 1), ev('b', true, 2), ev('c', true, 3), ev('b', false, 4)];
        expect([...replaySetEvents(events)].sort()).toEqual([...setDifferenceSet(events)].sort());
    });

    it('same-block events are ordered by log index, not by insertion', () => {
        // Register then revoke inside ONE transaction: only `idx` separates them, and reading that
        // order backwards flips the answer.
        const live = replaySetEvents([ev('x', false, 7, 5), ev('x', true, 7, 4)]);
        expect(live.has('x'), 'clear at idx 5 comes after assign at idx 4').toBe(false);
        const other = replaySetEvents([ev('y', true, 7, 5), ev('y', false, 7, 4)]);
        expect(other.has('y'), 'assign at idx 5 comes after clear at idx 4').toBe(true);
    });

    it('an empty history has an empty live set', () => {
        expect(replaySetEvents([]).size).toBe(0);
    });
});

/**
 * WHICH TEST ABOVE ACTUALLY GUARDS WHAT — measured by #415 review, written down so a future prune
 * does not remove the wrong one.
 *
 * Mutating `replaySetEvents` back to append-only reds THREE of them: `cleared-not-live`,
 * `the two agree…`, and `same-block events are ordered by log index`. It does NOT red
 * `a set difference gets exactly that input wrong` — that one asserts the set difference is wrong
 * and the replay keeps `x`, and append-only also keeps `x`.
 *
 * So `a set difference gets exactly that input wrong` pins **why this implementation was chosen**,
 * not **whether it is correct**. Deleting it loses the reason and no protection; deleting
 * `the two agree…` is what takes the protection away. Removing the `idx` tiebreaker reds exactly
 * one test — the same-block one — so that case has a single guard and no redundancy to spare.
 */
describe('setDifferenceSet stays out of production', () => {
    // The module says `NEVER call this from production code`. That sentence was a directive with
    // nothing executing it — the shape this repo keeps finding. This turns it into a reading:
    // adding `setDifferenceSet` to any non-test file must red this.
    // The name of the test below says what this list covers, because #415 review caught the earlier
    // name claiming more than the scanner reached: it was a universal quantifier over a domain of
    // `['scripts','packages','tests'] × /\.tsx?$/`, and `scripts/_n.mts` sat INSIDE a scanned
    // directory and was skipped on its extension alone.
    //
    // `ext/` and `docs/api/` are deliberately out: the first is vendored third-party code, the
    // second is generated typedoc output (~1200 files of permalink noise). Neither can import from
    // `scripts/`, and pulling them in would make the count large enough that nobody reads it.
    // `lib` is deliberately absent, and the reason is a reading rather than a guess: it holds 10 TS
    // files in a working tree but **zero tracked ones** (`lib/shared-config` is a submodule), so a
    // clean checkout has nothing there and the per-root floor below correctly reds. CI found that
    // within minutes of this list being written — I had enumerated the WORKING TREE while CI
    // enumerates the REPOSITORY, which is the same provenance mismatch this whole round is about.
    const ROOTS = ['scripts', 'packages', 'tests', 'examples', 'node-onboarding-portal'];
    // .mts / .cts included — that is the hole review found, not a hypothetical one.
    const IS_CODE = (p: string) => /\.(m|c)?tsx?$/.test(p) && !/\.test\.(m|c)?tsx?$/.test(p);

    function walk(dir: string, acc: string[] = []): string[] {
        for (const e of readdirSync(dir, { withFileTypes: true })) {
            const p = join(dir, e.name);
            if (e.name === 'node_modules' || e.name === 'dist' || e.name === '.git') continue;
            if (e.isDirectory()) walk(p, acc);
            else if (statSync(p).isFile() && IS_CODE(p)) acc.push(p);
        }
        return acc;
    }

    it('no non-test source file under the scanned roots references setDifferenceSet', () => {
        // Per-root, not just in total: a repo-wide floor cannot tell "every root is there" from
        // "one root vanished and the biggest one carried the count". #415 review named this.
        const byRoot = ROOTS.map((r) => [r, walk(r)] as const);
        for (const [root, found] of byRoot) {
            expect(found.length, `root "${root}" contributed zero files — it moved, and this check went blind there`).toBeGreaterThan(0);
        }
        const files = byRoot.flatMap(([, f]) => f);
        // The total floor stays as a second, coarser tripwire for a repo-wide layout change.
        expect(files.length, 'scanned zero files — the layout moved and this check went blind').toBeGreaterThan(200);
        const offenders = files.filter(
            (f) => f !== 'scripts/committee-set-replay.ts' && /\bsetDifferenceSet\b/.test(readFileSync(f, 'utf8')),
        );
        expect(offenders, 'setDifferenceSet is the WRONG implementation; it exists only so a test can show what it gets wrong').toEqual([]);
    });
});
