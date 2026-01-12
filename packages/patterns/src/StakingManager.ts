
import { type Address, type Hash, type Hex, encodeFunctionData, erc20Abi } from 'viem';
import { UserClient, type UserClientConfig } from '@aastar/enduser';
import { type TransactionOptions, tokenActions, GTokenStakingABI } from '@aastar/core'; 

export interface StakingDelegateParams {
    roleId: Hex;
    amount: bigint;
    gTokenAddress: Address;
}

export interface StakingDelegateResult {
    txHash: Hash; // Could be a batch hash
    isBatched: boolean;
}

/**
 * 💳 Staking Manager Pattern
 * 
 * Orchestrates asset management, specifically Delegation/Staking.
 * Features:
 * - "Zap" Staking: Combines Approve + Stake into a single Batch Transaction (if supported) or sequential.
 */
export class StakingManager {
    private client: UserClient;

    constructor(config: UserClientConfig) {
        this.client = new UserClient(config);
    }

    /**
     * Delegate GToken to a Role with automatic Approval.
     * Uses AA Batch Execution if possible.
     */
    async delegate(params: StakingDelegateParams, options?: TransactionOptions): Promise<StakingDelegateResult> {
        console.log(`💳 Delegating ${params.amount.toString()} GToken to Role ${params.roleId}`);

        if (!this.client.gTokenStakingAddress) {
            throw new Error('GTokenStaking address not configured in UserClient');
        }
        const stakingAddr = this.client.gTokenStakingAddress;

        // 1. Check Allowance
        // We use core tokenActions to check, similar to how UserClient would
        // But UserClient doesn't expose "getAllowance" directly yet, so we use direct action style or add to UserClient.
        // For L3, accessing Core Actions is allowed.
        // However, we need a PublicClient. UserClient base class has it.
        // We can access it via a hack or standard getter if available? 
        // UserClient doesn't expose 'client' public property easily (it's protected in BaseClient).
        // Check UserClient code... it extends BaseClient.
        // BaseClient has protected client key.
        // We might need to instantiate a separate TokenAction or assume we blindly approve (bad UX for gas).
        
        // BETTER APPROACH: Use UserClient's `executeBatch`.
        // We can construct the calldata for Approve and LockStake.
        
        // Encode "Approve"
        const approveData = encodeFunctionData({
            abi: erc20Abi,
            functionName: 'approve',
            args: [stakingAddr, params.amount]
        });

        // Encode "LockStake"
        // Needs ABI from Core.
        const stakeData = encodeFunctionData({
            abi: GTokenStakingABI,
            functionName: 'lockStake',
            args: [
                this.client.accountAddress, // user
                params.roleId,              // roleId
                params.amount,              // stakeAmount
                0n,                         // entryBurn
                this.client.accountAddress  // payer
            ]
        });

        console.log('🔄 Submitting Batch: Approve + Stake');
        
        // Execute Batch: [GToken, GTokenStaking]
        const txHash = await this.client.executeBatch(
            [params.gTokenAddress, stakingAddr],
            [0n, 0n], // No ETH value
            [approveData, stakeData],
            options
        );

        return {
            txHash,
            isBatched: true
        };
    }

    /**
     * Get staked balance helper
     */
    async getStakedBalance(roleId: Hex): Promise<bigint> {
        return this.client.getStakedBalance(roleId);
    }
}
