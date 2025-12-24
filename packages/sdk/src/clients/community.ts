import { createClient, type Client, type Transport, type Chain, type Account } from 'viem';
import { 
    registryActions, 
    sbtActions, 
    type RegistryActions, 
    type SBTActions, 
    CORE_ADDRESSES, 
    TOKEN_ADDRESSES 
} from '@aastar/core';

export type CommunityClient = Client<Transport, Chain, Account | undefined> & RegistryActions & SBTActions;

export function createCommunityClient({ 
    chain, 
    transport, 
    account 
}: { 
    chain: Chain, 
    transport: Transport,
    account?: Account 
}): CommunityClient {
    const client = createClient({ 
        chain, 
        transport,
        account
    });

    return client
        .extend(registryActions(CORE_ADDRESSES.registry))
        .extend(sbtActions(TOKEN_ADDRESSES.mySBT)) as CommunityClient;
}
