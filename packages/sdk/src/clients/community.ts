import { 
    createClient, 
    type Client, 
    type Transport, 
    type Chain, 
    type Account, 
    type Hash, 
    type Hex,
    publicActions,
    walletActions,
    type PublicActions,
    type WalletActions,
    type Address,
    keccak256,
    stringToBytes,
    erc20Abi
} from 'viem';

import { 
    registryActions, 
    RegistryABI, 
    sbtActions,
    reputationActions,
    type RegistryActions,
    type SBTActions,
    type ReputationActions,
    CORE_ADDRESSES,
    TEST_TOKEN_ADDRESSES
} from '@aastar/core';
import { RoleDataFactory, RoleIds } from '../utils/roleData.js';
import { decodeContractError } from '../errors/decoder.js';
import { decodeContractEvents, logDecodedEvents, type DecodedEvent } from '../utils/eventDecoder.js';

export type CommunityClient = Client<Transport, Chain, Account | undefined> & PublicActions<Transport, Chain, Account | undefined> & WalletActions<Chain, Account | undefined> & RegistryActions & SBTActions & ReputationActions & {
    /**
     * Query community registration status and token information
     * Returns null if not registered, otherwise returns community details
     */
    getCommunityInfo: (accountAddress: Address) => Promise<{
        hasRole: boolean;
        tokenAddress: Address | null;
        communityData: {
            name: string;
            ensName: string;
            website: string;
            description: string;
        } | null;
    }>;
    /**
     * High-level API to launch a community with automatic roleData generation
     */
    launch: (args: {
        name: string;
        tokenName: string;
        tokenSymbol: string;
        description?: string;
        logoURI?: string;
        website?: string;
        governance?: {
            minStake?: bigint;
            initialReputationRule?: boolean;
        }
    }) => Promise<{ tokenAddress: Address; results: { hash: Hash, events: DecodedEvent[] }[] }>;
};


export function createCommunityClient({ 
    chain, 
    transport, 
    account,
    addresses
}: { 
    chain: Chain, 
    transport: Transport,
    account?: Account,
    addresses?: { [key: string]: Address }
}): CommunityClient {
    const client = createClient({ 
        chain, 
        transport,
        account
    })
    .extend(publicActions)
    .extend(walletActions);

    const usedAddresses = { ...CORE_ADDRESSES, ...TEST_TOKEN_ADDRESSES, ...addresses };

    const registryActionsObj = registryActions(usedAddresses.registry)(client as any);
    const sbtActionsObj = sbtActions(usedAddresses.mySBT)(client as any);
    const reputationActionsObj = reputationActions(usedAddresses.reputationSystem)(client as any);


    const launch = async (args: {
        name: string;
        tokenName: string;
        tokenSymbol: string;
        description?: string;
        logoURI?: string;
        website?: string;
        governance?: {
            minStake?: bigint;
            initialReputationRule?: boolean;
        }
    }): Promise<{ tokenAddress: Address; results: { hash: Hash, events: DecodedEvent[] }[] }> => {
        try {
            console.log(`🚀 Launching community: ${args.name}`);
            
            if (!account) {
                throw new Error('Account is required for launch()');
            }

            // Generate unique community name with timestamp
            const uniqueName = `${args.name}_${Date.now()}`;
            console.log(`   📝 Unique name: ${uniqueName}`);

            // Generate roleData using RoleDataFactory
            const roleData = RoleDataFactory.community({
                name: uniqueName,
                ensName: '',
                website: args.website || '',
                description: args.description || '',
                logoURI: args.logoURI || '',
                stakeAmount: 0n
            });
            console.log(`   ✅ RoleData generated:`, roleData);
            console.log(`   📊 RoleData type:`, typeof roleData);
            console.log(`   📏 RoleData length:`, roleData?.length);

            // 1. Check if already has role
            const hasRole = await client.readContract({
                address: usedAddresses.registry,
                abi: RegistryABI,
                functionName: 'hasRole',
                args: [RoleIds.COMMUNITY, account.address]
            }) as boolean;

            let registerTx: Hex | undefined;
            const results: { hash: Hash, events: DecodedEvent[] }[] = [];

            if (hasRole) {
                console.log(`   ℹ️  Account already has COMMUNITY role. Skipping registration.`);
            } else {
                // 2. Check GToken Allowance and Balance
                if (usedAddresses.gToken && usedAddresses.gTokenStaking) {
                    console.log(`   💰 Checking GToken allowance...`);
                    const balance = await client.readContract({
                        address: usedAddresses.gToken,
                        abi: erc20Abi,
                        functionName: 'balanceOf',
                        args: [account.address]
                    }) as bigint;

                    if (balance < 50000000000000000000n) { // 50 GT assumption, should ideally check minStake
                         console.warn(`   ⚠️ Warning: Low GToken balance (${balance}). Registration may fail if minStake > balance.`);
                    }

                    const allowance = await client.readContract({
                        address: usedAddresses.gToken,
                        abi: erc20Abi,
                        functionName: 'allowance',
                        args: [account.address, usedAddresses.gTokenStaking]
                    }) as bigint;

                    if (allowance < 50000000000000000000n) {
                        console.log(`   🔓 Approving GToken for Staking...`);
                        const approveTx = await client.writeContract({
                            address: usedAddresses.gToken,
                            abi: erc20Abi,
                            functionName: 'approve',
                            args: [usedAddresses.gTokenStaking, 115792089237316195423570985008687907853269984665640564039457584007913129639935n], // MaxUint256
                            account: account
                        });
                        console.log(`   ✅ Approved: ${approveTx}`);
                        const receipt = await client.waitForTransactionReceipt({ hash: approveTx });
                        const events = decodeContractEvents(receipt.logs);
                        logDecodedEvents(events);
                        results.push({ hash: approveTx, events });
                    }
                }

                // Register community role
                console.log(`   📤 Registering community role...`);
                try {
                    registerTx = await registryActionsObj.registerRole({
                        roleId: RoleIds.COMMUNITY,
                        user: account.address,
                        data: roleData,
                        account: account
                    });
                    console.log(`   ✅ Community registered: ${registerTx}`);
                    const receipt = await client.waitForTransactionReceipt({ hash: registerTx });
                    const events = decodeContractEvents(receipt.logs);
                    logDecodedEvents(events);
                    results.push({ hash: registerTx, events });
                } catch (e: any) {
                     // Check for RoleAlreadyGranted (just in case hasRole returned false but race condition or cache)
                     const isRoleError = e.message?.includes('RoleAlreadyGranted') || 
                                        (e.cause as any)?.data?.errorName === 'RoleAlreadyGranted' ||
                                        (e as any).name === 'RoleAlreadyGranted' || 
                                        (e as any).name === 'RoleAlreadyGranted';

                    if (isRoleError) {
                        console.log(`   ℹ️  Role already granted (caught in tx). Skipping.`);
                    } else {
                        throw e;
                    }
                }
            }

            // Deploy xPNTs token if factory is available
            let tokenAddress: Address = '0x0000000000000000000000000000000000000000' as Address;

            if (usedAddresses.xPNTsFactory) {
                if (!client.account) {
                    throw new Error("Client account is required for token deployment");
                }

                // ABI from xPNTsFactory.sol
                const factoryAbi = [
                    {
                        type: 'function',
                        name: 'deployxPNTsToken',
                        inputs: [
                            { name: 'name', type: 'string' },
                            { name: 'symbol', type: 'string' },
                            { name: 'communityName', type: 'string' },
                            { name: 'communityENS', type: 'string' },
                            { name: 'exchangeRate', type: 'uint256' },
                            { name: 'paymasterAOA', type: 'address' }
                        ],
                        outputs: [{ name: 'token', type: 'address' }],
                        stateMutability: 'nonpayable'
                    },
                    {
                        type: 'function',
                        name: 'getTokenAddress',
                        inputs: [{ name: 'community', type: 'address' }],
                        outputs: [{ name: 'token', type: 'address' }],
                        stateMutability: 'view'
                    }
                ] as const;

                // 1. Check if token already exists
                try {
                    const existingToken = await client.readContract({
                        address: usedAddresses.xPNTsFactory,
                        abi: factoryAbi,
                        functionName: 'getTokenAddress',
                        args: [account.address]
                    }) as Address;

                    if (existingToken && existingToken !== '0x0000000000000000000000000000000000000000') {
                        console.log(`   ℹ️  Found existing token at ${existingToken}`);
                        tokenAddress = existingToken;
                    } else {
                        console.log(`   🏭 Deploying Token via Factory: ${usedAddresses.xPNTsFactory}`);
                        
                        // deployxPNTsToken(name, symbol, communityName, communityENS, exchangeRate, paymasterAOA)
                        const { request } = await client.simulateContract({
                            address: usedAddresses.xPNTsFactory,
                            abi: factoryAbi,
                            functionName: 'deployxPNTsToken',
                            args: [
                                args.tokenName, 
                                args.tokenSymbol, 
                                args.name, // communityName
                                args.website || '', // communityENS (mapping website to ENS param for now)
                                1000000000000000000n, // exchangeRate 1e18 (1:1)
                                '0x0000000000000000000000000000000000000000' // paymasterAOA (optional)
                            ],
                            account: client.account
                        } as any);

                        const deployTx = await client.writeContract(request as any);
                        console.log(`   📤 Deploy Token Tx: ${deployTx}`);
                        const receipt = await client.waitForTransactionReceipt({ hash: deployTx });
                        const events = decodeContractEvents(receipt.logs);
                        logDecodedEvents(events);
                        results.push({ hash: deployTx, events });
                        
                        // After deployment, fetch the address again
                        tokenAddress = await client.readContract({
                            address: usedAddresses.xPNTsFactory,
                            abi: factoryAbi,
                            functionName: 'getTokenAddress',
                            args: [account.address]
                        }) as Address;
                        
                        console.log(`   🪙 Token Deployed: ${tokenAddress}`);
                    }
                } catch (e) {
                    console.warn(`   ⚠️ Token deployment step issues:`, e);
                }
            }

            // 3. Setup Governance (Reputation Rule) - Pattern logic
            if (args.governance?.initialReputationRule) {
                console.log('⚖️ Setting up Governance Rules...');
                try {
                    const ruleId = '0x0000000000000000000000000000000000000000000000000000000000000001' as Hex; // Default Rule ID 1
                    const ruleConfig = {
                        topic: '0x0000000000000000000000000000000000000000' as Address, // Topic 0
                        weight: 100n,
                        maxScore: 1000n,
                        customData: '0x' as Hex
                    };
                    const govTx = await reputationActionsObj.setReputationRule({
                        ruleId,
                        rule: ruleConfig,
                        account
                    });
                    console.log(`   ✅ Reputation Rule Set: ${govTx}`);
                    const receipt = await client.waitForTransactionReceipt({ hash: govTx });
                    const events = decodeContractEvents(receipt.logs);
                    logDecodedEvents(events);
                    results.push({ hash: govTx, events });
                } catch (e) {
                    console.warn('   ⚠️ Failed to set reputation rule:', e);
                }
            }

            return { tokenAddress, results };
        } catch (error: any) {
            const decodedMsg = decodeContractError(error);
            if (decodedMsg) {
                throw new Error(`Community Launch Failed: ${decodedMsg}`);
            }
            throw error;
        }
    };

    // State query method - check before operations
    const getCommunityInfo = async (accountAddress: Address) => {
        try {
            // 1. Check if account has COMMUNITY role
            const hasRole = await client.readContract({
                address: usedAddresses.registry,
                abi: RegistryABI,
                functionName: 'hasRole',
                args: [RoleIds.COMMUNITY, accountAddress]
            }) as boolean;

            if (!hasRole) {
                return {
                    hasRole: false,
                    tokenAddress: null,
                    communityData: null
                };
            }

            // 2. Get token address from factory
            const factoryAbi = [
                {
                    inputs: [{ name: 'community', type: 'address' }],
                    name: 'getTokenAddress',
                    outputs: [{ name: '', type: 'address' }],
                    stateMutability: 'view',
                    type: 'function'
                }
            ] as const;

            const tokenAddress = await client.readContract({
                address: usedAddresses.xPNTsFactory!,
                abi: factoryAbi,
                functionName: 'getTokenAddress',
                args: [accountAddress]
            }) as Address;

            // 3. Get community metadata from Registry
        const metadata = await client.readContract({
            address: usedAddresses.registry,
            abi: RegistryABI,
            functionName: 'roleMetadata',
            args: [RoleIds.COMMUNITY, accountAddress]
        }) as Hex;

        let communityData = {
            name: 'Community',
            ensName: '',
            website: '',
            description: '',
            logoURI: ''
        };

        if (metadata && metadata !== '0x') {
            try {
                // RoleMetadata is encoded as CommunityRoleData struct:
                // (string name, string ensName, string website, string description, string logoURI, uint256 stakeAmount)
                const decoded = RoleDataFactory.decodeCommunity(metadata);
                communityData = {
                    name: decoded.name || 'Community',
                    ensName: decoded.ensName || '',
                    website: decoded.website || '',
                    description: decoded.description || '',
                    logoURI: decoded.logoURI || ''
                };
            } catch (e) {
                console.warn('   ⚠️ Failed to decode community metadata:', e);
            }
        }

        return {
            hasRole: true,
            tokenAddress: (tokenAddress && tokenAddress !== '0x0000000000000000000000000000000000000000') ? tokenAddress : null,
            communityData: (metadata && metadata !== '0x') ? communityData : null
        };
    } catch (error) {
            console.error('Error fetching community info:', error);
            return {
                hasRole: false,
                tokenAddress: null,
                communityData: null
            };
        }
    };

    return Object.assign(client, registryActionsObj, sbtActionsObj, reputationActionsObj, { 
        launch,
        getCommunityInfo
    }) as CommunityClient;
}
