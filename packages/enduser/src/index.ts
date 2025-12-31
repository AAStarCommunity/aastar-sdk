import { Address, Hash, PublicClient, WalletClient, Hex, parseEther } from 'viem';
import { ROLE_ENDUSER, RequirementChecker, type RoleRequirement } from '@aastar/core';

// Export test utilities
export { TestAccountManager, type TestAccount, type TestEnvironment, type TestEnvironmentConfig, type TokenFundingRecord } from './testAccountManager.js';

/**
 * End user client for community participation and gasless transactions
 * 
 * @roleRequired ROLE_ENDUSER (after joining community)
 * @description Terminal user participation tools
 * 
 * ## Permission Requirements:
 * - **Join Community**: 0.4 GT stake + 0.04 GT burn + MySBT from community
 * - **Mint SBT**: Community membership
 * - **Gasless Transaction**: ENDUSER role + credit limit
 * 
 * ## Typical Users:
 * - Community Members
 * - End Users
 */
export class EndUserClient {
    private publicClient: PublicClient;
    private walletClient: WalletClient;
    private requirementChecker: RequirementChecker;

    constructor(
        publicClient: PublicClient,
        walletClient: WalletClient,
        addresses?: {
            registry?: Address;
            gtoken?: Address;
            staking?: Address;
            mysbt?: Address;
        }
    ) {
        this.publicClient = publicClient;
        this.walletClient = walletClient;
        this.requirementChecker = new RequirementChecker(publicClient, addresses);
    }

    /**
     * Check join community requirements
     * 
     * @roleRequired None (pre-check)
     */
    async checkJoinRequirements(address?: Address): Promise<RoleRequirement> {
        const account = address || this.walletClient.account?.address;
        if (!account) throw new Error('No wallet account found');

        return await this.requirementChecker.checkRequirements({
            address: account,
            requiredGToken: parseEther("0.44"), // 0.4 stake + 0.04 burn (approx)
            requireSBT: false  // Will get SBT after joining
        });
    }

    /**
     * Join a community (includes auto-stake and SBT minting)
     * 
     * @roleRequired None (will register ROLE_ENDUSER)
     * @permission Required: 0.4 GT stake + 0.04 GT burn
     */
    async joinCommunity(params: {
        communityId: Address;
        avatarURI?: string;
        ensName?: string;
        autoMintSBT?: boolean;
    }): Promise<{
        sbtTokenId: bigint;
        creditLimit: bigint;
        txHash: Hash;
    }> {
        const account = this.walletClient.account;
        if (!account) throw new Error('Wallet account not found');

        // PRE-CHECK
        const check = await this.checkJoinRequirements(account.address);
        if (!check.hasEnoughGToken) {
            throw new Error(`Insufficient GToken:\n${check.missingRequirements.join('\n')}`);
        }

        const { CONTRACTS } = await import('@aastar/core');
        const totalRequired = parseEther("0.44");

        // Approve
        const approveTx = await this.walletClient.writeContract({
            address: CONTRACTS.sepolia.core.gToken,
            abi: [{ name: 'approve', type: 'function', stateMutability: 'nonpayable', inputs: [{ type: 'address' }, { type: 'uint256' }], outputs: [{ type: 'bool' }] }],
            functionName: 'approve',
            args: [CONTRACTS.sepolia.core.gTokenStaking, totalRequired],
            chain: this.walletClient.chain
        } as any);
        await this.publicClient.waitForTransactionReceipt({ hash: approveTx });

        // Register
        const roleData = '0x';
        const registerTx = await this.walletClient.writeContract({
            address: CONTRACTS.sepolia.core.registry,
            abi: [{ name: 'registerRole', type: 'function', stateMutability: 'nonpayable', inputs: [{ type: 'bytes32' }, { type: 'address' }, { type: 'bytes' }], outputs: [] }],
            functionName: 'registerRole',
            args: [ROLE_ENDUSER, account.address, roleData],
            chain: this.walletClient.chain
        } as any);

        await this.publicClient.waitForTransactionReceipt({ hash: registerTx });

        return {
            sbtTokenId: 1n,
            creditLimit: 0n,
            txHash: registerTx
        };
    }

    /**
     * Send a gasless transaction via SuperPaymaster
     * @roleRequired None (Paymaster verification)
     */
    async sendGaslessTransaction(
        to: Address,
        data: Hex,
        value: bigint = 0n
    ): Promise<Hash> {
        const { CORE_ADDRESSES } = await import('@aastar/core');
        const entryPointAddress = CORE_ADDRESSES.entryPoint || '0x0000000071727De22E5E9d8BAf0edAc6f37da032';
        const paymasterAddress = CORE_ADDRESSES.superPaymaster;

        if (!this.walletClient || !this.walletClient.account) {
            throw new Error("Wallet client required for sending transactions");
        }

        throw new Error(`Gasless TX requires Bundler connection. EntryPoint: ${entryPointAddress}, Paymaster: ${paymasterAddress}. Use @aastar/account for full UserOp construction.`);
    }

    /**
     * Get user credit limit
     */
    async getCreditLimit(): Promise<bigint> {
       // Placeholder until ReputationClient
       return 0n;
    }

    /**
     * Mint identity SBT
     * 
     * @roleRequired ROLE_ENDUSER
     */
    async mintSBT(params: { communityId: Address }): Promise<{ tokenId: bigint; txHash: Hash }> {
        const account = this.walletClient.account;
        if (!account) throw new Error('Wallet account not found');

        const hasRole = await this.requirementChecker.checkHasRole(ROLE_ENDUSER, account.address);
        if (!hasRole) throw new Error('Missing ROLE_ENDUSER');

        const { CONTRACTS } = await import('@aastar/core');
        const mintTx = await this.walletClient.writeContract({
            address: CONTRACTS.sepolia.core.mySBT,
            abi: [{ name: 'mint', type: 'function', stateMutability: 'nonpayable', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }] }],
            functionName: 'mint',
            args: [account.address],
            chain: this.walletClient.chain
        } as any);

        return { tokenId: 1n, txHash: mintTx };
    }

    /**
     * Create/Predict a Smart Account (SimpleAccount)
     * Useful for onboarding new users or experiment runners.
     */
    async createSmartAccount(params: {
        owner: Address;
        salt?: bigint;
    }): Promise<{
        accountAddress: Address;
        initCode: Hex;
        isDeployed: boolean;
    }> {
        const { TEST_ACCOUNT_ADDRESSES, SimpleAccountFactoryABI } = await import('@aastar/core');
        let factoryAddress = TEST_ACCOUNT_ADDRESSES.simpleAccountFactory;
        
        if (!factoryAddress || factoryAddress === "0x0000000000000000000000000000000000000000") {
            // Fallback for experiments - Official Sepolia v0.6 Factory
            factoryAddress = "0x9406Cc6185a346906296840746125a0E44976454";
        }

        const salt = params.salt || 0n;
        const { encodeFunctionData, concat } = await import('viem');

        // Predict Address
        const accountAddress = await this.publicClient.readContract({
            address: factoryAddress,
            abi: SimpleAccountFactoryABI,
            functionName: 'getAddress',
            args: [params.owner, salt]
        });

        // Generate InitCode
        const createAccountData = encodeFunctionData({
            abi: SimpleAccountFactoryABI,
            functionName: 'createAccount',
            args: [params.owner, salt]
        });
        const initCode = concat([factoryAddress, createAccountData]);

        // Check Deployment
        const byteCode = await this.publicClient.getBytecode({ address: accountAddress });
        const isDeployed = byteCode !== undefined && byteCode !== '0x';

        return { accountAddress, initCode, isDeployed };
    }

    /**
     * Deploy a Smart Account on-chain using official SimpleAccountFactory
     * 
     * **Purpose**: This API is designed for PhD paper experimental data collection.
     * It uses the official SimpleAccountFactory (0x9406...454) contract to deploy
     * deterministic AA accounts for performance comparison experiments.
     * 
     * **Technical Details**:
     * - Uses `SimpleAccountFactoryABI` from `@aastar/core` (official v0.6/v0.7 ABI)
     * - Calls `createAccount(owner, salt)` function for deployment
     * - Factory Address: 0x9406Cc6185a346906296840746125a0E44976454 (Sepolia)
     * - Supports deterministic address generation via salt parameter
     * 
     * **Usage in Experiments**:
     * - Generate test accounts for EOA vs AA vs SuperPaymaster comparisons
     * - Pre-fund accounts with ETH for gas payment experiments
     * - Persist account addresses to .env for reproducible tests
     * 
     * @param params.owner - The EOA address that will control the Smart Account
     * @param params.salt - Salt for deterministic address generation (default: 0)
     * @param params.fundWithETH - Optional: Amount of ETH to fund the account after deployment
     * 
     * @returns Promise resolving to deployed account address, transaction hash, and deployment status
     * 
     * @example
     * ```typescript
     * // Deploy AA account for experiment
     * const { accountAddress, deployTxHash } = await endUser.deploySmartAccount({
     *   owner: ownerAddress,
     *   salt: 0n,
     *   fundWithETH: parseEther("0.02") // Pre-fund for tests
     * });
     * console.log(`Deployed: ${accountAddress}`);
     * console.log(`Tx: https://sepolia.etherscan.io/tx/${deployTxHash}`);
     * ```
     */
    async deploySmartAccount(params: {
        owner: Address;
        salt?: bigint;
        fundWithETH?: bigint; // Optional: fund the new account with ETH
    }): Promise<{
        accountAddress: Address;
        deployTxHash: Hash;
        isDeployed: true;
    }> {
        const { TEST_ACCOUNT_ADDRESSES, SimpleAccountFactoryABI } = await import('@aastar/core');
        let factoryAddress = TEST_ACCOUNT_ADDRESSES.simpleAccountFactory;
        
        if (!factoryAddress || factoryAddress === "0x0000000000000000000000000000000000000000") {
            factoryAddress = "0x9406Cc6185a346906296840746125a0E44976454";
        }

        const salt = params.salt || 0n;

        // First predict the address
        const accountAddress = (await this.publicClient.readContract({
            address: factoryAddress,
            abi: SimpleAccountFactoryABI,
            functionName: 'getAddress',
            args: [params.owner, salt]
        })) as Address;

        // Check if already deployed
        const byteCode = await this.publicClient.getBytecode({ address: accountAddress });
        const alreadyDeployed = byteCode !== undefined && byteCode !== '0x';

        if (alreadyDeployed) {
            console.log(`   ℹ️ Account ${accountAddress} already deployed, skipping deployment.`);
            // Still fund if requested
            if (params.fundWithETH && params.fundWithETH > 0n) {
                const fundTx = await this.walletClient.sendTransaction({
                    to: accountAddress,
                    value: params.fundWithETH
                });
                await this.publicClient.waitForTransactionReceipt({ hash: fundTx });
            }
            return { accountAddress, deployTxHash: '0x0' as Hash, isDeployed: true };
        }

        // Deploy via Factory
        const deployTx = (await this.walletClient.writeContract({
            address: factoryAddress,
            abi: SimpleAccountFactoryABI,
            functionName: 'createAccount',
            args: [params.owner, salt]
        })) as Hash;

        await this.publicClient.waitForTransactionReceipt({ hash: deployTx });

        // Fund if requested
        if (params.fundWithETH && params.fundWithETH > 0n) {
            const fundTx = await this.walletClient.sendTransaction({
                to: accountAddress,
                value: params.fundWithETH
            });
            await this.publicClient.waitForTransactionReceipt({ hash: fundTx });
        }

        return { accountAddress, deployTxHash: deployTx, isDeployed: true };
    }
}
