import { type Address, type Hash, parseEther } from 'viem';
import { BaseClient, type ClientConfig, type TransactionOptions } from '@aastar/core';
import { superPaymasterActions, tokenActions } from '@aastar/core';

export interface OperatorClientConfig extends ClientConfig {
    superPaymasterAddress: Address;
    tokenAddress?: Address;
}

export interface SponsorshipPolicy {
    globalLimit: bigint;
    userLimit: bigint;
    itemPrice: bigint;
    // ... logic for encoding this into bytes/storage
}

/**
 * Client for Paymaster Operators (ROLE_PAYMASTER_SUPER)
 */
export class PaymasterOperatorClient extends BaseClient {
    public superPaymasterAddress: Address;
    public tokenAddress?: Address;

    constructor(config: OperatorClientConfig) {
        super(config);
        this.superPaymasterAddress = config.superPaymasterAddress;
        this.tokenAddress = config.tokenAddress;
    }

    // ========================================
    // 1. 资金管理 (基于 L1 superPaymasterActions)
    // ========================================

    /**
     * Deposit ETH/Funds into SuperPaymaster for sponsoring
     */
    async deposit(amount: bigint, options?: TransactionOptions): Promise<Hash> {
        const pm = superPaymasterActions(this.superPaymasterAddress);
        
        return pm(this.client).deposit({
            amount,
            account: options?.account
        });
    }

    /**
     * Withdraw funds from SuperPaymaster
     */
    async withdraw(to: Address, amount: bigint, options?: TransactionOptions): Promise<Hash> {
        const pm = superPaymasterActions(this.superPaymasterAddress);
        
        return pm(this.client).withdrawTo({
            to,
            amount,
            account: options?.account
        });
    }

    /**
     * Get current deposit balance
     */
    async getDepositDetails(): Promise<{ deposit: bigint }> {
        // SuperPaymaster logic for checking own deposit? 
        // Typically EntryPoint.getDepositInfo
        // But PM might have its own accounting.
        // Using L1 action for PM:
        const pm = superPaymasterActions(this.superPaymasterAddress);
        const deposit = await pm(this.getStartPublicClient()).getDeposit();
        return { deposit };
    }

    // ========================================
    // 2. 运营配置
    // ========================================

    /**
     * Check if address is a valid operator
     */
    async isOperator(operator: Address): Promise<boolean> {
        // This might need Registry check or PM check depending on architecture
        // PMv3 usually checks Registry roles?
        // Or internal whitelist.
        // Assuming PM has internal operator management or uses Registry.
        const pm = superPaymasterActions(this.superPaymasterAddress);
        // Checking price map or something? 
        // Let's assume verifying if they can sponsor.
        return true; // Placeholder logic
    }
}
