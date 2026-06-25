import { type Address, type Hash, type Hex, parseEther, BaseError, ContractFunctionRevertedError } from 'viem';
import { BaseClient, type ClientConfig, type TransactionOptions, RegistryABI } from '@aastar/core';
import { registryActions, sbtActions, tokenActions, stakingActions, entryPointActions } from '@aastar/core'; // L2/L1 Actions

export interface GaslessConfig {
    paymasterUrl: string;
    policy?: 'CREDIT' | 'TOKEN' | 'SPONSORED';
    /**
     * Explicit paymaster for TOKEN/SPONSORED (V4) policies. If omitted, the chain's canonical
     * PaymasterV4 is used. CREDIT always routes to the SuperPaymaster (registry-resolved).
     */
    paymasterAddress?: Address;
    /** ERC-20 used to pay gas under a V4 paymaster (TOKEN/SPONSORED). Required for those policies. */
    gasToken?: Address;
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
    async checkEligibility(_community: Address): Promise<boolean> {
        // #169 lesson: don't silently return `true` (a stub that claims everyone is eligible). The
        // real blacklist/whitelist/community-rule check is not implemented, so throw rather than lie.
        throw new Error('UserLifecycle.checkEligibility is not implemented — do not rely on a stubbed eligibility result.');
    }

    /**
     * One-click Onboarding: Approve -> Stake -> Register -> Mint SBT
     * @param community Address of the community to join
     * @param stakeAmount Amount of GToken to stake (default 0.4 GT)
     */
    async onboard(community: Address, stakeAmount: bigint = parseEther('0.4')): Promise<OnboardResult> {
        try {
            const registry = registryActions(this.registryAddress)(this.getStartPublicClient());
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
            
            // Post-check: Verify role with retry
            let hasRole = false;
            for (let i = 0; i < 5; i++) {
                hasRole = await registry.hasRole({ 
                    roleId: await registry.ROLE_ENDUSER(), 
                    user: this.accountAddress 
                });
                if (hasRole) break;
                await new Promise(r => setTimeout(r, 2000));
            }

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
        // #169 lesson: an unset policy must NOT silently default to V4 (it would route to the
        // canonical PaymasterV4 and SUCCEED silently — the dangerous case). Require it explicitly.
        if (!this.gaslessConfig.policy) {
            throw new Error(
                "gasless.policy is required ('CREDIT' | 'TOKEN' | 'SPONSORED') — refusing to default the paymaster silently.",
            );
        }

        const userClient = await import('./UserClient.js').then(m => new m.UserClient({
            ...this.config,
            accountAddress: this.accountAddress,
            // Pass minimal config needed for execution
            entryPointAddress: this.entryPointAddress,
            bundlerClient: (this.config as any).bundlerClient 
        }));

        // Resolve the paymaster ADDRESS for the policy (not a placeholder — #169 lesson: never
        // silently submit the wrong address). CREDIT → SuperPaymaster (registry-resolved);
        // TOKEN/SPONSORED → V4: explicit config address, else the chain's canonical PaymasterV4.
        const paymasterType = this.gaslessConfig.policy === 'CREDIT' ? 'Super' : 'V4';
        let paymasterAddress: Address;
        if (paymasterType === 'Super') {
            const registry = registryActions(this.registryAddress)(this.client);
            paymasterAddress = await registry.SUPER_PAYMASTER();
        } else if (this.gaslessConfig.paymasterAddress) {
            paymasterAddress = this.gaslessConfig.paymasterAddress;
        } else {
            const { getCanonicalAddresses } = await import('@aastar/core');
            const chainId = await this.client.getChainId();
            const canon = getCanonicalAddresses(chainId) as any;
            if (!canon?.paymasterV4) {
                throw new Error(
                    `No canonical PaymasterV4 for chain ${chainId}; set gasless.paymasterAddress for a ${this.gaslessConfig.policy} policy.`,
                );
            }
            paymasterAddress = canon.paymasterV4 as Address;
        }

        return await userClient.executeGasless({
            target: params.target,
            value: params.value,
            data: params.data,
            paymaster: paymasterAddress,
            paymasterType,
            gasToken: this.gaslessConfig.gasToken,
            operator: params.operator
        });
    }

    async claimSBT(roleId: Hex, options?: TransactionOptions): Promise<Hash> {
        const userClient = await import('./UserClient.js').then(m => new m.UserClient({
            ...this.config,
            accountAddress: this.accountAddress,
            sbtAddress: this.sbtAddress
        }));
        return await userClient.mintSBT(roleId, options);
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

        // Derive the level from the Registry's ascending level thresholds: the level is the number of
        // thresholds the score meets. The thresholds array has no length getter, so read by index until
        // an out-of-bounds read REVERTS (Panic) — but ONLY a revert means "end of array". A network /
        // RPC / unexpected error must propagate: silently breaking would under-report the level (the
        // #169 silent-error pattern). Read raw so the viem error type is preserved for that distinction.
        let level = 0n;
        for (let i = 0; i < 32; i++) {
            let threshold: bigint;
            try {
                threshold = (await publicClient.readContract({
                    address: this.registryAddress,
                    abi: RegistryABI as any,
                    functionName: 'levelThresholds',
                    args: [BigInt(i)],
                })) as bigint;
            } catch (err) {
                if (err instanceof BaseError && err.walk((e) => e instanceof ContractFunctionRevertedError)) {
                    break; // out-of-bounds read = past the end of the thresholds array
                }
                throw err; // network/RPC/unexpected — do NOT silently report a truncated level
            }
            if (score >= threshold) level = BigInt(i + 1);
            else break;
        }

        return { score, level, creditLimit };
    }

    async getCreditLimit(): Promise<bigint> {
        const registry = registryActions(this.registryAddress)(this.client);
        return await registry.getCreditLimit({ user: this.accountAddress });
    }

    // ===========================================
    // 4. Exit Phase (Cleanup)
    // ===========================================

    async leaveCommunity(community: Address, options?: TransactionOptions): Promise<Hash> {
        const userClient = await import('./UserClient.js').then(m => new m.UserClient({
            ...this.config,
            accountAddress: this.accountAddress,
            sbtAddress: this.sbtAddress
        }));
        return await userClient.leaveCommunity(community, options);
    }

    async exitRole(roleId: Hex, options?: TransactionOptions): Promise<Hash> {
        const userClient = await import('./UserClient.js').then(m => new m.UserClient({
            ...this.config,
            accountAddress: this.accountAddress,
            registryAddress: this.registryAddress
        }));
        return await userClient.exitRole(roleId, options);
    }

    async unstakeAll(roleId: Hex, options?: TransactionOptions): Promise<Hash> {
        const userClient = await import('./UserClient.js').then(m => new m.UserClient({
            ...this.config,
            accountAddress: this.accountAddress,
            gTokenStakingAddress: this.gTokenStakingAddress
        }));
        return await userClient.unstakeFromRole(roleId, options);
    }
}
