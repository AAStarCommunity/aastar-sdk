import type { Address, Hex, PublicClient } from 'viem';
import { AAStarCommitteeValidatorABI, AAStarValidatorABI } from '../abis/index.js';
import {
    COMMITTEE_QUORUM_UNAVAILABLE,
    assertCommitteeQuorum,
    type CommitteeSigner,
} from '../crypto/dvtWire.js';

/**
 * Reads for the CC-98 / CC-103 per-proposal committee validator
 * (`AAStarCommitteeValidator`, YetAnotherAA-Validator #237).
 *
 * These exist so the signature layer never has to GUESS its framing. The account picks legacy vs
 * committee from `committeeActive()` on the validator it has mounted; the submitter must read the
 * same flag off the same contract, or it encodes for one mode while the account decodes the other
 * — the shape-collision CC-103 names as the flip-order attack root.
 *
 * @module
 */

/** algId under which the DVT/committee validator is mounted on the router. */
export const ALG_ID_DVT = 0x01 as const;

/** Live committee-mode state, everything the encoder needs in one round trip. */
export interface CommitteeState {
    /** `committeeActive()` — `true` iff `epochLength != 0`. Decides legacy vs committee framing. */
    active: boolean;
    /** `requiredQuorum()`, verbatim. May be the fail-closed sentinel; see {@link quorumUsable}. */
    requiredQuorum: bigint;
    /**
     * `false` when `requiredQuorum` is `type(uint256).max`, i.e. committee validation cannot
     * succeed at all right now (committee off, or no usable pinned snapshot for the previous
     * epoch). Submitting a committee payload in that state is guaranteed to be rejected.
     */
    quorumUsable: boolean;
    /** `TREE_DEPTH()` — read, never assumed; `perSigner = 64 + treeDepth*32` (CC-103 Q4). */
    treeDepth: number;
    /** Byte length of one signer entry, derived from the on-chain depth. */
    perSignerBytes: number;
    /** `activeCount()` — nodes currently in the active set. */
    activeCount: bigint;
}

/** Resolve the validator mounted at algId 0x01 on a ValidatorRouter. */
export async function getMountedDvtValidator(
    publicClient: PublicClient,
    router: Address
): Promise<Address> {
    return (await publicClient.readContract({
        address: router,
        abi: AAStarValidatorABI,
        functionName: 'getAlgorithm',
        args: [ALG_ID_DVT],
    })) as Address;
}

/** Read the full committee state from a mounted `AAStarCommitteeValidator`. */
export async function getCommitteeState(
    publicClient: PublicClient,
    committeeValidator: Address
): Promise<CommitteeState> {
    // Pinned to one block so `active` / `requiredQuorum` / `activeCount` cannot straddle an epoch
    // rollover or a set mutation and describe two different committee configurations.
    const blockNumber = await publicClient.getBlockNumber();
    const pinned = (functionName: string, args: readonly unknown[] = []) =>
        publicClient.readContract({
            address: committeeValidator,
            abi: AAStarCommitteeValidatorABI,
            functionName,
            args: args as never,
            blockNumber,
        });

    const [active, requiredQuorum, treeDepth, activeCount] = (await Promise.all([
        pinned('committeeActive'),
        pinned('requiredQuorum'),
        pinned('TREE_DEPTH'),
        pinned('activeCount'),
    ])) as [boolean, bigint, bigint, bigint];

    const depth = Number(treeDepth);
    return {
        active,
        requiredQuorum,
        quorumUsable: requiredQuorum !== COMMITTEE_QUORUM_UNAVAILABLE,
        treeDepth: depth,
        perSignerBytes: 64 + depth * 32,
        activeCount,
    };
}

/** Whether an account has run the one-time `enrollInCommitteeValidator()`. */
export async function isAccountEnrolled(
    publicClient: PublicClient,
    committeeValidator: Address,
    account: Address
): Promise<boolean> {
    return (await publicClient.readContract({
        address: committeeValidator,
        abi: AAStarCommitteeValidatorABI,
        functionName: 'enrolledAccount',
        args: [account],
    })) as boolean;
}

/**
 * Fetch `slot` + Merkle proof for each contributing node and shape them into {@link CommitteeSigner}s.
 *
 * ⚠️ Uses the validator's `getMerkleProof`, which proves against the CURRENT active-set root. The
 * contract's own NatSpec is explicit that PRODUCTION proofs must target the FROZEN `setRoot[e-1]`,
 * and that a current-state proof is valid only while the set has not changed since that snapshot.
 * This helper therefore returns `setMutatedSince`, read from `lastSetMutationBlock()`, so a caller
 * can tell whether the proofs it just fetched are still safe to submit — rather than discovering it
 * as an on-chain revert. Rebuilding the frozen tree from `SlotAssigned`/`SlotCleared` events is the
 * durable path and is NOT implemented here.
 */
export async function fetchCommitteeSigners(
    publicClient: PublicClient,
    committeeValidator: Address,
    nodeIds: readonly Hex[]
): Promise<{ signers: CommitteeSigner[]; lastSetMutationBlock: bigint; atBlock: bigint }> {
    const atBlock = await publicClient.getBlockNumber();
    const signers = await Promise.all(
        nodeIds.map(async (nodeId) => {
            const [slot, proof] = (await publicClient.readContract({
                address: committeeValidator,
                abi: AAStarCommitteeValidatorABI,
                functionName: 'getMerkleProof',
                args: [nodeId],
                blockNumber: atBlock,
            })) as [bigint, readonly Hex[]];
            return { nodeId, slot, merkleProof: [...proof] } satisfies CommitteeSigner;
        })
    );
    const lastSetMutationBlock = (await publicClient.readContract({
        address: committeeValidator,
        abi: AAStarCommitteeValidatorABI,
        functionName: 'lastSetMutationBlock',
        blockNumber: atBlock,
    })) as bigint;

    return { signers, lastSetMutationBlock, atBlock };
}

/**
 * Fail fast when a committee payload is about to be built in a state that cannot validate.
 *
 * Checks, in the order they actually bite: committee mode on → account enrolled → quorum real →
 * enough signers collected.
 */
export async function assertCommitteeSubmittable(
    publicClient: PublicClient,
    committeeValidator: Address,
    account: Address,
    signerCount: number
): Promise<CommitteeState> {
    const state = await getCommitteeState(publicClient, committeeValidator);
    if (!state.active) {
        throw new Error(
            `assertCommitteeSubmittable: committeeActive() is false on ${committeeValidator} (epochLength == 0) — ` +
            `the account will decode LEGACY framing. Encode legacy, or wait for the validator owner to ` +
            `setEpochLength (CC-104).`
        );
    }
    if (!(await isAccountEnrolled(publicClient, committeeValidator, account))) {
        throw new Error(
            `assertCommitteeSubmittable: account ${account} has not enrolled — call the account's one-time ` +
            `enrollInCommitteeValidator() (owner tx) before submitting committee-framed operations.`
        );
    }
    assertCommitteeQuorum(signerCount, state.requiredQuorum);
    return state;
}
