import { type Address, type Hash, type Hex, concat, pad, toHex, encodeFunctionData } from 'viem';
import { BaseClient, type ClientConfig, type TransactionOptions } from '@aastar/core';
import { accountActions, sbtActions, tokenActions, entryPointActions, stakingActions, registryActions, paymasterActions, superPaymasterActions } from '@aastar/core';
import { bundlerActions, type UserOperation, getUserOperationHash } from 'viem/account-abstraction';

export interface UserClientConfig extends ClientConfig {
    accountAddress: Address; // The AA account address
    sbtAddress?: Address;
    entryPointAddress?: Address;
    superPaymasterAddress?: Address; // For sponsorship queries
    gTokenStakingAddress?: Address; // For staking/investing
    registryAddress?: Address; // For role management
    gTokenAddress?: Address; // For fee payment approval
    bundlerClient?: any;
}

export class UserClient extends BaseClient {
    public accountAddress: Address;
    public sbtAddress?: Address;
    public entryPointAddress?: Address;
    public gTokenStakingAddress?: Address;
    public registryAddress?: Address;
    public gTokenAddress?: Address;
    public bundlerClient?: any;

    constructor(config: UserClientConfig) {
        super(config);
        this.bundlerClient = config.bundlerClient;
        this.accountAddress = config.accountAddress;
        this.sbtAddress = config.sbtAddress;
        this.entryPointAddress = config.entryPointAddress;
        this.gTokenStakingAddress = config.gTokenStakingAddress;
        this.registryAddress = config.registryAddress;
        this.gTokenAddress = config.gTokenAddress;
    }

    /**
     * Deploy a new Smart Account (Supports multiple factory types)
     * Static helper to facilitate onboarding before instantiating the UserClient.
     * 
     * @param client - WalletClient to sign the deployment transaction
     * @param params - Deployment parameters
     * @returns Object containing the deployed account address and transaction hash
     */
    static async deployAccount(
        client: any, 
        params: {
            owner: Address;
            salt?: bigint;
            factoryAddress?: Address;
            publicClient?: any;
            accountType?: 'simple' | 'kernel' | 'safe' | string;
            customAbi?: any;
        }
    ): Promise<{ accountAddress: Address; hash: Hash }> {
        const { accountFactoryActions, SimpleAccountFactoryABI } = await import('@aastar/core');
        
        // 1. Determine Factory ABI (Ensure it's the raw ABI array)
        let abi = params.customAbi || (SimpleAccountFactoryABI?.abi || SimpleAccountFactoryABI);
        
        // In the future, we can add more built-in ABIs here based on accountType
        // if (params.accountType === 'kernel') abi = KernelFactoryABI;
        
        const factoryAddr = params.factoryAddress || '0x9406Cc6185a346906296840746125a0E44976454'; // Default v0.7 Factory
        const salt = params.salt || 0n;
        
        // Use publicClient for reading if provided, otherwise fallback to client (which might be a Full Client)
        const readClient = params.publicClient || client;
        
        // Use the generic actions with the selected ABI
        const factoryRead = accountFactoryActions(factoryAddr, abi)(readClient);
        const factoryWrite = accountFactoryActions(factoryAddr, abi)(client);
        
        // 1. Predict Address
        const accountAddress = await factoryRead.getAddress({
            owner: params.owner,
            salt
        });

        // 2. Deploy
        try {
            const hash = await factoryWrite.createAccount({
                owner: params.owner,
                salt,
                account: client.account
            });
            return { accountAddress, hash };
        } catch (error: any) {
            throw error;
        }
    }

    // ========================================
    // 1. 账户基本操作 (基于 L1 simpleAccountActions)
    // ========================================

    /**
     * Get the nonce of the account from EntryPoint (more reliable for 4337)
     */
    async getNonce(key: bigint = 0n): Promise<bigint> {
        try {
            if (!this.entryPointAddress) {
                throw new Error('EntryPoint address required for this client');
            }
            const entryPoint = entryPointActions(this.entryPointAddress);
            return await entryPoint(this.getStartPublicClient()).getNonce({
                sender: this.accountAddress,
                key
            });
        } catch (error) {
            throw error;
        }
    }

    /**
     * Get the owner of the AA account
     */
    async getOwner(): Promise<Address> {
        try {
            const account = accountActions(this.accountAddress);
            return await account(this.getStartPublicClient()).owner();
        } catch (error) {
            throw error;
        }
    }

    /**
     * Execute a transaction from the AA account
     */
    async execute(target: Address, value: bigint, data: Hex, options?: TransactionOptions): Promise<Hash> {
        try {
            const account = accountActions(this.accountAddress);
            
            // Use standard AA execute
            return await account(this.client).execute({
                dest: target,
                value,
                func: data,
                account: options?.account
            });
        } catch (error) {
            throw error;
        }
    }

    /**
     * Execute a batch of transactions
     */
    async executeBatch(targets: Address[], values: bigint[], datas: Hex[], options?: TransactionOptions): Promise<Hash> {
        try {
            const account = accountActions(this.accountAddress);
            
            return await account(this.client).executeBatch({
                dest: targets,
                value: values,
                func: datas,
                account: options?.account
            });
        } catch (error) {
            throw error;
        }
    }

    // ========================================
    // identity 与 SBT (基于 L1 sbtActions)
    // ========================================

    /**
     * Get user's SBT balance
     */
    async getSBTBalance(): Promise<bigint> {
        try {
            if (!this.sbtAddress) throw new Error('SBT address required for this client');
            const sbt = sbtActions(this.sbtAddress);
            
            return await sbt(this.getStartPublicClient()).balanceOf({
                owner: this.accountAddress
            });
        } catch (error) {
            throw error;
        }
    }

    async mintSBT(roleId: Hex, options?: TransactionOptions): Promise<Hash> {
        try {
            if (!this.sbtAddress) throw new Error('SBT address required for this client');
            const { encodeFunctionData } = await import('viem');
            
            const data = encodeFunctionData({
                abi: [{ name: 'mintForRole', type: 'function', inputs: [{ name: 'user', type: 'address' }, { name: 'roleId', type: 'bytes32' }, { name: 'roleData', type: 'bytes' }], outputs: [{ type: 'uint256' }] }],
                functionName: 'mintForRole',
                args: [this.accountAddress, roleId, '0x']
            });

            return await this.execute(this.sbtAddress, 0n, data, options);
        } catch (error) {
            throw error;
        }
    }

    // ========================================
    // 3. 资产管理 (基于 L1 tokenActions)
    // ========================================

    async transferToken(token: Address, to: Address, amount: bigint, options?: TransactionOptions): Promise<Hash> {
        try {
            const { encodeFunctionData } = await import('viem');
            const data = encodeFunctionData({
                abi: [{ name: 'transfer', type: 'function', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] }],
                functionName: 'transfer',
                args: [to, amount]
            });

            return await this.execute(token, 0n, data, options);
        } catch (error) {
            throw error;
        }
    }

    /**
     * Get Token Balance
     */
    async getTokenBalance(token: Address): Promise<bigint> {
        try {
            const tokens = tokenActions()(this.getStartPublicClient());
            
            return await tokens.balanceOf({
                token,
                account: this.accountAddress
            });
        } catch (error) {
            throw error;
        }
    }

    // ========================================
    // 4. 委托与质押 (Delegation & Staking)
    // ========================================

    async stakeForRole(roleId: Hex, amount: bigint, options?: TransactionOptions): Promise<Hash> {
        try {
            if (!this.gTokenStakingAddress) throw new Error('GTokenStaking address required for this client');
            const { encodeFunctionData } = await import('viem');
            
            const data = encodeFunctionData({
                abi: [{ name: 'lockStake', type: 'function', inputs: [{ name: 'user', type: 'address' }, { name: 'roleId', type: 'bytes32' }, { name: 'stakeAmount', type: 'uint256' }, { name: 'entryBurn', type: 'uint256' }, { name: 'payer', type: 'address' }], outputs: [] }],
                functionName: 'lockStake',
                args: [this.accountAddress, roleId, amount, 0n, this.accountAddress]
            });

            return await this.execute(this.gTokenStakingAddress, 0n, data, options);
        } catch (error) {
            throw error;
        }
    }

    async unstakeFromRole(roleId: Hex, options?: TransactionOptions): Promise<Hash> {
        try {
            if (!this.gTokenStakingAddress) throw new Error('GTokenStaking address required for this client');
            const { encodeFunctionData } = await import('viem');
            
            const data = encodeFunctionData({
                abi: [{ name: 'unlockAndTransfer', type: 'function', inputs: [{ name: 'user', type: 'address' }, { name: 'roleId', type: 'bytes32' }], outputs: [{ name: 'netAmount', type: 'uint256' }] }],
                functionName: 'unlockAndTransfer',
                args: [this.accountAddress, roleId]
            });

            return await this.execute(this.gTokenStakingAddress, 0n, data, options);
        } catch (error) {
            throw error;
        }
    }

    /**
     * Get staked balance for a specific role
     */
    async getStakedBalance(roleId: Hex): Promise<bigint> {
        try {
            if (!this.gTokenStakingAddress) throw new Error('GTokenStaking address required for this client');
            const staking = stakingActions(this.gTokenStakingAddress);
            
            return await staking(this.getStartPublicClient()).getLockedStake({
                user: this.accountAddress,
                roleId
            });
        } catch (error) {
            throw error;
        }
    }

    // ========================================
    // 5. 生命周期管理 (Lifecycle)
    // ========================================

    async exitRole(roleId: Hex, options?: TransactionOptions): Promise<Hash> {
        try {
            if (!this.registryAddress) throw new Error('Registry address required for this client');
            const { encodeFunctionData } = await import('viem');
            
            const data = encodeFunctionData({
                abi: [{ name: 'exitRole', type: 'function', inputs: [{ name: 'roleId', type: 'bytes32' }], outputs: [] }],
                functionName: 'exitRole',
                args: [roleId]
            });

            return await this.execute(this.registryAddress, 0n, data, options);
        } catch (error) {
            throw error;
        }
    }

    async leaveCommunity(community: Address, options?: TransactionOptions): Promise<Hash> {
        try {
            if (!this.sbtAddress) throw new Error('SBT address required for this client');
            const { encodeFunctionData } = await import('viem');
            
            const data = encodeFunctionData({
                abi: [{ name: 'leaveCommunity', type: 'function', inputs: [{ name: 'comm', type: 'address' }], outputs: [] }],
                functionName: 'leaveCommunity',
                args: [community]
            });

            return await this.execute(this.sbtAddress, 0n, data, options);
        } catch (error) {
            throw error;
        }
    }

    /**
     * Register as EndUser (One-click: Approve + Register)
     * Handles GToken approval to Staking contract and Role registration.
     */
    async registerAsEndUser(communityAddress: Address, stakeAmount: bigint, options?: TransactionOptions): Promise<Hash> {
        try {
            if (!this.registryAddress) throw new Error('Registry address required for this client');
            if (!this.gTokenStakingAddress) throw new Error('GTokenStaking address required for this client');
            if (!this.gTokenAddress) throw new Error('GToken address required for this client');

            const { encodeAbiParameters, keccak256, toBytes, parseEther } = await import('viem');
            const ROLE_ENDUSER = keccak256(toBytes("ENDUSER"));
            // Correct mapping for Registry Actions
            const registry = registryActions(this.registryAddress);
            const publicClient = this.getStartPublicClient();
            const tokens = tokenActions()(publicClient);

            // 1. Check Allowance
            const allowance = await tokens.allowance({
                token: this.gTokenAddress,
                owner: this.accountAddress,
                spender: this.gTokenStakingAddress
            });
            console.log(`   🔍 Debug Allowance: Account=${this.accountAddress}, Allowance=${allowance}, Needed=${stakeAmount}`);
            
            const txs: { target: Address, value: bigint, data: Hex }[] = [];

            if (allowance < stakeAmount) {
                 const approveData = encodeFunctionData({
                     abi: [{name:'approve', type:'function', inputs:[{type:'address'},{type:'uint256'}], outputs:[{type:'bool'}], stateMutability:'nonpayable'}],
                     functionName: 'approve',
                     args: [this.gTokenStakingAddress, parseEther('1000')]
                 });
                 txs.push({ target: this.gTokenAddress, value: 0n, data: approveData });
            }

            // 2. Construct Register Call
            // struct EndUserRoleData { address account; address community; string avatarURI; string ensName; uint256 stakeAmount; }
            const roleData = encodeAbiParameters(
                [
                    { type: 'address', name: 'account' },
                    { type: 'address', name: 'community' },
                    { type: 'string', name: 'avatarURI' },
                    { type: 'string', name: 'ensName' },
                    { type: 'uint256', name: 'stakeAmount' }
                ],
                [
                    this.accountAddress,
                    communityAddress,
                    '',
                    '',
                    stakeAmount
                ]
            );

            const registerData = encodeFunctionData({
                abi: [{ name: 'registerRoleSelf', type: 'function', inputs: [{type:'bytes32'}, {type:'bytes'}], outputs: [{type:'uint256'}], stateMutability: 'nonpayable' }],
                functionName: 'registerRoleSelf',
                args: [ROLE_ENDUSER, roleData]
            });
            
            txs.push({ target: this.registryAddress, value: 0n, data: registerData });
            
            console.log(`   🔍 Debug Onboard: Community=${communityAddress}, AA=${this.accountAddress}, Stake=${stakeAmount}`);
            console.log(`   🔍 Debug Batch: Txs=${txs.length}, Targets=${txs.map(t => t.target)}`);

            // 3. Execute separately for stability (Batch execution has issues on current AA deployment)
            const hashes: Hash[] = [];
            for (const tx of txs) {
                const h = await this.execute(tx.target, tx.value, tx.data, options);
                hashes.push(h);
                // Wait for each tx to ensure sequential state updates (approve -> register)
                await (this.getStartPublicClient() as any).waitForTransactionReceipt({ hash: h });
            }
            return hashes[hashes.length - 1];
        } catch (error) {
            throw error;
        }
    }

    // ========================================
    // 6. Gasless Execution (Advanced)
    // ========================================

    /**
     * Execute a transaction with Gasless Sponsorship
     */
    async executeGasless(params: {
        target: Address;
        value: bigint;
        data: Hex;
        paymaster: Address;
        paymasterType: 'V4' | 'Super';
        operator?: Address; // Added for SuperPaymaster
        maxRate?: bigint;   // Added for SuperPaymaster
    }, options?: TransactionOptions): Promise<Hash> {
        try {
            const client = this.bundlerClient ? this.bundlerClient.extend(bundlerActions) : (this.client as any).extend(bundlerActions);
            
            const ep = this.requireEntryPoint();
            
            // 1. Prepare Call Data
            const callData = encodeFunctionData({
                abi: [{ name: 'execute', type: 'function', inputs: [{ name: 'dest', type: 'address' }, { name: 'value', type: 'uint256' }, { name: 'func', type: 'bytes' }], outputs: [] }],
                functionName: 'execute',
                args: [params.target, params.value, params.data]
            });

            // 3. Delegate to PaymasterClient for v0.7 Gasless Submission
            // This ensures we follow the exact same logic as successful demo scripts
            // We dynamic import to avoid circular dependencies if any
            const { PaymasterClient: SDKPaymasterClient } = await import('@aastar/paymaster');
            
            let verificationGasLimit: bigint | undefined;
            let paymasterVerificationGasLimit: bigint | undefined;
            let paymasterPostOpGasLimit: bigint | undefined;
            let autoEstimate = true;

            if (params.paymasterType === 'Super') {
                // Apply Smart Buffer Strategy via PaymasterUtils (Same as SuperPaymasterClient)
                const { tuneGasLimit } = await import('../../paymaster/src/V4/PaymasterUtils.js');
                
                const est = await SDKPaymasterClient.estimateUserOperationGas(
                    this.client,
                    this.client, 
                    this.accountAddress,
                    ep,
                    params.paymaster,
                    params.target, // placeholder
                    this.bundlerClient?.transport?.url || (this.client.transport as any).url || '', 
                    callData,
                    {
                        operator: params.operator,
                        factory: undefined,
                        factoryData: undefined
                    }
                );
                
                // Matches SuperPaymasterClient Logic exactly:
                const bundlerEstimate = est.paymasterVerificationGasLimit || 100000n;
                // Nominal 60k, Efficiency 0.45
                paymasterVerificationGasLimit = tuneGasLimit(bundlerEstimate, 60_000n, 0.45);
                
                // Safety Pad for VGL (Moderate, not 1M)
                const SAFETY_PAD = 80000n;
                verificationGasLimit = est.verificationGasLimit + SAFETY_PAD;
                
                // PostOp Tuning
                paymasterPostOpGasLimit = est.paymasterPostOpGasLimit + 10000n;
                
                autoEstimate = false; // logic handled
            }

            const txHash = await SDKPaymasterClient.submitGaslessUserOperation(
                this.client,
                this.client, // WalletClient acts as signer
                this.accountAddress,
                ep,
                params.paymaster,
                params.target, // placeholder for token if V4
                this.bundlerClient?.transport?.url || (this.client.transport as any).url || '', 
                callData,
                {
                    operator: params.operator,
                    autoEstimate, 
                    verificationGasLimit,
                    paymasterVerificationGasLimit,
                    paymasterPostOpGasLimit
                }
            );

            return txHash;
        } catch (error: any) {
            console.error("   ❌ executeGasless Error:", error.message);
            throw error;
        }
    }
}
