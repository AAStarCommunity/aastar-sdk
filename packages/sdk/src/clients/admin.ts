import { createClient, type Client, type Transport, type Chain, type Account, publicActions, walletActions, type PublicActions, type WalletActions, type Address } from 'viem';
import {
    registryActions, 
    superPaymasterActions,
    paymasterActions, 
    stakingActions,
    sbtActions,
    dvtActions,
    xPNTsFactoryActions,
    aggregatorActions,
    type RegistryActions, 
    type SuperPaymasterActions,
    type PaymasterActions, 
    type StakingActions, 
    type SBTActions,
    type DVTActions,
    type XPNTsFactoryActions,
    type AggregatorActions,
    CORE_ADDRESSES,
    TOKEN_ADDRESSES,
    getCanonicalAddresses,
    listSupportedChainIds
} from '@aastar/core';

const ADDRESS_PLACEHOLDER: Address = '0x0000000000000000000000000000000000000000';

export type AdminClient = Client<Transport, Chain, Account | undefined> & PublicActions<Transport, Chain, Account | undefined> & WalletActions<Chain, Account | undefined> & RegistryActions & SuperPaymasterActions & PaymasterActions & StakingActions & SBTActions & DVTActions & XPNTsFactoryActions & AggregatorActions;

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
        
    // Auto-resolve the contract address book from `chain.id` (seamless multi-chain).
    // Precedence: explicit `addresses` > canonical-by-chainId > static CORE_ADDRESSES fallback.
    const chainDefaults = getCanonicalAddresses(chain.id);
    if (!chainDefaults && !addresses) {
        throw new Error(
            `[createAdminClient] No canonical addresses for chainId ${chain.id}. ` +
            `Pass \`addresses\` explicitly, or use a supported chain: ${listSupportedChainIds().join(', ')}.`,
        );
    }
    const usedAddresses = { ...CORE_ADDRESSES, ...TOKEN_ADDRESSES, ...chainDefaults, ...addresses };

    const actions = {
        ...registryActions(usedAddresses.registry)(baseClient as any),
        ...superPaymasterActions(usedAddresses.superPaymaster)(baseClient as any),
        ...paymasterActions(usedAddresses.paymasterV4)(baseClient as any),
        ...stakingActions(usedAddresses.gTokenStaking)(baseClient as any),
        ...sbtActions(usedAddresses.mySBT)(baseClient as any),
        ...dvtActions(ADDRESS_PLACEHOLDER)(baseClient as any),
        ...xPNTsFactoryActions(usedAddresses.xPNTsFactory || '0x')(baseClient as any),
        ...aggregatorActions(ADDRESS_PLACEHOLDER)(baseClient as any),
    };

    return Object.assign(baseClient, actions) as unknown as AdminClient;
}
