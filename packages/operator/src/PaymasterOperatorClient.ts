import { type Address, type Hash, parseEther } from 'viem';
import { BaseClient, type ClientConfig, type TransactionOptions, PaymasterABI } from '@aastar/core';
import { superPaymasterActions, tokenActions, paymasterActions, registryActions, paymasterFactoryActions } from '@aastar/core';

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
    public ethUsdPriceFeed: Address;
    public xpntsFactory: Address;

    constructor(config: OperatorClientConfig) {
        super(config);
        this.superPaymasterAddress = config.superPaymasterAddress;
        this.tokenAddress = config.tokenAddress;
        this.ethUsdPriceFeed = config.ethUsdPriceFeedAddress || '0x694AA1769357215DE4FAC081bf1f309aDC325306'; // Default Sepolia
        this.xpntsFactory = config.xpntsFactoryAddress || '0x0000000000000000000000000000000000000000'; // Should be provided
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
        try {
            const registryAddr = this.requireRegistry();
            const gTokenAddr = this.requireGToken();
            const gTokenStakingAddr = this.requireGTokenStaking();
            
            const registry = registryActions(registryAddr);
            const gToken = tokenActions();
            const publicClient = this.getStartPublicClient();
            
            // 1. Check prerequisites
            const ROLE_COMMUNITY = await registry(publicClient).ROLE_COMMUNITY();
            const hasCommunity = await registry(publicClient).hasRole({
                user: this.getAddress(),
                roleId: ROLE_COMMUNITY
            });
            
            if (!hasCommunity) {
                throw new Error('Must have ROLE_COMMUNITY before registering as SuperPaymaster operator');
            }
            
            // 2. Check if already has role
            const ROLE_PAYMASTER_SUPER = await registry(publicClient).ROLE_PAYMASTER_SUPER();
            const hasSuper = await registry(publicClient).hasRole({
                user: this.getAddress(),
                roleId: ROLE_PAYMASTER_SUPER
            });
            
            if (hasSuper) {
                // Still handle deposit if requested
                if (params?.depositAmount) {
                    return this.depositCollateral(params.depositAmount, options);
                }
                throw new Error('Already registered as SuperPaymaster operator');
            }
            
            // 3. Prepare stake amount (default 50 GToken as per Registry config)
            const stakeAmount = params?.stakeAmount || parseEther('50');
            
            // 4. Check and approve GToken to GTokenStaking
            const allowance = await gToken(publicClient).allowance({
                token: gTokenAddr,
                owner: this.getAddress(),
                spender: gTokenStakingAddr
            });
            
            if (allowance < stakeAmount) {
                const approveHash = await gToken(this.client).approve({
                    token: gTokenAddr,
                    spender: gTokenStakingAddr,
                    amount: stakeAmount * 2n, // Approve 2x for future use
                    account: options?.account
                });
                await (publicClient as any).waitForTransactionReceipt({ hash: approveHash });
            }
            
            // 5. Register ROLE_PAYMASTER_SUPER
            const registerHash = await registry(this.client).registerRoleSelf({
                roleId: ROLE_PAYMASTER_SUPER,
                data: '0x', // SuperPaymaster role doesn't need special data
                account: options?.account
            });
            
            // Wait for registration to complete
            await (publicClient as any).waitForTransactionReceipt({ hash: registerHash });
            
            // 6. Optional: Deposit collateral to SuperPaymaster
            if (params?.depositAmount) {
                await this.depositCollateral(params.depositAmount, options);
            }
            
            return registerHash;
        } catch (error) {
            throw error;
        }
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
        salt?: bigint; // Optional, for deterministic deployment
    }, options?: TransactionOptions): Promise<{ 
        paymasterAddress: Address; 
        deployHash: Hash; 
        registerHash: Hash;
    }> {
        try {
            const registryAddr = this.requireRegistry();
            const gTokenAddr = this.requireGToken();
            const gTokenStakingAddr = this.requireGTokenStaking();
            const factoryAddr = this.requirePaymasterFactory();
            
            const registry = registryActions(registryAddr);
            const gToken = tokenActions();
            const factory = paymasterFactoryActions(factoryAddr);
            const publicClient = this.getStartPublicClient();
            
            const account = options?.account || this.client.account || this.getAddress();
            const accountAddr = typeof account === 'string' ? account : account.address;

            // 1. Check prerequisites (ROLE_COMMUNITY)
            const ROLE_COMMUNITY = await registry(publicClient).ROLE_COMMUNITY();
            const hasCommunity = await registry(publicClient).hasRole({
                user: accountAddr,
                roleId: ROLE_COMMUNITY
            });
            
            if (!hasCommunity) {
                throw new Error('Must have ROLE_COMMUNITY before deploying Paymaster V4');
            }

            // 2. Deployment (Idempotent Check)
            const existingPaymaster = await factory(publicClient).getPaymaster({ owner: accountAddr });
            let deployHash: Hash = '0x0000000000000000000000000000000000000000000000000000000000000000';
            let paymasterAddress: Address;

            if (existingPaymaster && existingPaymaster !== '0x0000000000000000000000000000000000000000') {
                console.log(`    ℹ️  Paymaster already deployed at: ${existingPaymaster}`);
                paymasterAddress = existingPaymaster;
            } else {
                console.log('    🛠️ Deploying Paymaster V4 with args:', {
                    entryPoint: this.requireEntryPoint(),
                    owner: accountAddr,
                    priceFeed: this.ethUsdPriceFeed,
                    factory: factoryAddr
                });

                const { encodeFunctionData } = await import('viem');
                const initData = encodeFunctionData({
                    abi: PaymasterABI,
                    functionName: 'initialize',
                    args: [
                        this.requireEntryPoint(), // EntryPoint v0.7
                        accountAddr,
                        accountAddr, // Treasury defaults to owner
                        this.ethUsdPriceFeed,
                        200n, // serviceFeeRate (2%)
                        parseEther('0.1'), // maxGasCostCap
                        3600n // priceStalenessThreshold
                    ]
                });

                deployHash = await factory(this.client).deployPaymaster({
                    owner: accountAddr,
                    version: params?.version, 
                    initData,
                    account
                });
                
                await (publicClient as any).waitForTransactionReceipt({ hash: deployHash });
                
                paymasterAddress = await factory(publicClient).getPaymaster({ owner: accountAddr });
            }
            
            if (!paymasterAddress || paymasterAddress === '0x0000000000000000000000000000000000000000') {
                 throw new Error('Failed to retrieve Paymaster address from Factory');
            }

            // 3. Register ROLE_PAYMASTER_AOA
            const ROLE_PAYMASTER_AOA = await registry(publicClient).ROLE_PAYMASTER_AOA();
            const hasAOA = await registry(publicClient).hasRole({
                user: accountAddr,
                roleId: ROLE_PAYMASTER_AOA
            });

            if (hasAOA) {
                return { paymasterAddress, deployHash, registerHash: '0x0000000000000000000000000000000000000000000000000000000000000000' };
            }

            const stakeAmount = params?.stakeAmount || parseEther('30');
            
            const allowance = await gToken(publicClient).allowance({
                token: gTokenAddr,
                owner: accountAddr,
                spender: gTokenStakingAddr
            });
            
            if (allowance < stakeAmount) {
                const approveHash = await gToken(this.client).approve({
                    token: gTokenAddr,
                    spender: gTokenStakingAddr,
                    amount: stakeAmount * 2n,
                    account: account
                });
                await (publicClient as any).waitForTransactionReceipt({ hash: approveHash });
            }

            const { encodeAbiParameters, parseAbiParameters } = await import('viem');
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
            
            await (publicClient as any).waitForTransactionReceipt({ hash: registerHash });

            return {
                paymasterAddress,
                deployHash,
                registerHash
            };
        } catch (error) {
            throw error;
        }
    }

    /**
     * Deposit collateral (aPNTs/GToken) to SuperPaymaster.
     * This is a helper method used by registerAsSuperPaymasterOperator.
     */
    async depositCollateral(amount: bigint, options?: TransactionOptions): Promise<Hash> {
        try {
            const pm = superPaymasterActions(this.superPaymasterAddress);
            const publicClient = this.getStartPublicClient();
            
            // V3.7: Dynamically fetch the token expected by SuperPaymaster
            const depositToken = await pm(publicClient).APNTS_TOKEN();
            const token = tokenActions();
            
            // Approve SuperPaymaster to spend the token (usually aPNTs on Sepolia)
            const allowance = await token(publicClient).allowance({
                token: depositToken,
                owner: this.getAddress(),
                spender: this.superPaymasterAddress
            });
            
            if (allowance < amount) {
                const approveHash = await token(this.client).approve({
                    token: depositToken,
                    spender: this.superPaymasterAddress,
                    amount,
                    account: options?.account
                });
                await (publicClient as any).waitForTransactionReceipt({ hash: approveHash });
            }
            
            // Deposit to SuperPaymaster
            return pm(this.client).deposit({
                amount,
                account: options?.account
            });
        } catch (error) {
            throw error;
        }
    }

    async updateExchangeRate(exchangeRate: bigint, options?: TransactionOptions): Promise<Hash> {
        return this.configureOperator(undefined, undefined, exchangeRate, options);
    }

    /**
     * Configure operator parameters (Token, Treasury, Exchange Rate).
     * If parameters are undefined, existing values are preserved.
     */
    async configureOperator(
        xPNTsToken?: Address, 
        treasury?: Address, 
        exchangeRate?: bigint, 
        options?: TransactionOptions
    ): Promise<Hash> {
        try {
            const sp = superPaymasterActions(this.superPaymasterAddress);
            const publicClient = this.getStartPublicClient();

            // Fetch current config to preserve missing values
            const currentConfig = await sp(publicClient).operators({ operator: this.getAddress() });
            
            // [balance, token, treasury, rate]
            const currentToken = currentConfig[1] as Address;
            const currentTreasury = currentConfig[2] as Address;
            const currentRate = currentConfig[3] as bigint;

            return await sp(this.client).configureOperator({
                xPNTsToken: xPNTsToken || currentToken,
                treasury: treasury || currentTreasury,
                exchangeRate: exchangeRate ?? currentRate,
                account: options?.account
            });
        } catch (error) {
            throw error;
        }
    }

    async withdrawCollateral(to: Address, amount: bigint, options?: TransactionOptions): Promise<Hash> {
        try {
            const sp = superPaymasterActions(this.superPaymasterAddress);
            return await sp(this.client).withdrawTo({
                to,
                amount,
                account: options?.account
            });
        } catch (error) {
            throw error;
        }
    }

    async isOperator(operator: Address): Promise<boolean> {
        try {
            const sp = superPaymasterActions(this.superPaymasterAddress);
            const config = await sp(this.getStartPublicClient()).operators({ operator });
            // Assuming if Treasury is set, it's a valid operator (or check Registry role)
            // Or based on balance? 
            // Better to check Registry for ROLE_PAYMASTER_SUPER
            // But let's return true if config exists (non-zero treasury)
            return config[2] !== '0x0000000000000000000000000000000000000000';
        } catch (error) {
            return false;
        }
    }

    async getOperatorDetails(operator?: Address): Promise<any> {
        try {
            const target = operator || this.getAddress();
            const sp = superPaymasterActions(this.superPaymasterAddress);
            return await sp(this.getStartPublicClient()).operators({ operator: target });
        } catch (error) {
            throw error;
        }
    }

    async initiateExit(options?: TransactionOptions): Promise<Hash> {
        try {
            const sp = superPaymasterActions(this.superPaymasterAddress);
            return await sp(this.client).unlockSuperStake({
                account: options?.account
            });
        } catch (error) {
            throw error;
        }
    }

    async withdrawStake(to: Address, options?: TransactionOptions): Promise<Hash> {
        try {
            const sp = superPaymasterActions(this.superPaymasterAddress);
            return await sp(this.client).withdrawStake({
                to,
                account: options?.account
            });
        } catch (error) {
            throw error;
        }
    }

    // ========================================
    // 3. 支付代币管理 (基于 PaymasterActions)
    // ========================================

    async addGasToken(token: Address, price: bigint, options?: TransactionOptions): Promise<Hash> {
        try {
            const pm = paymasterActions(this.superPaymasterAddress);
            return await pm(this.client).setTokenPrice({
                token,
                price,
                account: options?.account
            });
        } catch (error) {
            throw error;
        }
    }

    async getTokenPrice(token: Address): Promise<bigint> {
        try {
            const pm = paymasterActions(this.superPaymasterAddress);
            return await pm(this.getStartPublicClient()).tokenPrices({ token });
        } catch (error) {
            throw error;
        }
    }

    async setupPaymasterDeposit(params: {
        paymaster: Address;
        user: Address;
        token: Address;
        amount: bigint;
    }, options?: TransactionOptions): Promise<Hash> {
        try {
            const pm = paymasterActions(params.paymaster);
            return await pm(this.client).depositFor({
                user: params.user,
                token: params.token,
                amount: params.amount,
                account: options?.account
            });
        } catch (error) {
            throw error;
        }
    }
}
