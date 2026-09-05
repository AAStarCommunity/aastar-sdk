import { encodeFunctionData, type Address, type Hex, type PublicClient } from 'viem';
import { AAStarAirAccountV7ABI, AAStarCommitteeValidatorABI, AAStarValidatorABI } from '../abis/index.js';
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

/**
 * Resolve the DVT validator an ACCOUNT actually consults: `account.validatorRouter()` then
 * `router.getAlgorithm(0x01)`.
 *
 * ## Why this exists when {@link getMountedDvtValidator} already resolves a router
 *
 * Because the router is not a global fact, and taking one as input silently assumes it is.
 * Measured on Sepolia at block 11639067 — two real deployed accounts, 45-byte proxies both:
 *
 * ```
 * 0x92EA8b02D34A4D5d10f0Db9Ea894e8bC72e292e8 → router 0xe68d6A7Bb60DA4caE62ceC2439722fc5eEF87a5c
 *                                            → validator 0x539B9681aFd5BFbCaa655Fe4c6BdcFe1fa7864bC
 * 0x0985785d1fc37978474C472E39391774DcB1C711 → router 0xA97A752779ebfDA58612F6727Ec7C8366c39f897
 *                                            → validator 0x7ac7E9d471742FA4397Beef0B5b11fbD22D196a9
 * ```
 *
 * The DVT repo's sweep of every router named across both repos found at least 11 on Sepolia,
 * resolving to 7 different validators — all answering, none reverting. (Their measurement.)
 *
 * **So "the current DVT validator on Sepolia" is not a question with an answer.** "Which validator
 * does THIS account consult" is, and the chain decides it: `validatorRouter()` is set by what was
 * deployed, not by what anyone wrote in a config or an address book.
 *
 * That is the whole value of this function, and it is worth stating plainly because it is easy to
 * read it as a convenience wrapper: it does not find a better answer to the old question, it
 * **replaces an unanswerable question with an answerable one**.
 *
 * The trap it closes is silent. A wrong validator does not revert: the superseded contract still
 * has code, and still answers `isRegistered = true` for nodes registered on it, so both obvious
 * sanity checks ("is there code there?", "does it know my node?") pass against either one.
 */
export async function getAccountDvtValidator(
    publicClient: PublicClient,
    account: Address,
): Promise<{ router: Address; validator: Address }> {
    const router = (await publicClient.readContract({
        address: account,
        abi: AAStarAirAccountV7ABI,
        functionName: 'validatorRouter',
    })) as Address;

    // A zero router is not "no router configured, fall back to something" — it is an account that
    // cannot validate at all, and continuing would resolve `getAlgorithm` against address(0) and
    // return address(0) as if it were an answer. Two zeros in a row read like data.
    if (/^0x0{40}$/i.test(router)) {
        throw new Error(
            `account ${account} reports validatorRouter() = the zero address. ` +
                'It is not an AAStar account, or it has never been configured. Resolving further ' +
                'would return the zero address as if it were a validator.',
        );
    }

    const validator = await getMountedDvtValidator(publicClient, router);
    if (/^0x0{40}$/i.test(validator)) {
        throw new Error(
            `router ${router} (from account ${account}) mounts nothing at algId 0x01. ` +
                'The account routes somewhere, but that somewhere has no DVT validator.',
        );
    }
    return { router, validator };
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
 * ⚠️ Uses the validator's `getMerkleProof`, which proves against the CURRENT active-set root, while
 * `_verifyMerkle` checks the FROZEN `epochSetRoot(e-1)`. **Deciding whether that gap matters is the
 * caller's job, and this function no longer pretends to help with it.**
 *
 * ## Why the staleness read is gone
 *
 * It used to also read `lastSetMutationBlock()` and return it. Measured on Sepolia against the live
 * committee validator `0x7ac7E9d4…`: **that function is not in the deployed bytecode.** Probing all
 * 59 functions of the ABI vendored at the time, four were absent —
 * `lastSetMutationBlock` · `rootAtBlockStart` · `countAtBlockStart` · `snapshotEpoch` — and the read
 * therefore reverted, taking this whole function down with it. Two evidence runners died here
 * AFTER successfully fetching every proof.
 *
 * Three of those were removed upstream at #244 (CC-115 D2, 2026-08-30), which replaced the
 * block-start snapshot model with the epoch-pinned one. The vendored ABI predated it. (The fourth,
 * `snapshotEpoch`, was never missing — the ABI had the wrong signature; see the note in
 * `AAStarCommitteeValidator.json`.)
 *
 * ## What replaced it, and where
 *
 * Nothing here — because the value was **already unused**. The one production caller destructures
 * `{ signers }` and does the real checks itself, against functions that exist:
 *
 * - `runningRoot()` vs `epochSetRoot(currentEpoch - 1)` — the roots the contract actually compares;
 * - `requiredQuorum()`, whose NatSpec says it mirrors `validate()`'s readiness *exactly* and returns
 *   `type(uint256).max` when nothing can satisfy it.
 *
 * **Which of that pair is the real guard is worth stating, because the obvious reading is wrong.**
 *
 * The root comparison looks like the load-bearing check and is not. `runningRoot` is written only by
 * `_smtSet`, reached from `_onNodeActivated` / `_onNodeDeactivated` — so ANY node going up or down
 * inside an epoch makes it diverge from `epochSetRoot[e-1]` and keeps it diverged until the epoch
 * ends, **while proofs against `[e-1]` stay perfectly valid**, because `validate()` reads only
 * `[e-1]`. With 64-block epochs (~12.8 min) and an active `syncNode` keeper it can refuse a large
 * slice of the window. It is a conservative gate whose rejections are not necessarily real problems.
 *
 * `requiredQuorum()` is the guard that catches the things that actually invalidate a snapshot: a
 * `configVersion` bump (five admin setters raise it, invalidating every pinned snapshot at once) and
 * the wall-clock `epochSetValidUntil` expiry. Both live inside `_epochUsable`, hence inside it — and
 * **no root or block comparison can see either**, a time bound least of all.
 *
 * So the whole re-configuration and expiry story rests on one thing: `assertCommitteeQuorum`
 * refusing the `type(uint256).max` sentinel. That is implicit enough to be worth naming here.
 * (Diagnosed with yetanotheraa-validator, who traced the `_smtSet` call sites.)
 *
 * > The tempting fix was to swap in `runningRoot` vs `epochSetRoot(currentEpoch)` — same shape, one
 * > index off, and it would pass today because all three roots are currently equal. Picking a
 * > replacement by reading function names is how you get a check that agrees with reality by
 * > coincidence.
 *
 * Rebuilding the frozen tree from `SlotAssigned`/`SlotCleared` events is the durable path and lives
 * in {@link fetchCommitteeSignersFrozen}.
 */
export async function fetchCommitteeSigners(
    publicClient: PublicClient,
    committeeValidator: Address,
    nodeIds: readonly Hex[]
): Promise<{ signers: CommitteeSigner[]; atBlock: bigint }> {
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
    return { signers, atBlock };
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

/**
 * Calldata for the account's one-time, OWNER-ONLY `enrollInCommitteeValidator()`.
 *
 * A server-side signer cannot send this on a user's behalf — it is a transaction from the account
 * owner. So rather than dead-ending when an unenrolled account needs committee framing, the SDK
 * hands back the exact calldata for whoever does hold the owner wallet (the app's own flow, a
 * UserOp, a Safe, a manual send) to execute against the account address (FU-19).
 *
 * Enrollment is idempotent-by-necessity: check {@link isAccountEnrolled} first and skip when true.
 */
export function encodeEnrollInCommitteeValidator(): Hex {
    return encodeFunctionData({
        abi: AAStarAirAccountV7ABI,
        functionName: 'enrollInCommitteeValidator',
    });
}

/** What the contract compares when it verifies a committee Merkle proof. */
export interface FrozenRootAgreement {
    /** `currentEpoch()`. */
    epoch: bigint;
    /** `runningRoot()` — the CURRENT set, which `getMerkleProof` proves against. */
    runningRoot: Hex;
    /** `epochSetRoot(epoch - 1)` — the FROZEN root `validate()` actually checks. */
    frozenRoot: Hex;
    /** True when proofs fetched now would verify. */
    agrees: boolean;
}

/**
 * Read whether proofs fetched right now would verify against the root the contract checks.
 *
 * This replaces the `lastSetMutationBlock() > atBlock` freshness guard that three evidence runners
 * used. That guard is worth describing, because it failed in two different ways in sequence:
 *
 * 1. It could never fire even when the function existed — `fetchCommitteeSigners` read the value
 *    PINNED to `atBlock`, and a storage read at block N cannot report a mutation later than N.
 * 2. When the function was removed upstream (#244) and the read deleted, the destructured value
 *    became `undefined`, so `undefined > atBlock` is `false` — **silently the same no-op**, now
 *    with nothing left to notice.
 *
 * It exists as one exported function precisely so the next removal has one call site to update
 * rather than three hand-rolled copies, which is how (2) happened at all.
 *
 * ## The index is `epoch - 1`, and the chain cannot corroborate that
 *
 * `validate()` reads `setRoot[e - 1]`, so that is what proofs must match. Measured on Sepolia,
 * `epochSetRoot` for five consecutive epochs and `runningRoot()` are ALL the same value — so
 * `[e]`, `[e-1]` and `[e-4]` are indistinguishable on the live chain today. **A green run is
 * therefore zero evidence for the index**; the only evidence is the contract source. Anything
 * asserting `-1` has to be fed a synthetic reader where the two roots differ.
 */
export async function readFrozenRootAgreement(
    publicClient: Pick<PublicClient, 'readContract'>,
    committeeValidator: Address,
): Promise<FrozenRootAgreement> {
    const read = (functionName: string, args: readonly unknown[] = []) =>
        publicClient.readContract({
            address: committeeValidator,
            abi: AAStarCommitteeValidatorABI,
            functionName,
            args,
        } as never);

    const [runningRoot, epoch] = (await Promise.all([read('runningRoot'), read('currentEpoch')])) as [Hex, bigint];
    if (epoch === 0n) {
        throw new Error(
            `readFrozenRootAgreement: ${committeeValidator} reports currentEpoch() == 0, so there is no ` +
                'frozen e-1 snapshot for _verifyMerkle to check proofs against.',
        );
    }
    const frozenRoot = (await read('epochSetRoot', [epoch - 1n])) as Hex;
    return {
        epoch,
        runningRoot,
        frozenRoot,
        agrees: runningRoot.toLowerCase() === frozenRoot.toLowerCase(),
    };
}
