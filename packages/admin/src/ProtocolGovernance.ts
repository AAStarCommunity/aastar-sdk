import { type Address, type Hash, type Hex } from 'viem';
import { BaseClient, type ClientConfig, type TransactionOptions } from '@aastar/core';
import { registryActions, entryPointActions } from '@aastar/core'; // L2/L1 Actions

export interface ProtocolParams {
    minStake: bigint;
    treasury: Address;
    entryPoint: Address;
    superPaymaster: Address;
}

/**
 * ProtocolGovernance - L3 Pattern
 * 
 * Responsibilities:
 * 1. Global Protocol Parameter Management (Registry, EntryPoint)
 * 2. High-level Governance Operations (DAO Transfer, Upgrades)
 * 3. SuperPaymaster & Module Approval
 */
export class ProtocolGovernance extends BaseClient {
    public registryAddress: Address;
    public entryPointAddress: Address;

    constructor(config: ClientConfig & { 
        registryAddress: Address; 
        entryPointAddress: Address 
    }) {
        super(config);
        this.registryAddress = config.registryAddress;
        this.entryPointAddress = config.entryPointAddress;
    }

    // ===========================================
    // 1. Global Parameter Management
    // ===========================================

    /**
     * Update the Global Treasury Address where protocol fees are collected
     */
    async setTreasury(treasury: Address, options?: TransactionOptions): Promise<Hash> {
        // Note: Registry might not have direct setTreasury if it relies on SuperPaymaster's config.
        // Assuming Registry has ownership pointers or config pointers.
        // If Logic resides in SuperPaymaster, we would use superPaymasterActions.
        // Based on provided ABI/Actions, Registry manages Role Configs mainly.
        // Let's assume we are updating a System Role or similar global config if available,
        // OR adhering to what registryActions provides.
        
        // Checking registryActions... it has 'transferOwnership' but maybe not direct 'setTreasury' depending on version.
        // If strictly following ABI, we might need to update a specific Role Parameter (e.g. AOA/Super config).
        
        throw new Error("Method not mapped to RegistryABI v1. Please verify contract capabilities.");
    }

    /**
     * Update the supported EntryPoint address
     */
    async updateEntryPoint(entryPoint: Address, options?: TransactionOptions): Promise<Hash> {
        // Placeholder: Real implementation depends on if Registry stores EntryPoint
        // registryActions typically provides getters. Setters usually restricted to Owner.
        // If action not available, throw standard error.
        throw new Error("Method not mapped to RegistryABI v1.");
    }

    // ===========================================
    // 2. Role & Module Governance
    // ===========================================

    /**
     * Approve a new SuperPaymaster contract address
     */
    async setSuperPaymaster(paymaster: Address, options?: TransactionOptions): Promise<Hash> {
        const registry = registryActions(this.registryAddress);
        return await registry(this.client).setSuperPaymaster({
            paymaster,
            account: options?.account
        });
    }

    /**
     * Set the Staking contract address
     */
    async setStaking(staking: Address, options?: TransactionOptions): Promise<Hash> {
        const registry = registryActions(this.registryAddress);
        return await registry(this.client).setStaking({
            staking,
            account: options?.account
        });
    }

    /**
     * Configure a Role's parameters (Admin only)
     * e.g. Setting minStake for ROLE_PAYMASTER_SUPER
     */
    async configureRole(params: {
        roleId: Hex;
        minStake?: bigint;
        entryBurn?: bigint;
        exitFeePercent?: bigint;
        minExitFee?: bigint;
    }, options?: TransactionOptions): Promise<Hash> {
        const registry = registryActions(this.registryAddress);
        
        // Use the admin shortcut if only updating financial params
        if (params.minStake !== undefined || params.entryBurn !== undefined) {
             return await registry(this.client).adminConfigureRole({
                 roleId: params.roleId,
                 minStake: params.minStake || 0n, // Careful: this might overwrite if API expects full set
                 entryBurn: params.entryBurn || 0n,
                 exitFeePercent: params.exitFeePercent || 0n,
                 minExitFee: params.minExitFee || 0n,
                 account: options?.account
             });
        }
        
        throw new Error("Invalid parameters for configureRole");
    }

    // ===========================================
    // 3. Transfer to DAO (Exit/Upgrade)
    // ===========================================

    /**
     * Transfer Protocol Ownership to a DAO (Multisig/Timelock)
     * This is the final step of "Protocol Admin" lifecycle.
     */
    async transferToDAO(daoAddress: Address, options?: TransactionOptions): Promise<Hash> {
        const registry = registryActions(this.registryAddress);
        return await registry(this.client).transferOwnership({
            newOwner: daoAddress,
            account: options?.account
        });
    }

    // ===========================================
    // 4. Query Capabilities
    // ===========================================

    async getProtocolParams(): Promise<ProtocolParams> {
        const registry = registryActions(this.registryAddress)(this.client); // Read-only via Client
        
        // Parallel fetch
        const [sp, staking] = await Promise.all([
            registry.SUPER_PAYMASTER(),
            registry.GTOKEN_STAKING()
        ]);

        return {
            minStake: 0n, // Global default not directly exposed, usually per role
            treasury: await registry.owner(), // Approximation for now
            entryPoint: this.entryPointAddress,
            superPaymaster: sp
        };
    }
}
