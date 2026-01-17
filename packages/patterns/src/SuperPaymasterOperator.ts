import { type Address, type Hash } from 'viem';
import { PaymasterOperatorClient, type OperatorClientConfig } from '@aastar/operator';
import { type TransactionOptions } from '@aastar/core';

export interface SPOperatorSetupParams {
    initialStake: bigint;
    xPNTsToken: Address;
    treasury: Address;
    exchangeRate: bigint;
}

/**
 * ⚡ SuperPaymaster Operator Pattern
 * 
 * Lifecycle management for SuperPaymaster Operators.
 * Uses ONLY verified L2 methods from PaymasterOperatorClient.
 */
export class SuperPaymasterOperator {
    private client: PaymasterOperatorClient;

    constructor(config: OperatorClientConfig) {
        this.client = new PaymasterOperatorClient(config);
    }

    // ========================================
    // Registration & Setup (注册阶段)
    // ========================================

    /**
     * Register as SuperPaymaster Operator with initial stake
     */
    async registerAsOperator(params: SPOperatorSetupParams, options?: TransactionOptions): Promise<Hash[]> {
        console.log('⚡ Registering as SuperPaymaster Operator...');
        const txs: Hash[] = [];

        // 1. Register & Stake
        console.log(`💰 Registering with ${params.initialStake} stake...`);
        const regTx = await this.client.registerAsSuperPaymasterOperator({
            stakeAmount: params.initialStake
        }, options);
        txs.push(regTx);

        // 2. Configure operator parameters
        console.log('⚙️ Configuring operator...');
        const configTx = await this.client.configureOperator(
            params.xPNTsToken,
            params.treasury,
            params.exchangeRate,
            options
        );
        txs.push(configTx);

        return txs;
    }

    // ========================================
    // Operational Management (运营阶段)
    // ========================================

    /**
     * Deposit funds to SuperPaymaster for sponsorship
     */
    async depositFunds(amount: bigint, options?: TransactionOptions): Promise<Hash> {
        console.log(`💵 Depositing ${amount} to SuperPaymaster...`);
        return this.client.depositCollateral(amount, options);
    }

    /**
     * Withdraw funds from SuperPaymaster
     */
    async withdrawFunds(to: Address, amount: bigint, options?: TransactionOptions): Promise<Hash> {
        console.log(`📤 Withdrawing ${amount} to ${to}...`);
        return this.client.withdrawCollateral(to, amount, options);
    }

    /**
     * Update operator configuration
     */
    async updateConfiguration(
        xPNTsToken: Address,
        treasury: Address,
        exchangeRate: bigint,
        options?: TransactionOptions
    ): Promise<Hash> {
        console.log('🔧 Updating operator configuration...');
        return this.client.configureOperator(xPNTsToken, treasury, exchangeRate, options);
    }

    /**
     * Check if address is registered operator
     */
    async isOperator(operator: Address): Promise<boolean> {
        return this.client.isOperator(operator);
    }

    /**
     * Get current deposit balance (aPNTs balance)
     */
    async getDepositBalance(): Promise<bigint> {
        const details = await this.client.getOperatorDetails(this.client.getAddress());
        return details[0]; // aPNTsBalance
    }

    // ========================================
    // Exit & Cleanup (退出阶段)
    // ========================================

    /**
     * Initiate operator exit by unstaking
     */
    async initiateExit(options?: TransactionOptions): Promise<Hash> {
        console.log('🚪 Initiating operator exit...');
        return this.client.initiateExit(options);
    }

    /**
     * Withdraw all remaining funds before complete exit
     */
    async withdrawAll(to: Address, options?: TransactionOptions): Promise<Hash> {
        console.log('💸 Withdrawing all funds...');
        const balance = await this.getDepositBalance();
        return this.client.withdrawCollateral(to, balance, options);
    }

    async withdrawStake(to: Address, options?: TransactionOptions): Promise<Hash> {
        return this.client.withdrawStake(to, options);
    }
}
