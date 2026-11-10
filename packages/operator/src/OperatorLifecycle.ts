import { type Address, type Hash, type Hex, parseEther } from 'viem';
import { type TransactionOptions } from '@aastar/core';
import { PaymasterOperatorClient, type OperatorClientConfig } from './PaymasterOperatorClient.js';
import { tokenActions, registryActions, superPaymasterHasTwoStepWithdrawal, SuperPaymasterABI } from '@aastar/core'; // L2/L1 Actions

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
     * Finalize exit: withdraw the aPNTs collateral, then exit the Registry role. Staged on
     * SuperPaymaster 5.5.1+ (request -> 48 h -> withdraw); call it again until the role exit is in
     * the returned hashes:
     *  - balance > 0, no request: sends requestWithdraw(balance) and returns — call again after it matures;
     *  - request open but not matured: throws, naming when it matures (nothing sent);
     *  - request matured: withdraws it; exits the role only once no collateral is left.
     * On 5.4.2 the collateral is withdrawn in one call. Funds always go to the operator itself;
     * `to` is accepted only when it IS the operator (SuperPaymaster has no recipient parameter).
     */
    async withdrawAllFunds(to?: Address, options?: TransactionOptions): Promise<Hash[]> {
        const self = this.getAddress();
        if (to && to.toLowerCase() !== self.toLowerCase()) {
            throw new Error(`withdrawAllFunds: SuperPaymaster pays a collateral withdrawal to the operator itself (${self}); it cannot send to ${to}`);
        }
        const hashes: Hash[] = [];

        // 1. Collateral (aPNTs) held by SuperPaymaster.
        const stats = await this.checkReadiness();
        if (stats.balance > 0n) {
            const version = await (this.getStartPublicClient() as any).readContract({
                address: this.superPaymasterAddress, abi: SuperPaymasterABI, functionName: 'version',
            }) as string;
            if (!superPaymasterHasTwoStepWithdrawal(version)) {
                hashes.push(await this.executeCollateralWithdrawal(stats.balance, options));
            } else {
                const w = await this.collateralWithdrawalStatus();
                if (w.amount === 0n) {
                    hashes.push(await this.requestCollateralWithdrawal(w.balance, options));
                    return hashes; // the delay has started; the role exit waits for the collateral
                }
                if (!w.matured) throw new Error(`withdrawAllFunds: the collateral withdrawal matures at ${w.readyAt} (now ${w.now}); call again then`);
                hashes.push(await this.executeCollateralWithdrawal(undefined, options));
                if (w.amount < w.balance) return hashes; // collateral left over: request the rest next call
            }
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
