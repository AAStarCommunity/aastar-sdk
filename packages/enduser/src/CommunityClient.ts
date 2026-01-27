import { type Address, type Hash, parseEther, encodeAbiParameters, parseAbiParameters } from 'viem';
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
    async createCommunityToken(params: CreateCommunityParams, options?: TransactionOptions): Promise<Hash> {
        try {
            if (!this.factoryAddress) {
                throw new Error('Factory address required for this client');
            }
            const factory = xPNTsFactoryActions(this.factoryAddress);

            // 1. Deploy Token
            // Note: The address calculation should be handled via event parsing or predictive deployment
            // For now, returning the transaction hash as per L1 pattern
            return await factory(this.client).createToken({
                name: params.name,
                symbol: params.tokenSymbol,
                community: this.getAddress(),
                account: options?.account
            });
        } catch (error) {
            // Error is likely already an AAStarError from L1, but we wrap it for context
            throw error; 
        }
    }

    /**
     * Register self as a Community Manager.
     * This method handles all necessary steps:
     * 1. Checks and approves GToken to GTokenStaking
     * 2. Encodes CommunityRoleData with provided parameters
     * 3. Calls registerRoleSelf on Registry
     * 
     * @param params Community registration parameters
     * @param options Transaction options
     * @returns Transaction hash
     */
    async registerAsCommunity(params: {
        name: string;
        ensName?: string;
        website?: string;
        description?: string;
        logoURI?: string;
        stakeAmount?: bigint;
    }, options?: TransactionOptions): Promise<Hash> {
        try {
            const registryAddr = this.requireRegistry();
            const registry = registryActions(registryAddr);
            const gTokenStakingAddr = this.requireGTokenStaking();
            const gTokenAddr = this.requireGToken();
            
            // 1. Get ROLE_COMMUNITY
            const roleCommunity = await registry(this.getStartPublicClient()).ROLE_COMMUNITY();
            
            // 2. Prepare stake amount (default 30 GToken as per Registry config)
            const stakeAmount = params.stakeAmount || parseEther('30');
            
            // 3. Check and approve GToken to GTokenStaking if needed
            const gToken = tokenActions();
            
            const allowance = await gToken(this.getStartPublicClient()).allowance({
                token: gTokenAddr,
                owner: this.getAddress(),
                spender: gTokenStakingAddr
            });
            
            if (allowance < stakeAmount) {
                const approveHash = await gToken(this.client).approve({
                    token: gTokenAddr,
                    spender: gTokenStakingAddr,
                    amount: stakeAmount * BigInt(2), // Approve 2x for future use
                    account: options?.account
                });
                await (this.getStartPublicClient() as any).waitForTransactionReceipt({ hash: approveHash });
            }
            
            // 4. Encode CommunityRoleData
            // struct CommunityRoleData { string name; string ensName; string website; string description; string logoURI; uint256 stakeAmount; }
            const communityData = encodeAbiParameters(
                parseAbiParameters('string, string, string, string, string, uint256'),
                [
                    params.name,
                    params.ensName || '',
                    params.website || '',
                    params.description || `${params.name} Community`,
                    params.logoURI || '',
                    stakeAmount
                ]
            );
            
            // 5. Register role
            return await registry(this.client).registerRoleSelf({
                roleId: roleCommunity,
                data: communityData,
                account: options?.account
            });
        } catch (error) {
            throw error;
        }
    }

    /**
     * One-click Setup: Register Community + Deploy Token
     * Orchestrates the complete community initialization flow.
     */
    async setupCommunity(params: {
        name: string;
        tokenName: string;
        tokenSymbol: string;
        description?: string;
        logoURI?: string;
        website?: string;
        stakeAmount?: bigint;
    }, options?: TransactionOptions): Promise<{ tokenAddress: Address; hashes: Hash[] }> {
        const hashes: Hash[] = [];
        let tokenAddress: Address = '0x0000000000000000000000000000000000000000';

        // 1. Register as Community (Idempotent check handled inside or by registry)
        // We should check hasRole first to avoid errors if already registered
        const registry = registryActions(this.requireRegistry())(this.getStartPublicClient());
        const ROLE_COMMUNITY = await registry.ROLE_COMMUNITY();
        const hasRole = await registry.hasRole({ roleId: ROLE_COMMUNITY, user: this.getAddress() });

        if (!hasRole) {
            const hReg = await this.registerAsCommunity({
                name: params.name,
                ensName: params.website, // Mapping website to ENS param for now as per legacy behavior
                website: params.website,
                description: params.description,
                logoURI: params.logoURI,
                stakeAmount: params.stakeAmount
            }, options);
            hashes.push(hReg);
            
            // Critical: Factory requires caller to be registered in Registry.
            // We must wait for the registration to be mined.
            await (this.getStartPublicClient() as any).waitForTransactionReceipt({ hash: hReg });
        }

        // 2. Deploy Token (Idempotent check via Factory)
        if (this.factoryAddress) {
            const factoryReader = xPNTsFactoryActions(this.factoryAddress)(this.getStartPublicClient());
            const existingToken = await factoryReader.getTokenAddress({ community: this.getAddress() });

            if (existingToken && existingToken !== '0x0000000000000000000000000000000000000000') {
                tokenAddress = existingToken;
            } else {
                const hToken = await this.createCommunityToken({
                    name: params.tokenName,
                    tokenSymbol: params.tokenSymbol,
                    description: params.description
                }, options);
                hashes.push(hToken);
                
                // Critical: Wait for token deployment to fetch the address
                await (this.getStartPublicClient() as any).waitForTransactionReceipt({ hash: hToken });
                
                // Fetch the actual address (with retries for latency)
                for (let i = 0; i < 5; i++) {
                    tokenAddress = await factoryReader.getTokenAddress({ community: this.getAddress() });
                    if (tokenAddress && tokenAddress !== '0x0000000000000000000000000000000000000000') break;
                    await new Promise(r => setTimeout(r, 2000));
                }
                
                if (!tokenAddress || tokenAddress === '0x0000000000000000000000000000000000000000') {
                    console.warn(`Warning: Token address not found after 10s. Factory might be slow indexing.`);
                }
            }
        }

        return { tokenAddress, hashes };
    }

    // ========================================
    // 2. 成员管理
    // ========================================

    /**
     * Airdrop SBTs to users to make them members
     */
    async airdropSBT(users: Address[], roleId: bigint, options?: TransactionOptions): Promise<Hash> {
        try {
            if (!this.sbtAddress) throw new Error('SBT address required for this client');
            const sbt = sbtActions(this.sbtAddress);

            if (users.length === 1) {
                // Convert roleId to Hex (bytes32)
                const roleIdHex = `0x${roleId.toString(16).padStart(64, '0')}` as Hash;

                return await sbt(this.client).mintForRole({
                    user: users[0],
                    roleId: roleIdHex,
                    roleData: '0x',
                    account: options?.account
                });
            }
            
            throw new Error('Batch airdrop not fully implemented in L1 yet, use single user');
        } catch (error) {
            throw error;
        }
    }

    // ========================================
    // 3. 信誉系统
    // ========================================

    async setReputationRule(ruleId: bigint, ruleConfig: any, options?: TransactionOptions): Promise<Hash> {
        try {
            if (!this.reputationAddress) throw new Error('Reputation address required for this client');
            const reputation = reputationActions(this.reputationAddress);
            
            const ruleIdHex = `0x${ruleId.toString(16).padStart(64, '0')}` as Hash;

            return await reputation(this.client).setReputationRule({
                ruleId: ruleIdHex,
                rule: ruleConfig,
                account: options?.account
            });
        } catch (error) {
            throw error;
        }
    }

    // ========================================
    // 4. 管理功能
    // ========================================

    /**
     * Revoke membership (Burn SBT)
     */
    async revokeMembership(userAddr: Address, options?: TransactionOptions): Promise<Hash> {
        try {
            if (!this.sbtAddress) throw new Error('SBT address required for this client');
            const sbt = sbtActions(this.sbtAddress);
            
            return await sbt(this.client).burnSBT({
                user: userAddr,
                account: options?.account
            });
        } catch (error) {
            throw error;
        }
    }

    /**
     * Transfer ownership of the Community Token
     */
    async transferCommunityTokenOwnership(tokenAddress: Address, newOwner: Address, options?: TransactionOptions): Promise<Hash> {
        try {
            const token = tokenActions()(this.client);
            
            return await token.transferOwnership({
                token: tokenAddress,
                newOwner,
                account: options?.account
            });
        } catch (error) {
            throw error;
        }
    }
}
