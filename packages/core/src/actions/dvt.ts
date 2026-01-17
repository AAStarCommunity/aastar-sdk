import { type Address, type PublicClient, type WalletClient, type Hex, type Hash, type Account } from 'viem';
import { DVTValidatorABI } from '../abis/index.js';

export type DVTActions = {
    // Proposal Management
    createSlashProposal: (args: { address: Address, operator: Address, level: number, reason: string, account?: Account | Address }) => Promise<Hash>;
    signSlashProposal: (args: { address: Address, proposalId: bigint, signature: Hex, account?: Account | Address }) => Promise<Hash>;
    executeSlashWithProof: (args: { address: Address, proposalId: bigint, repUsers: Address[], newScores: bigint[], epoch: bigint, proof: Hex, account?: Account | Address }) => Promise<Hash>;
    markProposalExecuted: (args: { address: Address, id: bigint, account?: Account | Address }) => Promise<Hash>;
    proposals: (args: { address: Address, proposalId: bigint }) => Promise<{ proposer: Address, slashLevel: number, reason: string, executed: boolean }>;
    nextProposalId: (args: { address: Address }) => Promise<bigint>;
    
    // Validator Management
    isValidator: (args: { address: Address, user: Address }) => Promise<boolean>;
    addValidator: (args: { address: Address, v: Address, account?: Account | Address }) => Promise<Hash>;
    
    // BLS Aggregator Integration
    setBLSAggregator: (args: { address: Address, bls: Address, account?: Account | Address }) => Promise<Hash>;
    BLS_AGGREGATOR: (args: { address: Address }) => Promise<Address>;
    REGISTRY: (args: { address:Address }) => Promise<Address>;
    
    // Ownership
    owner: (args: { address: Address }) => Promise<Address>;
    transferOwnership: (args: { address: Address, newOwner: Address, account?: Account | Address }) => Promise<Hash>;
    renounceOwnership: (args: { address: Address, account?: Account | Address }) => Promise<Hash>;
    
    // Version
    version: (args: { address: Address }) => Promise<string>;
};

export const dvtActions = (address: Address) => (client: PublicClient | WalletClient): DVTActions => ({
    // Proposal Management
    async createSlashProposal({  operator, level, reason, account }) {
        return (client as any).writeContract({
            address,
            abi: DVTValidatorABI,
            functionName: 'createProposal',
            args: [operator, level, reason],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async signSlashProposal({  proposalId, signature, account }) {
        return (client as any).writeContract({
            address,
            abi: DVTValidatorABI,
            functionName: 'signProposal',
            args: [proposalId, signature],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async executeSlashWithProof({  proposalId, repUsers, newScores, epoch, proof, account }) {
        return (client as any).writeContract({
            address,
            abi: DVTValidatorABI,
            functionName: 'executeWithProof',
            args: [proposalId, repUsers, newScores, epoch, proof],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async markProposalExecuted({  id, account }) {
        return (client as any).writeContract({
            address,
            abi: DVTValidatorABI,
            functionName: 'markProposalExecuted',
            args: [id],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async proposals({  proposalId }) {
        const result = await (client as PublicClient).readContract({
            address,
            abi: DVTValidatorABI,
            functionName: 'proposals',
            args: [proposalId]
        }) as any;
        return {
            proposer: result[0],
            slashLevel: Number(result[1]),
            reason: result[2],
            executed: result[3]
        };
    },

    async nextProposalId( ) {
        return (client as PublicClient).readContract({
            address,
            abi: DVTValidatorABI,
            functionName: 'nextProposalId',
            args: []
        }) as Promise<bigint>;
    },

    // Validator Management
    async isValidator({  user }) {
        return (client as PublicClient).readContract({
            address,
            abi: DVTValidatorABI,
            functionName: 'isValidator',
            args: [user]
        }) as Promise<boolean>;
    },

    async addValidator({  v, account }) {
        return (client as any).writeContract({
            address,
            abi: DVTValidatorABI,
            functionName: 'addValidator',
            args: [v],
            account: account as any,
            chain: (client as any).chain
        });
    },

    // BLS Aggregator Integration
    async setBLSAggregator({  bls, account }) {
        return (client as any).writeContract({
            address,
            abi: DVTValidatorABI,
            functionName: 'setBLSAggregator',
            args: [bls],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async BLS_AGGREGATOR( ) {
        return (client as PublicClient).readContract({
            address,
            abi: DVTValidatorABI,
            functionName: 'BLS_AGGREGATOR',
            args: []
        }) as Promise<Address>;
    },

    async REGISTRY( ) {
        return (client as PublicClient).readContract({
            address,
            abi: DVTValidatorABI,
            functionName: 'REGISTRY',
            args: []
        }) as Promise<Address>;
    },

    // Ownership
    async owner( ) {
        return (client as PublicClient).readContract({
            address,
            abi: DVTValidatorABI,
            functionName: 'owner',
            args: []
        }) as Promise<Address>;
    },

    async transferOwnership({  newOwner, account }) {
        return (client as any).writeContract({
            address,
            abi: DVTValidatorABI,
            functionName: 'transferOwnership',
            args: [newOwner],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async renounceOwnership({  account }) {
        return (client as any).writeContract({
            address,
            abi: DVTValidatorABI,
            functionName: 'renounceOwnership',
            args: [],
            account: account as any,
            chain: (client as any).chain
        });
    },

    // Version
    async version( ) {
        return (client as PublicClient).readContract({
            address,
            abi: DVTValidatorABI,
            functionName: 'version',
            args: []
        }) as Promise<string>;
    }
});
