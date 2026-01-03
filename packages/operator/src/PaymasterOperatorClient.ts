import { type Address, type Hash, parseEther } from 'viem';
import { BaseClient, type ClientConfig, type TransactionOptions } from '@aastar/core';
import { superPaymasterActions, tokenActions, paymasterV4Actions } from '@aastar/core';

export interface OperatorClientConfig extends ClientConfig {
    superPaymasterAddress: Address;
    tokenAddress?: Address;
}

export interface SponsorshipPolicy {
    globalLimit: bigint;
    userLimit: bigint;
    itemPrice: bigint;
    // ... logic for encoding this into bytes/storage
}

/**
 * Client for Paymaster Operators (ROLE_PAYMASTER_SUPER)
 */
export class PaymasterOperatorClient extends BaseClient {
    public superPaymasterAddress: Address;
    public tokenAddress?: Address;

    constructor(config: OperatorClientConfig) {
        super(config);
        this.superPaymasterAddress = config.superPaymasterAddress;
        this.tokenAddress = config.tokenAddress;
    }

    // ========================================
    // 0. 注册与入驻 (One-Stop Registration)
    // ========================================

    /**
     * Register as SuperPaymaster Operator (one-stop API).
     * This method handles all necessary steps:
     * 1. Checks prerequisites (must have ROLE_COMMUNITY)
     * 2. Checks and approves GToken to GTokenStaking
     * 3. Registers ROLE_PAYMASTER_SUPER
     * 4. Optionally deposits collateral to SuperPaymaster
     * 
     * @param params Registration parameters
     * @param options Transaction options
     * @returns Transaction hash of role registration
     */
    async registerAsSuperPaymasterOperator(params?: {
        stakeAmount?: bigint; // Optional, defaults to 50 GToken (Registry requirement)
        depositAmount?: bigint; // Optional initial deposit to SuperPaymaster
    }, options?: TransactionOptions): Promise<Hash> {
        const registryAddr = this.requireRegistry();
        const gTokenAddr = this.requireGToken();
        const gTokenStakingAddr = this.requireGTokenStaking();
        
        const { registryActions, tokenActions } = await import('@aastar/core');
        const registry = registryActions(registryAddr);
        const gToken = tokenActions();
        
        // 1. Check prerequisites
        const ROLE_COMMUNITY = await registry(this.getStartPublicClient()).ROLE_COMMUNITY();
        const hasCommunity = await registry(this.getStartPublicClient()).hasRole({
            user: this.getAddress(),
            roleId: ROLE_COMMUNITY
        });
        
        if (!hasCommunity) {
            throw new Error('Must have ROLE_COMMUNITY before registering as SuperPaymaster operator');
        }
        
        // 2. Check if already has role
        const ROLE_PAYMASTER_SUPER = await registry(this.getStartPublicClient()).ROLE_PAYMASTER_SUPER();
        const hasSuper = await registry(this.getStartPublicClient()).hasRole({
            user: this.getAddress(),
            roleId: ROLE_PAYMASTER_SUPER
        });
        
        if (hasSuper) {
            console.log('Already has ROLE_PAYMASTER_SUPER, skipping registration');
            
            // Still handle deposit if requested
            if (params?.depositAmount) {
                return this.depositCollateral(params.depositAmount, options);
            }
            
            throw new Error('Already registered as SuperPaymaster operator');
        }
        
        // 3. Prepare stake amount (default 50 GToken as per Registry config)
        const stakeAmount = params?.stakeAmount || (await import('viem')).parseEther('50');
        
        // 4. Check and approve GToken to GTokenStaking
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
        
        // 5. Register ROLE_PAYMASTER_SUPER
        const registerHash = await registry(this.client).registerRoleSelf({
            roleId: ROLE_PAYMASTER_SUPER,
            data: '0x', // SuperPaymaster role doesn't need special data
            account: options?.account
        });
        
        // Wait for registration to complete
        await (this.getStartPublicClient() as any).waitForTransactionReceipt({ hash: registerHash });
        
        // 6. Optional: Deposit collateral to SuperPaymaster
        if (params?.depositAmount) {
            await this.depositCollateral(params.depositAmount, options);
        }
        
        return registerHash;
    }

    /**
     * Deploy a new Paymaster V4 and Register as AOA Operator (one-stop API).
     * This method handles:
     * 1. Checks prerequisites (ROLE_COMMUNITY)
     * 2. Predicts new Paymaster address
     * 3. Deploys Paymaster V4 via Factory
     * 4. Registers ROLE_PAYMASTER_AOA with staking
     * 
     * @param params Deployment parameters
     * @param options Transaction options
     * @returns Object containing new paymaster address and transaction hashes
     */
    async deployAndRegisterPaymasterV4(params?: {
        stakeAmount?: bigint; // Optional, defaults to 30 GToken (Registry requirement for AOA)
        version?: string; // Optional, defaults to Factory default or V4.0.0
    }, options?: TransactionOptions): Promise<{ 
        paymasterAddress: Address; 
        deployHash: Hash; 
        registerHash: Hash;
    }> {
        const registryAddr = this.requireRegistry();
        const gTokenAddr = this.requireGToken();
        const gTokenStakingAddr = this.requireGTokenStaking();
        const factoryAddr = this.requirePaymasterFactory();
        
        const { registryActions, tokenActions, paymasterFactoryActions } = await import('@aastar/core');
        const registry = registryActions(registryAddr);
        const gToken = tokenActions();
        const factory = paymasterFactoryActions(factoryAddr);
        
        // Use provided account, or client's account, or address string
        // If string is used, Viem attempts eth_sendTransaction (RPC signing).
        // If object is used, Viem attempts local signing (eth_sendRawTransaction).
        const account = options?.account || this.client.account || this.getAddress();

        // 1. Check prerequisites (ROLE_COMMUNITY)
        const ROLE_COMMUNITY = await registry(this.getStartPublicClient()).ROLE_COMMUNITY();
        const hasCommunity = await registry(this.getStartPublicClient()).hasRole({
            user: typeof account === 'string' ? account : account.address,
            roleId: ROLE_COMMUNITY
        });
        
        if (!hasCommunity) {
            throw new Error('Must have ROLE_COMMUNITY before deploying Paymaster V4');
        }

        // 2. Check Deployment
        // Note: We use getPaymaster (paymasterByOperator) to check existing deployment
        // Standard deployment via deployPaymaster (EIP-1167) is non-deterministic (nonce-based)
        
        let paymasterAddress = await factory(this.getStartPublicClient()).getPaymaster({
            owner: typeof account === 'string' ? account : account.address
        });
        
        const isDeployed = paymasterAddress !== '0x0000000000000000000000000000000000000000';
        
        let deployHash: Hash = '0x0000000000000000000000000000000000000000000000000000000000000000';

        if (!isDeployed) {
            // Determine version: User param > Factory Default > Fallback V4.0.0
            let version = params?.version;
            if (!version) {
                try {
                   version = await factory(this.getStartPublicClient()).defaultVersion();
                } catch (e) {
                   console.warn('Failed to fetch default version from Factory:', e);
                }
            }
            if (!version || version === '') {
                version = 'V4.0.0'; // Ultimate fallback
            }

            console.log(`Deploying Paymaster ${version}...`);
            try {
                deployHash = await factory(this.client).deployPaymaster({
                    owner: typeof account === 'string' ? account : account.address,
                    version: version, // User requested V4.2
                    account: account
                });
            } catch (error: any) {
                if (error.message.includes('ImplementationNotFound') && version !== 'V4.0.0') {
                     console.warn(`Version ${version} not found, retrying with V4.0.0...`);
                     version = 'V4.0.0';
                     deployHash = await factory(this.client).deployPaymaster({
                        owner: typeof account === 'string' ? account : account.address,
                        version: version,
                        account: account
                    });
                } else {
                    throw error;
                }
            }
            
            await (this.getStartPublicClient() as any).waitForTransactionReceipt({ hash: deployHash });
            
            // Retrieve the new address
            paymasterAddress = await factory(this.getStartPublicClient()).getPaymaster({
                owner: typeof account === 'string' ? account : account.address
            });
            
            if (paymasterAddress === '0x0000000000000000000000000000000000000000') {
                throw new Error('Failed to retrieve Paymaster address after deployment');
            }
        } else {
            console.log(`Paymaster already deployed at ${paymasterAddress}`);
        }

        // 3. Register ROLE_PAYMASTER_AOA
        const ROLE_PAYMASTER_AOA = await registry(this.getStartPublicClient()).ROLE_PAYMASTER_AOA();
        const hasAOA = await registry(this.getStartPublicClient()).hasRole({
            user: typeof account === 'string' ? account : account.address,
            roleId: ROLE_PAYMASTER_AOA
        });

        if (hasAOA) {
            console.log('Already has ROLE_PAYMASTER_AOA, skipping registration');
            return { paymasterAddress, deployHash, registerHash: '0x0000000000000000000000000000000000000000000000000000000000000000' };
        }

        // Prepare stake (Default 30 GToken for AOA)
        const { parseEther, encodeAbiParameters, parseAbiParameters } = await import('viem');
        const stakeAmount = params?.stakeAmount || parseEther('30');
        
        // Approve GToken
        const allowance = await gToken(this.getStartPublicClient()).allowance({
            token: gTokenAddr,
            owner: typeof account === 'string' ? account : account.address,
            spender: gTokenStakingAddr
        });
        
        if (allowance < stakeAmount) {
            const approveHash = await gToken(this.client).approve({
                token: gTokenAddr,
                spender: gTokenStakingAddr,
                amount: stakeAmount * BigInt(2),
                account: account
            });
            await (this.getStartPublicClient() as any).waitForTransactionReceipt({ hash: approveHash });
        }

        // Register AOA
        // If stakeAmount > 0 and generic role, Registry expects encoded uint256 if data.length == 32
        // Or default if data is empty.
        // We will encode it explicitly to be safe if amount > minStake, or just strictly always.
        // Registry logic: if (roleData.length == 32) stakeAmount = abi.decode(roleData, (uint256));
        // So we pass 32 bytes of stakeAmount.
        
        let roleData: Hash = '0x';
        if (stakeAmount > 0) {
            roleData = encodeAbiParameters(
                parseAbiParameters('uint256'),
                [stakeAmount]
            ) as Hash;
        }

        const registerHash = await registry(this.client).registerRoleSelf({
            roleId: ROLE_PAYMASTER_AOA,
            data: roleData,
            account: account
        });
        
        await (this.getStartPublicClient() as any).waitForTransactionReceipt({ hash: registerHash });

        return {
            paymasterAddress,
            deployHash,
            registerHash
        };
    }

    /**
     * Deposit collateral (GToken/cPNTs) to SuperPaymaster.
     * This is a helper method used by registerAsSuperPaymasterOperator.
     */
    async depositCollateral(amount: bigint, options?: TransactionOptions): Promise<Hash> {
        const gTokenAddr = this.requireGToken();
        const { tokenActions, superPaymasterActions } = await import('@aastar/core');
        const gToken = tokenActions();
        const pm = superPaymasterActions(this.superPaymasterAddress);
        
        // Approve SuperPaymaster to spend GToken
        const allowance = await gToken(this.getStartPublicClient()).allowance({
            token: gTokenAddr,
            owner: this.getAddress(),
            spender: this.superPaymasterAddress
        });
        
        if (allowance < amount) {
            const approveHash = await gToken(this.client).approve({
                token: gTokenAddr,
                spender: this.superPaymasterAddress,
                amount,
                account: options?.account
            });
            await (this.getStartPublicClient() as any).waitForTransactionReceipt({ hash: approveHash });
        }
        
        // Deposit to SuperPaymaster
        return pm(this.client).deposit({
            amount,
            account: options?.account
        });
    }

    // ========================================
    // 1. 资金管理 (基于 L1 superPaymasterActions)
    // ========================================

    /**
     * Deposit ETH/Funds into SuperPaymaster for sponsoring
     */
    async deposit(amount: bigint, options?: TransactionOptions): Promise<Hash> {
        const pm = superPaymasterActions(this.superPaymasterAddress);
        
        return pm(this.client).deposit({
            amount,
            account: options?.account
        });
    }

    /**
     * Withdraw funds from SuperPaymaster
     */
    async withdraw(to: Address, amount: bigint, options?: TransactionOptions): Promise<Hash> {
        const pm = superPaymasterActions(this.superPaymasterAddress);
        
        return pm(this.client).withdrawTo({
            to,
            amount,
            account: options?.account
        });
    }

    /**
     * Get current deposit balance
     */
    async getDepositDetails(): Promise<{ deposit: bigint }> {
        // SuperPaymaster logic for checking own deposit? 
        // Typically EntryPoint.getDepositInfo
        // But PM might have its own accounting.
        // Using L1 action for PM:
        const pm = superPaymasterActions(this.superPaymasterAddress);
        const deposit = await pm(this.getStartPublicClient()).getDeposit();
        return { deposit };
    }

    /**
     * Stake ETH/Funds to register as a SuperPaymaster Operator
     */
    async stake(amount: bigint, options?: TransactionOptions): Promise<Hash> {
        const pm = superPaymasterActions(this.superPaymasterAddress);
        
        return pm(this.client).addSuperStake({
            amount,
            account: options?.account
        });
    }

    /**
     * Unstake funds (initiates withdrawal delay)
     */
    async unstake(options?: TransactionOptions): Promise<Hash> {
        const pm = superPaymasterActions(this.superPaymasterAddress);
        
        return pm(this.client).unlockSuperStake({
            account: options?.account
        });
    }

    // ========================================
    // 2. 运营配置
    // ========================================

    /**
     * Check if address is a valid operator
     */
    async isOperator(operator: Address): Promise<boolean> {
        const pm = superPaymasterActions(this.superPaymasterAddress);
        try {
            const opData = await pm(this.getStartPublicClient()).operators({ operator });
            return opData && opData.length > 0; // Assuming struct return
        } catch {
            return false;
        }
    }

    /**
     * Configure Operator parameters (Token, Treasury, Exchange Rate)
     */
    async configureOperator(xPNTsToken: Address, treasury: Address, exchangeRate: bigint, options?: TransactionOptions): Promise<Hash> {
        const pm = superPaymasterActions(this.superPaymasterAddress);
        
        return pm(this.client).configureOperator({
            xPNTsToken,
            treasury,
            exchangeRate,
            account: options?.account
        });
    }

    // ========================================
    // 3. 支付代币管理 (基于 PaymasterV4Actions)
    // ========================================

    /**
     * Add a supported Gas Token
     */
    async addGasToken(token: Address, priceFeed: Address, options?: TransactionOptions): Promise<Hash> {
        const pm = paymasterV4Actions(this.superPaymasterAddress);
        
        return pm(this.client).addGasToken({
            token,
            priceFeed,
            account: options?.account
        });
    }

    /**
     * Remove a Gas Token
     */
    async removeGasToken(token: Address, options?: TransactionOptions): Promise<Hash> {
        const pm = paymasterV4Actions(this.superPaymasterAddress);
        
        return pm(this.client).removeGasToken({
            token,
            account: options?.account
        });
    }

    /**
     * Get list of supported Gas Tokens
     */
    async getSupportedGasTokens(): Promise<Address[]> {
        const pm = paymasterV4Actions(this.superPaymasterAddress);
        return pm(this.getStartPublicClient()).getSupportedGasTokens();
    }
}
