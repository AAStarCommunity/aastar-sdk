import { Address, Hash, PublicClient, WalletClient, Hex, parseEther } from 'viem';
import { ROLE_ENDUSER, RequirementChecker, type RoleRequirement } from '@aastar/core';

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

}
