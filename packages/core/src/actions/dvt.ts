import {
    type Address, type PublicClient, type WalletClient, type Hex, type Hash, type Account,
    decodeAbiParameters, encodeAbiParameters, isHex, keccak256, zeroAddress, zeroHash,
} from 'viem';
import { BLSAggregatorV414DevABI, DVTValidatorABI, DVTValidatorV090DevABI } from '../abis/index.js';
import type { BLSG1Point, BLSG2Point } from './aggregator.js';
import { validateAddress, validateRequired } from '../validators/index.js';
import { AAStarError, ErrorCode } from '../errors/index.js';

export type DVTActions = {
    // Proposal Management
    /**
     * On DVTValidator-0.9.0 this succeeds only for a pure-reputation proposal (operator == 0 and level == 0): it calls
     * the 3-argument `createProposal`, which commits evidenceHash 0, so every slash-shaped proposal reverts with
     * MissingEvidenceHash (or UnknownEvidenceCategory(0) while no category is configured, as on SP 5.5.0). A slash
     * needs the 4-argument `createProposal(operator, level, reason, evidenceHash)`, which the SDK will add when 5.5.x
     * enables slashing; the rename of this action waits for then too. On DVTValidator-0.6.0 .. 0.8.x it creates either shape.
     */
    createSlashProposal: (args: { operator: Address, level: number, reason: string, account?: Account | Address }) => Promise<Hash>;
    /** @deprecated Removed in the v5.x contract refactor — DVT slash signing is off-chain (BLS), there is no `signSlashProposal` in the DVTValidator ABI. Throws {@link ErrorCode.NOT_IMPLEMENTED}. */
    signSlashProposal: (args: { proposalId: bigint, signature: Hex, account?: Account | Address }) => Promise<Hash>;
    /**
     * DVTValidator.executeWithProof. The generation is chosen by `evidence`:
     * - omitted: the 5-argument form `executeWithProof(id, repUsers, newScores, epoch, proof)` of DVTValidator-0.6.0 ..
     *   0.8.x (the deployed Sepolia DVT is 0.6.0), with the default `DVTValidatorABI`.
     * - given: the DVTValidator-0.9.0 form `executeWithProof(id, repUsers, newScores, epoch, evidence, proof)` (SP #635,
     *   development pin `DVTValidatorV090DevABI`). Before sending, the stored proposal is read and the arguments are
     *   checked against it as the contract would: a pure-reputation proposal (operator == 0 and level == 0) needs
     *   repUsers, `evidence` exactly `0x` and a zero stored evidenceHash; a slash-shaped one needs empty repUsers /
     *   newScores and `evidence = abi.encode(bytes32 category, bytes body)` with a configured category whose
     *   `keccak256(abi.encode(TAG_EVIDENCE, category, keccak256(body)))` equals the stored evidenceHash. The category
     *   checker itself runs only on chain. SP 5.5.0 configures no category, so every slash-shaped proposal is refused.
     * Sending one generation's form to the other reverts at gas estimation; nothing is broadcast.
     */
    executeSlashWithProof: (args: { proposalId: bigint, repUsers: Address[], newScores: bigint[], epoch: bigint, evidence?: Hex, proof: Hex, account?: Account | Address }) => Promise<Hash>;
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
     * Register a validator's BLS key through DVTValidator-0.8.0+ (SP rc.8; unchanged in 0.9.0). From BLSAggregator-4.14.0 the
     * aggregator accepts `registerBLSPublicKey` only from its current DVT, so this is the only working route.
     * ABI: registerBLSPublicKey(address validator, BLS.G1Point key, uint8 slot, BLS.G2Point pop).
     * - Owner of DVTValidator: may register any validator; `slot` is used as given.
     * - Anyone else: only when `aggregator.permissionlessBLSRegistration()` is true and the sender is `validator`
     *   (else PermissionlessRegistrationDisabled / UnauthorizedCaller), and the validator must hold ROLE_DVT with
     *   the minimum stake and not be suspended. `slot` is ignored: the contract keeps an active key's slot or
     *   takes the first free one (SlotOutOfRange when full).
     * The ABI is a development pin (see `DVTValidatorV090DevABI`) until the rc.8 tag.
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
 * DVTValidator-0.9.0 plus the BLSAggregator-4.14.x errors it does not declare. `registerBLSPublicKey` and
 * `executeWithProof` forward to the aggregator, whose reverts (InvalidParameter(bytes32), InvalidThreshold, ...) bubble
 * up unchanged; without these entries viem cannot name them.
 */
export const DVT_V090_ABI: readonly any[] = (() => {
    const own = DVTValidatorV090DevABI as any[];
    const seen = new Set(own.filter((item) => item.type === 'error').map(errorKey));
    const extra = (BLSAggregatorV414DevABI as any[]).filter((item) => item.type === 'error' && !seen.has(errorKey(item)));
    return Object.freeze([...own, ...extra]);
})();

const refuse = (message: string) => new AAStarError(ErrorCode.INVALID_PARAMETER, `executeWithProof (DVTValidator-0.9.0): ${message}`);

/**
 * The checks DVTValidator-0.9.0 `executeWithProof` makes before it calls the aggregator, run against the stored
 * proposal so a doomed call is refused before it is sent. Proposal fields are fixed at creation, so the read cannot go
 * stale before the send (only `executed` can change, and the contract still rejects a second execution).
 */
async function checkEvidenceAgainstProposal(
    client: PublicClient, address: Address,
    { proposalId, repUsers, newScores, evidence }: { proposalId: bigint, repUsers: readonly Address[], newScores: readonly bigint[], evidence: Hex },
): Promise<void> {
    if (!isHex(evidence, { strict: true }) || evidence.length % 2 !== 0) throw refuse('evidence must be 0x-prefixed hex bytes');
    const [operator, slashLevel, , executed, exists, evidenceHash] = await client.readContract({
        address, abi: DVT_V090_ABI, functionName: 'proposals', args: [proposalId],
    }) as readonly [Address, number, string, boolean, boolean, Hex];
    if (!exists) throw refuse(`proposal ${proposalId} does not exist (ProposalDoesNotExist)`);
    if (executed) throw refuse(`proposal ${proposalId} is already executed (ProposalExecutedAlready)`);
    if (operator.toLowerCase() === zeroAddress && Number(slashLevel) === 0) {
        if (repUsers.length === 0) throw refuse('a pure-reputation proposal needs repUsers (ProposalShapeMismatch)');
        if (evidence !== '0x') throw refuse('a pure-reputation proposal takes evidence "0x" (ReputationEvidenceNotEmpty)');
        if (evidenceHash.toLowerCase() !== zeroHash) throw refuse('this pure-reputation proposal stores a non-zero evidenceHash (ReputationEvidenceHashNotZero)');
        return;
    }
    if (repUsers.length !== 0 || newScores.length !== 0) throw refuse('a slash-shaped proposal takes empty repUsers and newScores (ProposalShapeMismatch)');
    let category: Hex, body: Hex;
    try {
        [category, body] = decodeAbiParameters([{ type: 'bytes32' }, { type: 'bytes' }], evidence);
    } catch {
        throw refuse('a slash-shaped proposal takes evidence = abi.encode(bytes32 category, bytes body)');
    }
    const checker = await client.readContract({ address, abi: DVT_V090_ABI, functionName: 'checkerOf', args: [category] }) as Address;
    if (checker.toLowerCase() === zeroAddress) throw refuse(`evidence category ${category} is not configured (UnknownEvidenceCategory)`);
    const tag = await client.readContract({ address, abi: DVT_V090_ABI, functionName: 'TAG_EVIDENCE', args: [] }) as Hex;
    const hash = keccak256(encodeAbiParameters([{ type: 'bytes32' }, { type: 'bytes32' }, { type: 'bytes32' }], [tag, category, keccak256(body)]));
    if (hash.toLowerCase() !== evidenceHash.toLowerCase()) throw refuse(`evidence hashes to ${hash}, the proposal committed to ${evidenceHash} (EvidenceHashMismatch)`);
}

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

    async executeSlashWithProof({ proposalId, repUsers, newScores, epoch, evidence, proof, account }) {
        try {
            validateRequired(proposalId, 'proposalId');
            validateRequired(repUsers, 'repUsers');
            validateRequired(newScores, 'newScores');
            validateRequired(epoch, 'epoch');
            validateRequired(proof, 'proof');
            if (evidence === undefined) {
                return await (client as any).writeContract({
                    address,
                    abi: DVTValidatorABI,
                    functionName: 'executeWithProof',
                    args: [proposalId, repUsers, newScores, epoch, proof],
                    account: account as any,
                    chain: (client as any).chain
                });
            }
            await checkEvidenceAgainstProposal(client as PublicClient, address, { proposalId, repUsers, newScores, evidence });
            return await (client as any).writeContract({
                address,
                abi: DVT_V090_ABI,
                functionName: 'executeWithProof',
                args: [proposalId, repUsers, newScores, epoch, evidence, proof],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            if (error instanceof AAStarError) throw error;
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
                abi: DVT_V090_ABI,
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
