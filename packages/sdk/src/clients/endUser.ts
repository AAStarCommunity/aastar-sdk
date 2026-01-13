import { createClient, type Client, type Transport, type Chain, type Account, publicActions, walletActions, type PublicActions, type WalletActions, type Address, type Hex, type Hash, parseAbi, parseEther } from 'viem';
import { 
    registryActions, 
    sbtActions,
    superPaymasterActions,
    paymasterV4Actions,
    type RegistryActions, 
    type SBTActions, 
    type SuperPaymasterActions, 
    type PaymasterV4Actions,
    CORE_ADDRESSES, 
    TOKEN_ADDRESSES,
    TEST_ACCOUNT_ADDRESSES,
    RegistryABI
} from '@aastar/core';
import { decodeContractError } from '../errors/decoder.js';
import { decodeContractEvents, logDecodedEvents, type DecodedEvent } from '../utils/eventDecoder.js';

export type EndUserClient = Client<Transport, Chain, Account | undefined> & PublicActions<Transport, Chain, Account | undefined> & WalletActions<Chain, Account | undefined> & RegistryActions & SBTActions & SuperPaymasterActions & PaymasterV4Actions & {
    /**
     * High-level API: Onboard user to community with automatic funding
     */
    onboard: (args: {
        community: Address,
        roleId: Hex,
        roleData: Hex
    }) => Promise<{ hash: Hash, events: DecodedEvent[], sbtId: bigint }>
    /**
     * Orchestrates the user joining a community and activating gas credit flow:
     * 1. Mint SBT for the community (Register ENDUSER role)
     * 2. Verify Credit is active (Reputation check)
     */
    joinAndActivate: (args: {
        community: Address,
        roleId: Hex,
        roleData?: Hex
    }) => Promise<{ hash: Hash, events: DecodedEvent[], sbtId: bigint, initialCredit: bigint }>
    /**
     * Executes a gasless transaction via SuperPaymaster.
     */
    executeGasless: (args: {
        target: Address,
        data: Hex,
        value?: bigint,
        operator: Address
    }) => Promise<{ hash: Hash, events: DecodedEvent[] }>;
    /**
     * Executes a batch of gasless transactions via SuperPaymaster.
     */
    executeGaslessBatch: (args: {
        targets: Address[],
        datas: Hex[],
        values?: bigint[],
        operator: Address
    }) => Promise<{ hash: Hash, events: DecodedEvent[] }>;
    /**
     * Check if the user meets the requirements to join a community (stake, sbt, etc.)
     */
    checkJoinRequirements: (address?: Address) => Promise<{
        hasEnoughGToken: boolean;
        hasSBT: boolean;
        missingRequirements: string[];
    }>;
    /**
     * Predict or deploy a SimpleAccount (ERC-4337)
     */
    deploySmartAccount: (params: {
        owner: Address;
        salt?: bigint;
        fundWithETH?: bigint;
    }) => Promise<{
        accountAddress: Address;
        deployTxHash: Hash;
        isDeployed: boolean;
    }>;
    /**
     * Predict the address of a SimpleAccount without deploying
     */
    createSmartAccount: (params: {
        owner: Address;
        salt?: bigint;
    }) => Promise<{
        accountAddress: Address;
        initCode: Hex;
        isDeployed: boolean;
    }>;
};

export function createEndUserClient({
    chain,
    transport,
    account,
    addresses
}: {
    chain: Chain,
    transport: Transport,
    account?: Account,
    addresses?: { [key: string]: Address }
}): EndUserClient {
    const client = createClient({
        chain,
        transport,
        account
    })
    .extend(publicActions)
    .extend(walletActions);

    const usedAddresses = { ...CORE_ADDRESSES, ...TOKEN_ADDRESSES, ...TEST_ACCOUNT_ADDRESSES, ...addresses };

    const actions = {
        ...registryActions(usedAddresses.registry)(client as any),
        ...sbtActions(usedAddresses.mySBT)(client as any),
        ...superPaymasterActions(usedAddresses.superPaymaster)(client as any),
        ...paymasterV4Actions(usedAddresses.paymasterV4)(client as any)
    };

    return Object.assign(client, actions, {
        async onboard({ community, roleId, roleData }: {
            community: Address,
            roleId: Hex,
            roleData: Hex
        }) {
            console.log('👤 Onboarding user to community...');
            const result = await (this as any).joinAndActivate({ community, roleId, roleData });
            console.log(`✅ User onboarded! SBT ID: ${result.sbtId}`);
            return { hash: result.hash, events: result.events, sbtId: result.sbtId };
        },
        async joinAndActivate({ community, roleId, roleData }: { 
            community: Address, 
            roleId: Hex, 
            roleData?: Hex 
        }) {
            const accountToUse = account;
            if (!accountToUse) throw new Error("Account required for joinAndActivate");

            console.log(`   SDK: Joining community ${community}...`);
            
            // Registry.registerRoleSelf is now idempotent (modified contract)
            // First call: Mints SBT + grants role
            // Subsequent calls: Adds community membership
            
            // If roleData not provided, encode EndUserRoleData structure
            let finalData: Hex;
            if (roleData) {
                finalData = roleData;
            } else {
                // Encode EndUserRoleData: (address account, address community, string avatarURI, string ensName, uint256 stakeAmount)
                const { encodeAbiParameters } = await import('viem');
                finalData = encodeAbiParameters(
                    [
                        { name: 'account', type: 'address' },
                        { name: 'community', type: 'address' },
                        { name: 'avatarURI', type: 'string' },
                        { name: 'ensName', type: 'string' },
                        { name: 'stakeAmount', type: 'uint256' }
                    ],
                    [accountToUse.address, community, '', '', 0n] // Use minimum stake (Registry will use roleConfig.minStake)
                ) as Hex;
            }
            
            try {
                const regTx = await (client as any).writeContract({
                    address: usedAddresses.registry,
                    abi: RegistryABI,
                    functionName: 'registerRoleSelf',
                    args: [roleId, finalData],
                    account: accountToUse,
                    chain
                });
                
                const receipt = await (client as any).waitForTransactionReceipt({ hash: regTx });
                const events = decodeContractEvents(receipt.logs);
                logDecodedEvents(events);

                // 2. Fetch SBT ID
                const sbtId = await actions.getUserSBT({ user: accountToUse.address, roleId });
                console.log(`   SDK: User joined. SBT ID: ${sbtId}`);

                // 3. Fetch Initial Credit for verification
                let credit = 0n;
                try {
                    const factoryAbi = parseAbi(['function communityToToken(address) view returns (address)']);
                    const tokenAddress = await (client as any).readContract({
                        address: usedAddresses.xPNTsFactory,
                        abi: factoryAbi,
                        functionName: 'communityToToken',
                        args: [community]
                    }) as Address;

                    credit = await actions.getAvailableCredit({
                        user: (client as any).aaAddress || accountToUse.address,
                        operator: tokenAddress
                    });

                    console.log(`   SDK: Activation complete. Current Credit: ${credit} points.`);
                } catch (error: any) {
                    console.log(`   SDK: Credit system not available (${error.message.split('\n')[0]}). Continuing...`);
                }

                return {
                    hash: regTx,
                    events,
                    sbtId,
                    initialCredit: credit
                };
            } catch (error: any) {
                const decodedMsg = decodeContractError(error);
                console.error(`   ❌ joinAndActivate failed:`, decodedMsg || error.message);
                if (decodedMsg) {
                    throw new Error(`Joining Community Failed: ${decodedMsg}`);
                }
                throw error;
            }
        },
        async executeGasless({ target, data, value = 0n, operator }: { 
            target: Address, 
            data: Hex, 
            value?: bigint, 
            operator: Address 
        }) {
            const accountToUse = account;
            if (!accountToUse) throw new Error("Wallet account required for gasless execution");

            // 1. Get AA Address (Predict if necessary)
            const { accountAddress } = await (this as any).createSmartAccount({ owner: accountToUse.address });
            console.log(`   SDK: Executing gasless via AA ${accountAddress} Sponsored by ${operator}`);

            // 2. Fetch Nonce from EntryPoint (v0.7 standard)
            // Note: In v0.7, nonce is managed by EntryPoint, not the account itself
            let nonce = 0n;
            try {
                nonce = await (client as any).readContract({
                    address: usedAddresses.entryPoint,
                    abi: [{ 
                        type: 'function', 
                        name: 'getNonce', 
                        inputs: [{ type: 'address', name: 'sender' }, { type: 'uint192', name: 'key' }],
                        outputs: [{ type: 'uint256' }], 
                        stateMutability: 'view' 
                    }],
                    functionName: 'getNonce',
                    args: [accountAddress, 0n] // 0 = default nonce key
                }) as bigint;
            } catch (e: any) {
                console.warn(`   ⚠️  Failed to fetch nonce from EntryPoint, using default 0:`, e.message);
                // For initial transactions, nonce is always 0
                nonce = 0n;
            }

            // 3. Build CallData (execute(target, value, data))
            const { encodeFunctionData, concat, pad, keccak256 } = await import('viem');
            const executeData = encodeFunctionData({
                abi: [{ type: 'function', name: 'execute', inputs: [{type: 'address'}, {type: 'uint256'}, {type: 'bytes'}] }],
                functionName: 'execute',
                args: [target, value, data]
            });

            // 4. Build Gas Limits & Fees (Benchmarked for experiments)
            const accountGasLimits = concat([
                pad(`0x${(100000).toString(16)}`, { dir: 'left', size: 16 }), // verification
                pad(`0x${(100000).toString(16)}`, { dir: 'left', size: 16 })  // call
            ]) as Hex;

            const gasFees = concat([
                pad(`0x${(2000000000).toString(16)}`, { dir: 'left', size: 16 }), // 2 gwei
                pad(`0x${(2000000000).toString(16)}`, { dir: 'left', size: 16 })  // 2 gwei
            ]) as Hex;

            // 5. Build PaymasterAndData (v0.7 packed format)
            const paymasterVerificationGas = 250000n;
            const paymasterPostOpGas = 50000n;
            const paymasterAndData = concat([
                usedAddresses.superPaymaster,
                pad(`0x${paymasterVerificationGas.toString(16)}`, { dir: 'left', size: 16 }),
                pad(`0x${paymasterPostOpGas.toString(16)}`, { dir: 'left', size: 16 }),
                operator
            ]);

            // 6. Construct UserOperation v0.7
            const userOp = {
                sender: accountAddress,
                nonce,
                initCode: '0x' as Hex,
                callData: executeData,
                accountGasLimits,
                preVerificationGas: 50000n,
                gasFees,
                paymasterAndData,
                signature: '0x' as Hex
            };

            // 7. Sign UserOp Hash
            const entryPointAddress = usedAddresses.entryPoint || '0x0000000071727De22E5E9d8BAf0edAc6f37da032';
            const userOpHash = await (client as any).readContract({
                address: entryPointAddress,
                abi: [{
                    type: 'function',
                    name: 'getUserOpHash',
                    inputs: [{
                        type: 'tuple',
                        components: [
                            {name: 'sender', type: 'address'},
                            {name: 'nonce', type: 'uint256'},
                            {name: 'initCode', type: 'bytes'},
                            {name: 'callData', type: 'bytes'},
                            {name: 'accountGasLimits', type: 'bytes32'},
                            {name: 'preVerificationGas', type: 'uint256'},
                            {name: 'gasFees', type: 'bytes32'},
                            {name: 'paymasterAndData', type: 'bytes'},
                            {name: 'signature', type: 'bytes'}
                        ]
                    }],
                    outputs: [{type: 'bytes32'}],
                    stateMutability: 'view'
                }],
                functionName: 'getUserOpHash',
                args: [userOp]
            }) as Hex;

            const signature = await (accountToUse as any).signMessage({
                message: { raw: userOpHash }
            });
            userOp.signature = signature;

            try {
                // 8. Submit via handleOps
                console.log(`   SDK: Submitting UserOp ${userOpHash}...`);
                const tx = await (client as any).writeContract({
                    address: entryPointAddress,
                    abi: [{
                        type: 'function',
                        name: 'handleOps',
                        inputs: [
                            {
                                type: 'tuple[]',
                                components: [
                                    {name: 'sender', type: 'address'},
                                    {name: 'nonce', type: 'uint256'},
                                    {name: 'initCode', type: 'bytes'},
                                    {name: 'callData', type: 'bytes'},
                                    {name: 'accountGasLimits', type: 'bytes32'},
                                    {name: 'preVerificationGas', type: 'uint256'},
                                    {name: 'gasFees', type: 'bytes32'},
                                    {name: 'paymasterAndData', type: 'bytes'},
                                    {name: 'signature', type: 'bytes'}
                                ]
                            },
                            {name: 'beneficiary', type: 'address'}
                        ],
                        outputs: [],
                        stateMutability: 'nonpayable'
                    }],
                    functionName: 'handleOps',
                    args: [[userOp], accountToUse.address],
                    account,
                    chain
                });

                const receipt = await (client as any).waitForTransactionReceipt({ hash: tx });
                const events = decodeContractEvents(receipt.logs);
                logDecodedEvents(events);
                return { hash: tx, events };
            } catch (error: any) {
                const decodedMsg = decodeContractError(error);
                if (decodedMsg) {
                    throw new Error(`Gasless Execution Failed: ${decodedMsg}`);
                }
                throw error;
            }
        },
        async executeGaslessBatch({ targets, datas, values, operator }: { 
            targets: Address[], 
            datas: Hex[], 
            values?: bigint[], 
            operator: Address 
        }) {
            const accountToUse = account;
            if (!accountToUse) throw new Error("Wallet account required for gasless execution");

            const finalValues = values || targets.map(() => 0n);

            // 1. Get AA Address (Predict if necessary)
            const { accountAddress } = await (this as any).createSmartAccount({ owner: accountToUse.address });
            console.log(`   SDK: Executing gasless batch via AA ${accountAddress} Sponsored by ${operator}`);

            // 2. Fetch Nonce from EntryPoint
            let nonce = 0n;
            try {
                nonce = await (client as any).readContract({
                    address: usedAddresses.entryPoint,
                    abi: [{ 
                        type: 'function', 
                        name: 'getNonce', 
                        inputs: [{ type: 'address', name: 'sender' }, { type: 'uint192', name: 'key' }],
                        outputs: [{ type: 'uint256' }], 
                        stateMutability: 'view' 
                    }],
                    functionName: 'getNonce',
                    args: [accountAddress, 0n]
                }) as bigint;
            } catch (e: any) {
                console.warn(`   ⚠️  Failed to fetch nonce, using 0:`, e.message);
                nonce = 0n;
            }

            // 3. Build CallData (executeBatch(targets, values, datas))
            const { encodeFunctionData, concat, pad } = await import('viem');
            const executeData = encodeFunctionData({
                abi: [{ type: 'function', name: 'executeBatch', inputs: [{type: 'address[]'}, {type: 'uint256[]'}, {type: 'bytes[]'}] }],
                functionName: 'executeBatch',
                args: [targets, finalValues, datas]
            });

            // 4. Build Gas Limits & Fees
            const accountGasLimits = concat([
                pad(`0x${(150000).toString(16)}`, { dir: 'left', size: 16 }), // increased verification for batch
                pad(`0x${(300000).toString(16)}`, { dir: 'left', size: 16 })  // increased call gas for batch
            ]) as Hex;

            const gasFees = concat([
                pad(`0x${(2000000000).toString(16)}`, { dir: 'left', size: 16 }),
                pad(`0x${(2000000000).toString(16)}`, { dir: 'left', size: 16 })
            ]) as Hex;

            // 5. Build PaymasterAndData
            const paymasterVerificationGas = 300000n;
            const paymasterPostOpGas = 50000n;
            const paymasterAndData = concat([
                usedAddresses.superPaymaster,
                pad(`0x${paymasterVerificationGas.toString(16)}`, { dir: 'left', size: 16 }),
                pad(`0x${paymasterPostOpGas.toString(16)}`, { dir: 'left', size: 16 }),
                operator
            ]);

            // 6. Construct UserOperation v0.7
            const userOp = {
                sender: accountAddress,
                nonce,
                initCode: '0x' as Hex,
                callData: executeData,
                accountGasLimits,
                preVerificationGas: 100000n, // increased for batch
                gasFees,
                paymasterAndData,
                signature: '0x' as Hex
            };

            // 7. Sign UserOp Hash
            const entryPointAddress = usedAddresses.entryPoint || '0x0000000071727De22E5E9d8BAf0edAc6f37da032';
            const userOpHash = await (client as any).readContract({
                address: entryPointAddress,
                abi: [{
                    type: 'function',
                    name: 'getUserOpHash',
                    inputs: [{
                        type: 'tuple',
                        components: [
                            {name: 'sender', type: 'address'},
                            {name: 'nonce', type: 'uint256'},
                            {name: 'initCode', type: 'bytes'},
                            {name: 'callData', type: 'bytes'},
                            {name: 'accountGasLimits', type: 'bytes32'},
                            {name: 'preVerificationGas', type: 'uint256'},
                            {name: 'gasFees', type: 'bytes32'},
                            {name: 'paymasterAndData', type: 'bytes'},
                            {name: 'signature', type: 'bytes'}
                        ]
                    }],
                    outputs: [{type: 'bytes32'}],
                    stateMutability: 'view'
                }],
                functionName: 'getUserOpHash',
                args: [userOp]
            }) as Hex;

            const signature = await (accountToUse as any).signMessage({
                message: { raw: userOpHash }
            });
            userOp.signature = signature;

            try {
                // 8. Submit
                console.log(`   SDK: Submitting Batch UserOp ${userOpHash}...`);
                const tx = await (client as any).writeContract({
                    address: entryPointAddress,
                    abi: [{
                        type: 'function',
                        name: 'handleOps',
                        inputs: [
                            {
                                type: 'tuple[]',
                                components: [
                                    {name: 'sender', type: 'address'},
                                    {name: 'nonce', type: 'uint256'},
                                    {name: 'initCode', type: 'bytes'},
                                    {name: 'callData', type: 'bytes'},
                                    {name: 'accountGasLimits', type: 'bytes32'},
                                    {name: 'preVerificationGas', type: 'uint256'},
                                    {name: 'gasFees', type: 'bytes32'},
                                    {name: 'paymasterAndData', type: 'bytes'},
                                    {name: 'signature', type: 'bytes'}
                                ]
                            },
                            {name: 'beneficiary', type: 'address'}
                        ],
                        outputs: [],
                        stateMutability: 'nonpayable'
                    }],
                    functionName: 'handleOps',
                    args: [[userOp], accountToUse.address],
                    account,
                    chain
                });

                const receipt = await (client as any).waitForTransactionReceipt({ hash: tx });
                const events = decodeContractEvents(receipt.logs);
                logDecodedEvents(events);
                return { hash: tx, events };
            } catch (error: any) {
                const decodedMsg = decodeContractError(error);
                if (decodedMsg) {
                    throw new Error(`Gasless Batch Execution Failed: ${decodedMsg}`);
                }
                throw error;
            }
        },
        async checkJoinRequirements(address?: Address) {
            const accountToUse = address || account?.address;
            if (!accountToUse) throw new Error("Account address required for requirement check");
            
            const { RequirementChecker } = await import('@aastar/core');
            const checker = new RequirementChecker(client as any, usedAddresses);
            
            // Default requirements for standard community joining
            return await checker.checkRequirements({
                address: accountToUse,
                requiredGToken: 440000000000000000n, // 0.44 GT (stake + burn)
                requireSBT: false
            });
        },
        async createSmartAccount({ owner, salt = 0n }: { owner: Address, salt?: bigint }) {
            const { SimpleAccountFactoryABI } = await import('@aastar/core');
            const { encodeFunctionData, concat } = await import('viem');

            let factoryAddress = (usedAddresses as any).simpleAccountFactory; 
            console.log(`   SDK: Using SimpleAccountFactory: ${factoryAddress} (Owner: ${owner}, Salt: ${salt})`);
            
            // Fallback to official v0.7 factory if not provided
            if (!factoryAddress || factoryAddress === '0x0000000000000000000000000000000000000000') {
                throw new Error("SimpleAccountFactory not found in configuration or override. Please check SIMPLE_ACCOUNT_FACTORY or SimpleAccountFactoryv0.7 in your .env file.");
            }

            const accountAddress = await (client as any).readContract({
                address: factoryAddress,
                abi: SimpleAccountFactoryABI,
                functionName: 'getAddress',
                args: [owner, salt]
            }) as Address;

            const createAccountData = encodeFunctionData({
                abi: SimpleAccountFactoryABI,
                functionName: 'createAccount',
                args: [owner, salt]
            });

            const initCode = concat([factoryAddress, createAccountData]);
            const byteCode = await (client as any).getBytecode({ address: accountAddress });
            const isDeployed = byteCode !== undefined && byteCode !== '0x';

            return { accountAddress, initCode, isDeployed };
        },
        async deploySmartAccount({ owner, salt = 0n, fundWithETH = 0n }: { owner: Address, salt?: bigint, fundWithETH?: bigint }) {
            const { accountAddress, isDeployed } = await (this as any).createSmartAccount({ owner, salt });
            const { formatEther } = await import('viem');

            let deployHash: Hash = '0x0';

            if (isDeployed) {
                console.log(`   ℹ️ Account ${accountAddress} already deployed.`);
            } else {
                const { SimpleAccountFactoryABI } = await import('@aastar/core');
                let factoryAddress = (usedAddresses as any).simpleAccountFactory;
                if (!factoryAddress || factoryAddress === '0x0000000000000000000000000000000000000000') {
                    throw new Error("SimpleAccountFactory not found in configuration or override. Please check SIMPLE_ACCOUNT_FACTORY or SimpleAccountFactoryv0.7 in your .env file.");
                }

                console.log(`   🏭 Deploying Smart Account for ${owner}...`);
                deployHash = await (client as any).writeContract({
                    address: factoryAddress,
                    abi: SimpleAccountFactoryABI,
                    functionName: 'createAccount',
                    args: [owner, salt],
                    account,
                    chain
                }) as Hash;
                await (client as any).waitForTransactionReceipt({ hash: deployHash });
                console.log(`   ✅ Deployed at ${accountAddress}`);
            }

            if (fundWithETH > 0n) {
                const balance = await (client as any).getBalance({ address: accountAddress });
                if (balance < parseEther('0.01')) { // 只有在余额少于 0.01 ETH 时才注入
                    console.log(`   ⛽ Funding account with ${formatEther(fundWithETH)} ETH...`);
                    const tx = await (client as any).sendTransaction({
                        to: accountAddress,
                        value: fundWithETH,
                        account,
                        chain
                    });
                    await (client as any).waitForTransactionReceipt({ hash: tx });
                } else {
                    console.log(`   ℹ️ Account already funded (Balance: ${formatEther(balance)} ETH). Skipping.`);
                }
            }

            return { accountAddress, deployTxHash: deployHash, isDeployed: true }; 
        }
    }) as EndUserClient;
}
