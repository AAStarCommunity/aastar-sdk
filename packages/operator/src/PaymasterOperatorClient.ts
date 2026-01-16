import { type Address, type Hash, parseEther } from 'viem';
import { BaseClient, type ClientConfig, type TransactionOptions, PaymasterABI } from '@aastar/core';
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
        salt?: bigint; // Optional, for deterministic deployment
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

        // 2. Direct Deployment (PMV4-Hybrid)
        // No legacy factory check. Always deploy new instance directly via Factory.
        
        let deployHash: Hash;
        let paymasterAddress: Address;

        // Restore missing variables
        // const { parseEther } = await import('viem'); // Use top-level import
        const ownerAddr = typeof account === 'string' ? account : account.address;
        const treasuryAddr = ownerAddr;
        
        // Resolve xPNTs Factory
        const xpntsFactory = this.xpntsFactory !== '0x0000000000000000000000000000000000000000' 
            ? this.xpntsFactory 
            : factoryAddr; 

        try {
            // Encode initialize data
            const { encodeFunctionData, parseEther } = await import('viem');
            const initData = encodeFunctionData({
                abi: PaymasterABI,
                functionName: 'initialize',
                args: [
                    '0x0000000071727De22E5E9d8BAf0edAc6f37da032', // EntryPoint v0.7
                    ownerAddr,
                    treasuryAddr,
                    this.ethUsdPriceFeed,
                    200n, // serviceFeeRate (2%)
                    parseEther('0.1'), // maxGasCostCap
                    3600n // priceStalenessThreshold
                ]
            });

            console.log(`Using PaymasterFactory at ${factoryAddr} to deploy...`);
            
            // Use PaymasterFactory
            deployHash = await factory(this.client).deployPaymaster({
                owner: ownerAddr, // Required by action interface
                version: params?.version, 
                initData,
                account
            });
            
            const receipt = await (this.getStartPublicClient() as any).waitForTransactionReceipt({ hash: deployHash });
            
            // Fallback: Query factory for our paymaster
            // Use getPaymaster action (which maps to paymasterByOperator in contract)
            paymasterAddress = await factory(this.getStartPublicClient()).getPaymaster({ owner: ownerAddr });
            
            if (!paymasterAddress || paymasterAddress === '0x0000000000000000000000000000000000000000') {
                 throw new Error('Failed to retrieve Paymaster address from Factory');
            }

            console.log('✅ Paymaster Deployed at:', paymasterAddress);
        } catch (e: any) {
             throw new Error(`Paymaster Deployment Failed: ${e.message}`);
        }
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
        const { encodeAbiParameters, parseAbiParameters } = await import('viem');
        // stakeAmount uses top-level parseEther
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
     * Deposit collateral (aPNTs/GToken) to SuperPaymaster.
     * This is a helper method used by registerAsSuperPaymasterOperator.
     */
    async depositCollateral(amount: bigint, options?: TransactionOptions): Promise<Hash> {
        const { tokenActions, superPaymasterActions } = await import('@aastar/core');
        const pm = superPaymasterActions(this.superPaymasterAddress);
        
        // V3.7: Dynamically fetch the token expected by SuperPaymaster
        const depositToken = await pm(this.getStartPublicClient()).APNTS_TOKEN();
        const token = tokenActions();
        
        // Approve SuperPaymaster to spend the token (usually aPNTs on Sepolia)
        const allowance = await token(this.getStartPublicClient()).allowance({
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
    /**
     * Setup Paymaster V4 Configuration (Add SBT and GasToken)
     * @param params configuration parameters
     */
    async setupPaymasterV4(params: {
        paymaster: Address;
        sbt: Address;
        gasToken: Address;
        priceFeed: Address;
    }): Promise<void> {
        const { paymasterV4Actions } = await import('@aastar/core');
        
        // Use Public Client for Reads
        const pmRead = paymasterV4Actions(params.paymaster)(this.getStartPublicClient());
        // Use Wallet Client for Writes (this.client)
        const pmWrite = paymasterV4Actions(params.paymaster)(this.client);
        
        // 1. Add SBT
        const isSbtSupported = await pmRead.isSBTSupported({ sbt: params.sbt });
        if (!isSbtSupported) {
            console.log(`Adding SBT ${params.sbt} to Paymaster...`);
            const hash = await pmWrite.addSBT({ sbt: params.sbt, account: this.client.account });
            await (this.getStartPublicClient() as any).waitForTransactionReceipt({ hash });
            console.log('SBT Added.');
        } else {
            console.log(`SBT ${params.sbt} already supported.`);
        }

        // 2. Add GasToken
        const isTokenSupported = await pmRead.isGasTokenSupported({ token: params.gasToken });
        if (!isTokenSupported) {
            console.log(`Adding GasToken ${params.gasToken} to Paymaster...`);
            const hash = await pmWrite.addGasToken({ 
                token: params.gasToken, 
                priceFeed: params.priceFeed,
                account: this.client.account 
            });
            await (this.getStartPublicClient() as any).waitForTransactionReceipt({ hash });
            console.log('GasToken Added.');
        } else {
             console.log(`GasToken ${params.gasToken} already supported.`);
        }
    }
}
