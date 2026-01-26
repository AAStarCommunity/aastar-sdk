import { type Address, type Hash, type Hex, parseEther } from 'viem';
import { BaseClient, type ClientConfig, type TransactionOptions } from '@aastar/core';
import { registryActions, sbtActions, tokenActions, stakingActions, entryPointActions } from '@aastar/core'; // L2/L1 Actions

export interface GaslessConfig {
    paymasterUrl: string;
    policy?: 'CREDIT' | 'TOKEN' | 'SPONSORED';
}

export interface UserLifecycleConfig extends ClientConfig {
    accountAddress: Address;
    registryAddress: Address;
    sbtAddress: Address;
    gTokenAddress: Address;
    gTokenStakingAddress: Address;
    entryPointAddress: Address;
    gasless?: GaslessConfig; // Optional gasless config
}

export interface OnboardResult {
    success: boolean;
    sbtId?: bigint;
    txHash?: Hash;
}

export interface ReputationData {
    score: bigint;
    level: bigint;
    creditLimit: bigint;
}

/**
 * UserLifecycle - L3 Pattern
 * 
 * Responsibilities:
 * 1. Managing the complete lifecycle of an End User (Onboard -> Operate -> Exit)
 * 2. Providing a unified interface for Gasless operations
 * 3. Abstracting underlying contract interactions via L2 Actions
 */
export class UserLifecycle extends BaseClient {
    public accountAddress: Address;
    public registryAddress: Address;
    public sbtAddress: Address;
    public gTokenAddress: Address;
    public gTokenStakingAddress: Address;
    public entryPointAddress: Address;
    public gaslessConfig?: GaslessConfig;

    public config: UserLifecycleConfig;

    constructor(config: UserLifecycleConfig) {
        super(config);
        this.config = config;
        this.accountAddress = config.accountAddress;
        this.registryAddress = config.registryAddress;
        this.sbtAddress = config.sbtAddress;
        this.gTokenAddress = config.gTokenAddress;
        this.gTokenStakingAddress = config.gTokenStakingAddress;
        this.entryPointAddress = config.entryPointAddress;
        this.gaslessConfig = config.gasless;
    }

    // ===========================================
    // 1. Onboarding Phase (Registration)
    // ===========================================

    /**
     * Check if user is eligible to join a community
     * @param community Address of the community
     */
    async checkEligibility(community: Address): Promise<boolean> {
        // Validation logic (e.g., check blacklist or whitelist via Registry)
        const publicClient = this.getStartPublicClient();
        const registry = registryActions(this.registryAddress)(publicClient);
        // Placeholder: simplistic check, real logic might involve community specific rules
        return true; 
    }

    /**
     * One-click Onboarding: Approve -> Stake -> Register -> Mint SBT
     * @param community Address of the community to join
     * @param stakeAmount Amount of GToken to stake (default 0.4 GT)
     */
    async onboard(community: Address, stakeAmount: bigint = parseEther('0.4')): Promise<OnboardResult> {
        try {
            const registry = registryActions(this.registryAddress)(this.client);
            const userClient = await import('./UserClient.js').then(m => new m.UserClient({
                ...this.config,
                accountAddress: this.accountAddress,
                registryAddress: this.registryAddress,
                gTokenStakingAddress: this.gTokenStakingAddress,
                gTokenAddress: this.gTokenAddress,
                sbtAddress: this.sbtAddress
            }));

            // Use UserClient's batch execution capability for atomic onboarding
            const txHash = await userClient.registerAsEndUser(community, stakeAmount);
            
            // Post-check: Verify role
            const hasRole = await registry.hasRole({ 
                roleId: await registry.ROLE_ENDUSER(), 
                user: this.accountAddress 
            });

            return {
                success: hasRole,
                txHash
            };
        } catch (error) {
            console.error("Onboarding failed:", error);
            return { success: false };
        }
    }

    /**
     * Enable or update Gasless configuration
     */
    async enableGasless(config: GaslessConfig): Promise<void> {
        this.gaslessConfig = config;
        // In future: verify paymaster connection here
    }

    // ===========================================
    // 2. Operational Phase (Execute & Interact)
    // ===========================================

    /**
     * Execute a transaction effectively using Gasless configuration if available
     */
    async executeGaslessTx(params: {
        target: Address;
        value: bigint;
        data: Hex;
        operator?: Address; // Optional specific operator
    }): Promise<Hash> {
        if (!this.gaslessConfig) {
            throw new Error("Gasless configuration not enabled. Call enableGasless() first.");
        }

        const userClient = await import('./UserClient.js').then(m => new m.UserClient({
            ...this.config,
            accountAddress: this.accountAddress,
            // Pass minimal config needed for execution
            entryPointAddress: this.entryPointAddress,
            bundlerClient: (this.config as any).bundlerClient 
        }));

        // Determine Paymaster Type based on policy
        const paymasterType = this.gaslessConfig.policy === 'CREDIT' ? 'Super' : 'V4'; 
        // Note: Real implementation needs to resolve actual Paymaster Address from Registry/Config
        // This is a placeholder address resolution
        const registry = registryActions(this.registryAddress)(this.client);
        const paymasterAddress = await registry.SUPER_PAYMASTER(); 

        return await userClient.executeGasless({
            target: params.target,
            value: params.value,
            data: params.data,
            paymaster: paymasterAddress,
            paymasterType,
            operator: params.operator
        });
    }

    /**
     * Claim a specific SBT Role
     */
    async claimSBT(roleId: Hex): Promise<Hash> {
        const userClient = await import('./UserClient.js').then(m => new m.UserClient({
            ...this.config,
            accountAddress: this.accountAddress,
            sbtAddress: this.sbtAddress
        }));
        return await userClient.mintSBT(roleId);
    }

    // ===========================================
    // 3. Query Phase (Info & Stats)
    // ===========================================

    async getMyReputation(): Promise<ReputationData> {
        const publicClient = this.getStartPublicClient();
        const registry = registryActions(this.registryAddress)(publicClient);
        
        const [score, creditLimit] = await Promise.all([
            registry.globalReputation({ user: this.accountAddress }),
            registry.getCreditLimit({ user: this.accountAddress })
        ]);

        return {
            score,
            level: 0n, // TODO: Add level calculation logic
            creditLimit
        };
    }

    async getCreditLimit(): Promise<bigint> {
        const registry = registryActions(this.registryAddress)(this.client);
        return await registry.getCreditLimit({ user: this.accountAddress });
    }

    // ===========================================
    // 4. Exit Phase (Cleanup)
    // ===========================================

    /**
     * Leave community: Unbind assets, Burn SBT, Remove Role
     */
    async leaveCommunity(community: Address): Promise<Hash> {
        const sbt = sbtActions(this.sbtAddress)(this.client);
        // 1. Leave Logic (contracts usually handle burn)
        return await sbt.leaveCommunity({ 
            community, 
            account: this.accountAddress // Self-exit
        });
    }

    /**
     * Exit a specific role in Registry
     */
    async exitRole(roleId: Hex): Promise<Hash> {
        const registry = registryActions(this.registryAddress)(this.client);
        return await registry.exitRole({ 
            roleId, 
            account: this.accountAddress 
        });
    }

    /**
     * Unstake all GTokens from Staking contract
     */
    async unstakeAll(roleId: Hex): Promise<Hash> {
        const staking = stakingActions(this.gTokenStakingAddress)(this.client);
        return await staking.unlockAndTransfer({
            user: this.accountAddress,
            roleId,
            account: this.accountAddress
        });
    }
}
