import { type Address, type PublicClient, type WalletClient, type Hex, type Hash, type Account, encodeFunctionData } from 'viem';
import { BLSAggregatorABI } from '../abis/index.js';
import { validateAddress, validateRequired } from '../validators/index.js';
import { AAStarError } from '../errors/index.js';
import { BLSHelpers } from '../crypto/blsSigner.js';

/** A registered validator's on-chain BLS G1 public key point. */
export type BLSG1Point = { x_a: Hex, x_b: Hex, y_a: Hex, y_b: Hex };

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
