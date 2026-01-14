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
} from 'viem';

import { 
    registryActions, 
    RegistryABI,
    xPNTsFactoryABI, 
    sbtActions,
    reputationActions,
    type RegistryActions,
    type SBTActions,
    type ReputationActions,
    CORE_ADDRESSES,
    TEST_TOKEN_ADDRESSES,
    validateAddress
} from '@aastar/core';
import { AAStarError, AAStarErrorCode as AAStarErrorType } from '../errors/AAStarError.js';
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
    }) => {
        if (!account) throw new Error("Account required for launch");
        
        // Input Validation
        if (!args.name) throw new AAStarError("Community Name is required", AAStarErrorType.VALIDATION_ERROR);
        if (!args.tokenName) throw new AAStarError("Token Name is required", AAStarErrorType.VALIDATION_ERROR);
        if (!args.tokenSymbol) throw new AAStarError("Token Symbol is required", AAStarErrorType.VALIDATION_ERROR);

        const results: { hash: Hash, events: DecodedEvent[] }[] = [];
        let tokenAddress: Address = '0x0000000000000000000000000000000000000000';

        try {
            console.log(`🚀 Launching Community "${args.name}"...`);

            // 1. Register Role (Community)
            // Using helper logic to reuse data encoding
            const communityRoleData = {
                name: args.name,
                ensName: '',
                website: args.website || '',
                description: args.description || '',
                logoURI: args.logoURI || '',
                stakeAmount: args.governance?.minStake || 0n
            };

            const roleDataHex = RoleDataFactory.community(communityRoleData);
            
            // Register Role
            console.log('   Registry: Registering Role...');
            try {
                const regTx = await registryActionsObj.registryRegisterRoleSelf({
                    roleId: RoleIds.COMMUNITY,
                    data: roleDataHex,
                    account
                });
                console.log(`   ✅ Registered: ${regTx}`);
                const receipt = await client.waitForTransactionReceipt({ hash: regTx });
                const events = decodeContractEvents(receipt.logs);
                logDecodedEvents(events);
                results.push({ hash: regTx, events });
            } catch (e: any) {
                // If already registered, we continue
                console.log('   ℹ️ Role registration check:', e.message || 'Already registered');
            }

            // 2. Deploy xPNTs Token via Factory
            if (usedAddresses.xPNTsFactory) {
                // Check if token already exists
                try {
                    const existingToken = await client.readContract({
                        address: usedAddresses.xPNTsFactory,
                        abi: xPNTsFactoryABI,
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
                            abi: xPNTsFactoryABI,
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
                            abi: xPNTsFactoryABI,
                            functionName: 'getTokenAddress',
                            args: [account.address]
                        }) as Address;
                        
                        console.log(`   🪙 Token Deployed: ${tokenAddress}`);
                    }
                } catch (e) {
                    console.warn(`   ⚠️ Token deployment step issues:`, e);
                }
            } else {
                console.warn(`   ⚠️ xPNTsFactory address missing, skipping token deployment.`);
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
                throw new AAStarError(`Community Launch Failed: ${decodedMsg}`, AAStarErrorType.CONTRACT_ERROR);
            }
            throw error;
        }
    };

    // State query method - check before operations
    const getCommunityInfo = async (accountAddress: Address) => {
        try {
            validateAddress(accountAddress, 'Account Address');

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
            let tokenAddress: Address | null = null;
            if (usedAddresses.xPNTsFactory) {
                 tokenAddress = await client.readContract({
                    address: usedAddresses.xPNTsFactory,
                    abi: xPNTsFactoryABI,
                    functionName: 'getTokenAddress',
                    args: [accountAddress]
                }) as Address;
            }

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
