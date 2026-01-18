import { type Address, type PublicClient, type WalletClient, type Hex, type Hash, type Account } from 'viem';
import { DVTValidatorABI } from '../abis/index.js';
import { validateAddress, validateRequired } from '../validators/index.js';
import { AAStarError } from '../errors/index.js';

export type DVTActions = {
    // Proposal Management
    createSlashProposal: (args: { operator: Address, level: number, reason: string, account?: Account | Address }) => Promise<Hash>;
    signSlashProposal: (args: { proposalId: bigint, signature: Hex, account?: Account | Address }) => Promise<Hash>;
    executeSlashWithProof: (args: { proposalId: bigint, repUsers: Address[], newScores: bigint[], epoch: bigint, proof: Hex, account?: Account | Address }) => Promise<Hash>;
    markProposalExecuted: (args: { id: bigint, account?: Account | Address }) => Promise<Hash>;
    proposals: (args: { proposalId: bigint }) => Promise<{ operator: Address, slashLevel: number, reason: string, executed: boolean }>;
    nextProposalId: () => Promise<bigint>;
    
    // Validator Management
    isValidator: (args: { user: Address }) => Promise<boolean>;
    addValidator: (args: { v: Address, account?: Account | Address }) => Promise<Hash>;
    
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
    
    async signSlashProposal({ proposalId, signature, account }) {
        try {
            validateRequired(proposalId, 'proposalId');
            validateRequired(signature, 'signature');
            return await (client as any).writeContract({
                address,
                abi: DVTValidatorABI,
                functionName: 'signSlashProposal',
                args: [proposalId, signature],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'signSlashProposal');
        }
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
