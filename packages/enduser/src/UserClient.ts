import { type Address, type Hash, type Hex } from 'viem';
import { BaseClient, type ClientConfig, type TransactionOptions } from '@aastar/core';
import { accountActions, sbtActions, tokenActions, entryPointActions, stakingActions, registryActions, paymasterActions, superPaymasterActions } from '@aastar/core';
import { bundlerActions, type UserOperation, getUserOperationHash } from 'viem/account-abstraction';
import { encodeFunctionData } from 'viem';

export interface UserClientConfig extends ClientConfig {
    accountAddress: Address; // The AA account address
    sbtAddress?: Address;
    entryPointAddress?: Address;
    superPaymasterAddress?: Address; // For sponsorship queries
    gTokenStakingAddress?: Address; // For staking/investing
    registryAddress?: Address; // For role management
    gTokenAddress?: Address; // For fee payment approval
}

export class UserClient extends BaseClient {
    public accountAddress: Address;
    public sbtAddress?: Address;
    public entryPointAddress?: Address;
    public gTokenStakingAddress?: Address;
    public registryAddress?: Address;
    public gTokenAddress?: Address;

    constructor(config: UserClientConfig) {
        super(config);
        this.accountAddress = config.accountAddress;
        this.sbtAddress = config.sbtAddress;
        this.entryPointAddress = config.entryPointAddress;
        this.gTokenStakingAddress = config.gTokenStakingAddress;
        this.registryAddress = config.registryAddress;
        this.gTokenAddress = config.gTokenAddress;
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

    /**
     * Self-mint SBT for a role (user self-service)
     */
    async mintSBT(roleId: Hex, options?: TransactionOptions): Promise<Hash> {
        try {
            if (!this.sbtAddress) throw new Error('SBT address required for this client');
            const sbt = sbtActions(this.sbtAddress);
            
            return await sbt(this.client).mintForRole({
                user: this.accountAddress,
                roleId,
                roleData: '0x',
                account: options?.account
            });
        } catch (error) {
            throw error;
        }
    }

    // ========================================
    // 3. 资产管理 (基于 L1 tokenActions)
    // ========================================

    /**
     * Transfer GToken or any ERC20
     */
    async transferToken(token: Address, to: Address, amount: bigint, options?: TransactionOptions): Promise<Hash> {
        try {
            const tokens = tokenActions()(this.client);
            
            return await tokens.transfer({
                token,
                to,
                amount,
                account: options?.account
            });
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

    /**
     * Delegate stake to a role (Delegate to an operator/community)
     */
    async stakeForRole(roleId: Hex, amount: bigint, options?: TransactionOptions): Promise<Hash> {
        try {
            if (!this.gTokenStakingAddress) throw new Error('GTokenStaking address required for this client');
            const staking = stakingActions(this.gTokenStakingAddress);
            
            return await staking(this.client).lockStake({
                user: this.accountAddress,
                roleId,
                stakeAmount: amount,
                entryBurn: 0n,
                payer: this.accountAddress,
                account: options?.account
            });
        } catch (error) {
            throw error;
        }
    }

    /**
     * Unstake from a role
     */
    async unstakeFromRole(roleId: Hex, options?: TransactionOptions): Promise<Hash> {
        try {
            if (!this.gTokenStakingAddress) throw new Error('GTokenStaking address required for this client');
            const staking = stakingActions(this.gTokenStakingAddress);
            
            return await staking(this.client).unlockAndTransfer({
                user: this.accountAddress,
                roleId,
                account: options?.account
            });
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

    /**
     * Exit a specific role (Cleanup registry status)
     */
    async exitRole(roleId: Hex, options?: TransactionOptions): Promise<Hash> {
        try {
            if (!this.registryAddress) throw new Error('Registry address required for this client');
            const registry = registryActions(this.registryAddress);
            
            return await registry(this.client).exitRole({
                roleId,
                account: options?.account
            });
        } catch (error) {
            throw error;
        }
    }

    /**
     * Leave a community (Burn SBT and clean up)
     */
    async leaveCommunity(community: Address, options?: TransactionOptions): Promise<Hash> {
        try {
            if (!this.sbtAddress) throw new Error('SBT address required for this client');
            const sbt = sbtActions(this.sbtAddress);
            
            return await sbt(this.client).leaveCommunity({
                community,
                account: options?.account
            });
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
            const tokens = tokenActions()(this.getStartPublicClient());

            // 1. Check Allowance
            const allowance = await tokens.allowance({
                token: this.gTokenAddress,
                owner: this.accountAddress,
                spender: this.gTokenStakingAddress
            });
            
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

            // 3. Execute
            if (txs.length === 1) {
                return await this.execute(txs[0].target, txs[0].value, txs[0].data, options);
            } else {
                return await this.executeBatch(
                    txs.map(t => t.target), 
                    txs.map(t => t.value), 
                    txs.map(t => t.data), 
                    options
                );
            }
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
    }, options?: TransactionOptions): Promise<Hash> {
        try {
            const client = (this.client as any).extend(bundlerActions);
            const ep = this.requireEntryPoint();
            const publicClient = this.getStartPublicClient();
            
            // 1. Prepare Call Data
            const callData = encodeFunctionData({
                abi: [{ name: 'execute', type: 'function', inputs: [{ name: 'dest', type: 'address' }, { name: 'value', type: 'uint256' }, { name: 'func', type: 'bytes' }], outputs: [] }],
                functionName: 'execute',
                args: [params.target, params.value, params.data]
            });

            // 2. Prepare Paymaster Data
            let paymasterAndData: Hex = params.paymaster;
            // Note: In real scenarios, PM V4 or Super might need additional encoded data.
            // For now, we use the address as the base.

            // 3. Estimate Gas
            const sender = this.accountAddress;
            const nonce = await this.getNonce();
            
            const userOpPartial = {
                sender,
                nonce,
                initCode: '0x' as Hex,
                callData,
                paymasterAndData,
                signature: '0x' as Hex
            };

            const gasEstimate = await (client as any).estimateUserOperationGas({
                 userOperation: userOpPartial as any,
                 entryPoint: ep
            });

            // 4. Construct Final UserOp 
            const fees = await (publicClient as any).estimateFeesPerGas();
            
            const userOp: UserOperation = {
                ...userOpPartial,
                callGasLimit: gasEstimate.callGasLimit,
                verificationGasLimit: gasEstimate.verificationGasLimit + 50000n,
                preVerificationGas: gasEstimate.preVerificationGas,
                maxFeePerGas: fees.maxFeePerGas || fees.gasPrice || 1000000000n,
                maxPriorityFeePerGas: fees.maxPriorityFeePerGas || 1000000000n
            };

            // 5. Sign
            const chainId = this.client.chain?.id || 31337;
            const hash = getUserOperationHash({
                userOperation: userOp,
                entryPointAddress: ep,
                entryPointVersion: '0.7',
                chainId
            });

            const signature = await this.client.signMessage({
                message: { raw: hash },
                account: this.client.account!
            });

            const signedUserOp = {
                ...userOp,
                signature
            };

            // 6. Send
            return await (client as any).sendUserOperation({
                userOperation: signedUserOp,
                entryPoint: ep
            });
        } catch (error) {
            throw error;
        }
    }
}
