import { type Address, type PublicClient, type WalletClient, type Hex, type Hash, type Account } from 'viem';
import { BLSAggregatorV414DevABI, DVTValidatorABI, DVTValidatorV080DevABI } from '../abis/index.js';
import type { BLSG1Point, BLSG2Point } from './aggregator.js';
import { validateAddress, validateRequired } from '../validators/index.js';
import { AAStarError, ErrorCode } from '../errors/index.js';

export type DVTActions = {
    // Proposal Management
    createSlashProposal: (args: { operator: Address, level: number, reason: string, account?: Account | Address }) => Promise<Hash>;
    /** @deprecated Removed in the v5.x contract refactor — DVT slash signing is off-chain (BLS), there is no `signSlashProposal` in the DVTValidator ABI. Throws {@link ErrorCode.NOT_IMPLEMENTED}. */
    signSlashProposal: (args: { proposalId: bigint, signature: Hex, account?: Account | Address }) => Promise<Hash>;
    executeSlashWithProof: (args: { proposalId: bigint, repUsers: Address[], newScores: bigint[], epoch: bigint, proof: Hex, account?: Account | Address }) => Promise<Hash>;
    markProposalExecuted: (args: { id: bigint, account?: Account | Address }) => Promise<Hash>;
    proposals: (args: { proposalId: bigint }) => Promise<{ operator: Address, slashLevel: number, reason: string, executed: boolean }>;
    nextProposalId: () => Promise<bigint>;
    
    // Validator Management
    isValidator: (args: { user: Address }) => Promise<boolean>;
    addValidator: (args: { v: Address, account?: Account | Address }) => Promise<Hash>;
    /** Remove a validator from the active set (owner-gated). ABI: removeValidator(address v). */
    removeValidator: (args: { v: Address, account?: Account | Address }) => Promise<Hash>;
    /** Prune a validator entry (cleanup of a removed/stale validator). ABI: pruneValidator(address v). */
    pruneValidator: (args: { v: Address, account?: Account | Address }) => Promise<Hash>;
    
    /**
     * Register a validator's BLS key through DVTValidator-0.8.0 (SP rc.8). From BLSAggregator-4.14.0 the
     * aggregator accepts `registerBLSPublicKey` only from its current DVT, so this is the only working route.
     * ABI: registerBLSPublicKey(address validator, BLS.G1Point key, uint8 slot, BLS.G2Point pop).
     * - Owner of DVTValidator: may register any validator; `slot` is used as given.
     * - Anyone else: only when `aggregator.permissionlessBLSRegistration()` is true and the sender is `validator`
     *   (else PermissionlessRegistrationDisabled / UnauthorizedCaller), and the validator must hold ROLE_DVT with
     *   the minimum stake and not be suspended. `slot` is ignored: the contract keeps an active key's slot or
     *   takes the first free one (SlotOutOfRange when full).
     * The ABI is a development pin (see `DVTValidatorV080DevABI`) until the rc.8 tag.
     */
    registerBLSPublicKey: (args: {
        validator: Address, key: BLSG1Point, slot: number, pop: BLSG2Point, account?: Account | Address,
    }) => Promise<Hash>;

    // BLS Aggregator Integration
    setBLSAggregator: (args: { aggregator: Address, account?: Account | Address }) => Promise<Hash>;
    BLS_AGGREGATOR: () => Promise<Address>;
    REGISTRY: () => Promise<Address>;
    
    // Ownership
    owner: () => Promise<Address>;
    transferOwnership: (args: { newOwner: Address, account?: Account | Address }) => Promise<Hash>;
    renounceOwnership: (args: { account?: Account | Address }) => Promise<Hash>;
    
    // Version
    version: () => Promise<string>;
};

const isWord = (v: unknown): boolean => typeof v === 'string' && /^0x[0-9a-fA-F]{64}$/.test(v);

const errorKey = (item: any): string => `${item.name}(${(item.inputs ?? []).map((x: any) => x.type).join(',')})`;

/**
 * DVTValidator-0.8.0 plus the BLSAggregator-4.14.0 errors it does not declare. `registerBLSPublicKey` forwards to the
 * aggregator, whose reverts (InvalidParameter(bytes32), InvalidThreshold, ...) bubble up unchanged; without these
 * entries viem cannot name them.
 */
export const DVT_BLS_REGISTRATION_ABI: readonly any[] = (() => {
    const own = DVTValidatorV080DevABI as any[];
    const seen = new Set(own.filter((item) => item.type === 'error').map(errorKey));
    const extra = (BLSAggregatorV414DevABI as any[]).filter((item) => item.type === 'error' && !seen.has(errorKey(item)));
    return Object.freeze([...own, ...extra]);
})();

export const dvtActions = (address: Address) => (client: PublicClient | WalletClient): DVTActions => ({
    // Proposal Management
    async createSlashProposal({ operator, level, reason, account }) {
        try {
            validateAddress(operator, 'operator');
            validateRequired(reason, 'reason');
            return await (client as any).writeContract({
                address,
                abi: DVTValidatorABI,
                functionName: 'createProposal',
                args: [operator, level, reason],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'createSlashProposal');
        }
    },
    
    async signSlashProposal({ proposalId, signature }) {
        // `signSlashProposal` was removed in the v5.x contract refactor: slash-proposal
        // co-signing is performed OFF-CHAIN via BLS (signatures are aggregated and submitted
        // through the BLSAggregator / executeWithProof path), so the DVTValidator ABI exposes
        // no such function. Validate inputs then throw rather than revert on-chain.
        validateRequired(proposalId, 'proposalId');
        validateRequired(signature, 'signature');
        throw new AAStarError(
            ErrorCode.NOT_IMPLEMENTED,
            'signSlashProposal was removed in the v5.x contract refactor; DVT slash signing is ' +
            'off-chain (BLS). Aggregate signatures off-chain and submit via the BLSAggregator ' +
            '(verifyAndExecute) or DVTValidator.executeWithProof instead.'
        );
    },

    async executeSlashWithProof({ proposalId, repUsers, newScores, epoch, proof, account }) {
        try {
            validateRequired(proposalId, 'proposalId');
            validateRequired(repUsers, 'repUsers');
            validateRequired(newScores, 'newScores');
            validateRequired(epoch, 'epoch');
            validateRequired(proof, 'proof');
            return await (client as any).writeContract({
                address,
                abi: DVTValidatorABI,
                functionName: 'executeWithProof',
                args: [proposalId, repUsers, newScores, epoch, proof],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'executeSlashWithProof');
        }
    },

    async markProposalExecuted({ id, account }) {
        try {
            validateRequired(id, 'id');
            return await (client as any).writeContract({
                address,
                abi: DVTValidatorABI,
                functionName: 'markProposalExecuted',
                args: [id],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'markProposalExecuted');
        }
    },

    async proposals({ proposalId }) {
        try {
            validateRequired(proposalId, 'proposalId');
            const result = await (client as PublicClient).readContract({
                address,
                abi: DVTValidatorABI,
                functionName: 'proposals',
                args: [proposalId]
            }) as any;
            return {
                operator: result[0],
                slashLevel: Number(result[1]),
                reason: result[2],
                executed: result[3]
            };
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'proposals');
        }
    },

    async nextProposalId() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: DVTValidatorABI,
                functionName: 'nextProposalId',
                args: []
            }) as Promise<bigint>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'nextProposalId');
        }
    },

    // Validator Management
    async isValidator({ user }) {
        try {
            validateAddress(user, 'user');
            return await (client as PublicClient).readContract({
                address,
                abi: DVTValidatorABI,
                functionName: 'isValidator',
                args: [user]
            }) as Promise<boolean>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'isValidator');
        }
    },

    async registerBLSPublicKey({ validator, key, slot, pop, account }) {
        try {
            validateAddress(validator, 'validator');
            if (!Number.isInteger(slot) || slot < 0 || slot > 255) {
                throw new AAStarError(ErrorCode.INVALID_PARAMETER, 'slot must be an integer in [0, 255]');
            }
            const g1 = [key?.x_a, key?.x_b, key?.y_a, key?.y_b];
            const g2 = [pop?.x_c0_a, pop?.x_c0_b, pop?.x_c1_a, pop?.x_c1_b, pop?.y_c0_a, pop?.y_c0_b, pop?.y_c1_a, pop?.y_c1_b];
            if (![...g1, ...g2].every(isWord)) {
                throw new AAStarError(ErrorCode.INVALID_PARAMETER, 'key and pop must be BLS.G1Point / BLS.G2Point with bytes32 fields');
            }
            return await (client as any).writeContract({
                address,
                abi: DVT_BLS_REGISTRATION_ABI,
                functionName: 'registerBLSPublicKey',
                args: [validator, key, slot, pop],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            if (error instanceof AAStarError) throw error;
            throw AAStarError.fromViemError(error as Error, 'registerBLSPublicKey');
        }
    },

    async addValidator({ v, account }) {
        try {
            validateAddress(v, 'v');
            return await (client as any).writeContract({
                address,
                abi: DVTValidatorABI,
                functionName: 'addValidator',
                args: [v],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'addValidator');
        }
    },

    async removeValidator({ v, account }) {
        try {
            validateAddress(v, 'v');
            return await (client as any).writeContract({
                address,
                abi: DVTValidatorABI,
                functionName: 'removeValidator',
                args: [v],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'removeValidator');
        }
    },

    async pruneValidator({ v, account }) {
        try {
            validateAddress(v, 'v');
            return await (client as any).writeContract({
                address,
                abi: DVTValidatorABI,
                functionName: 'pruneValidator',
                args: [v],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'pruneValidator');
        }
    },

    // BLS Aggregator Integration
    async setBLSAggregator({ aggregator, account }) {
        try {
            validateAddress(aggregator, 'aggregator');
            return await (client as any).writeContract({
                address,
                abi: DVTValidatorABI,
                functionName: 'setBLSAggregator',
                args: [aggregator],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'setBLSAggregator');
        }
    },

    async BLS_AGGREGATOR() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: DVTValidatorABI,
                functionName: 'BLS_AGGREGATOR',
                args: []
            }) as Promise<Address>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'BLS_AGGREGATOR');
        }
    },

    async REGISTRY() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: DVTValidatorABI,
                functionName: 'REGISTRY',
                args: []
            }) as Promise<Address>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'REGISTRY');
        }
    },

    // Ownership
    async owner() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: DVTValidatorABI,
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
                abi: DVTValidatorABI,
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
                abi: DVTValidatorABI,
                functionName: 'renounceOwnership',
                args: [],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'renounceOwnership');
        }
    },

    async version() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: DVTValidatorABI,
                functionName: 'version',
                args: []
            }) as Promise<string>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'version');
        }
    }
});
