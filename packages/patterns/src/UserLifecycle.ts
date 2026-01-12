import { type Address, type Hash, type Hex, parseEther } from 'viem';
import { UserClient, type UserClientConfig } from '@aastar/enduser';
import { type TransactionOptions, sbtActions } from '@aastar/core';

export interface OnboardParams {
    community: Address;
    roleId: Hex;
    stakeAmount: bigint;
    tokenURI?: string;
}

export interface OnboardResult {
    stakeTx: Hash;
    sbtTokenId?: bigint;
}

/**
 * 👤 UserLifecycle Pattern
 * 
 * Complete user onboarding and lifecycle management.
 * Uses ONLY verified L1/L2 methods - no fictional APIs.
 */
export class UserLifecycle {
    private client: UserClient;

    constructor(config: UserClientConfig) {
        this.client = new UserClient(config);
    }

    // ========================================
    // Onboarding (注册阶段)
    // ========================================

    /**
     * Check if user already has SBT for this community
     */
    async checkEligibility(community: Address): Promise<boolean> {
        if (!this.client.sbtAddress) throw new Error('SBT address required');
        
        const sbt = sbtActions(this.client.sbtAddress);
        const hasSBT = await sbt(this.client['getStartPublicClient']()).verifyCommunityMembership({
            user: this.client.accountAddress,
            community
        });
        
        return !hasSBT; // Eligible if doesn't have SBT yet
    }

    /**
     * Complete onboarding: Stake + Mint SBT (self-service)
     */
    async onboard(params: OnboardParams, options?: TransactionOptions): Promise<OnboardResult> {
        console.log(`👤 Onboarding to community ${params.community}`);

        // 1. Stake for the role
        console.log(`💰 Staking ${params.stakeAmount} GToken...`);
        const stakeTx = await this.client.stakeForRole(
            params.roleId,
            params.stakeAmount,
            options
        );

        // 2. Self-mint SBT
        console.log('🎫 Minting SBT...');
        const mintTx = await this.client.mintSBT(params.roleId, options);

        // 3. Query SBT tokenId
        const sbtBalance = await this.client.getSBTBalance();

        console.log('✅ Onboarding complete!');

        return {
            stakeTx,
            sbtTokenId: sbtBalance // Last minted is current balance (simplified)
        };
    }

    // ========================================
    // Operations (运营阶段)
    // ========================================

    /**
     * Get user's SBT balance (number of SBTs owned)
     */
    async getMySBTs(): Promise<bigint> {
        return this.client.getSBTBalance();
    }

    /**
     * Get staked amount for a specific role
     */
    async getStakedBalance(roleId: Hex): Promise<bigint> {
        return this.client.getStakedBalance(roleId);
    }

    /**
     * Transfer tokens (standard ERC20)
     */
    async transferToken(token: Address, to: Address, amount: bigint, options?: TransactionOptions): Promise<Hash> {
        return this.client.transferToken(token, to, amount, options);
    }

    /**
     * Execute arbitrary transaction from AA account
     */
    async execute(target: Address, value: bigint, data: Hex, options?: TransactionOptions): Promise<Hash> {
        return this.client.execute(target, value, data, options);
    }

    /**
     * Execute batch transactions
     */
    async executeBatch(targets: Address[], values: bigint[], datas: Hex[], options?: TransactionOptions): Promise<Hash> {
        return this.client.executeBatch(targets, values, datas, options);
    }

    // ========================================
    // Lifecycle Exit (退出阶段)
    // ========================================

    /**
     * Unstake from a role
     */
    async unstakeFromRole(roleId: Hex, options?: TransactionOptions): Promise<Hash> {
        console.log(`📤 Unstaking from role ${roleId}...`);
        return this.client.unstakeFromRole(roleId, options);
    }

    /**
     * Exit a role (cleanup registry status)
     */
    async exitRole(roleId: Hex, options?: TransactionOptions): Promise<Hash> {
        console.log(`🚪 Exiting role ${roleId}...`);
        return this.client.exitRole(roleId, options);
    }

    /**
     * Leave community (burn SBT)
     */
    async leaveCommunity(community: Address, options?: TransactionOptions): Promise<Hash> {
        console.log(`👋 Leaving community ${community}...`);
        return this.client.leaveCommunity(community, options);
    }
}
