import { type Address, type PublicClient, type WalletClient, type Hex, type Hash, type Account } from 'viem';
import { ReputationSystemABI } from '../abis/index.js';
import { validateAddress, validateRequired, validateAmount } from '../validators/index.js';
import { AAStarError } from '../errors/index.js';

export type ReputationRule = {
    baseScore: bigint;
    activityBonus: bigint;
    maxBonus: bigint;
    description: string;
};

export type ReputationBreakdown = {
    baseScore: bigint;
    nftBonus: bigint;
    activityBonus: bigint;
    multiplier: bigint;
};

export type ReputationActions = {
    // Rule Configuration
    setReputationRule: (args: { ruleId: Hex, rule: ReputationRule, account?: Account | Address }) => Promise<Hash>;
    getReputationRule: (args: { ruleId: Hex }) => Promise<ReputationRule>;
    enableRule: (args: { ruleId: Hex, account?: Account | Address }) => Promise<Hash>;
    disableRule: (args: { ruleId: Hex, account?: Account | Address }) => Promise<Hash>;
    isRuleActive: (args: { ruleId: Hex }) => Promise<boolean>;
    getActiveRules: (args: { community: Address }) => Promise<Hex[]>;
    getRuleCount: () => Promise<bigint>;
    setRule: (args: { ruleId: Hex, base: bigint, bonus: bigint, max: bigint, desc: string, account?: Account | Address }) => Promise<Hash>;
    communityRules: (args: { community: Address, ruleId: Hex }) => Promise<ReputationRule>;
    communityActiveRules: (args: { community: Address, index: bigint }) => Promise<Hex>;
    defaultRule: () => Promise<ReputationRule>;
    
    // Score Calculation
    computeScore: (args: { user: Address, communities: Address[], ruleIds: Hex[][], activities: bigint[][] }) => Promise<bigint>;
    calculateReputation: (args: { user: Address, community: Address, timestamp: bigint }) => Promise<{ communityScore: bigint, globalScore: bigint }>;
    getReputationBreakdown: (args: { user: Address, community: Address, timestamp: bigint }) => Promise<ReputationBreakdown>;
    getUserScore: (args: { user: Address }) => Promise<bigint>;
    getCommunityScore: (args: { community: Address }) => Promise<bigint>;
    communityReputations: (args: { community: Address, user: Address }) => Promise<bigint>;
    setCommunityReputation: (args: { community: Address, user: Address, score: bigint, account?: Account | Address }) => Promise<Hash>;
    
    // NFT Boost
    setNFTBoost: (args: { collection: Address, boost: bigint, account?: Account | Address }) => Promise<Hash>;
    nftCollectionBoost: (args: { collection: Address }) => Promise<bigint>;
    nftHoldStart: (args: { user: Address, collection: Address }) => Promise<bigint>;
    updateNFTHoldStart: (args: { collection: Address, account?: Account | Address }) => Promise<Hash>;
    boostedCollections: (args: { index: bigint }) => Promise<Address>;
    entropyFactors: (args: { community: Address }) => Promise<bigint>;
    
    // Batch Operations
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
    setEntropyFactor: (args: { community: Address, factor: bigint, account?: Account | Address }) => Promise<Hash>;
    getEntropyFactor: () => Promise<bigint>;
    
    // Constants
    REGISTRY: () => Promise<Address>;
    
    // Ownership
    owner: () => Promise<Address>;
    transferOwnership: (args: { newOwner: Address, account?: Account | Address }) => Promise<Hash>;
    renounceOwnership: (args: { account?: Account | Address }) => Promise<Hash>;
    
    // Version
    version: () => Promise<string>;
};

export const reputationActions = (address: Address) => (client: PublicClient | WalletClient): ReputationActions => ({
    // Rule Configuration
    async setReputationRule({ ruleId, rule, account }) {
        try {
            validateRequired(ruleId, 'ruleId');
            validateRequired(rule, 'rule');
            return await (client as any).writeContract({
                address,
                abi: ReputationSystemABI,
                functionName: 'setReputationRule',
                args: [ruleId, rule],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'setReputationRule');
        }
    },

    async getReputationRule({ ruleId }) {
        try {
            validateRequired(ruleId, 'ruleId');
            const result = await (client as PublicClient).readContract({
                address,
                abi: ReputationSystemABI,
                functionName: 'getReputationRule',
                args: [ruleId]
            }) as any;

            if (Array.isArray(result)) {
                return {
                    baseScore: result[0],
                    activityBonus: result[1],
                    maxBonus: result[2],
                    description: result[3]
                };
            }
            return result as ReputationRule;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'getReputationRule');
        }
    },

    async enableRule({ ruleId, account }) {
        try {
            validateRequired(ruleId, 'ruleId');
            return await (client as any).writeContract({
                address,
                abi: ReputationSystemABI,
                functionName: 'enableRule',
                args: [ruleId],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'enableRule');
        }
    },

    async disableRule({ ruleId, account }) {
        try {
            validateRequired(ruleId, 'ruleId');
            return await (client as any).writeContract({
                address,
                abi: ReputationSystemABI,
                functionName: 'disableRule',
                args: [ruleId],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'disableRule');
        }
    },

    async isRuleActive({ ruleId }) {
        try {
            validateRequired(ruleId, 'ruleId');
            return await (client as PublicClient).readContract({
                address,
                abi: ReputationSystemABI,
                functionName: 'isRuleActive',
                args: [ruleId]
            }) as boolean;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'isRuleActive');
        }
    },

    async getActiveRules({ community }) {
        try {
            validateAddress(community, 'community');
            return await (client as PublicClient).readContract({
                address,
                abi: ReputationSystemABI,
                functionName: 'getActiveRules',
                args: [community]
            }) as Hex[];
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'getActiveRules');
        }
    },

    async getRuleCount() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: ReputationSystemABI,
                functionName: 'getRuleCount',
                args: []
            }) as bigint;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'getRuleCount');
        }
    },

    // Score Calculation
    async computeScore({ user, communities, ruleIds, activities }) {
        try {
            validateAddress(user, 'user');
            validateRequired(communities, 'communities');
            validateRequired(ruleIds, 'ruleIds');
            validateRequired(activities, 'activities');
            return await (client as PublicClient).readContract({
                address,
                abi: ReputationSystemABI,
                functionName: 'computeScore',
                args: [user, communities, ruleIds, activities]
            }) as bigint;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'computeScore');
        }
    },

    async calculateReputation({ user, community, timestamp }) {
        try {
            validateAddress(user, 'user');
            validateAddress(community, 'community');
            const result = await (client as PublicClient).readContract({
                address,
                abi: ReputationSystemABI,
                functionName: 'calculateReputation',
                args: [user, community, timestamp]
            }) as any;

            if (Array.isArray(result)) {
                return { communityScore: result[0], globalScore: result[1] };
            }
            return result as { communityScore: bigint, globalScore: bigint };
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'calculateReputation');
        }
    },

    async getReputationBreakdown({ user, community, timestamp }) {
        try {
            validateAddress(user, 'user');
            validateAddress(community, 'community');
            const result = await (client as PublicClient).readContract({
                address,
                abi: ReputationSystemABI,
                functionName: 'getReputationBreakdown',
                args: [user, community, timestamp]
            }) as any;

            if (Array.isArray(result)) {
                return {
                    baseScore: result[0],
                    nftBonus: result[1],
                    activityBonus: result[2],
                    multiplier: result[3]
                };
            }
            return result as ReputationBreakdown;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'getReputationBreakdown');
        }
    },

    async getUserScore({ user }) {
        try {
            validateAddress(user, 'user');
            return await (client as PublicClient).readContract({
                address,
                abi: ReputationSystemABI,
                functionName: 'getUserScore',
                args: [user]
            }) as bigint;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'getUserScore');
        }
    },

    async getCommunityScore({ community }) {
        try {
            validateAddress(community, 'community');
            return await (client as PublicClient).readContract({
                address,
                abi: ReputationSystemABI,
                functionName: 'getCommunityScore',
                args: [community]
            }) as bigint;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'getCommunityScore');
        }
    },

    async communityReputations({ community, user }) {
        try {
            validateAddress(community, 'community');
            validateAddress(user, 'user');
            return await (client as PublicClient).readContract({
                address,
                abi: ReputationSystemABI,
                functionName: 'communityReputations',
                args: [community, user]
            }) as bigint;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'communityReputations');
        }
    },

    async setCommunityReputation({ community, user, score, account }) {
        try {
            validateAddress(community, 'community');
            validateAddress(user, 'user');
            validateAmount(score, 'score');
            return await (client as any).writeContract({
                address,
                abi: ReputationSystemABI,
                functionName: 'setCommunityReputation',
                args: [community, user, score],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'setCommunityReputation');
        }
    },

    async setRule({ ruleId, base, bonus, max, desc, account }) {
        try {
            validateRequired(ruleId, 'ruleId');
            validateAmount(base, 'base');
            validateAmount(bonus, 'bonus');
            validateAmount(max, 'max');
            validateRequired(desc, 'desc');
            return await (client as any).writeContract({
                address,
                abi: ReputationSystemABI,
                functionName: 'setRule',
                args: [ruleId, base, bonus, max, desc],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'setRule');
        }
    },

    async communityRules({ community, ruleId }) {
        try {
            validateAddress(community, 'community');
            validateRequired(ruleId, 'ruleId');
            const result = await (client as PublicClient).readContract({
                address,
                abi: ReputationSystemABI,
                functionName: 'communityRules',
                args: [community, ruleId]
            }) as any;

            if (Array.isArray(result)) {
                return {
                    baseScore: result[0],
                    activityBonus: result[1],
                    maxBonus: result[2],
                    description: result[3]
                };
            }
            return result as ReputationRule;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'communityRules');
        }
    },

    async communityActiveRules({ community, index }) {
        try {
            validateAddress(community, 'community');
            validateRequired(index, 'index');
            return await (client as PublicClient).readContract({
                address,
                abi: ReputationSystemABI,
                functionName: 'communityActiveRules',
                args: [community, index]
            }) as Hex;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'communityActiveRules');
        }
    },

    async defaultRule() {
        try {
            const result = await (client as PublicClient).readContract({
                address,
                abi: ReputationSystemABI,
                functionName: 'defaultRule',
                args: []
            }) as any;

            if (Array.isArray(result)) {
                return {
                    baseScore: result[0],
                    activityBonus: result[1],
                    maxBonus: result[2],
                    description: result[3]
                };
            }
            return result as ReputationRule;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'defaultRule');
        }
    },

    // NFT Boost
    async setNFTBoost({ collection, boost, account }) {
        try {
            validateAddress(collection, 'collection');
            validateAmount(boost, 'boost');
            return await (client as any).writeContract({
                address,
                abi: ReputationSystemABI,
                functionName: 'setNFTBoost',
                args: [collection, boost],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'setNFTBoost');
        }
    },

    async nftCollectionBoost({ collection }) {
        try {
            validateAddress(collection, 'collection');
            return await (client as PublicClient).readContract({
                address,
                abi: ReputationSystemABI,
                functionName: 'nftCollectionBoost',
                args: [collection]
            }) as bigint;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'nftCollectionBoost');
        }
    },

    async nftHoldStart({ user, collection }) {
        try {
            validateAddress(user, 'user');
            validateAddress(collection, 'collection');
            return await (client as PublicClient).readContract({
                address,
                abi: ReputationSystemABI,
                functionName: 'nftHoldStart',
                args: [user, collection]
            }) as bigint;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'nftHoldStart');
        }
    },

    async updateNFTHoldStart({ collection, account }) {
        try {
            validateAddress(collection, 'collection');
            return await (client as any).writeContract({
                address,
                abi: ReputationSystemABI,
                functionName: 'updateNFTHoldStart',
                args: [collection],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'updateNFTHoldStart');
        }
    },

    async boostedCollections({ index }) {
        try {
            validateRequired(index, 'index');
            return await (client as PublicClient).readContract({
                address,
                abi: ReputationSystemABI,
                functionName: 'boostedCollections',
                args: [index]
            }) as Address;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'boostedCollections');
        }
    },

    async entropyFactors({ community }) {
        try {
            validateAddress(community, 'community');
            return await (client as PublicClient).readContract({
                address,
                abi: ReputationSystemABI,
                functionName: 'entropyFactors',
                args: [community]
            }) as bigint;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'entropyFactors');
        }
    },

    // Batch Operations
    async batchUpdateScores({ users, scores, account }) {
        try {
            validateRequired(users, 'users');
            validateRequired(scores, 'scores');
            return await (client as any).writeContract({
                address,
                abi: ReputationSystemABI,
                functionName: 'batchUpdateScores',
                args: [users, scores],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'batchUpdateScores');
        }
    },

    async batchSyncToRegistry({ users, account }) {
        try {
            validateRequired(users, 'users');
            return await (client as any).writeContract({
                address,
                abi: ReputationSystemABI,
                functionName: 'batchSyncToRegistry',
                args: [users],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'batchSyncToRegistry');
        }
    },

    async syncToRegistry({ user, communities, ruleIds, activities, epoch, proof, account }) {
        try {
            validateAddress(user, 'user');
            validateRequired(communities, 'communities');
            validateRequired(ruleIds, 'ruleIds');
            validateRequired(activities, 'activities');
            validateAmount(epoch, 'epoch');
            validateRequired(proof, 'proof');
            return await (client as any).writeContract({
                address,
                abi: ReputationSystemABI,
                functionName: 'syncToRegistry',
                args: [user, communities, ruleIds, activities, epoch, proof],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'syncToRegistry');
        }
    },

    // Admin & Config
    async setRegistry({ registry, account }) {
        try {
            validateAddress(registry, 'registry');
            return await (client as any).writeContract({
                address,
                abi: ReputationSystemABI,
                functionName: 'setRegistry',
                args: [registry],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'setRegistry');
        }
    },

    async setEntropyFactor({ community, factor, account }) {
        try {
            validateAddress(community, 'community');
            validateAmount(factor, 'factor');
            return await (client as any).writeContract({
                address,
                abi: ReputationSystemABI,
                functionName: 'setEntropyFactor',
                args: [community, factor],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'setEntropyFactor');
        }
    },

    async getEntropyFactor() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: ReputationSystemABI,
                functionName: 'getEntropyFactor',
                args: []
            }) as bigint;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'getEntropyFactor');
        }
    },

    // Constants
    async REGISTRY() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: ReputationSystemABI,
                functionName: 'REGISTRY',
                args: []
            }) as Address;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'REGISTRY');
        }
    },

    // Ownership
    async owner() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: ReputationSystemABI,
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
                abi: ReputationSystemABI,
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
                abi: ReputationSystemABI,
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
                abi: ReputationSystemABI,
                functionName: 'version',
                args: []
            }) as Promise<string>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'version');
        }
    }
});
