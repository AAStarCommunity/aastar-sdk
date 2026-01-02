import { type Address, type Hash, parseEther } from 'viem';
import { BaseClient, type ClientConfig, type TransactionOptions } from '@aastar/core';
import { registryActions, sbtActions, xPNTsFactoryActions, reputationActions, tokenActions } from '@aastar/core';

export interface CommunityClientConfig extends ClientConfig {
    sbtAddress?: Address;
    factoryAddress?: Address;
    reputationAddress?: Address;
}

export interface CreateCommunityParams {
    name: string;
    tokenSymbol: string;
    ensName?: string;
    description?: string;
}

export interface CommunityInfo {
    address: Address; // Community ID (hash) usually, but here likely the SBT/profile? No, Community in Registry is bytes32 ID.
    // Wait, Registry defines Community as a Role (ROLE_COMMUNITY).
    // The "Community" entity usually implies a collection of contracts (Token, maybe Paymaster).
}

/**
 * Client for Community Managers (`ROLE_COMMUNITY`)
 */
export class CommunityClient extends BaseClient {
    public sbtAddress?: Address;
    public factoryAddress?: Address;
    public reputationAddress?: Address;

    constructor(config: CommunityClientConfig) {
        super(config);
        this.sbtAddress = config.sbtAddress;
        this.factoryAddress = config.factoryAddress;
        this.reputationAddress = config.reputationAddress;
    }

    // ========================================
    // 1. 社区创建与配置
    // ========================================

    /**
     * Create a new Community Token (xPNTs) and register it.
     * Note: In the current architecture, creating a community often involves:
     * 1. Registering the ROLE_COMMUNITY on Registry (if not exists) -> usually manual or self-register
     * 2. Deploying a Token (xPNTs) via Factory
     * 3. Linking the Token to the Community in Registry
     */
    async createCommunityToken(params: CreateCommunityParams, options?: TransactionOptions): Promise<Address> {
        if (!this.factoryAddress) throw new Error('Factory address required');
        const factory = xPNTsFactoryActions(this.factoryAddress);

        // 1. Deploy Token
        const hash = await factory(this.client).createToken({
            name: params.name,
            symbol: params.tokenSymbol,
            community: params.ensName ? '0x0000000000000000000000000000000000000000' : '0x0000000000000000000000000000000000000000', // Placeholder for community ID logic or params.ensName as Address if valid
            account: options?.account
        });

        // We need to get the address. The action returns hash.
        return '0x...'; // Placeholder
    }

    /**
     * Register self as a Community Manager (if open)
     */
    async registerAsCommunity(options?: TransactionOptions): Promise<Hash> {
        const registryAddr = this.requireRegistry();
        const registry = registryActions(registryAddr);
        
        const roleCommunity = await registry(this.getStartPublicClient()).ROLE_COMMUNITY();
        
        return registry(this.client).registerRoleSelf({
            roleId: roleCommunity,
            data: '0x',
            account: options?.account
        });
    }

    // ========================================
    // 2. 成员管理
    // ========================================

    /**
     * Airdrop SBTs to users to make them members
     */
    async airdropSBT(users: Address[], roleId: bigint, options?: TransactionOptions): Promise<Hash> {
        if (!this.sbtAddress) throw new Error('SBT address required');
        const sbt = sbtActions(this.sbtAddress);

        if (users.length === 1) {
            // Convert roleId to Hex (bytes32)
            const roleIdHex = `0x${roleId.toString(16).padStart(64, '0')}` as Hash;

            return sbt(this.client).airdropMint({
                to: users[0],
                roleId: roleIdHex,
                tokenURI: '', // Added required param
                account: options?.account
            });
        }
        
        throw new Error('Batch airdrop not fully implemented in L1 yet, use single user');
    }

    // ========================================
    // 3. 信誉系统
    // ========================================

    async setReputationRule(ruleId: bigint, ruleConfig: any, options?: TransactionOptions): Promise<Hash> {
        if (!this.reputationAddress) throw new Error('Reputation address required');
        const reputation = reputationActions(this.reputationAddress);
        
        const ruleIdHex = `0x${ruleId.toString(16).padStart(64, '0')}` as Hash;

        return reputation(this.client).setReputationRule({
            ruleId: ruleIdHex,
            rule: ruleConfig,
            account: options?.account
        });
    }

    // ========================================
    // 4. 管理功能
    // ========================================

    /**
     * Revoke membership (Burn SBT)
     */
    async revokeMembership(tokenId: bigint, options?: TransactionOptions): Promise<Hash> {
        if (!this.sbtAddress) throw new Error('SBT address required');
        const sbt = sbtActions(this.sbtAddress);
        
        // Use burn or deactivateMembership depending on logic.
        // burnSBT is likely the admin action
        return sbt(this.client).burnSBT({
            tokenId,
            account: options?.account
        });
    }

    /**
     * Transfer ownership of the Community Token
     */
    async transferCommunityTokenOwnership(tokenAddress: Address, newOwner: Address, options?: TransactionOptions): Promise<Hash> {
        const token = tokenActions()(this.client);
        
        return token.transferOwnership({
            token: tokenAddress,
            newOwner,
            account: options?.account
        });
    }
}
