import { createClient, type Client, type Transport, type Chain, type Account, publicActions, walletActions, type PublicActions, type WalletActions, type Address, type Hex, type Hash, parseAbi } from 'viem';
import { isZeroAddress, ZeroAddressDestinationError, zeroDestinationGuard, 
    registryActions, 
    sbtActions,
    superPaymasterActions,
    paymasterActions,
    type RegistryActions, 
    type SBTActions, 
    type SuperPaymasterActions, 
    type PaymasterActions,
    CORE_ADDRESSES,
    TOKEN_ADDRESSES,
    TEST_ACCOUNT_ADDRESSES,
    getCanonicalAddresses,
    describeSupportedChains,
    RegistryABI,
    resolveAccountFactoryAddress,
    verifyAccountFactory,
    confirmSentOnChain,
    encodeEndUserRoleData,
} from '@aastar/core';

export type EndUserClient = Client<Transport, Chain, Account | undefined> & PublicActions<Transport, Chain, Account | undefined> & WalletActions<Chain, Account | undefined> & RegistryActions & SBTActions & SuperPaymasterActions & PaymasterActions & {
    /**
     * High-level API: Onboard user to community with automatic funding
     */
    onboard: (args: {
        community: Address,
        roleId: Hex,
        roleData: Hex
    }) => Promise<{ tx: Hash, sbtId: bigint }>
    /**
     * Orchestrates the user joining a community and activating gas credit flow:
     * 1. Mint SBT for the community (Register ENDUSER role)
     * 2. Verify Credit is active (Reputation check)
     */
    joinAndActivate: (args: {
        community: Address,
        roleId: Hex,
        roleData?: Hex
    }) => Promise<{ tx: Hash, sbtId: bigint, initialCredit: bigint }>
    /**
     * Executes a gasless transaction via SuperPaymaster.
     */
    executeGasless: (args: {
        target: Address,
        data: Hex,
        value?: bigint,
        operator: Address
    }) => Promise<Hash>;
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
    .extend(walletActions)
    // A destination of address zero (a contract the selected deployment does not include) is refused before signing.
    .extend(zeroDestinationGuard);

    // Auto-resolve the contract address book from `chain.id` (seamless multi-chain).
    // Precedence: explicit `addresses` > canonical-by-chainId > static CORE_ADDRESSES fallback.
    const chainDefaults = getCanonicalAddresses(chain.id);
    if (!chainDefaults && !addresses) {
        throw new Error(
            `[createEndUserClient] No canonical addresses for chainId ${chain.id}. ` +
            `Pass \`addresses\` explicitly, or use a supported chain: ${describeSupportedChains()}.`,
        );
    }
    const usedAddresses = { ...CORE_ADDRESSES, ...TOKEN_ADDRESSES, ...TEST_ACCOUNT_ADDRESSES, ...chainDefaults, ...addresses };

    // The account factory: the caller's `addresses.simpleAccountFactory`, else the address book's for the live chain;
    // on every call it must build accounts for the EntryPoint this client uses.
    // Captured once: later changes to the caller's `addresses` object cannot swap the factory between calls.
    const factoryOverride = (addresses as any)?.simpleAccountFactory as Address | undefined;
    const checkedAccountFactory = async (): Promise<Address> => {
        const liveChainId = await (client as any).getChainId();
        if (liveChainId !== chain.id) throw new Error(`the RPC is on chain ${liveChainId}, the client is configured for ${chain.id}; refusing to create an account`);
        const entryPoint = (usedAddresses.entryPoint || '0x0000000071727De22E5E9d8BAf0edAc6f37da032') as Address;
        // Only the caller's own override or the address book: not the merged usedAddresses, whose global
        // TEST_ACCOUNT_ADDRESSES entry would otherwise pass as "explicit" on a chain outside the book.
        const factory = resolveAccountFactoryAddress(liveChainId, factoryOverride);
        await verifyAccountFactory(client as any, factory, entryPoint);
        return factory;
    };

    const actions = {
        ...registryActions(usedAddresses.registry)(client as any),
        ...sbtActions(usedAddresses.mySBT)(client as any),
        ...superPaymasterActions(usedAddresses.superPaymaster)(client as any),
        ...paymasterActions(usedAddresses.paymasterV4)(client as any)
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
            return { tx: result.tx, sbtId: result.sbtId };
        },
        async joinAndActivate({ community, roleId, roleData }: { 
            community: Address, 
            roleId: Hex, 
            roleData?: Hex 
        }) {
            const accountToUse = account;
            if (!accountToUse) throw new Error("Account required for joinAndActivate");

            console.log(`   SDK: Joining community ${community}...`);
            
            // Registry.registerRole(roleId, user, roleData) requires msg.sender == user, so the
            // account registers itself. ENDUSER may be registered again to add a community.
            // Without roleData: EndUserRoleData { community, stakeAmount: 0 } (0 = the role's minStake).
            const finalData: Hex = roleData ?? encodeEndUserRoleData({ community });

            const regTx = await (client as any).writeContract({
                address: usedAddresses.registry,
                abi: RegistryABI,
                functionName: 'registerRole',
                args: [roleId, accountToUse.address, finalData],
                account: accountToUse,
                chain
            });

            const regReceipt = await (client as any).waitForTransactionReceipt({ hash: regTx });
            if (regReceipt.status !== 'success') throw new Error(`joinAndActivate: registerRole ${regTx} reverted`);

            // 2. Fetch SBT ID
            const sbtId = await actions.getUserSBT({ user: accountToUse.address });
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
                    user: accountToUse.address, // the account that just registered (not a separately configured AA)
                    token: tokenAddress
                });

                console.log(`   SDK: Activation complete. Current Credit: ${credit} points.`);
            } catch (error: any) {
                console.log(`   SDK: Credit system not available (${error.message.split('\n')[0]}). Continuing...`);
            }

            return {
                tx: regTx,
                sbtId,
                initialCredit: credit
            };
        },
        async executeGasless({ target, data, value = 0n, operator }: { 
            target: Address, 
            data: Hex, 
            value?: bigint, 
            operator: Address 
        }) {
            const accountToUse = account;
            if (!accountToUse) throw new Error("Wallet account required for gasless execution");
            // The call target is inside the UserOp (execute(target, value, data)), past the client's zero-destination
            // guard: a declared-absent contract (zero) is refused here, before the account is touched or anything signed.
            if (isZeroAddress(target)) throw new ZeroAddressDestinationError('executeGasless', 'execute target');

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

            // 5. Build PaymasterAndData from what the deployed SP actually reads (both generations).
            // The previous hand-rolled bytes were the 72-byte 5.4.x prefix with no token and a 50k
            // postOp: SuperPaymaster 5.5.0 sigFails that (token REQUIRED, postOp below the
            // governable minPostOpGas), and even 5.4.2 enforces MIN_POST_OP_GAS = 200k.
            const { resolveSuperPaymasterSponsorship, buildSuperPaymasterData, atLeast } = await import('@aastar/paymaster');
            const sp = await resolveSuperPaymasterSponsorship(client as any, usedAddresses.superPaymaster, operator);
            if (!sp.isConfigured || sp.isPaused) {
                throw new Error(`SuperPaymaster ${sp.version}: operator ${operator} is ${sp.isConfigured ? 'paused' : 'not configured'}; the op would be rejected (AA34).`);
            }
            const paymasterAndData = buildSuperPaymasterData(usedAddresses.superPaymaster, operator, {
                // 250k covers 5.5.0 validation (spec §3.2: 198k-238k measured); floors only raise.
                verificationGasLimit: atLeast(250_000n, sp.verificationGasFloor),
                // 300k headroom (observed ~117k on 5.4.2), never below the contract's floor.
                postOpGasLimit: atLeast(300_000n, sp.minPostOpGas),
                token: sp.token,
            });

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

            await (client as any).waitForTransactionReceipt({ hash: tx });
            return tx;
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

            // From the configuration, else the address book for this chain; checked to build accounts for the
            // configured EntryPoint (the old fallback 0x9406… is the EntryPoint v0.6 factory).
            const factoryAddress = await checkedAccountFactory();
            console.log(`   SDK: Using SimpleAccountFactory: ${factoryAddress} (Owner: ${owner}, Salt: ${salt})`);

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
            const { accountAddress, isDeployed, initCode } = await (this as any).createSmartAccount({ owner, salt });
            const { formatEther } = await import('viem');

            let deployHash: Hash = '0x0';

            if (isDeployed) {
                console.log(`   ℹ️ Account ${accountAddress} already deployed.`);
            } else {
                const { SimpleAccountFactoryABI } = await import('@aastar/core');
                // The factory the address was predicted with (the first 20 bytes of its initCode, already checked),
                // not a second resolution: the account deployed and funded must be the one returned.
                const { getAddress } = await import('viem');
                const factoryAddress = getAddress(('0x' + (initCode as string).slice(2, 42)) as Address);

                console.log(`   🏭 Deploying Smart Account for ${owner}...`);
                deployHash = await (client as any).writeContract({
                    address: factoryAddress,
                    abi: SimpleAccountFactoryABI,
                    functionName: 'createAccount',
                    args: [owner, salt],
                    account,
                    chain
                }) as Hash;
                // Confirmed on this client's chain before anything else is sent (a JSON-RPC wallet that switched chains
                // would have sent it elsewhere: the flow stops here instead of funding).
                await confirmSentOnChain(client as any, deployHash, chain.id);
                console.log(`   ✅ Deployed at ${accountAddress}`);
            }

            if (fundWithETH > 0n) {
                // ETH goes only to an account that exists on this chain now, never to a predicted address.
                const code = await (client as any).getCode({ address: accountAddress });
                if (!code || code === '0x') throw new Error(`deploySmartAccount: ${accountAddress} has no code on chain ${chain.id}; not funding it`);
                console.log(`   ⛽ Funding account with ${formatEther(fundWithETH)} ETH...`);
                const tx = await (client as any).sendTransaction({
                    to: accountAddress,
                    value: fundWithETH,
                    account,
                    chain
                });
                await confirmSentOnChain(client as any, tx, chain.id);
            }

            return { accountAddress, deployTxHash: deployHash, isDeployed: true }; 
        }
    }) as unknown as EndUserClient;
}
