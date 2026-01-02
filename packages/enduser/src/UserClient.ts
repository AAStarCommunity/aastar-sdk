import { type Address, type Hash, type Hex } from 'viem';
import { BaseClient, type ClientConfig, type TransactionOptions } from '@aastar/core';
import { accountActions, sbtActions, tokenActions, entryPointActions, stakingActions, registryActions } from '@aastar/core';

export interface UserClientConfig extends ClientConfig {
    accountAddress: Address; // The AA account address
    sbtAddress?: Address;
    entryPointAddress?: Address;
    superPaymasterAddress?: Address; // For sponsorship queries
    gTokenStakingAddress?: Address; // For staking/investing
    registryAddress?: Address; // For role management
}

export class UserClient extends BaseClient {
    public accountAddress: Address;
    public sbtAddress?: Address;
    public entryPointAddress?: Address;
    public gTokenStakingAddress?: Address;
    public registryAddress?: Address;

    constructor(config: UserClientConfig) {
        super(config);
        this.accountAddress = config.accountAddress;
        this.sbtAddress = config.sbtAddress;
        this.entryPointAddress = config.entryPointAddress;
        this.gTokenStakingAddress = config.gTokenStakingAddress;
        this.registryAddress = config.registryAddress;
    }

    // ========================================
    // 1. 账户基本操作 (基于 L1 simpleAccountActions)
    // ========================================

    /**
     * Get the nonce of the account from EntryPoint (more reliable for 4337)
     */
    async getNonce(key: bigint = 0n): Promise<bigint> {
        if (!this.entryPointAddress) throw new Error('EntryPoint address required');
        const entryPoint = entryPointActions(this.entryPointAddress);
        return entryPoint(this.getStartPublicClient()).getNonce({
            sender: this.accountAddress,
            key
        });
    }

    /**
     * Get the owner of the AA account
     */
    async getOwner(): Promise<Address> {
        const account = accountActions(this.accountAddress);
        return account(this.getStartPublicClient()).owner();
    }

    /**
     * Execute a transaction from the AA account
     */
    async execute(target: Address, value: bigint, data: Hex, options?: TransactionOptions): Promise<Hash> {
        const account = accountActions(this.accountAddress);
        
        // Use standard AA execute
        return account(this.client).execute({
            dest: target, // API uses dest
            value,
            func: data, // API uses func
            account: options?.account // The EOA signer
        });
    }

    /**
     * Execute a batch of transactions
     */
    async executeBatch(targets: Address[], values: bigint[], datas: Hex[], options?: TransactionOptions): Promise<Hash> {
        const account = accountActions(this.accountAddress);
        
        return account(this.client).executeBatch({
            dest: targets,
            value: values,
            func: datas,
            account: options?.account
        });
    }

    // ========================================
    // 2. 身份与 SBT (基于 L1 sbtActions)
    // ========================================

    /**
     * Get user's SBT balance
     */
    async getSBTBalance(): Promise<bigint> {
        if (!this.sbtAddress) throw new Error('SBT address required');
        const sbt = sbtActions(this.sbtAddress);
        
        // Note: Missing totalSupply in previous demo, but balanceOf usually exists
        return sbt(this.getStartPublicClient()).balanceOf({
            owner: this.accountAddress
        });
    }

    // ========================================
    // 3. 资产管理 (基于 L1 tokenActions)
    // ========================================

    /**
     * Transfer GToken or any ERC20
     */
    async transferToken(token: Address, to: Address, amount: bigint, options?: TransactionOptions): Promise<Hash> {
        const tokens = tokenActions()(this.client);
        
        return tokens.transfer({
            token,
            to,
            amount,
            account: options?.account // signer
        });
    }

    /**
     * Get Token Balance
     */
    async getTokenBalance(token: Address): Promise<bigint> {
        const tokens = tokenActions()(this.getStartPublicClient());
        
        return tokens.balanceOf({
            token,
            account: this.accountAddress
        });
    }

    // ========================================
    // 4. 委托与质押 (Delegation & Staking)
    // ========================================

    /**
     * Delegate stake to a role (Delegate to an operator/community)
     */
    async stakeForRole(roleId: Hex, amount: bigint, options?: TransactionOptions): Promise<Hash> {
        if (!this.gTokenStakingAddress) throw new Error('GTokenStaking address required');
        const staking = stakingActions(this.gTokenStakingAddress);
        
        return staking(this.client).lockStake({
            user: this.accountAddress, // The delegator (self)
            roleId,
            stakeAmount: amount,
            entryBurn: 0n, // Default 0 burn
            payer: this.accountAddress, // Self pay
            account: options?.account
        });
    }

    /**
     * Unstake from a role
     */
    async unstakeFromRole(roleId: Hex, options?: TransactionOptions): Promise<Hash> {
        if (!this.gTokenStakingAddress) throw new Error('GTokenStaking address required');
        const staking = stakingActions(this.gTokenStakingAddress);
        
        return staking(this.client).unlockAndTransfer({
            user: this.accountAddress,
            roleId,
            account: options?.account
        });
    }

    /**
     * Get staked balance for a specific role
     */
    async getStakedBalance(roleId: Hex): Promise<bigint> {
        if (!this.gTokenStakingAddress) throw new Error('GTokenStaking address required');
        const staking = stakingActions(this.gTokenStakingAddress);
        
        return staking(this.getStartPublicClient()).getLockedStake({
            user: this.accountAddress,
            roleId
        });
    }

    // ========================================
    // 5. 生命周期管理 (Lifecycle)
    // ========================================

    /**
     * Exit a specific role (Cleanup registry status)
     */
    async exitRole(roleId: Hex, options?: TransactionOptions): Promise<Hash> {
        if (!this.registryAddress) throw new Error('Registry address required');
        const registry = registryActions(this.registryAddress);
        
        return registry(this.client).exitRole({
            roleId,
            account: options?.account
        });
    }

    /**
     * Leave a community (Burn SBT and clean up)
     */
    async leaveCommunity(community: Address, options?: TransactionOptions): Promise<Hash> {
        if (!this.sbtAddress) throw new Error('SBT address required');
        const sbt = sbtActions(this.sbtAddress);
        
        return sbt(this.client).leaveCommunity({
            community,
            account: options?.account
        });
    }
}
