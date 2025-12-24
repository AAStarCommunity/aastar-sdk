import { createClient, type Client, type Transport, type Chain, type Account } from 'viem';
import { 
    registryActions, 
    paymasterActions, 
    stakingActions,
    sbtActions,
    type RegistryActions, 
    type PaymasterActions, 
    type StakingActions,
    type SBTActions,
    CORE_ADDRESSES, 
    TOKEN_ADDRESSES 
} from '@aastar/core';

export type AdminClient = Client<Transport, Chain, Account | undefined> & RegistryActions & PaymasterActions & StakingActions & SBTActions;

export function createAdminClient({ 
    chain, 
    transport, 
    account 
}: { 
    chain: Chain, 
    transport: Transport,
    account?: Account 
}): AdminClient {
    return createClient({ chain, transport, account })
        .extend(registryActions(CORE_ADDRESSES.registry))
        .extend(paymasterActions(CORE_ADDRESSES.superPaymasterV2))
        .extend(stakingActions(CORE_ADDRESSES.gTokenStaking))
        .extend(sbtActions(TOKEN_ADDRESSES.mySBT)) as AdminClient;
}
