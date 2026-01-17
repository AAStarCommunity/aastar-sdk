
import { type Address, type Hash, type Hex, parseEther } from 'viem';
import { PaymasterOperatorClient, type OperatorClientConfig } from '@aastar/operator';
import { type TransactionOptions } from '@aastar/core';

export interface OperatorSetupParams {
    collateralAmount: bigint;
    gasTokens: Address[]; // Tokens to support (e.g. USDC, USDT)
    priceFeeds?: Address[]; // Oracle feeds for the tokens
}

export interface OperatorStatus {
    isRegistered: boolean;
    collateralBalance: bigint;
    operatingTokenCount: number;
}

/**
 * 🚀 Operator Lifecycle Pattern (The "Operator Wizard")
 * 
 * Guideline:
 * 1. Check Readiness (Resources)
 * 2. Setup Node (Register, Deposit, Config)
 * 3. Manage (Withdraw, Update) - TODO
 */
export class OperatorLifecycle {
    private client: PaymasterOperatorClient;

    constructor(config: OperatorClientConfig) {
        this.client = new PaymasterOperatorClient(config);
    }

    /**
     * Check if the current account is ready to be an operator.
     * Checks GToken balance and current Operator status.
     */
    async checkReadiness(): Promise<OperatorStatus> {
        // 1. Check if already operator
        const isOp = await this.client.isOperator(this.client.getAddress());
        
        // 2. Check collateral
        let collateralBalance = 0n;
        if (isOp) {
             const details = await this.client.getOperatorDetails(this.client.getAddress());
             collateralBalance = details[0]; // aPNTsBalance
        } else {
             // Assume 0 if not registered
             collateralBalance = 0n;
        }
        
        return {
            isRegistered: isOp,
            collateralBalance, 
            operatingTokenCount: 0 // Placeholder
        };
    }

    /**
     * One-step Setup for new Operators.
     * Deposits Collateral -> Registers (if needed) -> Adds Gas Tokens
     */
    async setupNode(params: OperatorSetupParams, options?: TransactionOptions): Promise<Hash[]> {
        console.log('🚀 Setting up Operator Node...');
        const txs: Hash[] = [];

        // 1. Deposit Collateral
        if (params.collateralAmount > 0n) {
            console.log(`💰 Depositing ${params.collateralAmount} Collateral...`);
            const tx = await this.client.depositCollateral(params.collateralAmount, options);
            txs.push(tx);
        }

        // 2. Register Operator (if not already)
        const isOp = await this.client.isOperator(this.client.getAddress());
        if (!isOp) {
             const regTx = await this.client.registerAsSuperPaymasterOperator({
                 stakeAmount: parseEther('50'), // Default
             }, options);
             txs.push(regTx);
        }

        // 3. Add Gas Tokens
        if (params.gasTokens.length > 0) {
            console.log(`⛽ configuring ${params.gasTokens.length} Gas Tokens...`);
            for (let i = 0; i < params.gasTokens.length; i++) {
                const token = params.gasTokens[i];
                // Use explicit type cast or fix logic. Client expects (token, price).
                // We mock price as 100n for now since feed logic is not fully integrated in Client.
                const tx = await this.client.addGasToken(token, 100n, options);
                txs.push(tx);
            }
        }

        return txs;
    }

    // ========================================
    // Exit & Cleanup (退出阶段)
    // ========================================

    /**
     * Withdraw collateral from SuperPaymaster
     */
    async withdrawCollateral(to: Address, amount: bigint, options?: TransactionOptions): Promise<Hash> {
        console.log(`📤 Withdrawing ${amount} collateral to ${to}...`);
        return this.client.withdrawCollateral(to, amount, options);
    }

    /**
     * Complete operator exit (withdraw all funds)
     */
    async exitOperator(to: Address, options?: TransactionOptions): Promise<Hash> {
        console.log('🚪 Exiting operator role...');
        const details = await this.client.getOperatorDetails(this.client.getAddress());
        const balance = details[0];
        return this.client.withdrawCollateral(to, balance, options);
    }
}
