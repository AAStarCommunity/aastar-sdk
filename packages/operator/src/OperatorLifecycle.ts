import { type Address, type Hash, type Hex, parseEther } from 'viem';
import { type TransactionOptions } from '@aastar/core';
import { PaymasterOperatorClient, type OperatorClientConfig } from './PaymasterOperatorClient.js';
import { tokenActions, registryActions } from '@aastar/core'; // L2/L1 Actions

export interface OperatorStatus {
    isConfigured: boolean;
    isActive: boolean;
    balance: bigint;
}

/**
 * OperatorLifecycle - L3 Pattern
 * 
 * Responsibilities:
 * 1. Managing the complete lifecycle of a Paymaster Operator
 * 2. Unifying setup (onboard), operation (config), and exit (withdraw)
 */
export class OperatorLifecycle extends PaymasterOperatorClient {

    constructor(config: OperatorClientConfig) {
        super(config);
    }

    // ===========================================
    // 1. Setup Phase (Onboarding)
    // ===========================================

    /**
     * Check if the account is ready to become an operator
     * (e.g., has GToken, has ROLE_COMMUNITY, etc.)
     */
    async checkReadiness(): Promise<OperatorStatus> {
        const isOp = await this.isOperator(this.getAddress());
        const balance = await this.getTokenBalance(); // Logic to get current stake/deposit
        
        return {
            isConfigured: isOp,
            isActive: isOp, // Simplification, real logic might check activity
            balance
        };
    }

    /**
     * One-click Setup: Register + Deposit + Deploy Node
     * Wraps existing registerAsSuperPaymasterOperator or deployAndRegisterPaymasterV4
     */
    async setupNode(params: {
        type: 'V4' | 'SUPER';
        stakeAmount?: bigint;
        depositAmount?: bigint;
    }, options?: TransactionOptions): Promise<Hash[]> {
        const hashes: Hash[] = [];

        if (params.type === 'SUPER') {
            const h = await this.registerAsSuperPaymasterOperator({
                stakeAmount: params.stakeAmount,
                depositAmount: params.depositAmount
            }, options);
            hashes.push(h);
        } else {
            const result = await this.deployAndRegisterPaymasterV4({
                stakeAmount: params.stakeAmount
            }, options);
            hashes.push(result.deployHash);
            hashes.push(result.registerHash);
        }

        return hashes;
    }

    // ===========================================
    // 2. Operational Phase (Config & Funds)
    // ===========================================

    // Inherits: addGasToken, configureOperator, depositCollateral from PaymasterOperatorClient

    async getOperatorStats(): Promise<any> {
        return await this.getOperatorDetails();
    }

    // ===========================================
    // 3. Exit Phase (Withdraw & Leave)
    // ===========================================

    /**
     * Start the exit process: Unstake from Registry/SuperPaymaster and Unlock funds
     */
    async initiateExit(options?: TransactionOptions): Promise<Hash> {
        // 1. Unlock Stake from SuperPaymaster (if applicable)
        return await super.initiateExit(options);
    }

    /**
     * Finalize exit: Withdraw all funds (Collateral + Rewards)
     */
    async withdrawAllFunds(to?: Address, options?: TransactionOptions): Promise<Hash[]> {
        const recipient = to || this.getAddress();
        const hashes: Hash[] = [];

        // 1. Withdraw Collateral from SuperPaymaster
        // We first need to check the balance. 
        // Note: Real implementation needs a getter for deposit balance.
        // Assuming we withdraw everything available.
        // For now, we reuse withdrawCollateral if amount is known, 
        // or we need to add a "withdrawAll" to the underlying actions/contracts if supported.
        // As a fallback pattern, we often just withdraw the stake after unlock period.
        
        const h1 = await this.withdrawStake(recipient, options);
        hashes.push(h1);

        // 2. Withdraw remaining GTokens if any (optional cleanup)
        // ...

        return hashes;
    }

    // Helper: Get GToken Balance
    private async getTokenBalance(): Promise<bigint> {
        if (!this.tokenAddress) return 0n;
        const token = tokenActions()(this.getStartPublicClient());
        return await token.balanceOf({ token: this.tokenAddress, account: this.getAddress() });
    }
}
