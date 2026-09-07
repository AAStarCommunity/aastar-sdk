/**
 * Reconstruct a committee validator's ACTIVE node set from its set-mutation events.
 *
 * ## Why this is not a set difference
 *
 * `AAStarCommitteeValidator` recycles freed slots (`freeSlots.push` at
 * `AAStarCommitteeValidator.sol:332`), so a nodeId can be assigned, cleared, and assigned AGAIN.
 * Only the LAST event for a nodeId decides whether it is live. `assigned \ cleared` drops any node
 * that came back — it answers "was this ever cleared", not "is this live now".
 *
 * **That reason was an assertion when it was first written, and #415 review said so.** On the live
 * validator at the time, ordered replay and set difference BOTH returned 4, because zero nodeIds had
 * ever been re-assigned after a clear (measured: 6 SlotAssigned / 6 unique, 2 SlotCleared). The
 * chain could not produce the distinguishing case — the third cause of "the mutation stayed green"
 * this repo already has a name for: **the environment cannot currently make this difference.**
 *
 * So the distinguishing case is constructed here instead, in `committee-set-replay.test.ts`:
 * `assign(X) → clear(X) → assign(X)` must leave X LIVE, and the test pins that a set-difference
 * implementation gets it wrong on exactly that input. The reason is now a reading.
 *
 * ## Why not just read `activeNodeIdsSorted()`
 *
 * Because the point of the caller (`cc103-committee-e2e`) is to prove the on-chain set from an
 * INDEPENDENT source. Asking the contract for its own answer and comparing it to itself proves
 * nothing — the same tautology this repo found in #337.
 */

/** One set-mutation event, already decoded. `add` distinguishes SlotAssigned from SlotCleared. */
export interface SetEvent {
    nodeId: string;
    add: boolean;
    /** Block number; ordering key. */
    block: bigint;
    /** Log index within the block; the tiebreaker that makes ordering total. */
    idx: number;
}

/**
 * Replay events in chain order and return the live set.
 *
 * Sorting by `(block, idx)` is what makes this a replay rather than a count: two events for the same
 * nodeId in the SAME block (register and revoke can be composed in one tx) are only separated by
 * `idx`, and getting that order backwards flips the answer.
 */
export function replaySetEvents(events: readonly SetEvent[]): Set<string> {
    const ordered = [...events].sort((a, b) => (a.block === b.block ? a.idx - b.idx : a.block < b.block ? -1 : 1));
    const live = new Set<string>();
    for (const e of ordered) {
        if (e.add) live.add(e.nodeId);
        else live.delete(e.nodeId);
    }
    return live;
}

/**
 * The WRONG implementation, kept so the test can pin what it gets wrong.
 *
 * Exported deliberately: a comment claiming "a set difference would be wrong here" is the kind of
 * unverified capability claim this repo keeps finding. Keeping the wrong implementation next to the
 * right one lets a test show the disagreement instead of asserting it.
 *
 * NEVER call this from production code.
 */
export function setDifferenceSet(events: readonly SetEvent[]): Set<string> {
    const cleared = new Set(events.filter((e) => !e.add).map((e) => e.nodeId));
    return new Set(events.filter((e) => e.add && !cleared.has(e.nodeId)).map((e) => e.nodeId));
}
