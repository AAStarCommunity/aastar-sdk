import { type Address, type Hash, parseEther } from 'viem';
import { BaseClient, type ClientConfig, type TransactionOptions } from '@aastar/core';
import { superPaymasterActions, tokenActions, paymasterV4Actions } from '@aastar/core';

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

    /**
     * Stake ETH/Funds to register as a SuperPaymaster Operator
     */
    async stake(amount: bigint, options?: TransactionOptions): Promise<Hash> {
        const pm = superPaymasterActions(this.superPaymasterAddress);
        
        return pm(this.client).addSuperStake({
            amount,
            account: options?.account
        });
    }

    /**
     * Unstake funds (initiates withdrawal delay)
     */
    async unstake(options?: TransactionOptions): Promise<Hash> {
        const pm = superPaymasterActions(this.superPaymasterAddress);
        
        return pm(this.client).unlockSuperStake({
            account: options?.account
        });
    }

    // ========================================
    // 2. 运营配置
    // ========================================

    /**
     * Check if address is a valid operator
     */
    async isOperator(operator: Address): Promise<boolean> {
        const pm = superPaymasterActions(this.superPaymasterAddress);
        try {
            const opData = await pm(this.getStartPublicClient()).operators({ operator });
            return opData && opData.length > 0; // Assuming struct return
        } catch {
            return false;
        }
    }

    /**
     * Configure Operator parameters (Token, Treasury, Exchange Rate)
     */
    async configureOperator(xPNTsToken: Address, treasury: Address, exchangeRate: bigint, options?: TransactionOptions): Promise<Hash> {
        const pm = superPaymasterActions(this.superPaymasterAddress);
        
        return pm(this.client).configureOperator({
            xPNTsToken,
            treasury,
            exchangeRate,
            account: options?.account
        });
    }

    // ========================================
    // 3. 支付代币管理 (基于 PaymasterV4Actions)
    // ========================================

    /**
     * Add a supported Gas Token
     */
    async addGasToken(token: Address, priceFeed: Address, options?: TransactionOptions): Promise<Hash> {
        const pm = paymasterV4Actions(this.superPaymasterAddress);
        
        return pm(this.client).addGasToken({
            token,
            priceFeed,
            account: options?.account
        });
    }

    /**
     * Remove a Gas Token
     */
    async removeGasToken(token: Address, options?: TransactionOptions): Promise<Hash> {
        const pm = paymasterV4Actions(this.superPaymasterAddress);
        
        return pm(this.client).removeGasToken({
            token,
            account: options?.account
        });
    }

    /**
     * Get list of supported Gas Tokens
     */
    async getSupportedGasTokens(): Promise<Address[]> {
        const pm = paymasterV4Actions(this.superPaymasterAddress);
        return pm(this.getStartPublicClient()).getSupportedGasTokens();
    }
}
