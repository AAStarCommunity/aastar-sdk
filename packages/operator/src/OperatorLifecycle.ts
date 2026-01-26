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
        // For SuperPaymaster, balance is 'aPNTsBalance' (Collateral)
        const details = await this.getOperatorDetails();
        const balance = details.aPNTsBalance || 0n;
        
        return {
            isConfigured: isOp,
            isActive: isOp, // Simplification
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

            // Fetch Token Address and Configure
            const factory = await import('@aastar/core').then(m => m.xPNTsFactoryActions(this.xpntsFactory!)(this.getStartPublicClient()));
            const token = await factory.getTokenAddress({ community: this.getAddress() });
            
            if (token && token !== '0x0000000000000000000000000000000000000000') {
                const hConfig = await this.configureOperator(
                    token,
                    this.getAddress(), // Default treasury to self
                    parseEther('1'),    // Default 1:1 rate
                    options
                );
                hashes.push(hConfig);
            }
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

        // 1. Withdraw Collateral from SuperPaymaster (if any)
        // Note: We need to know the balance to withdraw exact amount.
        // For current L3 pattern, we assume the user tracks it or we fetch it.
        const stats = await this.checkReadiness();
        if (stats.balance > 0n) {
             const hCol = await this.withdrawCollateral(recipient, stats.balance, options);
             hashes.push(hCol);
        }

        // 2. Exit Role in Registry (Unstake GToken)
        // This will fail if lock duration > 0 and not yet cooldown.
        // Or it will initiate cooldown.
        const client = this.getStartPublicClient();
        const registry = registryActions(this.registryAddress as Address); // Use local registry address
        const registryWriter = registryActions(this.registryAddress as Address)(this.client);
        
        // Check if we have the role
        // For Super Operator
        const ROLE_PAYMASTER_SUPER = await registry(client).ROLE_PAYMASTER_SUPER();
        const hasRole = await registry(client).hasRole({ user: this.getAddress(), roleId: ROLE_PAYMASTER_SUPER });
        
        if (hasRole) {
            const hExit = await registryWriter.exitRole({ roleId: ROLE_PAYMASTER_SUPER, account: options?.account });
            hashes.push(hExit);
        }

        return hashes;
    }

    // Helper: Get GToken Balance
    private async getTokenBalance(): Promise<bigint> {
        if (!this.tokenAddress) return 0n;
        const token = tokenActions()(this.getStartPublicClient());
        return await token.balanceOf({ token: this.tokenAddress, account: this.getAddress() });
    }
}
