import { createClient, type Client, type Transport, type Chain, type Account, publicActions, walletActions, type PublicActions, type WalletActions, type Address } from 'viem';
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

export type EndUserClient = Client<Transport, Chain, Account | undefined> & PublicActions<Transport, Chain, Account | undefined> & WalletActions<Chain, Account | undefined> & RegistryActions & SBTActions & PaymasterActions;

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

    const usedAddresses = { ...CORE_ADDRESSES, ...TOKEN_ADDRESSES, ...addresses };

    const actions = {
        ...registryActions(usedAddresses.registry)(client as any),
        ...sbtActions(usedAddresses.mySBT)(client as any),
        ...paymasterActions(usedAddresses.superPaymasterV2)(client as any)
    };

    return Object.assign(client, actions) as EndUserClient;
}
