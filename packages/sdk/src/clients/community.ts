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

export type CommunityClient = Client<Transport, Chain, Account | undefined> & PublicActions<Transport, Chain, Account | undefined> & WalletActions<Chain, Account | undefined> & RegistryActions & SBTActions;

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

    const actions = {
        ...registryActions(usedAddresses.registry)(client as any),
        ...sbtActions(usedAddresses.mySBT)(client as any),
    };

    return Object.assign(client, actions) as CommunityClient;
}
