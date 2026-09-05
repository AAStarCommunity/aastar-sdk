
export * from './mysbt.js';

import { createAAStarPublicClient, ReputationSystemABI, type PublicClient, type WalletClient } from '@aastar/core';
import { type Address, type Hash, parseAbi } from 'viem';

export class ReputationClient {
    /** @internal */
    private walletClient?: WalletClient;

    /**
     * Initialize ReputationClient
     * @param client The public client for queries
     * @param reputationAddress The address of the reputation system contract
     * @param walletClient Optional wallet client for write operations
     */
    constructor(
        private client: PublicClient, 
        private reputationAddress: Address,
        walletClient?: WalletClient
    ) {
        this.walletClient = walletClient;
    }

    /**
     * Compute reputation score for a user
     */
    async computeScore(user: Address, communities: Address[], ruleIds: `0x${string}`[][], activities: bigint[][]): Promise<bigint> {
        return this.client.readContract({
            address: this.reputationAddress,
            abi: ReputationSystemABI as any,
            functionName: 'computeScore',
            args: [user, communities, ruleIds, activities]
        }) as Promise<bigint>;
    }

    /**
     * Get global reputation score for a user
     * @param user User address
     * @returns Reputation score
     */
    async getGlobalReputation(user: Address): Promise<number> {
        // Try to read score, if fails (e.g. invalid contract), return 0
        try {
            const score = await this.computeScore(user, [], [], []);
            return Number(score);
        } catch (e) {
            console.warn('Failed to read reputation from contract, defaulting to 0');
            return 0;
        }
    }

    /**
     * Get credit limit based on reputation
     * @param user User address
     * @returns Credit limit in wei (Mock logic closely tied to Reputation)
     */
    async getCreditLimit(user: Address): Promise<bigint> {
        const reputation = await this.getGlobalReputation(user);
        
        // Dynamic Credit Limit Logic:
        // Base: 0
        // Score > 50: +0.01 ETH
        // Score > 100: +0.05 ETH
        let limit = 0n;
        if (reputation > 50) limit += 10000000000000000n; // 0.01 ETH
        if (reputation > 100) limit += 40000000000000000n; // +0.04 -> 0.05 ETH

        return limit;
    }

    /**
     * Get reputation score breakdown
     * @param user User address
     * @returns Detailed reputation breakdown (Mock implementation awaiting contract V4)
     */
    async getReputationBreakdown(user: Address): Promise<{
        baseScore: number;
        stakingBonus: number;
        activityBonus: number;
        penaltyDeduction: number;
        total: number;
    }> {
        const total = await this.getGlobalReputation(user);
        
        // Heuristic breakdown
        return {
            baseScore: Math.floor(total * 0.5),
            stakingBonus: Math.floor(total * 0.3),
            activityBonus: Math.floor(total * 0.2),
            penaltyDeduction: 0,
            total
        };
    }

    /**
     * Submit reputation proof (off-chain data to on-chain)
     * @param params Proof parameters
     * @returns Transaction hash
     */
    async submitReputationProof(params: {
        proofType: 'github' | 'twitter' | 'on-chain-activity';
        proofData: string;
        signature: Hash;
    }): Promise<Hash> {
        if (!this.walletClient || !this.walletClient.account) {
            throw new Error("Wallet client required to submit proofs");
        }

        // The comment that used to sit here said it all: "Using a generic 'submitProof' signature
        // for now / In reality this would target the ReputationOracle or similar". It was a
        // placeholder that SENT A TRANSACTION — `submitProof` appears in none of this repo's 52
        // ABIs, so every call could only revert, after paying gas, with "execution reverted" and
        // nothing naming the cause.
        //
        // A stub that throws and a stub that broadcasts are very different things. This one now
        // throws, which is what its own comment always implied it should do.
        throw new Error(
            'ReputationClient.submitProof is not implemented. The original code sent a transaction ' +
            'to `submitProof(string,bytes32)`, a function declared by no contract in this SDK — its ' +
            'own comment called the signature "generic for now". Wire it to the real reputation ' +
            'entry point before using it.',
        );
    }
}
