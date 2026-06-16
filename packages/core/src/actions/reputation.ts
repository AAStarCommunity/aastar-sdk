import { type Address, type PublicClient, type WalletClient, type Hex, type Hash, type Account } from 'viem';
import { ReputationSystemABI } from '../abis/index.js';
import { validateAddress, validateRequired, validateAmount } from '../validators/index.js';
import { AAStarError, ErrorCode } from '../errors/index.js';

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
    /** @deprecated The deployed ReputationSystem ABI has no `setReputationRule` — this wrapper now calls the ABI-confirmed `setRule(ruleId, base, bonus, max, desc)` (the {@link ReputationRule} struct is flattened). Prefer {@link setRule}. */
    setReputationRule: (args: { ruleId: Hex, rule: ReputationRule, account?: Account | Address }) => Promise<Hash>;
    /** @deprecated Removed in the v5.x contract refactor — no single-rule getter by ruleId. Throws {@link ErrorCode.NOT_IMPLEMENTED}; use {@link communityRules} (per-community) or {@link defaultRule}. */
    getReputationRule: (args: { ruleId: Hex }) => Promise<ReputationRule>;
    /** @deprecated Removed in the v5.x contract refactor — rules have no enable/disable toggle. Throws {@link ErrorCode.NOT_IMPLEMENTED}. */
    enableRule: (args: { ruleId: Hex, account?: Account | Address }) => Promise<Hash>;
    /** @deprecated Removed in the v5.x contract refactor — rules have no enable/disable toggle. Throws {@link ErrorCode.NOT_IMPLEMENTED}. */
    disableRule: (args: { ruleId: Hex, account?: Account | Address }) => Promise<Hash>;
    /** @deprecated Removed in the v5.x contract refactor — no `isRuleActive(ruleId)` getter (rule activity is per-community). Throws {@link ErrorCode.NOT_IMPLEMENTED}; use {@link getActiveRules}({ community }) and test membership. */
    isRuleActive: (args: { ruleId: Hex }) => Promise<boolean>;
    getActiveRules: (args: { community: Address }) => Promise<Hex[]>;
    /** @deprecated Removed in the v5.x contract refactor — no global rule counter. Throws {@link ErrorCode.NOT_IMPLEMENTED}. */
    getRuleCount: () => Promise<bigint>;
    setRule: (args: { ruleId: Hex, base: bigint, bonus: bigint, max: bigint, desc: string, account?: Account | Address }) => Promise<Hash>;
    communityRules: (args: { community: Address, ruleId: Hex }) => Promise<ReputationRule>;
    communityActiveRules: (args: { community: Address, index: bigint }) => Promise<Hex>;
    defaultRule: () => Promise<ReputationRule>;
    
    // Score Calculation
    computeScore: (args: { user: Address, communities: Address[], ruleIds: Hex[][], activities: bigint[][] }) => Promise<bigint>;
    calculateReputation: (args: { user: Address, community: Address, timestamp: bigint }) => Promise<{ communityScore: bigint, globalScore: bigint }>;
    getReputationBreakdown: (args: { user: Address, community: Address, timestamp: bigint }) => Promise<ReputationBreakdown>;
    /**
     * @deprecated NOT available on-chain. `getUserScore` does not exist in the deployed
     * ReputationSystem ABI (calling it reverts). There is no single-argument global score
     * getter — use {@link calculateReputation} (returns `globalScore`, requires a community
     * + timestamp) or read `globalReputation(user)` from the Registry contract instead.
     * This method now throws a descriptive error rather than reverting on-chain.
     */
    getUserScore: (args: { user: Address }) => Promise<bigint>;
    /**
     * @deprecated NOT available on-chain. `getCommunityScore` does not exist in the deployed
     * ReputationSystem ABI (calling it reverts). There is no aggregate per-community score
     * getter — use {@link communityReputations} (per-user community score) or
     * {@link calculateReputation} (returns `communityScore` for a given user) instead.
     * This method now throws a descriptive error rather than reverting on-chain.
     */
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
    /** @deprecated Removed in the v5.x contract refactor — no `batchUpdateScores`. Throws {@link ErrorCode.NOT_IMPLEMENTED}; use {@link setCommunityReputation} per user or {@link syncToRegistry}. */
    batchUpdateScores: (args: { users: Address[], scores: bigint[], account?: Account | Address }) => Promise<Hash>;
    /** @deprecated Removed in the v5.x contract refactor — no batch sync variant. Throws {@link ErrorCode.NOT_IMPLEMENTED}; use {@link syncToRegistry} (per-user, with proof). */
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
    /** @deprecated Removed in the v5.x contract refactor — REGISTRY is immutable (no `setRegistry`). Throws {@link ErrorCode.NOT_IMPLEMENTED}. */
    setRegistry: (args: { registry: Address, account?: Account | Address }) => Promise<Hash>;
    setEntropyFactor: (args: { community: Address, factor: bigint, account?: Account | Address }) => Promise<Hash>;
    /** @deprecated Removed in the v5.x contract refactor — no no-arg `getEntropyFactor`. Throws {@link ErrorCode.NOT_IMPLEMENTED}; use {@link entropyFactors}({ community }). */
    getEntropyFactor: () => Promise<bigint>;
    
    // Constants
    REGISTRY: () => Promise<Address>;
    /** Max number of NFT collections that can grant a reputation boost (view). ABI: MAX_BOOSTED_COLLECTIONS() -> uint256. */
    MAX_BOOSTED_COLLECTIONS: () => Promise<bigint>;

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
            // On-chain fn: setRule(bytes32 ruleId, uint256 base, uint256 bonus, uint256 max, string desc).
            // The legacy struct-arg `setReputationRule` does not exist; flatten the struct.
            return await (client as any).writeContract({
                address,
                abi: ReputationSystemABI,
                functionName: 'setRule',
                args: [ruleId, rule.baseScore, rule.activityBonus, rule.maxBonus, rule.description],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'setReputationRule');
        }
    },

    async getReputationRule({ ruleId }) {
        // Removed in the v5.x contract refactor: there is no single-rule getter keyed solely
        // by ruleId. Validate then throw rather than revert on-chain.
        validateRequired(ruleId, 'ruleId');
        throw new AAStarError(
            ErrorCode.NOT_IMPLEMENTED,
            'getReputationRule was removed in the v5.x contract refactor; rules are per-community now. ' +
            'Use communityRules({ community, ruleId }) or defaultRule() instead.'
        );
    },

    async enableRule({ ruleId }) {
        validateRequired(ruleId, 'ruleId');
        throw new AAStarError(
            ErrorCode.NOT_IMPLEMENTED,
            'enableRule was removed in the v5.x contract refactor; rules no longer have an ' +
            'enable/disable toggle. Use setRule(...) to (re)define a rule.'
        );
    },

    async disableRule({ ruleId }) {
        validateRequired(ruleId, 'ruleId');
        throw new AAStarError(
            ErrorCode.NOT_IMPLEMENTED,
            'disableRule was removed in the v5.x contract refactor; rules no longer have an ' +
            'enable/disable toggle.'
        );
    },

    async isRuleActive({ ruleId }) {
        // Removed in the v5.x contract refactor: rule activity is per-community, so there is
        // no `isRuleActive(ruleId)` getter. Validate then throw rather than revert on-chain.
        validateRequired(ruleId, 'ruleId');
        throw new AAStarError(
            ErrorCode.NOT_IMPLEMENTED,
            'isRuleActive was removed in the v5.x contract refactor; rule activity is per-community. ' +
            'Use getActiveRules({ community }) and check whether the ruleId is in the returned set.'
        );
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
        throw new AAStarError(
            ErrorCode.NOT_IMPLEMENTED,
            'getRuleCount was removed in the v5.x contract refactor; there is no global rule ' +
            'counter. Use getActiveRules({ community }).length for a per-community count.'
        );
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

    /**
     * @deprecated `getUserScore` is absent from the deployed ReputationSystem ABI — there
     * is no single-argument global score getter. Throws instead of issuing a call that
     * would revert on-chain. Use `calculateReputation({ user, community, timestamp })`
     * (read its `globalScore`) or the Registry's `globalReputation(user)` getter.
     */
    async getUserScore({ user }) {
        validateAddress(user, 'user');
        throw new AAStarError(
            ErrorCode.NOT_IMPLEMENTED,
            'getUserScore is not available on-chain: the deployed ReputationSystem ABI has ' +
            'no getUserScore function. Use calculateReputation({ user, community, timestamp }) ' +
            'and read globalScore, or read globalReputation(user) from the Registry contract.'
        );
    },

    /**
     * @deprecated `getCommunityScore` is absent from the deployed ReputationSystem ABI —
     * there is no aggregate per-community score getter. Throws instead of issuing a call
     * that would revert on-chain. Use `communityReputations({ community, user })` for a
     * per-user community score, or `calculateReputation(...)` and read `communityScore`.
     */
    async getCommunityScore({ community }) {
        validateAddress(community, 'community');
        throw new AAStarError(
            ErrorCode.NOT_IMPLEMENTED,
            'getCommunityScore is not available on-chain: the deployed ReputationSystem ABI ' +
            'has no getCommunityScore function. Use communityReputations({ community, user }) ' +
            'for a per-user community score, or calculateReputation(...) and read communityScore.'
        );
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
    async batchUpdateScores({ users, scores }) {
        // Removed in the v5.x contract refactor: no batch score setter on ReputationSystem.
        validateRequired(users, 'users');
        validateRequired(scores, 'scores');
        throw new AAStarError(
            ErrorCode.NOT_IMPLEMENTED,
            'batchUpdateScores was removed in the v5.x contract refactor; use ' +
            'setCommunityReputation({ community, user, score }) per user, or syncToRegistry(...).'
        );
    },

    async batchSyncToRegistry({ users }) {
        // Removed in the v5.x contract refactor: there is no batch sync variant. The ABI
        // exposes only the per-user syncToRegistry(user, communities, ruleIds, activities, epoch, proof).
        validateRequired(users, 'users');
        throw new AAStarError(
            ErrorCode.NOT_IMPLEMENTED,
            'batchSyncToRegistry was removed in the v5.x contract refactor; use ' +
            'syncToRegistry({ user, communities, ruleIds, activities, epoch, proof }) per user instead.'
        );
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
    async setRegistry({ registry }) {
        // Removed in the v5.x contract refactor: ReputationSystem.REGISTRY is immutable.
        validateAddress(registry, 'registry');
        throw new AAStarError(
            ErrorCode.NOT_IMPLEMENTED,
            'setRegistry was removed in the v5.x contract refactor; ReputationSystem.REGISTRY is ' +
            'immutable (set at construction) and cannot be changed on-chain.'
        );
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
        // Removed in the v5.x contract refactor: entropy factors are per-community now, so
        // there is no no-arg `getEntropyFactor`. Throw rather than revert on-chain.
        throw new AAStarError(
            ErrorCode.NOT_IMPLEMENTED,
            'getEntropyFactor was removed in the v5.x contract refactor; entropy factors are ' +
            'per-community. Use entropyFactors({ community }) instead.'
        );
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

    async MAX_BOOSTED_COLLECTIONS() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: ReputationSystemABI,
                functionName: 'MAX_BOOSTED_COLLECTIONS',
                args: []
            }) as Promise<bigint>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'MAX_BOOSTED_COLLECTIONS');
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
