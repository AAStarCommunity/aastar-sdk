import { createClient, type Client, type Transport, type Chain, type Account } from 'viem';
import { 
    registryActions, 
    sbtActions, 
    paymasterActions, 
    type RegistryActions, 
    type SBTActions, 
    type PaymasterActions, 
    CORE_ADDRESSES, 
    TOKEN_ADDRESSES 
} from '@aastar/core';

export type EndUserClient = Client<Transport, Chain, Account | undefined> & RegistryActions & SBTActions & PaymasterActions;

export function createEndUserClient({ 
    chain, 
    transport, 
    account 
}: { 
    chain: Chain, 
    transport: Transport,
    account?: Account 
}): EndUserClient {
    const client = createClient({ 
        chain, 
        transport,
        account
    });

    return client
        .extend(registryActions(CORE_ADDRESSES.registry))
        .extend(sbtActions(TOKEN_ADDRESSES.mySBT))
        .extend(paymasterActions(CORE_ADDRESSES.superPaymasterV2)) as EndUserClient;
}
