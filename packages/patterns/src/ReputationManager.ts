import { type Address, type Hash, type Hex } from 'viem';
import { type TransactionOptions, reputationActions, sbtActions } from '@aastar/core';
import { type WalletClient, type PublicClient } from 'viem';

export interface NFTBoostParams {
    nftCollection: Address;
    boostPercentage: bigint;
}

/**
 * 🎨 ReputationManager Pattern
 * 
 * Manage reputation rules, scores, and NFT boosting.
 * Uses real reputationActions and sbtActions.
 */
export class ReputationManager {
    private reputationAddr: Address;
    private sbtAddr?: Address;
    private client: WalletClient | PublicClient;

    constructor(reputationAddress: Address, client: WalletClient | PublicClient, sbtAddress?: Address) {
        this.reputationAddr = reputationAddress;
        this.client = client;
        this.sbtAddr = sbtAddress;
    }

    // ========================================
    // Rule Management (规则管理)
    // ========================================

    /**
     * Set/Update a reputation rule
     */
    async setRule(ruleId: Hex, rule: any, options?: TransactionOptions): Promise<Hash> {
        const rep = reputationActions(this.reputationAddr);
        return rep(this.client).setReputationRule({ ruleId, rule, account: options?.account });
    }

    /**
     * Enable a reputation rule
     */
    async enableRule(ruleId: Hex, options?: TransactionOptions): Promise<Hash> {
        const rep = reputationActions(this.reputationAddr);
        return rep(this.client).enableRule({ ruleId, account: options?.account });
    }

    /**
     * Disable a reputation rule
     */
    async disableRule(ruleId: Hex, options?: TransactionOptions): Promise<Hash> {
        const rep = reputationActions(this.reputationAddr);
        return rep(this.client).disableRule({ ruleId, account: options?.account });
    }

    /**
     * Get active rules for a community
     */
    async getActiveRules(community?: Address): Promise<Hex[]> {
        const comm = community || this.reputationAddr;
        const rep = reputationActions(this.reputationAddr);
        return rep(this.client as PublicClient).getActiveRules({ community: comm });
    }

    // ========================================
    // Score Management (积分管理)
    // ========================================

    /**
     * Batch update user scores (Admin/DVT Node)
     */
    async batchUpdateScores(users: Address[], scores: bigint[], options?: TransactionOptions): Promise<Hash> {
        console.log(`📊 Batch updating scores for ${users.length} users...`);
        const rep = reputationActions(this.reputationAddr);
        return rep(this.client).batchUpdateScores({ users, scores, account: options?.account });
    }

    /**
     * Record user activity (triggers reputation update)
     */
    async recordActivity(user: Address, options?: TransactionOptions): Promise<Hash> {
        if (!this.sbtAddr) throw new Error('SBT address required for recordActivity');
        console.log(`✍️ Recording activity for ${user}...`);
        const sbt = sbtActions(this.sbtAddr);
        return sbt(this.client).recordActivity({ user, account: options?.account });
    }

    /**
     * Sync reputation to Registry
     */
    async syncToRegistry(
        user: Address,
        communities: Address[],
        ruleIds: Hex[][],
        activities: bigint[][],
        epoch: bigint,
        proof: Hex,
        options?: TransactionOptions
    ): Promise<Hash> {
        const rep = reputationActions(this.reputationAddr);
        return rep(this.client).syncToRegistry({
            user,
            communities,
            ruleIds,
            activities,
            epoch,
            proof,
            account: options?.account
        });
    }

    // ========================================
    // NFT Boost (NFT加成)
    // ========================================

    /**
     * Set NFT collection boost for reputation
     * Note: This requires adding to reputationActions if not present
     */
    async setNFTBoost(params: NFTBoostParams, options?: TransactionOptions): Promise<Hash> {
        console.log(`🎨 Setting NFT boost for ${params.nftCollection}: +${params.boostPercentage}%`);
        // This would use: reputationActions.setNFTBoost() if we add it
        // For now, direct contract call:
        return (this.client as any).writeContract({
            address: this.reputationAddr,
            abi: [
                {
                    name: 'setNFTBoost',
                    type: 'function',
                    stateMutability: 'nonpayable',
                    inputs: [
                        { name: 'nftCollection', type: 'address' },
                        { name: 'boostPercentage', type: 'uint256' }
                    ],
                    outputs: []
                }
            ],
            functionName: 'setNFTBoost',
            args: [params.nftCollection, params.boostPercentage],
            account: options?.account as any,
            chain: (this.client as any).chain
        });
    }

    // ========================================
    // Queries (查询)
    // ========================================

    /**
     * Get user's reputation score in a community
     */
    async getUserScore(user: Address, community?: Address): Promise<bigint> {
        const comm = community || this.reputationAddr;
        const rep = reputationActions(this.reputationAddr);
        return rep(this.client as PublicClient).communityReputations({ community: comm, user });
    }

    /**
     * Compute score for user in community
     */
    async computeScore(user: Address, communities: Address[], ruleIds: Hex[][], activities: bigint[][]): Promise<bigint> {
        const rep = reputationActions(this.reputationAddr);
        return rep(this.client as PublicClient).computeScore({ user, communities, ruleIds, activities });
    }
}
