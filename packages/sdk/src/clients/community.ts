import { createClient, type Client, type Transport, type Chain, type Account, publicActions, walletActions, type PublicActions, type WalletActions, type Address } from 'viem';
import { 
    registryActions, 
    sbtActions, 
    type RegistryActions, 
    type SBTActions, 
    CORE_ADDRESSES, 
    TOKEN_ADDRESSES 
} from '@aastar/core';
import { RoleDataFactory, RoleIds } from '../utils/roleData.js';

export type CommunityClient = Client<Transport, Chain, Account | undefined> & PublicActions<Transport, Chain, Account | undefined> & WalletActions<Chain, Account | undefined> & RegistryActions & SBTActions & {
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
    }) => Promise<{ tokenAddress: Address; txs: Hex[] }>;
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

    const usedAddresses = { ...CORE_ADDRESSES, ...TOKEN_ADDRESSES, ...addresses };

    const registryActionsObj = registryActions(usedAddresses.registry)(client as any);
    const sbtActionsObj = sbtActions(usedAddresses.mySBT)(client as any);

    const launch = async (args: {
        name: string;
        tokenName: string;
        tokenSymbol: string;
        description?: string;
        logoURI?: string;
        website?: string;
    }): Promise<{ tokenAddress: Address; txs: Hex[] }> => {
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

            // Register community role
            console.log(`   📤 Registering community role...`);
            console.log(`   📋 Params:`, {
                roleId: RoleIds.COMMUNITY,
                user: account.address,
                dataLength: roleData?.length,
                accountExists: !!account
            });
            console.log(`   📋 Full data:`, roleData);
            
            const registerTx = await registryActionsObj.registerRole({
                roleId: RoleIds.COMMUNITY,
                user: account.address,
                data: roleData,
                account: account
            });
            console.log(`   ✅ Community registered: ${registerTx}`);

            // Deploy xPNTs token (if factory is available)
            let tokenAddress: Address = '0x0000000000000000000000000000000000000000' as Address;
            const txs: Hex[] = [registerTx];

            console.log(`✅ Community ${uniqueName} launched successfully!`);
            console.log(`   Token Address: ${tokenAddress}`);
            console.log(`   Transactions: ${txs.length}`);

            return { tokenAddress, txs };
        } catch (error: any) {
            console.error('❌ Error in launch():', error);
            
            // 检查是否是 RoleAlreadyGranted 错误
            const errorMessage = error.message || '';
            const errorData = error.data?.errorName || '';
            const errorString = JSON.stringify(error);
            
            if (errorMessage.includes('RoleAlreadyGranted') || 
                errorData === 'RoleAlreadyGranted' ||
                errorString.includes('RoleAlreadyGranted')) {
                throw new Error(`Account ${account.address} already has COMMUNITY role. Please use a different account or exit the role first.`);
            }
            
            // 检查其他常见错误
            if (errorMessage.includes('InsufficientStake')) {
                throw new Error('Insufficient stake. Please ensure you have enough GToken staked.');
            }
            
            if (errorMessage.includes('RoleNotConfigured')) {
                throw new Error('COMMUNITY role is not configured in the Registry contract.');
            }
            
            // 重新抛出原始错误
            throw new Error(`Failed to launch community: ${errorMessage}`);
        }
    };

    return Object.assign(client, {
        ...registryActionsObj,
        ...sbtActionsObj,
        launch
    }) as CommunityClient;
}
