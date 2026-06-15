import { Address, Hash, parseEther, decodeEventLog } from 'viem';
import {
    ROLE_COMMUNITY,
    RequirementChecker,
    type RoleRequirement,
    type PublicClient,
    type WalletClient,
    type RoleConfigDetailed,
} from '@aastar/core';

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
 *
 * @remarks
 * These map 1:1 onto the on-chain `xPNTsFactory.deployxPNTsToken` signature.
 * The factory deploys an ERC-1167 minimal-proxy token; it does NOT take an
 * initial supply (tokens are minted later via the token's own mint flow).
 */
export interface XPNTsIssuanceParams {
    /** ERC-20 token name (e.g. "MyDAO Points") */
    name: string;
    /** ERC-20 token symbol (e.g. "MDP") */
    symbol: string;
    /** Human-readable community name recorded on the token */
    communityName: string;
    /** Community ENS name recorded on the token (e.g. "mydao.eth") */
    communityENS: string;
    /** xPNTs:aPNTs exchange rate (18-decimal fixed point, e.g. parseEther("1")) */
    exchangeRate: bigint;
    /** Paymaster AOA (Account-Owned Address) authorized to burn/settle gas */
    paymasterAOA: `0x${string}`;
}

/**
 * Community statistics.
 *
 * @remarks
 * Every field below is sourced from a read getter that ACTUALLY EXISTS in the
 * on-chain ABIs (Registry / GTokenStaking / xPNTsToken). Two stats that earlier
 * drafts of this interface assumed (`totalMembers` and a per-member
 * `reputationAvg`) are intentionally absent because no on-chain getter provides
 * them — see the {@link CommunityClient.getCommunityStats} doc for the gap
 * details. `community` echoes the queried id so the snapshot is self-describing.
 */
export interface CommunityStats {
    /** The queried community (admin/owner) address. */
    community: Address;
    /** Whether `community` currently holds ROLE_COMMUNITY. Source: Registry.hasRole(ROLE_COMMUNITY, community). */
    isRegistered: boolean;
    /** GToken the community has locked for its COMMUNITY role. Source: GTokenStaking.getLockedStake(community, ROLE_COMMUNITY). */
    communityStake: bigint;
    /** The community's on-chain credit limit. Source: Registry.getCreditLimit(community). */
    creditLimit: bigint;
    /** The community's global reputation score. Source: Registry.globalReputation(community). */
    globalReputation: bigint;
    /** COMMUNITY role configuration (minStake, ticketPrice, exit fees, ...). Source: Registry.getRoleConfig(ROLE_COMMUNITY). */
    roleConfig: RoleConfigDetailed;
    /** Protocol-wide number of registered communities (NOT this community's member count). Source: Registry.getRoleUserCount(ROLE_COMMUNITY). */
    totalCommunities: bigint;
    /** Protocol-wide total GToken staked. Source: GTokenStaking.totalStaked(). */
    globalTotalStaked: bigint;
    /**
     * Total supply of the community's xPNTs token. Only populated when the
     * caller supplies the token address (it is not resolvable from `community`
     * via any on-chain getter — only emitted as a deploy event). Source: xPNTsToken.totalSupply().
     */
    xpntsSupply?: bigint;
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

        // Load contract addresses + factory action factory from @aastar/core
        // (ABIs MUST come from @aastar/core per the SDK ESLint rule).
        const { CORE_ADDRESSES, xPNTsFactoryActions, xPNTsFactoryABI } = await import('@aastar/core');
        const factoryAddress = CORE_ADDRESSES.xPNTsFactory;

        if (!factoryAddress) throw new Error('xPNTsFactory address not found');

        // Deploy xPNTs via the core action factory (no inline parseAbi).
        const txHash = await xPNTsFactoryActions(factoryAddress)(this.walletClient).deployxPNTsToken({
            name: params.name,
            symbol: params.symbol,
            communityName: params.communityName,
            communityENS: params.communityENS,
            exchangeRate: params.exchangeRate,
            paymasterAOA: params.paymasterAOA,
            account
        });

        const receipt = await this.publicClient.waitForTransactionReceipt({ hash: txHash });

        // Decode the `xPNTsTokenDeployed(community indexed, tokenAddress indexed, name, symbol)`
        // event from the receipt logs to recover the real deployed token address.
        let xpntsAddress: Address | undefined;
        for (const log of receipt.logs) {
            try {
                const decoded = decodeEventLog({
                    abi: xPNTsFactoryABI,
                    data: log.data,
                    topics: log.topics
                }) as { eventName: string; args: { tokenAddress?: Address } };
                if (decoded.eventName === 'xPNTsTokenDeployed') {
                    xpntsAddress = decoded.args.tokenAddress;
                    break;
                }
            } catch {
                // Not a factory event (or a different event) — skip.
                continue;
            }
        }

        if (!xpntsAddress) {
            throw new Error(
                `xPNTs deployment succeeded (tx ${txHash}) but no xPNTsTokenDeployed event ` +
                `was found in the receipt logs; unable to determine the deployed token address.`
            );
        }

        return {
            xpntsAddress,
            txHash
        };
    }

    /**
     * Configure the MySBT minting parameters.
     *
     * @permission MySBT owner / DAO multisig
     *
     * @remarks
     * IMPORTANT — these are GLOBAL, protocol-wide parameters, NOT per-community
     * rules. MySBT exposes no per-community SBT rule configuration; the only
     * rule-like setters it has are `setMinLockAmount` (the GToken lock required
     * to mint) and `setMintFee` (the SBT mint fee), both gated by the contract's
     * owner / DAO multisig. They will revert on-chain unless the caller holds
     * that authority — this is why no ROLE_COMMUNITY pre-check is performed here
     * (a community role does NOT grant the right to change these values, and
     * enforcing it would wrongly block the legitimate owner).
     *
     * CONTRACT GAP — `SBTRuleConfig.maxSupply`: MySBT has no max-supply setter.
     * `MAX_MEMBERSHIPS` is an immutable per-holder membership cap, not a
     * configurable token supply, so a maximum supply cannot be set on-chain. To
     * avoid silently dropping the requested value, this method throws when
     * `maxSupply` is non-zero; pass `maxSupply: 0n` to skip it. Honouring a max
     * supply would require a new `setMaxSupply()`-style function on MySBT.
     *
     * Two transactions are sent (setMinLockAmount, then setMintFee); the final
     * (mint-fee) tx hash is returned, mirroring `launchCommunity`'s multi-step
     * return convention.
     *
     * @param rules SBT rule configuration. `maxSupply` MUST be `0n`.
     * @returns The mint-fee transaction hash (the last of the two writes).
     */
    async configureSBTRules(rules: SBTRuleConfig): Promise<Hash> {
        const account = this.walletClient.account;
        if (!account) throw new Error('Wallet account not found');

        // CONTRACT GAP: MySBT cannot set a maximum supply. Refuse rather than
        // pretend the value was applied.
        if (rules.maxSupply !== 0n) {
            throw new Error(
                'SBTRuleConfig.maxSupply is not configurable on-chain: MySBT exposes no ' +
                'setMaxSupply()/max-supply setter (MAX_MEMBERSHIPS is an immutable per-holder ' +
                'membership cap, not a token supply cap). Pass maxSupply: 0n to skip it. ' +
                'Configuring a max supply requires a contract-side change to MySBT.'
            );
        }

        // ABIs MUST come from @aastar/core; dynamic import avoids the documented
        // circular-dependency issue at module load.
        const { CORE_ADDRESSES, sbtActions } = await import('@aastar/core');
        const sbtAddress = CORE_ADDRESSES.mySBT as Address | undefined;
        if (!sbtAddress) throw new Error('MySBT address not found');

        const sbt = sbtActions(sbtAddress)(this.walletClient);

        // 1) Minimum GToken lock required to mint an SBT membership.
        const lockTx = await sbt.setMinLockAmount({ amount: rules.minStake, account });
        await this.publicClient.waitForTransactionReceipt({ hash: lockTx });

        // 2) Mint fee charged when an SBT is minted.
        const feeTx = await sbt.setMintFee({ fee: rules.mintPrice, account });
        await this.publicClient.waitForTransactionReceipt({ hash: feeTx });

        return feeTx;
    }

    /**
     * Aggregate on-chain statistics for a community.
     *
     * @roleRequired None (public read-only query)
     *
     * @remarks
     * This aggregates ONLY getters that actually exist in the on-chain ABIs:
     * - `isRegistered`     ← Registry.hasRole(ROLE_COMMUNITY, communityId)
     * - `communityStake`   ← GTokenStaking.getLockedStake(communityId, ROLE_COMMUNITY)
     * - `creditLimit`      ← Registry.getCreditLimit(communityId)
     * - `globalReputation` ← Registry.globalReputation(communityId)
     * - `roleConfig`       ← Registry.getRoleConfig(ROLE_COMMUNITY)
     * - `totalCommunities` ← Registry.getRoleUserCount(ROLE_COMMUNITY)  (protocol-wide)
     * - `globalTotalStaked`← GTokenStaking.totalStaked()                 (protocol-wide)
     * - `xpntsSupply`      ← xPNTsToken.totalSupply()  (only when `options.xpntsToken` is given)
     *
     * GAPS (no on-chain getter, deliberately omitted rather than guessed):
     * - Per-community member count: MySBT indexes memberships per holder (SBT)
     *   with no reverse community→members index or counter, and Registry's
     *   `getRoleUserCount(ROLE_COMMUNITY)` counts COMMUNITIES, not a community's
     *   members. A `communityMemberCount()`-style getter would be required.
     * - Per-member average reputation: derivable only from a member count
     *   (missing above) plus a per-community aggregate score; neither exists.
     *
     * @param communityId The community (admin/owner) address to describe.
     * @param options.xpntsToken Optional deployed xPNTs token address; when
     *        supplied, its `totalSupply()` is read into `xpntsSupply`. It cannot
     *        be resolved from `communityId` on-chain (only emitted at deploy time).
     * @returns A {@link CommunityStats} snapshot.
     */
    async getCommunityStats(
        communityId: Address,
        options?: { xpntsToken?: Address }
    ): Promise<CommunityStats> {
        // ABIs MUST come from @aastar/core; dynamic import avoids the documented
        // circular-dependency issue at module load.
        const { CORE_ADDRESSES, registryActions, stakingActions, xPNTsTokenActions } =
            await import('@aastar/core');

        const registryAddress = this.registryAddress || (CORE_ADDRESSES.registry as Address);
        const stakingAddress = this.stakingAddress || (CORE_ADDRESSES.gTokenStaking as Address);
        if (!registryAddress) throw new Error('Registry address not found');
        if (!stakingAddress) throw new Error('GTokenStaking address not found');

        const registry = registryActions(registryAddress)(this.publicClient);
        const staking = stakingActions(stakingAddress)(this.publicClient);

        const [
            isRegistered,
            communityStake,
            creditLimit,
            globalReputation,
            roleConfig,
            totalCommunities,
            globalTotalStaked,
        ] = await Promise.all([
            registry.hasRole({ roleId: ROLE_COMMUNITY, user: communityId }),
            staking.getLockedStake({ user: communityId, roleId: ROLE_COMMUNITY }),
            registry.getCreditLimit({ user: communityId }),
            registry.globalReputation({ user: communityId }),
            registry.getRoleConfig({ roleId: ROLE_COMMUNITY }),
            registry.getRoleUserCount({ roleId: ROLE_COMMUNITY }),
            staking.totalStaked(),
        ]);

        let xpntsSupply: bigint | undefined;
        if (options?.xpntsToken) {
            xpntsSupply = await xPNTsTokenActions(options.xpntsToken)(this.publicClient)
                .totalSupply({ token: options.xpntsToken });
        }

        return {
            community: communityId,
            isRegistered,
            communityStake,
            creditLimit,
            globalReputation,
            roleConfig,
            totalCommunities,
            globalTotalStaked,
            xpntsSupply,
        };
    }
}
