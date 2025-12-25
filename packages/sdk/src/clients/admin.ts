import { createClient, type Client, type Transport, type Chain, type Account, publicActions, walletActions, type PublicActions, type WalletActions, type Address } from 'viem';
import {
    registryActions, 
    paymasterActions, 
    stakingActions,
    sbtActions,
    dvtActions,
    factoryActions,
    aggregatorActions,
    type RegistryActions, 
    type PaymasterActions, 
    type StakingActions, 
    type SBTActions,
    type DVTActions,
    type FactoryActions,
    type AggregatorActions,
    CORE_ADDRESSES, 
    TOKEN_ADDRESSES 
} from '@aastar/core';

export type AdminClient = Client<Transport, Chain, Account | undefined> & PublicActions<Transport, Chain, Account | undefined> & WalletActions<Chain, Account | undefined> & RegistryActions & PaymasterActions & StakingActions & SBTActions & DVTActions & FactoryActions & AggregatorActions;

export function createAdminClient({ 
    chain, 
    transport, 
    account,
    addresses
}: { 
    chain: Chain, 
    transport: Transport,
    account?: Account,
    addresses?: { [key: string]: Address }
}): AdminClient {
    const baseClient = createClient({ chain, transport, account })
        .extend(publicActions)
        .extend(walletActions);
        
    const usedAddresses = { ...CORE_ADDRESSES, ...TOKEN_ADDRESSES, ...addresses };

    const actions = {
        ...registryActions(usedAddresses.registry)(baseClient as any),
        ...paymasterActions(usedAddresses.superPaymasterV2)(baseClient as any),
        ...stakingActions(usedAddresses.gTokenStaking)(baseClient as any),
        ...sbtActions(usedAddresses.mySBT)(baseClient as any),
        ...dvtActions()(baseClient as any),
        ...factoryActions()(baseClient as any),
        ...aggregatorActions()(baseClient as any),
    };

    return Object.assign(baseClient, actions) as AdminClient;
}
