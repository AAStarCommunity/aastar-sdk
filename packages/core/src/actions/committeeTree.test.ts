/**
 * The tree rule, checked against the contract it was transcribed from.
 *
 * The offline cases are the ones that can run anywhere; the on-chain case is the one that decides
 * whether the transcription is right. A hand-written Merkle implementation that agrees with itself
 * proves nothing — every wrong version does too. What settles it is reproducing a root the contract
 * computed, from inputs the contract emitted.
 */
import { describe, expect, it } from 'vitest';
import { createPublicClient, http, type Address, type Hex } from 'viem';

import { CANONICAL_ADDRESSES } from '../addresses.js';
import {
  COMMITTEE_TREE_DEPTH,
  COMMITTEE_VALIDATOR_FIRST_BLOCK,
  committeeZeroHashes,
  committeeRoot,
  committeeMerkleProof,
  committeeRootFromProof,
  committeeLeavesAt,
  replaySlotEvents,
  rebuildCommitteeSet,
  fetchCommitteeSignersFrozen,
} from './committeeTree.js';

const SEPOLIA = 11155111;
const addrs = CANONICAL_ADDRESSES[SEPOLIA];
const VALIDATOR = addrs.aaStarBLSAlgorithm as Address;

const RUN_ONCHAIN = process.env.AASTAR_ONCHAIN_TEST === '1';

/**
 * Log-replay cases need an RPC that answers `eth_getLogs` over history CONSISTENTLY, and the free
 * public endpoint does not. Measured, three consecutive runs of the same assertion against
 * `ethereum-sepolia-rpc.publicnode.com`: `0 vs 3`, then `3 vs 0`, then pass — the same query, the
 * same blocks, three different answers.
 *
 * That is worth gating on rather than retrying, because the failure is indistinguishable from the
 * real defect these tests exist to catch: a scan that misses a `SlotAssigned` also reports a smaller
 * set. A flaky instrument that fails the way the bug fails cannot be told apart from the bug.
 *
 * So they run only against an endpoint declared able to serve logs, and when that is absent they say
 * so instead of vanishing from the count.
 */
const ARCHIVE_RPC = process.env.AASTAR_ARCHIVE_RPC_URL ?? process.env.SEPOLIA_RPC_URL;
const RUN_LOGS = RUN_ONCHAIN && !!ARCHIVE_RPC;
const RPC = ARCHIVE_RPC ?? 'https://ethereum-sepolia-rpc.publicnode.com';
const client = () => createPublicClient({ transport: http(RPC) }) as never;

if (RUN_ONCHAIN && !RUN_LOGS) {
  console.warn(
    '[committeeTree] SKIPPING the event-replay cases: no AASTAR_ARCHIVE_RPC_URL / SEPOLIA_RPC_URL. ' +
      'The public fallback answers eth_getLogs inconsistently over history, so these would be flaky ' +
      'in exactly the shape of the bug they check for. The frozen-root path is therefore NOT gated ' +
      'in this run — see FU-38.',
  );
}

const ID = (n: string) => `0x${n.repeat(64).slice(0, 64)}` as Hex;

describe('the tree rule (offline)', () => {
  it('an empty tree is zeros[depth], and depth is the contract constant', () => {
    expect(COMMITTEE_TREE_DEPTH).toBe(14);
    const zeros = committeeZeroHashes();
    expect(zeros).toHaveLength(15);
    expect(committeeRoot(new Map())).toBe(zeros[14]);
  });

  it('a proof folds back to the root it came from', () => {
    const leaves = new Map([[0, ID('1')], [1, ID('2')], [5, ID('3')]]);
    const root = committeeRoot(leaves);
    for (const [slot, nodeId] of leaves) {
      expect(committeeRootFromProof(nodeId, slot, committeeMerkleProof(leaves, slot))).toBe(root);
    }
  });

  it('a proof for the WRONG slot does not fold back', () => {
    // Otherwise "it folds back" would be satisfied by any function returning the root.
    const leaves = new Map([[0, ID('1')], [1, ID('2')]]);
    const root = committeeRoot(leaves);
    expect(committeeRootFromProof(ID('1'), 1, committeeMerkleProof(leaves, 0))).not.toBe(root);
  });

  it('clearing a slot returns the tree to what it was before that slot existed', () => {
    // The property `SlotCleared` relies on: an absent leaf and a leaf set to zero must be the same
    // tree, or replaying events would diverge from the contract after the first deactivation.
    const before = committeeRoot(new Map([[0, ID('1')]]));
    const after = new Map([[0, ID('1')], [7, ID('2')]]);
    after.delete(7);
    expect(committeeRoot(after)).toBe(before);
  });

  it('slot order does not change the root, but slot ASSIGNMENT does', () => {
    expect(committeeRoot(new Map([[0, ID('1')], [1, ID('2')]]))).toBe(committeeRoot(new Map([[1, ID('2')], [0, ID('1')]])));
    expect(committeeRoot(new Map([[0, ID('1')], [1, ID('2')]]))).not.toBe(committeeRoot(new Map([[0, ID('2')], [1, ID('1')]])));
  });
});

describe('rebuilt from chain', () => {
  it.runIf(RUN_LOGS)('replaying the events reproduces runningRoot() exactly', async () => {
    // The case that validates the transcription. If the leaf encoding, the pair hashing, the zero
    // subtrees, or the event ordering were wrong, this root would differ.
    const atBlock = await (client() as unknown as { getBlockNumber(): Promise<bigint> }).getBlockNumber();
    const onChain = (await (client() as never as { readContract(a: unknown): Promise<Hex> }).readContract({
      address: VALIDATOR,
      abi: [{ type: 'function', name: 'runningRoot', inputs: [], outputs: [{ type: 'bytes32' }], stateMutability: 'view' }],
      functionName: 'runningRoot',
      blockNumber: atBlock,
    })) as Hex;

    const { root, leaves } = await rebuildCommitteeSet(client(), VALIDATOR, atBlock, onChain);
    expect(root.toLowerCase()).toBe(onChain.toLowerCase());
    expect(leaves.size).toBeGreaterThan(0);
  }, 120_000);

  it.runIf(RUN_LOGS)('a scan that starts too late is REFUSED, not silently wrong', async () => {
    // The safety argument for defaulting `fromBlock`. Starting after the SlotAssigned events yields
    // an empty set whose root is zeros[14] — a perfectly well-formed tree, and the wrong one.
    const atBlock = await (client() as unknown as { getBlockNumber(): Promise<bigint> }).getBlockNumber();
    const onChain = (await (client() as never as { readContract(a: unknown): Promise<Hex> }).readContract({
      address: VALIDATOR,
      abi: [{ type: 'function', name: 'runningRoot', inputs: [], outputs: [{ type: 'bytes32' }], stateMutability: 'view' }],
      functionName: 'runningRoot',
      blockNumber: atBlock,
    })) as Hex;

    await expect(
      rebuildCommitteeSet(client(), VALIDATOR, atBlock, onChain, atBlock - 10n),
    ).rejects.toThrow(/does not match the on-chain root/);
  }, 120_000);

  it.runIf(RUN_LOGS)('the pinned first block is at or before the first SlotAssigned', async () => {
    // Keeps the constant honest: it is allowed to be early, never late.
    const atBlock = await (client() as unknown as { getBlockNumber(): Promise<bigint> }).getBlockNumber();
    const all = await committeeLeavesAt(client(), VALIDATOR, atBlock, COMMITTEE_VALIDATOR_FIRST_BLOCK);
    const fromZeroish = await committeeLeavesAt(client(), VALIDATOR, atBlock, COMMITTEE_VALIDATOR_FIRST_BLOCK - 40_000n);
    expect(all.size).toBe(fromZeroish.size);
  }, 180_000);

  it.runIf(RUN_LOGS)('frozen-root proofs verify against epochSetRoot(e-1), not runningRoot', async () => {
    const nodeIds = [...(await committeeLeavesAt(client(), VALIDATOR, await (client() as unknown as { getBlockNumber(): Promise<bigint> }).getBlockNumber())).values()];
    const out = await fetchCommitteeSignersFrozen(client(), VALIDATOR, nodeIds).catch((e: Error) => e);
    if (out instanceof Error) {
      // Not every epoch has been snapshotted, and that is an operational state of the DVT side, not
      // an SDK defect. Pin the SHAPE of the refusal so it stays actionable instead of asserting a
      // condition this test does not control.
      expect(out.message).toMatch(/epochSetRoot\(\d+\) is unset|no EpochSnapshotted event|currentEpoch\(\) is 0/);
      return;
    }
    for (const s of out.signers) {
      expect(committeeRootFromProof(s.nodeId, Number(s.slot), s.merkleProof)).toBe(out.frozenRoot.toLowerCase());
    }
    expect(out.signers).toHaveLength(nodeIds.length);
  }, 180_000);
});

describe('event replay ordering (offline — the chain cannot exercise this yet)', () => {
  // The live validator has three SlotAssigned and zero SlotCleared, so the on-chain case above is
  // blind to ordering: a version that processed every assignment before every clear passed all nine
  // tests. These use histories the chain has not produced.
  const ev = (slot: number, nodeId: Hex, assign: boolean, blockNumber: bigint, logIndex: number) =>
    ({ slot, nodeId, assign, blockNumber, logIndex });

  it('a slot freed then reassigned ends up held by the SECOND node', () => {
    // The sequence that breaks topic-grouped processing: group by topic and the clear is applied
    // last, deleting the live entry and silently shrinking the set.
    const leaves = replaySlotEvents([
      ev(0, ID('1'), true, 100n, 0),
      ev(0, ID('1'), false, 101n, 0),
      ev(0, ID('2'), true, 102n, 0),
    ]);
    expect(leaves.get(0)).toBe(ID('2'));
    expect(leaves.size).toBe(1);
  });

  it('input order does not matter — chain order does', () => {
    const shuffled = replaySlotEvents([
      ev(0, ID('2'), true, 102n, 0),
      ev(0, ID('1'), false, 101n, 0),
      ev(0, ID('1'), true, 100n, 0),
    ]);
    expect(shuffled.get(0)).toBe(ID('2'));
  });

  it('two mutations in the SAME block are ordered by logIndex', () => {
    // Block number alone is not a total order, and a stable sort on equal keys would keep whatever
    // order the two getLogs calls happened to return — which is not a property of the chain.
    const sameBlock = replaySlotEvents([
      ev(3, ID('a'), false, 500n, 7),
      ev(3, ID('b'), true, 500n, 6),
    ]);
    expect(sameBlock.has(3)).toBe(false); // assign at 6, clear at 7 ⇒ cleared

    const reversed = replaySlotEvents([
      ev(3, ID('a'), false, 500n, 6),
      ev(3, ID('b'), true, 500n, 7),
    ]);
    expect(reversed.get(3)).toBe(ID('b')); // clear at 6, assign at 7 ⇒ held
  });

  it('clearing a slot that was never assigned is a no-op, not a crash', () => {
    expect(replaySlotEvents([ev(9, ID('1'), false, 1n, 0)]).size).toBe(0);
  });
});
