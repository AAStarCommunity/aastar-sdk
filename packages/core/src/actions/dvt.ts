import { type Address, type PublicClient, type WalletClient, type Hex, type Hash, type Account } from 'viem';
import { DVTValidatorABI } from '../abis/index.js';

export type DVTActions = {
    createSlashProposal: (args: { address: Address, operator: Address, level: number, reason: string, account?: Account | Address }) => Promise<Hash>;
    signSlashProposal: (args: { address: Address, proposalId: bigint, signature: Hex, account?: Account | Address }) => Promise<Hash>;
    executeSlashWithProof: (args: { address: Address, proposalId: bigint, repUsers: Address[], newScores: bigint[], epoch: bigint, proof: Hex, account?: Account | Address }) => Promise<Hash>;
    isValidator: (args: { address: Address, user: Address }) => Promise<boolean>;
};

export const dvtActions = () => (client: PublicClient | WalletClient): DVTActions => ({
    async createSlashProposal({ address, operator, level, reason, account }) {
        return (client as any).writeContract({
            address,
            abi: DVTValidatorABI,
            functionName: 'createProposal',
            args: [operator, level, reason],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async signSlashProposal({ address, proposalId, signature, account }) {
        return (client as any).writeContract({
            address,
            abi: DVTValidatorABI,
            functionName: 'signProposal',
            args: [proposalId, signature],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async executeSlashWithProof({ address, proposalId, repUsers, newScores, epoch, proof, account }) {
        return (client as any).writeContract({
            address,
            abi: DVTValidatorABI,
            functionName: 'executeWithProof',
            args: [proposalId, repUsers, newScores, epoch, proof],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async isValidator({ address, user }) {
        return (client as PublicClient).readContract({
            address,
            abi: DVTValidatorABI,
            functionName: 'isValidator',
            args: [user]
        }) as Promise<boolean>;
    }
});
