import { type Address, type Hash, type Hex } from 'viem';
import { BaseClient, type ClientConfig, type TransactionOptions } from '@aastar/core';
import { accountActions, sbtActions, tokenActions, entryPointActions, stakingActions, registryActions, paymasterV4Actions, superPaymasterActions } from '@aastar/core';
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
        if (!this.entryPointAddress) throw new Error('EntryPoint address required');
        const entryPoint = entryPointActions(this.entryPointAddress);
        return entryPoint(this.getStartPublicClient()).getNonce({
            sender: this.accountAddress,
            key
        });
    }

    /**
     * Get the owner of the AA account
     */
    async getOwner(): Promise<Address> {
        const account = accountActions(this.accountAddress);
        return account(this.getStartPublicClient()).owner();
    }

    /**
     * Execute a transaction from the AA account
     */
    async execute(target: Address, value: bigint, data: Hex, options?: TransactionOptions): Promise<Hash> {
        const account = accountActions(this.accountAddress);
        
        // Use standard AA execute
        return account(this.client).execute({
            dest: target, // API uses dest
            value,
            func: data, // API uses func
            account: options?.account // The EOA signer
        });
    }

    /**
     * Execute a batch of transactions
     */
    async executeBatch(targets: Address[], values: bigint[], datas: Hex[], options?: TransactionOptions): Promise<Hash> {
        const account = accountActions(this.accountAddress);
        
        return account(this.client).executeBatch({
            dest: targets,
            value: values,
            func: datas,
            account: options?.account
        });
    }

    // ========================================
    // 2. 身份与 SBT (基于 L1 sbtActions)
    // ========================================

    /**
     * Get user's SBT balance
     */
    async getSBTBalance(): Promise<bigint> {
        if (!this.sbtAddress) throw new Error('SBT address required');
        const sbt = sbtActions(this.sbtAddress);
        
        // Note: Missing totalSupply in previous demo, but balanceOf usually exists
        return sbt(this.getStartPublicClient()).balanceOf({
            owner: this.accountAddress
        });
    }

    /**
     * Self-mint SBT for a role (user self-service)
     */
    async mintSBT(roleId: Hex, options?: TransactionOptions): Promise<Hash> {
        if (!this.sbtAddress) throw new Error('SBT address required');
        const sbt = sbtActions(this.sbtAddress);
        
        return sbt(this.client).mintForRole({
            roleId,
            to: this.accountAddress,
            account: options?.account
        });
    }

    // ========================================
    // 3. 资产管理 (基于 L1 tokenActions)
    // ========================================

    /**
     * Transfer GToken or any ERC20
     */
    async transferToken(token: Address, to: Address, amount: bigint, options?: TransactionOptions): Promise<Hash> {
        const tokens = tokenActions()(this.client);
        
        return tokens.transfer({
            token,
            to,
            amount,
            account: options?.account // signer
        });
    }

    /**
     * Get Token Balance
     */
    async getTokenBalance(token: Address): Promise<bigint> {
        const tokens = tokenActions()(this.getStartPublicClient());
        
        return tokens.balanceOf({
            token,
            account: this.accountAddress
        });
    }

    // ========================================
    // 4. 委托与质押 (Delegation & Staking)
    // ========================================

    /**
     * Delegate stake to a role (Delegate to an operator/community)
     */
    async stakeForRole(roleId: Hex, amount: bigint, options?: TransactionOptions): Promise<Hash> {
        if (!this.gTokenStakingAddress) throw new Error('GTokenStaking address required');
        const staking = stakingActions(this.gTokenStakingAddress);
        
        return staking(this.client).lockStake({
            user: this.accountAddress, // The delegator (self)
            roleId,
            stakeAmount: amount,
            entryBurn: 0n, // Default 0 burn
            payer: this.accountAddress, // Self pay
            account: options?.account
        });
    }

    /**
     * Unstake from a role
     */
    async unstakeFromRole(roleId: Hex, options?: TransactionOptions): Promise<Hash> {
        if (!this.gTokenStakingAddress) throw new Error('GTokenStaking address required');
        const staking = stakingActions(this.gTokenStakingAddress);
        
        return staking(this.client).unlockAndTransfer({
            user: this.accountAddress,
            roleId,
            account: options?.account
        });
    }

    /**
     * Get staked balance for a specific role
     */
    async getStakedBalance(roleId: Hex): Promise<bigint> {
        if (!this.gTokenStakingAddress) throw new Error('GTokenStaking address required');
        const staking = stakingActions(this.gTokenStakingAddress);
        
        return staking(this.getStartPublicClient()).getLockedStake({
            user: this.accountAddress,
            roleId
        });
    }

    // ========================================
    // 5. 生命周期管理 (Lifecycle)
    // ========================================

    /**
     * Exit a specific role (Cleanup registry status)
     */
    async exitRole(roleId: Hex, options?: TransactionOptions): Promise<Hash> {
        if (!this.registryAddress) throw new Error('Registry address required');
        const registry = registryActions(this.registryAddress);
        
        return registry(this.client).exitRole({
            roleId,
            account: options?.account
        });
    }

    /**
     * Leave a community (Burn SBT and clean up)
     */
    async leaveCommunity(community: Address, options?: TransactionOptions): Promise<Hash> {
        if (!this.sbtAddress) throw new Error('SBT address required');
        const sbt = sbtActions(this.sbtAddress);
        
        return sbt(this.client).leaveCommunity({
            community,
            account: options?.account
        });
    }

    /**
     * Register as EndUser (One-click: Approve + Register)
     * Handles GToken approval to Staking contract and Role registration.
     */
    async registerAsEndUser(communityAddress: Address, stakeAmount: bigint, options?: TransactionOptions): Promise<Hash> {
        if (!this.registryAddress) throw new Error('Registry address required');
        if (!this.gTokenStakingAddress) throw new Error('GTokenStaking address required');
        if (!this.gTokenAddress) throw new Error('GToken address required');

        const { encodeAbiParameters, keccak256, toBytes, parseEther } = await import('viem');
        const ROLE_ENDUSER = keccak256(toBytes("ENDUSER"));
        const registry = registryActions(this.registryAddress);
        const tokens = tokenActions()(this.getStartPublicClient()); // Use public client for reading

        // 1. Check Allowance
        const allowance = await tokens.allowance({
            token: this.gTokenAddress,
            owner: this.accountAddress,
            spender: this.gTokenStakingAddress
        });

        // 2. Approve if needed (Batch if possible, but executeBatch logic assumes we constructed calls manually?)
        // UserClient.executeBatch takes arrays. Let's try to batch if possible.
        // But wait, executeBatch returns Hash.
        // If we want atomic, we should batch.
        
        const txs: { target: Address, value: bigint, data: Hex }[] = [];

        if (allowance < stakeAmount) {
             const approveData = encodeFunctionData({
                 abi: [{name:'approve', type:'function', inputs:[{type:'address'},{type:'uint256'}], outputs:[{type:'bool'}], stateMutability:'nonpayable'}],
                 functionName: 'approve',
                 args: [this.gTokenStakingAddress, parseEther('1000')] // Safe high amount
             });
             txs.push({ target: this.gTokenAddress, value: 0n, data: approveData });
        }

        // 3. Construct Register Call
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
                this.accountAddress, // account (Self)
                communityAddress,    // community
                '',                  // avatarURI
                '',                  // ensName
                stakeAmount          // stakeAmount
            ]
        );

        const registerData = encodeFunctionData({
            abi: [{ name: 'registerRoleSelf', type: 'function', inputs: [{type:'bytes32'}, {type:'bytes'}], outputs: [{type:'uint256'}], stateMutability: 'nonpayable' }],
            functionName: 'registerRoleSelf',
            args: [ROLE_ENDUSER, roleData]
        });
        
        txs.push({ target: this.registryAddress, value: 0n, data: registerData });

        // 4. Execute
        if (txs.length === 1) {
            return this.execute(txs[0].target, txs[0].value, txs[0].data, options);
        } else {
            return this.executeBatch(
                txs.map(t => t.target), 
                txs.map(t => t.value), 
                txs.map(t => t.data), 
                options
            );
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
        const client = (this.client as any).extend(bundlerActions);
        const ep = this.requireEntryPoint();
        
        // 1. Prepare Call Data
        // SimpleAccount.execute(dest, value, func)
        const callData = encodeFunctionData({
            abi: [{ name: 'execute', type: 'function', inputs: [{ name: 'dest', type: 'address' }, { name: 'value', type: 'uint256' }, { name: 'func', type: 'bytes' }], outputs: [] }],
            functionName: 'execute',
            args: [params.target, params.value, params.data]
        });

        // 2. Prepare Paymaster Data
        let paymasterAndData: Hex = '0x';
        const publicClient = this.getStartPublicClient();

        if (params.paymasterType === 'V4') {
             // V4: Paymaster + InitData? No, just address if no special logic.
             // Usually V4 needs no special data for basic sponsorship if token is setup?
             // Actually, Paymaster V4 usually requires `paymasterAndData` to contain Token info or just use default?
             // If V4 uses `validatePaymasterUserOp`, it checks `userOp.paymasterAndData`.
             // If we just pass address, it might fail?
             // Let's assume just address for now, or use stub helper if available.
             // Standard V4: address + ...
             // We'll append empty bytes if needed: account-abstraction/contracts usually needs nothing?
             // Wait, if it's Token Paymaster, it might need token address encoded?
             // PaymasterV4.sol logic: assumes defaults or reads from Storage?
             // We'll assume address is sufficient for now (packed to 20 bytes).
             paymasterAndData = params.paymaster;
        } else if (params.paymasterType === 'Super') {
             // SuperPaymaster V3:
             // Needs mode (0=Basic, 1=Credit).
             // If Credit, needs nothing?
             // SuperPaymasterV3 `validatePaymasterUserOp` parses mode.
             // Let's assume standard sponsorship (Credit/Registry).
             // Just address is usually enough for "Mycelium" mode (Pull)?
             // If using `PostOp`, we need verifyingGasLimit > 0.
             paymasterAndData = params.paymaster;
        }

        // 3. Estimate Gas
        // We use bundler to estimate
        const sender = this.accountAddress;
        const nonce = await this.getNonce();
        
        // Partial UserOp
        const userOpPartial = {
            sender,
            nonce,
            initCode: '0x' as Hex, // Valid only if deployed
            callData,
            paymasterAndData,
            signature: '0x' as Hex // Dummy
        };

        // Estimate
        const gasEstimate = await (client as any).estimateUserOperationGas({
             userOperation: userOpPartial as any, // Viem types are strict, partial might need casting
             entryPoint: ep
        });

        // 4. Construct Final UserOp 
        // We need fees.
        const fees = await (publicClient as any).estimateFeesPerGas();
        
        const userOp: UserOperation = {
            ...userOpPartial,
            callGasLimit: gasEstimate.callGasLimit,
            verificationGasLimit: gasEstimate.verificationGasLimit + 50000n, // Buffer
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
            account: this.client.account
        });

        const signedUserOp = {
            ...userOp,
            signature
        };

        // 6. Send
        const bundleClient = client as any;
        return bundleClient.sendUserOperation({
            userOperation: signedUserOp,
            entryPoint: ep
        });
    }
}
