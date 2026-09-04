/**
 * Rebuild the committee's sparse Merkle tree from events, so proofs can target the FROZEN root.
 *
 * WHY `getMerkleProof` IS NOT ENOUGH
 * ---------------------------------
 * The validator's `getMerkleProof` proves against `runningRoot` — the CURRENT active set. But
 * `validate()` checks each signer against `epochSetRoot[e-1]`, the root snapshotted for the previous
 * epoch. While the set has not changed since that snapshot the two coincide, which is why the
 * current-state shortcut works in practice and why its failure mode is not gradual: the moment one
 * node is activated or deactivated, every proof fetched that way stops verifying, and it surfaces as
 * an on-chain revert on a UserOperation rather than as anything the SDK noticed.
 *
 * THE TREE, TRANSCRIBED FROM THE CONTRACT
 * ---------------------------------------
 * `AAStarCommitteeValidator._smtSet` (YetAnotherAA-Validator), depth 14:
 *
 *   leaf(slot)   = nodeId for an assigned slot, bytes32(0) for a cleared one
 *   zeros[0]     = bytes32(0);  zeros[i+1] = keccak256(abi.encode(zeros[i], zeros[i]))
 *   parent(l, r) = keccak256(abi.encode(l, r))         // abi.encode, NOT abi.encodePacked
 *   an absent node at level d reads as zeros[d]        // "unset ⇒ empty subtree"
 *
 * `abi.encode` of two bytes32 is the same 64 bytes as `abi.encodePacked` here — measured, by
 * mutating this file to plain concatenation and watching all nine tests stay green. That is an
 * EQUIVALENT transformation, not a hole in the tests, and it is worth saying which of the two it is:
 * a mutation that does not go red means either the tests are blind or the change made no difference,
 * and only reading the code tells you apart. The encoding is written the way the contract writes it
 * anyway, because the equivalence stops holding the moment either operand is not a fixed 32 bytes.
 *
 * WHY A WRONG SCAN CANNOT PRODUCE A WRONG PROOF
 * --------------------------------------------
 * Rebuilding needs a `fromBlock`, and a scan that starts too late silently misses `SlotAssigned`
 * events — the classic shape where a gap in the input yields a confident, wrong answer.
 *
 * It cannot happen here, and not because the default is trusted: every rebuild recomputes the root
 * and compares it to the root the CONTRACT reports for that same block. A tree missing a leaf hashes
 * to something else, so a short scan fails loudly instead of emitting proofs that would revert. That
 * check is what makes {@link COMMITTEE_VALIDATOR_FIRST_BLOCK} an optimisation rather than a
 * correctness assumption.
 *
 * @module
 */
import { keccak256, encodeAbiParameters, parseAbiItem, type Address, type Hex, type PublicClient } from 'viem';

/** Depth of the committee SMT. `TREE_DEPTH` in the contract; 2^14 = 16384 slots. */
export const COMMITTEE_TREE_DEPTH = 14;

/**
 * A lower bound for log scans: the block `aaStarBLSAlgorithm` was deployed on Sepolia.
 *
 * Measured by binary search on `getCode`. It is a SPEED hint, not a correctness input — see the
 * module note. Being wrong makes a rebuild fail; it cannot make one succeed with a bad tree.
 */
export const COMMITTEE_VALIDATOR_FIRST_BLOCK = 11_599_099n;

/** Most public RPCs cap `eth_getLogs` at 50k blocks; stay under it. */
const LOG_CHUNK = 45_000n;

const ZERO_BYTES32 = `0x${'00'.repeat(32)}` as Hex;

const hashPair = (left: Hex, right: Hex): Hex =>
    keccak256(encodeAbiParameters([{ type: 'bytes32' }, { type: 'bytes32' }], [left, right]));

/** `zeros[d]` = root of an empty subtree of depth d. Index 0 is the empty LEAF. */
export function committeeZeroHashes(depth = COMMITTEE_TREE_DEPTH): Hex[] {
    const zeros: Hex[] = [ZERO_BYTES32];
    for (let i = 0; i < depth; i++) zeros.push(hashPair(zeros[i], zeros[i]));
    return zeros;
}

/** The active set at some block: slot → nodeId. Cleared slots are absent, not zero-valued. */
export type CommitteeLeaves = Map<number, Hex>;

/** Root of the sparse tree holding `leaves`. */
export function committeeRoot(leaves: CommitteeLeaves, depth = COMMITTEE_TREE_DEPTH): Hex {
    const zeros = committeeZeroHashes(depth);
    let level: Map<number, Hex> = new Map(leaves);
    for (let d = 0; d < depth; d++) {
        const parents = new Map<number, Hex>();
        for (const index of new Set([...level.keys()].map((i) => i >> 1))) {
            parents.set(index, hashPair(level.get(index * 2) ?? zeros[d], level.get(index * 2 + 1) ?? zeros[d]));
        }
        level = parents;
    }
    return level.get(0) ?? zeros[depth];
}

/** The sibling path for `slot`, bottom-up — the same shape `getMerkleProof` returns. */
export function committeeMerkleProof(leaves: CommitteeLeaves, slot: number, depth = COMMITTEE_TREE_DEPTH): Hex[] {
    const zeros = committeeZeroHashes(depth);
    const proof: Hex[] = [];
    let level: Map<number, Hex> = new Map(leaves);
    let index = slot;
    for (let d = 0; d < depth; d++) {
        proof.push(level.get(index ^ 1) ?? zeros[d]);
        const parents = new Map<number, Hex>();
        for (const p of new Set([...level.keys()].map((i) => i >> 1))) {
            parents.set(p, hashPair(level.get(p * 2) ?? zeros[d], level.get(p * 2 + 1) ?? zeros[d]));
        }
        level = parents;
        index >>= 1;
    }
    return proof;
}

/** Fold a proof back to a root — the SDK-side mirror of the contract's `_verifyMerkle`. */
export function committeeRootFromProof(nodeId: Hex, slot: number, proof: readonly Hex[]): Hex {
    let current = nodeId;
    let index = slot;
    for (const sibling of proof) {
        current = (index & 1) === 0 ? hashPair(current, sibling) : hashPair(sibling, current);
        index >>= 1;
    }
    return current;
}

const SLOT_ASSIGNED = parseAbiItem('event SlotAssigned(bytes32 indexed nodeId, uint256 slot)');
const SLOT_CLEARED = parseAbiItem('event SlotCleared(bytes32 indexed nodeId, uint256 slot)');

/**
 * Replay `SlotAssigned`/`SlotCleared` up to `toBlock` and return the set as it stood there.
 *
 * Events from both topics are merged and ordered by (blockNumber, logIndex). Ordering matters and
 * per-topic ordering is not enough: a slot freed in one block and reassigned in the next is a normal
 * sequence, and processing all assignments before all clears would delete the live entry.
 */
export async function committeeLeavesAt(
    publicClient: PublicClient,
    committeeValidator: Address,
    toBlock: bigint,
    fromBlock: bigint = COMMITTEE_VALIDATOR_FIRST_BLOCK,
): Promise<CommitteeLeaves> {
    const collect = async (event: typeof SLOT_ASSIGNED | typeof SLOT_CLEARED) => {
        const logs: Awaited<ReturnType<PublicClient['getLogs']>> = [];
        for (let lo = fromBlock; lo <= toBlock; lo += LOG_CHUNK + 1n) {
            const hi = lo + LOG_CHUNK > toBlock ? toBlock : lo + LOG_CHUNK;
            logs.push(...(await publicClient.getLogs({ address: committeeValidator, event, fromBlock: lo, toBlock: hi })));
        }
        return logs;
    };
    const [assigned, cleared] = await Promise.all([collect(SLOT_ASSIGNED), collect(SLOT_CLEARED)]);

    return replaySlotEvents([
        ...assigned.map((log) => ({ ...toSlotEvent(log), assign: true })),
        ...cleared.map((log) => ({ ...toSlotEvent(log), assign: false })),
    ]);
}

/** One set mutation, reduced to the four fields the replay depends on. */
export interface SlotEvent {
    nodeId: Hex;
    slot: number;
    assign: boolean;
    blockNumber: bigint;
    logIndex: number;
}

function toSlotEvent(log: { args?: unknown; blockNumber?: bigint | null; logIndex?: number | null }): Omit<SlotEvent, 'assign'> {
    const args = (log as { args: { nodeId: Hex; slot: bigint } }).args;
    return { nodeId: args.nodeId, slot: Number(args.slot), blockNumber: log.blockNumber ?? 0n, logIndex: log.logIndex ?? 0 };
}

/**
 * Fold set mutations into the active set, in chain order.
 *
 * Split out from the fetch so the ordering rule can be tested without a chain. It needed to be: the
 * live validator has three `SlotAssigned` and zero `SlotCleared`, so an on-chain test cannot tell a
 * correct ordering from any other — a mutation that processed every assignment before every clear
 * passed the whole suite. The rule only bites on histories the chain has not produced yet.
 *
 * Ordering is (blockNumber, logIndex), across BOTH topics. Per-topic ordering is not enough: a slot
 * freed in one block and reassigned in the next is an ordinary sequence, and grouping by topic would
 * apply the clear last and delete the live entry.
 */
export function replaySlotEvents(events: readonly SlotEvent[]): CommitteeLeaves {
    const ordered = [...events].sort((a, b) => {
        const byBlock = Number(a.blockNumber - b.blockNumber);
        return byBlock !== 0 ? byBlock : a.logIndex - b.logIndex;
    });
    const leaves: CommitteeLeaves = new Map();
    for (const event of ordered) {
        if (event.assign) leaves.set(event.slot, event.nodeId);
        else leaves.delete(event.slot);
    }
    return leaves;
}

async function readBytes32(publicClient: PublicClient, address: Address, name: string, args: unknown[], blockNumber?: bigint): Promise<Hex> {
    return (await publicClient.readContract({
        address,
        abi: [{ type: 'function' as const, name, inputs: args.map(() => ({ type: 'uint256' as const })), outputs: [{ type: 'bytes32' as const }], stateMutability: 'view' as const }],
        functionName: name,
        args: args as never,
        blockNumber,
    })) as Hex;
}

/**
 * Rebuild the set at `atBlock` and REFUSE to return it unless the root matches what the contract
 * reports there.
 *
 * `expectedRoot` is the caller's choice of authority: `runningRoot()` read at `atBlock` for a
 * current-state rebuild, or `epochSetRoot(e)` for a frozen one. Either way the comparison is the
 * whole safety argument — without it a scan that began after a `SlotAssigned` would hand back a
 * plausible tree and proofs that revert on chain.
 */
export async function rebuildCommitteeSet(
    publicClient: PublicClient,
    committeeValidator: Address,
    atBlock: bigint,
    expectedRoot: Hex,
    fromBlock: bigint = COMMITTEE_VALIDATOR_FIRST_BLOCK,
): Promise<{ leaves: CommitteeLeaves; root: Hex }> {
    const leaves = await committeeLeavesAt(publicClient, committeeValidator, atBlock, fromBlock);
    const root = committeeRoot(leaves);
    if (root.toLowerCase() !== expectedRoot.toLowerCase()) {
        throw new Error(
            `rebuildCommitteeSet: reconstructed root ${root} does not match the on-chain root ${expectedRoot} ` +
            `at block ${atBlock} (${leaves.size} active slots, scanned from ${fromBlock}). The event scan is ` +
            `incomplete or the tree rule has changed upstream — refusing to emit proofs that would revert. ` +
            `If the validator was deployed before ${fromBlock}, pass an earlier fromBlock. ` +
            `Note a third cause that looks identical: an RPC that serves eth_getLogs incompletely. ` +
            `The free Sepolia public endpoint was measured returning 0 and 3 events for the same ` +
            `query on consecutive calls, so verify the endpoint before concluding the scan window is wrong.`,
        );
    }
    return { leaves, root };
}

/**
 * Proofs for `nodeIds` against the FROZEN root of epoch `e-1` — the root `validate()` checks.
 *
 * The snapshot block comes from the `EpochSnapshotted` event for that epoch rather than from any
 * arithmetic on epoch length: the snapshot is permissionless, so WHEN it happened is a fact about a
 * transaction, not something derivable from the schedule.
 */
export async function fetchCommitteeSignersFrozen(
    publicClient: PublicClient,
    committeeValidator: Address,
    nodeIds: readonly Hex[],
    fromBlock: bigint = COMMITTEE_VALIDATOR_FIRST_BLOCK,
): Promise<{ signers: { nodeId: Hex; slot: bigint; merkleProof: Hex[] }[]; epoch: bigint; frozenRoot: Hex; snapshotBlock: bigint }> {
    const currentEpoch = (await publicClient.readContract({
        address: committeeValidator,
        abi: [{ type: 'function' as const, name: 'currentEpoch', inputs: [], outputs: [{ type: 'uint256' as const }], stateMutability: 'view' as const }],
        functionName: 'currentEpoch',
    })) as bigint;
    if (currentEpoch === 0n) throw new Error('fetchCommitteeSignersFrozen: currentEpoch() is 0 — there is no previous epoch to prove against');
    const epoch = currentEpoch - 1n;

    const frozenRoot = await readBytes32(publicClient, committeeValidator, 'epochSetRoot', [epoch]);
    if (frozenRoot === ZERO_BYTES32) {
        throw new Error(
            `fetchCommitteeSignersFrozen: epochSetRoot(${epoch}) is unset — epoch ${epoch} was never snapshotted, so ` +
            'committee validation cannot succeed for this epoch regardless of the proofs. Someone must call snapshotEpoch().',
        );
    }

    const head = await publicClient.getBlockNumber();
    const snapshots = [];
    for (let lo = fromBlock; lo <= head; lo += LOG_CHUNK + 1n) {
        const hi = lo + LOG_CHUNK > head ? head : lo + LOG_CHUNK;
        snapshots.push(...(await publicClient.getLogs({
            address: committeeValidator,
            event: parseAbiItem('event EpochSnapshotted(uint256 indexed epoch, bytes32 seed, bytes32 setRoot, uint256 setCount)'),
            fromBlock: lo,
            toBlock: hi,
        })));
    }
    const forEpoch = snapshots.filter((log) => (log as unknown as { args: { epoch: bigint } }).args.epoch === epoch);
    if (forEpoch.length === 0) {
        throw new Error(
            `fetchCommitteeSignersFrozen: epochSetRoot(${epoch}) is set to ${frozenRoot} but no EpochSnapshotted event ` +
            `for that epoch was found from block ${fromBlock}. The scan starts too late — the tree cannot be rebuilt ` +
            'without knowing which block to rebuild it at.',
        );
    }
    // Last wins: re-snapshotting an epoch is not expected, but if it happened the later one is what
    // `epochSetRoot` holds, and picking the earlier would rebuild a tree that no longer matches.
    const snapshotBlock = forEpoch[forEpoch.length - 1].blockNumber!;

    const { leaves } = await rebuildCommitteeSet(publicClient, committeeValidator, snapshotBlock, frozenRoot, fromBlock);

    const bySlot = new Map<string, number>();
    for (const [slot, nodeId] of leaves) bySlot.set(nodeId.toLowerCase(), slot);

    const signers = nodeIds.map((nodeId) => {
        const slot = bySlot.get(nodeId.toLowerCase());
        if (slot === undefined) {
            throw new Error(
                `fetchCommitteeSignersFrozen: node ${nodeId} was not in the active set at the epoch-${epoch} snapshot ` +
                `(block ${snapshotBlock}). It may have been added since — a node that joined after the snapshot cannot ` +
                'contribute to this epoch, and submitting it would revert.',
            );
        }
        return { nodeId, slot: BigInt(slot), merkleProof: committeeMerkleProof(leaves, slot) };
    });

    return { signers, epoch, frozenRoot, snapshotBlock };
}
