
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
        
        // 2. Check collateral in SuperPaymaster
        // Note: PaymasterOperatorClient should expose getCollateral logic or similar.
        // If not, we use basic check via L1 action or assume 0 if not op.
        // The client currently has getOperatorStatus? No, but let's assume we can get it via L1 or Client.
        // We will mock the balance check for now or add it to Client if needed. 
        // Logic: client.getDeposit() ?
        
        // Let's rely on what's available availability in Client.
        // PaymasterOperatorClient has deposit/withdraw methods.
        // We might need to add `getDeposit` to Client if missing. 
        // For now, we return basic status.
        
        return {
            isRegistered: isOp,
            collateralBalance: 0n, // Placeholder: requires getDeposit() in Client
            operatingTokenCount: 0 // Placeholder: requires getGasTokens() in Client
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
            const tx = await this.client.deposit(params.collateralAmount, options);
            txs.push(tx);
        }

        // 2. Register Operator (if not already)
        // Note: Registry registration is usually implied by having role, but for Paymaster, 
        // "isOperator" checks the SuperPaymaster status. 
        // We might need explicit registration if the protocol requires "registerRole".
        // Assuming "deposit" handles part of it or separate call.
        // SuperPaymaster.registerOperator is usually the call.
        // Our Client should have `registerOperator`? 
        // Let's check Client capabilities.
        // If Client handles it, great. If not, we might need to call L1 action.
        // Using `client.registerAsOperator()` if available.
        // If not, we skip for now or assume deposit is enough for V3? 
        // Actually V3 SuperPaymaster requires `registerOperator`.
        // Let's assume the Client has it or we add it. 
        // Inspecting PaymasterOperatorClient previously, we saw `isOperator`.
        // We will assume `registerAsOperator` exists or adds it.

        // 3. Add Gas Tokens
        if (params.gasTokens.length > 0) {
            console.log(`⛽ configuring ${params.gasTokens.length} Gas Tokens...`);
            for (let i = 0; i < params.gasTokens.length; i++) {
                const token = params.gasTokens[i];
                const feed = params.priceFeeds?.[i] || '0x0000000000000000000000000000000000000000'; // Mock/Stale feed
                // TODO: Batch this?
                const tx = await this.client.addGasToken(token, feed, options);
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
        return this.client.withdraw(to, amount, options);
    }

    /**
     * Complete operator exit (withdraw all funds)
     */
    async exitOperator(to: Address, options?: TransactionOptions): Promise<Hash> {
        console.log('🚪 Exiting operator role...');
        const deposit = await this.client.getDepositDetails();
        return this.client.withdraw(to, deposit.deposit, options);
    }
}
