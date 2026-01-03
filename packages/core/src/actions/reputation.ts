import { type Address, type PublicClient, type WalletClient, type Hex, type Hash, type Account } from 'viem';
import { ReputationSystemABI } from '../abis/index.js';

export type ReputationActions = {
    // 规则配置
    setReputationRule: (args: { ruleId: Hex, rule: any, account?: Account | Address }) => Promise<Hash>;
    getReputationRule: (args: { ruleId: Hex }) => Promise<any>;
    enableRule: (args: { ruleId: Hex, account?: Account | Address }) => Promise<Hash>;
    disableRule: (args: { ruleId: Hex, account?: Account | Address }) => Promise<Hash>;
    isRuleActive: (args: { ruleId: Hex }) => Promise<boolean>;
    getActiveRules: (args: { community: Address }) => Promise<Hex[]>;
    getRuleCount: () => Promise<bigint>;
    
    // 积分计算
    computeScore: (args: { user: Address, community: Address }) => Promise<bigint>;
    getUserScore: (args: { user: Address }) => Promise<bigint>;
    getCommunityScore: (args: { community: Address }) => Promise<bigint>;
    communityReputations: (args: { community: Address, user: Address }) => Promise<bigint>; // Public mapping getter
    
    // 批量操作
    batchUpdateScores: (args: { users: Address[], scores: bigint[], account?: Account | Address }) => Promise<Hash>;
    batchSyncToRegistry: (args: { users: Address[], account?: Account | Address }) => Promise<Hash>;
    syncToRegistry: (args: { 
        user: Address, 
        communities: Address[], 
        ruleIds: Hex[][], 
        activities: bigint[][], 
        epoch: bigint, 
        proof: Hex, 
        account?: Account | Address 
    }) => Promise<Hash>;
    
    // Admin & Config
    setRegistry: (args: { registry: Address, account?: Account | Address }) => Promise<Hash>;
    setEntropyFactor: (args: { factor: bigint, account?: Account | Address }) => Promise<Hash>;
    getEntropyFactor: () => Promise<bigint>;
    
    // Constants
    REGISTRY: () => Promise<Address>;
    
    // Ownership
    owner: () => Promise<Address>;
    transferOwnership: (args: { newOwner: Address, account?: Account | Address }) => Promise<Hash>;
    
    // Version
    version: () => Promise<string>;
};

export const reputationActions = (address: Address) => (client: PublicClient | WalletClient): ReputationActions => ({
    // 规则配置
    async setReputationRule({ ruleId, rule, account }) {
        return (client as any).writeContract({
            address,
            abi: ReputationSystemABI,
            functionName: 'setReputationRule',
            args: [ruleId, rule],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async getReputationRule({ ruleId }) {
        return (client as PublicClient).readContract({
            address,
            abi: ReputationSystemABI,
            functionName: 'getReputationRule',
            args: [ruleId]
        });
    },

    async enableRule({ ruleId, account }) {
        return (client as any).writeContract({
            address,
            abi: ReputationSystemABI,
            functionName: 'enableRule',
            args: [ruleId],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async disableRule({ ruleId, account }) {
        return (client as any).writeContract({
            address,
            abi: ReputationSystemABI,
            functionName: 'disableRule',
            args: [ruleId],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async isRuleActive({ ruleId }) {
        return (client as PublicClient).readContract({
            address,
            abi: ReputationSystemABI,
            functionName: 'isRuleActive',
            args: [ruleId]
        }) as Promise<boolean>;
    },

    async getActiveRules({ community }) {
        return (client as PublicClient).readContract({
            address,
            abi: ReputationSystemABI,
            functionName: 'getActiveRules',
            args: [community]
        }) as Promise<Hex[]>;
    },

    async getRuleCount() {
        return (client as PublicClient).readContract({
            address,
            abi: ReputationSystemABI,
            functionName: 'getRuleCount',
            args: []
        }) as Promise<bigint>;
    },

    // 积分计算
    async computeScore({ user, community }) {
        return (client as PublicClient).readContract({
            address,
            abi: ReputationSystemABI,
            functionName: 'computeScore',
            args: [user, community]
        }) as Promise<bigint>;
    },

    async getUserScore({ user }) {
        return (client as PublicClient).readContract({
            address,
            abi: ReputationSystemABI,
            functionName: 'getUserScore',
            args: [user]
        }) as Promise<bigint>;
    },

    async getCommunityScore({ community }) {
        return (client as PublicClient).readContract({
            address,
            abi: ReputationSystemABI,
            functionName: 'getCommunityScore',
            args: [community]
        }) as Promise<bigint>;
    },

    // Public mapping getter
    async communityReputations({ community, user }) {
        return (client as PublicClient).readContract({
            address,
            abi: ReputationSystemABI,
            functionName: 'communityReputations',
            args: [community, user]
        }) as Promise<bigint>;
    },

    // 批量操作
    async batchUpdateScores({ users, scores, account }) {
        return (client as any).writeContract({
            address,
            abi: ReputationSystemABI,
            functionName: 'batchUpdateScores',
            args: [users, scores],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async batchSyncToRegistry({ users, account }) {
        return (client as any).writeContract({
            address,
            abi: ReputationSystemABI,
            functionName: 'batchSyncToRegistry',
            args: [users],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async syncToRegistry({ user, communities, ruleIds, activities, epoch, proof, account }) {
        return (client as any).writeContract({
            address,
            abi: ReputationSystemABI,
            functionName: 'syncToRegistry',
            args: [user, communities, ruleIds, activities, epoch, proof],
            account: account as any,
            chain: (client as any).chain
        });
    },

    // Admin & Config
    async setRegistry({ registry, account }) {
        return (client as any).writeContract({
            address,
            abi: ReputationSystemABI,
            functionName: 'setRegistry',
            args: [registry],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async setEntropyFactor({ factor, account }) {
        return (client as any).writeContract({
            address,
            abi: ReputationSystemABI,
            functionName: 'setEntropyFactor',
            args: [factor],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async getEntropyFactor() {
        return (client as PublicClient).readContract({
            address,
            abi: ReputationSystemABI,
            functionName: 'getEntropyFactor',
            args: []
        }) as Promise<bigint>;
    },

    // Constants
    async REGISTRY() {
        return (client as PublicClient).readContract({
            address,
            abi: ReputationSystemABI,
            functionName: 'REGISTRY',
            args: []
        }) as Promise<Address>;
    },

    // Ownership
    async owner() {
        return (client as PublicClient).readContract({
            address,
            abi: ReputationSystemABI,
            functionName: 'owner',
            args: []
        }) as Promise<Address>;
    },

    async transferOwnership({ newOwner, account }) {
        return (client as any).writeContract({
            address,
            abi: ReputationSystemABI,
            functionName: 'transferOwnership',
            args: [newOwner],
            account: account as any,
            chain: (client as any).chain
        });
    },

    // Version
    async version() {
        return (client as PublicClient).readContract({
            address,
            abi: ReputationSystemABI,
            functionName: 'version',
            args: []
        }) as Promise<string>;
    }
});
