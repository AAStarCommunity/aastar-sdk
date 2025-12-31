import { Address, Hash, PublicClient, WalletClient, parseEther, formatEther, zeroAddress, parseAbi } from 'viem';

import { ROLE_PAYMASTER_SUPER, RequirementChecker, type RoleRequirement } from '@aastar/core';

/**
 * Operator management client for Paymaster node operations
 * 
 * @roleRequired ROLE_PAYMASTER_SUPER (for deployment and operations)
 * @description Infrastructure operator tools
 * 
 * ## Permission Requirements:
 * - **Deploy Paymaster**: ROLE_PAYMASTER_SUPER + 50 GT stake + 5 GT burn
 * - **Deposit Collateral**: ROLE_PAYMASTER_SUPER + aPNTs balance
 * - **Withdraw**: ROLE_PAYMASTER_SUPER + sufficient collateral
 * 
 * ## Typical Users:
 * - Paymaster Node Operators
 * - Infrastructure Providers
 */
export class OperatorClient {
    private publicClient: PublicClient;
    private walletClient: WalletClient;
    private requirementChecker: RequirementChecker;

    constructor(
        publicClient: PublicClient,
        walletClient: WalletClient,
        addresses?: {
            registry?: Address;
            superPaymaster?: Address;
            apnts?: Address;
        }
    ) {
        this.publicClient = publicClient;
        this.walletClient = walletClient;
        this.requirementChecker = new RequirementChecker(publicClient, addresses);
    }

    /**
     * Check operator resources before deployment
     * 
     * @roleRequired None (pre-check)
     * @returns Resource check result with recommendations
     */
    async checkResources(address?: Address): Promise<RoleRequirement & { recommendations: string[] }> {
        const account = address || this.walletClient.account?.address;
        if (!account) throw new Error('No wallet account found');

        const result = await this.requirementChecker.checkRequirements({
            address: account,
            roleId: ROLE_PAYMASTER_SUPER,
            requiredGToken: parseEther("55"), // 50 stake + 5 burn
            requiredAPNTs: parseEther("100")  // Initial collateral
        });

        const recommendations: string[] = [];
        if (!result.hasEnoughGToken) recommendations.push('Fund GToken first');
        if (!result.hasEnoughAPNTs) recommendations.push('Fund aPNTs for collateral');
        if (!result.hasRole) recommendations.push('Register as PAYMASTER_SUPER role first');

        return { ...result, recommendations };
    }

    /**
     * Deploy/Register a new Paymaster
     * @roleRequired ROLE_PAYMASTER_SUPER
     */
    async deployPaymaster(
        token: Address = zeroAddress
    ): Promise<Hash> {
        const check = await this.checkResources(this.walletClient?.account?.address!);
        if (!check.hasRole) throw new Error("Must have ROLE_PAYMASTER_SUPER");

        const { CORE_ADDRESSES } = await import('@aastar/core');
        // If we are deploying a NEW instance, we call a Factory.
        // If we are registering with the EXISTING SuperPaymaster (Singleton), we call registerPaymaster.
        const superPaymasterAddress = CORE_ADDRESSES.superPaymaster;

        if (!this.walletClient) throw new Error("Wallet client required");

        // Assuming we are registering this account as a Paymaster owner on the SuperPaymaster singleton
        return await this.walletClient.writeContract({
            address: superPaymasterAddress,
            abi: parseAbi(['function registerPaymaster(address token)']),
            functionName: 'registerPaymaster',
            args: [token],
            account: this.walletClient.account!,
            chain: this.walletClient.chain
        });
    }

    /**
     * Deposit collateral (aPNTs) to SuperPaymaster
     * 
     * @roleRequired ROLE_PAYMASTER_SUPER
     * @permission Required: aPNTs balance >= amount
     */
    async depositCollateral(amount: bigint, options?: { autoApprove?: boolean }): Promise<Hash> {
        const account = this.walletClient.account;
        if (!account) throw new Error('Wallet account not found');

        // PRE-CHECK: aPNTs balance
        const { balance, hasEnough } = await this.requirementChecker.checkAPNTsBalance(
            account.address,
            amount
        );
        
        if (!hasEnough) {
            throw new Error(
                `Insufficient aPNTs: need ${formatEther(amount)}, have ${formatEther(balance)}`
            );
        }

        // PRE-CHECK: Has PAYMASTER_SUPER role
        const hasRole = await this.requirementChecker.checkHasRole(
            ROLE_PAYMASTER_SUPER,
            account.address
        );
        
        if (!hasRole) {
            throw new Error('Missing ROLE_PAYMASTER_SUPER');
        }

        const { CONTRACTS } = await import('@aastar/core');
        const apntsAddress = CONTRACTS.sepolia.core.aPNTs;
        const superPaymasterAddress = CONTRACTS.sepolia.core.superPaymaster;

        // Auto approve
        if (options?.autoApprove !== false) {
            const approveTx = await this.walletClient.writeContract({
                address: apntsAddress,
                abi: [{ name: 'approve', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] }],
                functionName: 'approve',
                args: [superPaymasterAddress, amount],
                chain: this.walletClient.chain
            } as any);
            await this.publicClient.waitForTransactionReceipt({ hash: approveTx });
        }

        const depositTx = await this.walletClient.writeContract({
            address: superPaymasterAddress,
            abi: [{ name: 'deposit', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'amount', type: 'uint256' }], outputs: [] }],
            functionName: 'deposit',
            args: [amount],
            chain: this.walletClient.chain
        } as any);

        return depositTx;
    }

    /**
     * Withdraw collateral from SuperPaymaster
     * 
     * @roleRequired ROLE_PAYMASTER_SUPER
     */
    async withdrawCollateral(amount: bigint): Promise<Hash> {
        const account = this.walletClient.account;
        if (!account) throw new Error('Wallet account not found');

        const hasRole = await this.requirementChecker.checkHasRole(
            ROLE_PAYMASTER_SUPER,
            account.address
        );
        
        if (!hasRole) {
            throw new Error('Missing ROLE_PAYMASTER_SUPER');
        }

        const { CONTRACTS } = await import('@aastar/core');
        const withdrawTx = await this.walletClient.writeContract({
            address: CONTRACTS.sepolia.core.superPaymaster,
            abi: [{ name: 'withdraw', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'amount', type: 'uint256' }], outputs: [] }],
            functionName: 'withdraw',
            args: [amount],
            chain: this.walletClient.chain
        } as any);

        return withdrawTx;
    }
}
