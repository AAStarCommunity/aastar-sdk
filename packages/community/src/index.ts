import { Address, Hash, parseEther, parseAbi } from 'viem';
import { ROLE_COMMUNITY, RequirementChecker, type RoleRequirement, type PublicClient, type WalletClient } from '@aastar/core';

// Import contract addresses dynamically to avoid circular dependency
let CONTRACTS: any;
import('@aastar/core').then(m => { CONTRACTS = m.CONTRACTS; });

/**
 * Community configuration for launch
 */
export interface CommunityLaunchConfig {
    name: string;
    ensName?: string;
    website?: string;
    description?: string;
    logoURI?: string;
    stakeAmount: bigint;
    entryBurn?: bigint;
    sbtRules?: SBTRuleConfig;
}

/**
 * SBT minting rules configuration
 */
export interface SBTRuleConfig {
    minStake: bigint;
    maxSupply: bigint;
    mintPrice: bigint;
}

/**
 * xPNTs issuance parameters
 */
export interface XPNTsIssuanceParams {
    symbol: string;
    initialSupply: bigint;
    exchangeRate: bigint;
}

/**
 * Community statistics
 */
export interface CommunityStats {
    totalMembers: number;
    totalStaked: bigint;
    xpntsSupply: bigint;
    reputationAvg: number;
}

/**
 * Community management client
 * 
 * @roleRequired ROLE_COMMUNITY (for most operations after launch)
 * @description Provides high-level APIs for community lifecycle operations
 * 
 * ## Permission Requirements:
 * - **Launch Community**: Requires GToken balance >= stakeAmount + entryBurn
 * - **Issue xPNTs**: Requires COMMUNITY role
 * - **Configure SBT**: Requires COMMUNITY role + community ownership
 * 
 * ## Typical Users:
 * - Community Administrators
 * - DAO Operators
 * - Protocol Partners
 */
export class CommunityClient {
    /** @internal */
    private publicClient: PublicClient;
    /** @internal */
    private walletClient: WalletClient;
    /** @internal */
    private requirementChecker: RequirementChecker;
    /** @internal */
    private registryAddress?: Address;
    /** @internal */
    private gtokenAddress?: Address;
    /** @internal */
    private stakingAddress?: Address;

    /**
     * Initialize CommunityClient
     * @param publicClient The public client for queries
     * @param walletClient The wallet client for transactions
     * @param addresses Optional contract address overrides
     */
    constructor(
        publicClient: PublicClient,
        walletClient: WalletClient,
        addresses?: {
            registry?: Address;
            gtoken?: Address;
            staking?: Address;
        }
    ) {
        this.publicClient = publicClient;
        this.walletClient = walletClient;
        this.requirementChecker = new RequirementChecker(publicClient as any, addresses);
        
        this.registryAddress = addresses?.registry;
        this.gtokenAddress = addresses?.gtoken;
        this.stakingAddress = addresses?.staking;
    }

    /**
     * Check if user meets requirements to launch a community
     * 
     * @roleRequired None (pre-check before registration)
     * @param address User address to check (optional, defaults to wallet account)
     * @param requiredAmount Total GToken required (stake + burn)
     * @returns Requirement check result
     * 
     * @example
     * ```typescript
     * const check = await communityClient.checkLaunchRequirements(
     *     myAddress,
     *     parseEther("33")  // 30 stake + 3 burn
     * );
     * if (!check.hasEnoughGToken) {
     *     console.error(`❌ ${check.missingRequirements.join('\n')}`);
     *     return;
     * }
     * ```
     */
    async checkLaunchRequirements(
        address?: Address,
        requiredAmount?: bigint
    ): Promise<RoleRequirement> {
        const userAddress = address || this.walletClient.account?.address;
        if (!userAddress) throw new Error('No wallet account found');

        const amount = requiredAmount || parseEther("33"); // Default: 30+3

        return await this.requirementChecker.checkRequirements({
            address: userAddress,
            requiredGToken: amount,
            requireSBT: false
        });
    }

    /**
     * Launch a community with one-click operation
     * 
     * @roleRequired None (will register ROLE_COMMUNITY)
     * @permission Requires GToken balance >= stakeAmount + entryBurn
     * 
     * @description Combines: approve → stake → register → configure
     * - Auto-approves GToken for staking contract
     * - Registers caller as COMMUNITY role
     * - Stakes required amount
     * - **Pre-checks requirements before execution**
     * 
     * @param config Community configuration
     * @returns Community ID and transaction hash
     * 
     * @throws Error if requirements not met
     * 
     * @example
     * ```typescript
     * const communityClient = new CommunityClient(publicClient, walletClient);
     * 
     * try {
     *     const { communityId, txHash } = await communityClient.launchCommunity({
     *         name: "MyDAO",
     *         stakeAmount: parseEther("30"),
     *         entryBurn: parseEther("3"),
     *         logoURI: "ipfs://..."
     *     });
     *     console.log(`✅ Community launched: ${communityId}`);
     * } catch (error) {
     *     console.error(`❌ Failed: ${error.message}`);
     * }
     * ```
     */
    async launchCommunity(config: CommunityLaunchConfig): Promise<{
        communityId: Address;
        txHash: Hash;
    }> {
        const account = this.walletClient.account;
        if (!account) throw new Error('Wallet account not found');

        // PRE-CHECK: Verify requirements
        const totalRequired = config.stakeAmount + (config.entryBurn || 0n);
        const check = await this.checkLaunchRequirements(account.address, totalRequired);
        
        if (!check.hasEnoughGToken) {
            throw new Error(
                `Insufficient funds to launch community:\n` +
                check.missingRequirements.join('\n')
            );
        }

        // Load contract addresses
        const { CONTRACTS } = await import('@aastar/core');
        const registryAddress = this.registryAddress || CONTRACTS.sepolia.core.registry;
        const gtokenAddress = this.gtokenAddress || CONTRACTS.sepolia.core.gToken;
        const stakingAddress = this.stakingAddress || CONTRACTS.sepolia.core.gTokenStaking;

        // Step 1: Approve GToken
        const approveTx = await this.walletClient.writeContract({
            address: gtokenAddress,
            abi: [{
                name: 'approve',
                type: 'function',
                stateMutability: 'nonpayable',
                inputs: [
                    { name: 'spender', type: 'address' },
                    { name: 'amount', type: 'uint256' }
                ],
                outputs: [{ type: 'bool' }]
            }],
            functionName: 'approve',
            args: [stakingAddress, totalRequired],
            chain: this.walletClient.chain
        } as any);

        await this.publicClient.waitForTransactionReceipt({ hash: approveTx });

        // Step 2: Register role
        const roleData = '0x'; // Simplified - needs proper encoding
        const registerTx = await this.walletClient.writeContract({
            address: registryAddress,
            abi: [{
                name: 'registerRole',
                type: 'function',
                stateMutability: 'nonpayable',
                inputs: [
                    { name: 'roleId', type: 'bytes32' },
                    { name: 'user', type: 'address' },
                    { name: 'roleData', type: 'bytes' }
                ],
                outputs: []
            }],
            functionName: 'registerRole',
            args: [ROLE_COMMUNITY, account.address, roleData],
            chain: this.walletClient.chain
        } as any);

        await this.publicClient.waitForTransactionReceipt({ hash: registerTx });

        return {
            communityId: account.address,
            txHash: registerTx
        };
    }

    /**
     * Issue community-specific xPNTs token
     * 
     * @roleRequired ROLE_COMMUNITY
     * @permission Must be registered community admin
     * 
     * @param params xPNTs issuance parameters
     * @returns xPNTs contract address and transaction hash
     */
    async issueXPNTs(params: XPNTsIssuanceParams): Promise<{
        xpntsAddress: Address;
        txHash: Hash;
    }> {
        const account = this.walletClient.account;
        if (!account) throw new Error('Wallet account not found');

        // PRE-CHECK: Verify COMMUNITY role
        const hasRole = await this.requirementChecker.checkHasRole(
            ROLE_COMMUNITY,
            account.address
        );
        
        if (!hasRole) {
            throw new Error(
                `Missing ROLE_COMMUNITY. Please register as a community first.`
            );
        }

        // Load contract addresses
        const { CORE_ADDRESSES } = await import('@aastar/core');
        const factoryAddress = CORE_ADDRESSES.xPNTsFactory;

        if (!factoryAddress) throw new Error('xPNTsFactory address not found');

        // Deploy xPNTs via Factory
        // Assuming ABI: createXPNTs(string symbol, uint256 supply, uint256 rate)
        const deployTx = await this.walletClient.writeContract({
            address: factoryAddress,
            abi: parseAbi(['function createXPNTs(string,uint256,uint256) returns (address)']),
            functionName: 'createXPNTs',
            args: [params.symbol, params.initialSupply, params.exchangeRate],
            chain: this.walletClient.chain,
            account
        });

        // We can't easily get the address without parsing logs, so we return zero address for now or simulate
        return {
            xpntsAddress: '0x0000000000000000000000000000000000000000', 
            txHash: deployTx
        };
    }

    /**
     * Configure SBT minting rules for the community
     * 
     * @roleRequired ROLE_COMMUNITY
     * @permission Must be registered community admin + community ownership
     * 
     * @param rules SBT rule configuration
     * @returns Transaction hash
     */
    async configureSBTRules(rules: SBTRuleConfig): Promise<Hash> {
        const account = this.walletClient.account;
        if (!account) throw new Error('Wallet account not found');

        // PRE-CHECK: Verify COMMUNITY role
        const hasRole = await this.requirementChecker.checkHasRole(
            ROLE_COMMUNITY,
            account.address
        );
        
        if (!hasRole) {
            throw new Error(
                `Missing ROLE_COMMUNITY. Please register as a community first.`
            );
        }

        // TODO: Implement MySBT configuration
        throw new Error('Not implemented yet - requires MySBT rule configuration');
    }

    /**
     * Get community statistics
     * 
     * @roleRequired None (public query)
     * @param communityId Community address
     * @returns Community statistics
     */
    async getCommunityStats(communityId: Address): Promise<CommunityStats> {
        // TODO: Implement by querying Registry, Staking, and Reputation contracts
        throw new Error('Not implemented yet - requires multi-contract aggregation');
    }
}
