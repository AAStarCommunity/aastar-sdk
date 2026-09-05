import { type Address, type PublicClient, type WalletClient, type Hex, type Hash, type Account, encodeFunctionData, decodeFunctionResult } from 'viem';
import { BLSAggregatorABI } from '../abis/index.js';
import { validateAddress, validateRequired } from '../validators/index.js';
import { AAStarError, ErrorCode } from '../errors/index.js';
import { BLSHelpers } from '../crypto/blsSigner.js';

/** A registered validator's on-chain BLS G1 public key point. */
export type BLSG1Point = { x_a: Hex, x_b: Hex, y_a: Hex, y_b: Hex };

/** Lifecycle of a queued guardian-slash case (`guardianSlashCases(uint256).status`). */
export enum GuardianSlashStatus {
    /** No case at this id. */
    NONE = 0,
    /** Queued and inside its window — guardians may still resolve it. */
    PENDING = 1,
    /** Executed. */
    EXECUTED = 2,
    /** Window elapsed without execution (see `expireGuardianSlashCase`). */
    EXPIRED = 3,
}

/**
 * One queued guardian-slash case, decoded from `guardianSlashCases(uint256)`.
 *
 * Field order is the DEPLOYED BLSAggregator-4.11.0 struct. It is not stable across versions —
 * see {@link AggregatorActions.guardianSlashCase} for why that matters and what guards it.
 */
export type GuardianSlashCase = {
    /** Commitment to the guardian set the case was queued against. */
    guardiansHash: Hex;
    /** Commitment to the fraud proof backing the case. */
    fraudProofHash: Hex;
    /** Unix seconds after which the case can no longer be executed. */
    deadline: bigint;
    status: GuardianSlashStatus;
    /** Guardians in the set the case was queued against. */
    guardianCount: number;
    /** Guardians that have already resolved (slashed or cleared). */
    resolvedCount: number;
    /** Fraud-proof verifier bound to this case at queue time. */
    verifier: Address;
};

/**
 * Words `guardianSlashCases` returns on the DEPLOYED aggregator (4.11.0): 7 static fields → 224 bytes.
 *
 * SuperPaymaster's `contracts/src` is at 4.12.0, which adds a field to this struct **without changing
 * the selector**. 4.11.0 is otherwise a strict subset — 71 of 72 functions behave identically — so this
 * one return is the whole difference, and it is the kind that does not announce itself: a 7-parameter
 * ABI decoding a 256-byte return does not revert. If the added field lands anywhere but the end, every
 * field after it silently shifts. Hence the byte-length assertion in
 * {@link AggregatorActions.guardianSlashCase} rather than a plain `readContract`.
 */
const GUARDIAN_SLASH_CASE_WORDS = 7;
const GUARDIAN_SLASH_CASE_BYTES = GUARDIAN_SLASH_CASE_WORDS * 32;
/**
 * 0-based index of the `verifier` word — the only field whose valid values are constrained enough to
 * detect a SAME-WIDTH struct change, which the byte-length check above cannot see. An address must
 * have 12 zero high bytes; any displaced `uint256`/`bytes32` almost certainly does not.
 */
const GUARDIAN_SLASH_CASE_VERIFIER_WORD = 6;

/**
 * BLSAggregator slash severity levels (SP #329 unified slash consensus). The
 * per-level co-sign quorum is read via {@link AggregatorActions.getSlashThreshold}
 * (bootstrap on Sepolia: WARNING 2-of-3, MINOR/MAJOR 3-of-3).
 */
export enum SlashLevel {
    WARNING = 0,
    MINOR = 1,
    MAJOR = 2,
}

/**
 * ABI-encode a BLSAggregator `setSlashPolicyAdmin(newAdmin)` call (CC-13 batch B).
 * Returns the inner calldata to route through governance — pair it with the
 * BLSAggregator address as the `target` of a {TimelockController} `schedule`/`execute`
 * (see the admin `SlashGovernance` helper). The current admin is read via
 * {@link AggregatorActions.slashPolicyAdmin}. Once handed over to a timelock, a direct
 * EOA call to `setSlashPolicyAdmin` reverts `NotSlashPolicyAdmin`.
 */
export function encodeSetSlashPolicyAdmin(newAdmin: Address): Hex {
    validateAddress(newAdmin, 'newAdmin');
    return encodeFunctionData({
        abi: BLSAggregatorABI,
        functionName: 'setSlashPolicyAdmin',
        args: [newAdmin],
    });
}

/**
 * ABI-encode a BLSAggregator `setSlashThreshold(slashLevel, threshold)` call (CC-13
 * batch B). `threshold` is the co-sign quorum for the given {@link SlashLevel}. Returns
 * the inner calldata to route through governance (same target/timelock pairing as
 * {@link encodeSetSlashPolicyAdmin}).
 */
export function encodeSetSlashThreshold(slashLevel: SlashLevel | number, threshold: number): Hex {
    validateRequired(slashLevel, 'slashLevel');
    validateRequired(threshold, 'threshold');
    return encodeFunctionData({
        abi: BLSAggregatorABI,
        functionName: 'setSlashThreshold',
        args: [slashLevel, threshold],
    });
}

export type AggregatorActions = {
    // BLS Public Key Management
    registerBLSPublicKey: (args: { validator: Address, publicKey: Hex, account?: Account | Address }) => Promise<Hash>;
    /** @deprecated The deployed BLSAggregator ABI has no `blsPublicKeys` mapping getter — this wrapper now reads the ABI-confirmed `getBLSPublicKey` and projects out the slot. Prefer {@link getBLSPublicKey}. */
    blsPublicKeys: (args: { validator: Address }) => Promise<{ publicKey: Hex, isActive: boolean }>;
    /** Read a validator's registered G1 key + its registration SLOT (1-indexed) + active flag. */
    getBLSPublicKey: (args: { validator: Address }) => Promise<{ publicKey: BLSG1Point, slot: number, isActive: boolean }>;
    /** Reverse of {@link getBLSPublicKey}: the validator address registered at a given slot. */
    validatorAtSlot: (args: { slot: number }) => Promise<Address>;
    /** Revoke a validator's registered BLS public key (owner-gated). ABI: revokeBLSPublicKey(address validator). */
    revokeBLSPublicKey: (args: { validator: Address, account?: Account | Address }) => Promise<Hash>;
    /** Toggle permissionless (self-service) BLS key registration. ABI: setPermissionlessBLSRegistration(bool enabled). */
    setPermissionlessBLSRegistration: (args: { enabled: boolean, account?: Account | Address }) => Promise<Hash>;
    /** Whether permissionless BLS key registration is currently enabled (view). */
    permissionlessBLSRegistration: () => Promise<boolean>;

    // DVT co-sign aggregation (frozen DVT program spec, hub #42)
    /**
     * Build the DVT `signerMask` for a set of signer addresses by reading each
     * signer's on-chain registration slot. bit `s-1` is set for a validator at slot
     * `s` (see {@link BLSHelpers.slotsToSignerMask}). Throws if any signer is not a
     * registered, active validator, or if two signers map to the same slot.
     */
    buildSignerMask: (args: { signers: Address[] }) => Promise<{ signerMask: bigint, slots: number[] }>;
    /** On-chain aggregate-signature verification (view). `sigBytes` = aggregated sigG2. */
    verify: (args: { expectedMessageHash: Hex, signerMask: bigint, requiredThreshold: bigint, sigBytes: Hex }) => Promise<boolean>;


    // Threshold Management
    setDefaultThreshold: (args: { newThreshold: bigint, account?: Account | Address }) => Promise<Hash>;
    setMinThreshold: (args: { newThreshold: bigint, account?: Account | Address }) => Promise<Hash>;
    defaultThreshold: () => Promise<bigint>;
    minThreshold: () => Promise<bigint>;

    // Slash Policy Governance (CC-13 · SP #329 unified slash) — read side
    /**
     * The address authorised to update the slash threshold table (`slashPolicyAdmin()` view).
     * Bootstrap on Sepolia = deployer EOA; governance moves it to a TimelockController (CC-13).
     */
    slashPolicyAdmin: () => Promise<Address>;
    /** The co-sign quorum required for a given {@link SlashLevel} (`slashThresholds(uint8)` view). */
    getSlashThreshold: (args: { slashLevel: SlashLevel | number }) => Promise<number>;
    /** Convenience: read the whole slash threshold table (WARNING/MINOR/MAJOR) in one shot. */
    getSlashThresholds: () => Promise<{ warning: number, minor: number, major: number }>;
    /**
     * The floor `setSlashThreshold` will not go below (`SLASH_THRESHOLD_FLOOR()` view). Read it rather
     * than assuming: a threshold table that passes {@link getSlashThresholds} but sits at the floor
     * means governance has no headroom left to lower it.
     */
    slashThresholdFloor: () => Promise<number>;
    /**
     * The two BLS domain path tags that separate a QUEUE co-signature from an EXECUTE one
     * (`TAG_QUEUE_SLASH()` / `TAG_EXECUTE_SLASH()`). A caller reconstructing either preimage must use
     * the on-chain tags — reusing one for the other is a valid signature over the wrong intent.
     */
    slashPathTags: () => Promise<{ queue: Hex, execute: Hex }>;

    // Guardian slash + exit cooldown (CC-13 批A) — read side
    /** Seconds a guardian must wait between requesting and consuming an exit (`GUARDIAN_EXIT_COOLDOWN()`). */
    guardianExitCooldown: () => Promise<bigint>;
    /** Seconds a queued guardian-slash case stays executable (`GUARDIAN_SLASH_CASE_WINDOW()`). */
    guardianSlashCaseWindow: () => Promise<bigint>;
    /**
     * Unix seconds until which this guardian is barred from exiting (`guardianExitCooldownUntil`).
     * `0` = not under cooldown. Compare against a BLOCK timestamp, not local wall-clock.
     */
    guardianExitCooldownUntil: (args: { guardian: Address }) => Promise<bigint>;
    /** A guardian's pending exit request window (`guardianExitRequests`); both `0` = no request. */
    guardianExitRequest: (args: { guardian: Address }) => Promise<{ readyAt: bigint, expiresAt: bigint }>;
    /** How many queued slash cases still name this guardian unresolved (`pendingGuardianSlashCount`). */
    pendingGuardianSlashCount: (args: { guardian: Address }) => Promise<bigint>;
    /** Whether a specific guardian was already slashed within a specific case (`guardianSlashed`). */
    guardianSlashed: (args: { caseId: bigint, guardian: Address }) => Promise<boolean>;
    /** Whether a queue-hash has been consumed, i.e. that co-signature cannot be replayed. */
    isSlashQueueHashUsed: (args: { queueHash: Hex }) => Promise<boolean>;
    /**
     * One queued guardian-slash case, decoded from `guardianSlashCases(uint256)`.
     *
     * Deliberately NOT a plain `readContract`: it raw-`call`s and asserts the return is exactly
     * {@link GUARDIAN_SLASH_CASE_BYTES} (7 words) before decoding. The deployed 4.11.0 struct has 7
     * fields while SuperPaymaster `src` 4.12.0 has 8 **under the same selector**, and viem decoding 7
     * static parameters out of a longer return does not revert — a field added anywhere but the end
     * shifts every later field with no error. Throws a named `AAStarError` on any other length, so a
     * contract upgrade shows up as a loud failure here rather than as plausible wrong values
     * downstream.
     *
     * ## What is actually holding, in three layers — do not read this as "verified"
     * 1. **Width (224 bytes)** — chain-anchored. Measured against the live aggregator, ids 0/1/2.
     * 2. **Field order** — anchored to `BLSAggregator-4.11.0.deployed.json`, which was matched
     *    70/70 on non-tuple selectors against the deployed bytecode. The chain cannot corroborate
     *    this further: a selector does not encode its outputs.
     * 3. **These two runtime guards** — **ASLEEP TODAY.** No guardian-slash case has ever been
     *    queued, so every read returns 224 zero bytes, and the zero address is legitimately
     *    zero-padded. On today's data neither guard can tell a correct decode from a wrong one.
     *    They wake up when the first real case is queued. What is doing real work right now is the
     *    sentinel fixture in `aggregator.guardianSlash.test.ts`, and what it pins is the
     *    decoder-against-ABI-file link — the right link, but not the on-chain one.
     */
    guardianSlashCase: (args: { caseId: bigint }) => Promise<GuardianSlashCase>;

    // Proposal & Execution
    executeProposal: (args: { proposalId: bigint, target: Address, callData: Hex, requiredThreshold: bigint, proof: Hex, account?: Account | Address }) => Promise<Hash>;
    verifyAndExecute: (args: { proposalId: bigint, operator: Address, slashLevel: number, repUsers: Address[], newScores: bigint[], epoch: bigint, evidenceHash: Hex, proof: Hex, account?: Account | Address }) => Promise<Hash>;
    executedProposals: (args: { proposalId: bigint }) => Promise<boolean>;
    proposalNonces: (args: { proposalId: bigint }) => Promise<bigint>;
    
    // Aggregated Signatures
    aggregatedSignatures: (args: { index: bigint }) => Promise<{ aggregatedSig: Hex, messageHash: Hex, timestamp: bigint, verified: boolean }>;
    
    // Config
    setDVTValidator: (args: { dv: Address, account?: Account | Address }) => Promise<Hash>;
    setSuperPaymaster: (args: { paymaster: Address, account?: Account | Address }) => Promise<Hash>;
    DVT_VALIDATOR: () => Promise<Address>;
    SUPERPAYMASTER: () => Promise<Address>;
    REGISTRY: () => Promise<Address>;
    
    // Constants
    MAX_VALIDATORS: () => Promise<bigint>;
    
    // Ownership
    owner: () => Promise<Address>;
    transferOwnership: (args: { newOwner: Address, account?: Account | Address }) => Promise<Hash>;
    renounceOwnership: (args: { account?: Account | Address }) => Promise<Hash>;
    
    // Version
    version: () => Promise<string>;
};

export const aggregatorActions = (address: Address) => (client: PublicClient | WalletClient): AggregatorActions => ({
    // BLS Public Key Management
    async registerBLSPublicKey({ validator, publicKey, account }) {
        try {
            validateAddress(validator, 'validator');
            validateRequired(publicKey, 'publicKey');
            return await (client as any).writeContract({
                address,
                abi: BLSAggregatorABI,
                functionName: 'registerBLSPublicKey',
                args: [validator, publicKey],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'registerBLSPublicKey');
        }
    },

    async blsPublicKeys({ validator }) {
        try {
            validateAddress(validator, 'validator');
            // On-chain fn: getBLSPublicKey(validator) -> (G1Point publicKey, uint8 slot, bool isActive).
            // The legacy `blsPublicKeys` mapping getter no longer exists; isActive is at index 2 (index 1 is the slot).
            const result = await (client as PublicClient).readContract({
                address,
                abi: BLSAggregatorABI,
                functionName: 'getBLSPublicKey',
                args: [validator]
            }) as any;
            return { publicKey: result[0], isActive: result[2] };
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'blsPublicKeys');
        }
    },

    async getBLSPublicKey({ validator }) {
        try {
            validateAddress(validator, 'validator');
            const r = await (client as PublicClient).readContract({
                address,
                abi: BLSAggregatorABI,
                functionName: 'getBLSPublicKey',
                args: [validator]
            }) as any;
            // outputs: (G1Point publicKey, uint8 slot, bool isActive)
            return { publicKey: r[0] as BLSG1Point, slot: Number(r[1]), isActive: r[2] as boolean };
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'getBLSPublicKey');
        }
    },

    async validatorAtSlot({ slot }) {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: BLSAggregatorABI,
                functionName: 'validatorAtSlot',
                args: [slot]
            }) as Promise<Address>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'validatorAtSlot');
        }
    },

    // DVT co-sign aggregation (frozen DVT program spec, hub #42)
    async buildSignerMask({ signers }) {
        // Semantic validation throws with its own message (NOT wrapped via
        // fromViemError, which would discard it for a generic "contract call failed").
        validateRequired(signers, 'signers');
        if (signers.length === 0) {
            throw new Error('buildSignerMask: signers must be a non-empty array');
        }
        signers.forEach((s) => validateAddress(s, 'signer'));

        // Only the genuine contract reads are wrapped. Reads are independent → run
        // concurrently; the resulting mask is order-independent.
        let infos: { signer: Address, slot: number, isActive: boolean }[];
        try {
            infos = await Promise.all(signers.map(async (signer) => {
                const r = await (client as PublicClient).readContract({
                    address,
                    abi: BLSAggregatorABI,
                    functionName: 'getBLSPublicKey',
                    args: [signer]
                }) as any;
                return { signer, slot: Number(r[1]), isActive: r[2] as boolean };
            }));
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'buildSignerMask');
        }

        for (const { signer, slot, isActive } of infos) {
            if (!isActive || slot < 1) {
                throw new Error(
                    `buildSignerMask: signer ${signer} is not a registered active DVT validator (slot ${slot}, active ${isActive})`
                );
            }
        }
        const slots = infos.map((i) => i.slot);
        if (new Set(slots).size !== slots.length) {
            throw new Error(`buildSignerMask: duplicate registration slots in signer set: ${slots.join(', ')}`);
        }
        const signerMask = BLSHelpers.slotsToSignerMask(slots);
        return { signerMask, slots: [...slots].sort((a, b) => a - b) };
    },

    async verify({ expectedMessageHash, signerMask, requiredThreshold, sigBytes }) {
        try {
            validateRequired(expectedMessageHash, 'expectedMessageHash');
            validateRequired(signerMask, 'signerMask');
            validateRequired(requiredThreshold, 'requiredThreshold');
            validateRequired(sigBytes, 'sigBytes');
            return await (client as PublicClient).readContract({
                address,
                abi: BLSAggregatorABI,
                functionName: 'verify',
                args: [expectedMessageHash, signerMask, requiredThreshold, sigBytes]
            }) as Promise<boolean>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'verify');
        }
    },

    // Threshold Management
    async setDefaultThreshold({ newThreshold, account }) {
        try {
            validateRequired(newThreshold, 'newThreshold');
            return await (client as any).writeContract({
                address,
                abi: BLSAggregatorABI,
                functionName: 'setDefaultThreshold',
                args: [newThreshold],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'setDefaultThreshold');
        }
    },

    async setMinThreshold({ newThreshold, account }) {
        try {
            validateRequired(newThreshold, 'newThreshold');
            return await (client as any).writeContract({
                address,
                abi: BLSAggregatorABI,
                functionName: 'setMinThreshold',
                args: [newThreshold],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'setMinThreshold');
        }
    },

    async defaultThreshold() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: BLSAggregatorABI,
                functionName: 'defaultThreshold',
                args: []
            }) as Promise<bigint>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'defaultThreshold');
        }
    },

    async minThreshold() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: BLSAggregatorABI,
                functionName: 'minThreshold',
                args: []
            }) as Promise<bigint>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'minThreshold');
        }
    },

    // Slash Policy Governance (CC-13 · SP #329 unified slash) — read side
    async slashPolicyAdmin() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: BLSAggregatorABI,
                functionName: 'slashPolicyAdmin',
                args: []
            }) as Address;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'slashPolicyAdmin');
        }
    },

    async getSlashThreshold({ slashLevel }) {
        try {
            validateRequired(slashLevel, 'slashLevel');
            const threshold = await (client as PublicClient).readContract({
                address,
                abi: BLSAggregatorABI,
                functionName: 'slashThresholds',
                args: [slashLevel]
            });
            return Number(threshold);
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'getSlashThreshold');
        }
    },

    async getSlashThresholds() {
        try {
            const read = (slashLevel: number) => (client as PublicClient).readContract({
                address,
                abi: BLSAggregatorABI,
                functionName: 'slashThresholds',
                args: [slashLevel]
            });
            const [warning, minor, major] = await Promise.all([
                read(SlashLevel.WARNING),
                read(SlashLevel.MINOR),
                read(SlashLevel.MAJOR)
            ]);
            return { warning: Number(warning), minor: Number(minor), major: Number(major) };
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'getSlashThresholds');
        }
    },

    async slashThresholdFloor() {
        try {
            const floor = await (client as PublicClient).readContract({
                address,
                abi: BLSAggregatorABI,
                functionName: 'SLASH_THRESHOLD_FLOOR',
                args: []
            });
            return Number(floor);
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'slashThresholdFloor');
        }
    },

    async slashPathTags() {
        try {
            const read = (functionName: string) => (client as PublicClient).readContract({
                address, abi: BLSAggregatorABI, functionName, args: []
            }) as Promise<Hex>;
            const [queue, execute] = await Promise.all([
                read('TAG_QUEUE_SLASH'),
                read('TAG_EXECUTE_SLASH'),
            ]);
            return { queue, execute };
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'slashPathTags');
        }
    },

    // Guardian slash + exit cooldown (CC-13 批A) — read side

    async guardianExitCooldown() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: BLSAggregatorABI,
                functionName: 'GUARDIAN_EXIT_COOLDOWN',
                args: []
            }) as Promise<bigint>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'guardianExitCooldown');
        }
    },

    async guardianSlashCaseWindow() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: BLSAggregatorABI,
                functionName: 'GUARDIAN_SLASH_CASE_WINDOW',
                args: []
            }) as Promise<bigint>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'guardianSlashCaseWindow');
        }
    },

    async guardianExitCooldownUntil({ guardian }) {
        try {
            validateAddress(guardian, 'guardian');
            const until = await (client as PublicClient).readContract({
                address,
                abi: BLSAggregatorABI,
                functionName: 'guardianExitCooldownUntil',
                args: [guardian]
            });
            // uint64 — widen to bigint so callers compare against block timestamps without a cast.
            return BigInt(until as bigint | number);
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'guardianExitCooldownUntil');
        }
    },

    async guardianExitRequest({ guardian }) {
        try {
            validateAddress(guardian, 'guardian');
            const [readyAt, expiresAt] = await (client as PublicClient).readContract({
                address,
                abi: BLSAggregatorABI,
                functionName: 'guardianExitRequests',
                args: [guardian]
            }) as readonly [bigint | number, bigint | number];
            return { readyAt: BigInt(readyAt), expiresAt: BigInt(expiresAt) };
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'guardianExitRequest');
        }
    },

    async pendingGuardianSlashCount({ guardian }) {
        try {
            validateAddress(guardian, 'guardian');
            return await (client as PublicClient).readContract({
                address,
                abi: BLSAggregatorABI,
                functionName: 'pendingGuardianSlashCount',
                args: [guardian]
            }) as Promise<bigint>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'pendingGuardianSlashCount');
        }
    },

    async guardianSlashed({ caseId, guardian }) {
        try {
            validateRequired(caseId, 'caseId');
            validateAddress(guardian, 'guardian');
            return await (client as PublicClient).readContract({
                address,
                abi: BLSAggregatorABI,
                functionName: 'guardianSlashed',
                args: [caseId, guardian]
            }) as Promise<boolean>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'guardianSlashed');
        }
    },

    async isSlashQueueHashUsed({ queueHash }) {
        try {
            validateRequired(queueHash, 'queueHash');
            return await (client as PublicClient).readContract({
                address,
                abi: BLSAggregatorABI,
                functionName: 'usedSlashQueueHashes',
                args: [queueHash]
            }) as Promise<boolean>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'isSlashQueueHashUsed');
        }
    },

    async guardianSlashCase({ caseId }) {
        validateRequired(caseId, 'caseId');
        let raw: Hex;
        try {
            const { data } = await (client as PublicClient).call({
                to: address,
                data: encodeFunctionData({
                    abi: BLSAggregatorABI,
                    functionName: 'guardianSlashCases',
                    args: [caseId],
                }),
            });
            if (data === undefined) {
                throw new Error('guardianSlashCases returned no data');
            }
            raw = data;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'guardianSlashCase');
        }

        // The shape gate. See GUARDIAN_SLASH_CASE_WORDS: this is the ONE place the deployed 4.11.0
        // and the 4.12.0 source diverge, and it diverges without changing the selector — so length is
        // the only signal available before the values are already wrong. Checked BEFORE decoding, so a
        // longer return can never reach the decoder and produce plausible-looking shifted fields.
        const byteLength = (raw.length - 2) / 2;
        // An EMPTY return is a different diagnosis and deserves a different one. `eth_call` answers
        // `0x` when there is no code at the address, or when the contract has no such function and no
        // fallback — neither is an ABI-shape problem, and telling someone to re-sync the ABI sends
        // them to the wrong place. Split it out before the shape message can claim it.
        if (byteLength === 0) {
            throw new AAStarError(
                ErrorCode.CONTRACT_REVERT,
                `guardianSlashCase: eth_call to ${address} returned empty data for ` +
                `guardianSlashCases(${caseId}). That usually means there is no contract code at this ` +
                `address, or the contract has no such function — not that the ABI drifted. Check that ` +
                `the aggregator address is right for this chain before re-syncing anything.`,
            );
        }
        if (byteLength !== GUARDIAN_SLASH_CASE_BYTES) {
            throw new AAStarError(
                ErrorCode.ABI_SHAPE_MISMATCH,
                `guardianSlashCase: aggregator ${address} returned ${byteLength} bytes for ` +
                `guardianSlashCases(${caseId}), expected ${GUARDIAN_SLASH_CASE_BYTES} ` +
                `(${GUARDIAN_SLASH_CASE_WORDS} words = the deployed BLSAggregator-4.11.0 struct). ` +
                `The selector is unchanged across 4.11.0/4.12.0 while the struct is not, so this is a ` +
                `contract upgrade, not a bad caseId. Refusing to decode: a 7-parameter decode of a ` +
                `longer return does not revert, it silently shifts every field after the added one. ` +
                `Re-sync the BLSAggregator ABI (pnpm run abi:sync) and update GUARDIAN_SLASH_CASE_WORDS.`,
            );
        }

        // Length is NECESSARY BUT NOT SUFFICIENT: a same-width change (4.12.0 REPLACING a field rather
        // than adding one) is still 7 words and sails through the check above. The cheap complement is
        // the one word whose valid values are constrained — `verifier` is an address, so its high 12
        // bytes MUST be zero. Any field shift moves a uint256/bytes32 into that slot and lights up
        // immediately. Length catches additions; this catches displacement.
        const verifierWord = raw.slice(2 + GUARDIAN_SLASH_CASE_VERIFIER_WORD * 64);
        if (!/^0{24}/.test(verifierWord)) {
            throw new AAStarError(
                ErrorCode.ABI_SHAPE_MISMATCH,
                `guardianSlashCase: word ${GUARDIAN_SLASH_CASE_VERIFIER_WORD} of ` +
                `guardianSlashCases(${caseId}) on ${address} is 0x${verifierWord.slice(0, 64)}, whose ` +
                `high 12 bytes are not zero — it cannot be the \`verifier\` address. The return is the ` +
                `expected ${GUARDIAN_SLASH_CASE_BYTES} bytes, so this is a same-width struct change ` +
                `(a field replaced or reordered), which the length check cannot see. Refusing to ` +
                `decode: every field would be plausible and wrong. Re-sync the BLSAggregator ABI.`,
            );
        }

        try {
            const [guardiansHash, fraudProofHash, deadline, status, guardianCount, resolvedCount, verifier] =
                decodeFunctionResult({
                    abi: BLSAggregatorABI,
                    functionName: 'guardianSlashCases',
                    data: raw,
                }) as readonly [Hex, Hex, bigint | number, number, number, number, Address];
            return {
                guardiansHash,
                fraudProofHash,
                deadline: BigInt(deadline),
                status: Number(status) as GuardianSlashStatus,
                guardianCount: Number(guardianCount),
                resolvedCount: Number(resolvedCount),
                verifier,
            };
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'guardianSlashCase');
        }
    },

    // Proposal & Execution
    async executeProposal({ proposalId, target, callData, requiredThreshold, proof, account }) {
        try {
            validateRequired(proposalId, 'proposalId');
            validateAddress(target, 'target');
            validateRequired(callData, 'callData');
            validateRequired(requiredThreshold, 'requiredThreshold');
            validateRequired(proof, 'proof');
            return await (client as any).writeContract({
                address,
                abi: BLSAggregatorABI,
                functionName: 'executeProposal',
                args: [proposalId, target, callData, requiredThreshold, proof],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'executeProposal');
        }
    },

    async verifyAndExecute({ proposalId, operator, slashLevel, repUsers, newScores, epoch, evidenceHash, proof, account }) {
        try {
            validateRequired(proposalId, 'proposalId');
            validateAddress(operator, 'operator');
            validateRequired(slashLevel, 'slashLevel');
            validateRequired(repUsers, 'repUsers');
            validateRequired(newScores, 'newScores');
            validateRequired(epoch, 'epoch');
            // #285/SP#329 slash-consensus unify: verifyAndExecute now binds an evidenceHash (part of the
            // execute messageHash keccak256(abi.encode(proposalId, operator, slashLevel, repUsers, newScores,
            // epoch, chainid, evidenceHash))). The old 7-arg overload was REMOVED on-chain.
            validateRequired(evidenceHash, 'evidenceHash');
            validateRequired(proof, 'proof');
            return await (client as any).writeContract({
                address,
                abi: BLSAggregatorABI,
                functionName: 'verifyAndExecute',
                args: [proposalId, operator, slashLevel, repUsers, newScores, epoch, evidenceHash, proof],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'verifyAndExecute');
        }
    },

    async executedProposals({ proposalId }) {
        try {
            validateRequired(proposalId, 'proposalId');
            return await (client as PublicClient).readContract({
                address,
                abi: BLSAggregatorABI,
                functionName: 'executedProposals',
                args: [proposalId]
            }) as Promise<boolean>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'executedProposals');
        }
    },

    async proposalNonces({ proposalId }) {
        try {
            validateRequired(proposalId, 'proposalId');
            return await (client as PublicClient).readContract({
                address,
                abi: BLSAggregatorABI,
                functionName: 'proposalNonces',
                args: [proposalId]
            }) as Promise<bigint>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'proposalNonces');
        }
    },

    // Aggregated Signatures
    async aggregatedSignatures({ index }) {
        try {
            validateRequired(index, 'index');
            const result = await (client as PublicClient).readContract({
                address,
                abi: BLSAggregatorABI,
                functionName: 'aggregatedSignatures',
                args: [index]
            }) as any;
            return {
                aggregatedSig: result[0],
                messageHash: result[1],
                timestamp: result[2],
                verified: result[3]
            };
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'aggregatedSignatures');
        }
    },

    // Config
    async setDVTValidator({ dv, account }) {
        try {
            validateAddress(dv, 'dv');
            return await (client as any).writeContract({
                address,
                abi: BLSAggregatorABI,
                functionName: 'setDVTValidator',
                args: [dv],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'setDVTValidator');
        }
    },

    async setSuperPaymaster({ paymaster, account }) {
        try {
            validateAddress(paymaster, 'paymaster');
            return await (client as any).writeContract({
                address,
                abi: BLSAggregatorABI,
                functionName: 'setSuperPaymaster',
                args: [paymaster],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'setSuperPaymaster');
        }
    },

    async DVT_VALIDATOR() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: BLSAggregatorABI,
                functionName: 'DVT_VALIDATOR',
                args: []
            }) as Promise<Address>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'DVT_VALIDATOR');
        }
    },

    async SUPERPAYMASTER() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: BLSAggregatorABI,
                functionName: 'SUPERPAYMASTER',
                args: []
            }) as Promise<Address>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'SUPERPAYMASTER');
        }
    },

    async REGISTRY() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: BLSAggregatorABI,
                functionName: 'REGISTRY',
                args: []
            }) as Promise<Address>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'REGISTRY');
        }
    },

    async MAX_VALIDATORS() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: BLSAggregatorABI,
                functionName: 'MAX_VALIDATORS',
                args: []
            }) as Promise<bigint>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'MAX_VALIDATORS');
        }
    },

    async owner() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: BLSAggregatorABI,
                functionName: 'owner',
                args: []
            }) as Promise<Address>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'owner');
        }
    },

    async transferOwnership({ newOwner, account }) {
        try {
            validateAddress(newOwner, 'newOwner');
            return await (client as any).writeContract({
                address,
                abi: BLSAggregatorABI,
                functionName: 'transferOwnership',
                args: [newOwner],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'transferOwnership');
        }
    },

    async renounceOwnership({ account }) {
        try {
            return await (client as any).writeContract({
                address,
                abi: BLSAggregatorABI,
                functionName: 'renounceOwnership',
                args: [],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'renounceOwnership');
        }
    },

    async revokeBLSPublicKey({ validator, account }) {
        try {
            validateAddress(validator, 'validator');
            return await (client as any).writeContract({
                address,
                abi: BLSAggregatorABI,
                functionName: 'revokeBLSPublicKey',
                args: [validator],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'revokeBLSPublicKey');
        }
    },

    async setPermissionlessBLSRegistration({ enabled, account }) {
        try {
            validateRequired(enabled, 'enabled');
            return await (client as any).writeContract({
                address,
                abi: BLSAggregatorABI,
                functionName: 'setPermissionlessBLSRegistration',
                args: [enabled],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'setPermissionlessBLSRegistration');
        }
    },

    async permissionlessBLSRegistration() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: BLSAggregatorABI,
                functionName: 'permissionlessBLSRegistration',
                args: []
            }) as Promise<boolean>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'permissionlessBLSRegistration');
        }
    },

    async version() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: BLSAggregatorABI,
                functionName: 'version',
                args: []
            }) as Promise<string>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'version');
        }
    }
});
