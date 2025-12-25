import { type Address, type PublicClient, type WalletClient, type Hex, type Hash, type Account } from 'viem';
import { ReputationSystemABI } from '../abis/index.js';

export type ReputationActions = {
    syncToRegistry: (args: { 
        user: Address, 
        communities: Address[], 
        ruleIds: Hex[][], 
        activities: bigint[][], 
        epoch: bigint, 
        proof: Hex, 
        account?: Account | Address 
    }) => Promise<Hash>;
};

export const reputationActions = (address: Address) => (client: PublicClient | WalletClient): ReputationActions => ({
    async syncToRegistry({ user, communities, ruleIds, activities, epoch, proof, account }) {
        return (client as any).writeContract({
            address,
            abi: ReputationSystemABI,
            functionName: 'syncToRegistry',
            args: [user, communities, ruleIds, activities, epoch, proof],
            account: account as any,
            chain: (client as any).chain
        });
    }
});
