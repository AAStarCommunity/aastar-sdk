import { createClient, type Client, type Transport, type Chain, type Account, publicActions, walletActions, type PublicActions, type WalletActions, type Address, parseAbi } from 'viem';
import {
    registryActions, 
    superPaymasterActions,
    paymasterV4Actions, 
    stakingActions,
    sbtActions,
    dvtActions,
    xPNTsFactoryActions,
    aggregatorActions,
    type RegistryActions, 
    type SuperPaymasterActions,
    type PaymasterV4Actions, 
    type StakingActions, 
    type SBTActions,
    type DVTActions,
    type XPNTsFactoryActions,
    type AggregatorActions,
    type TokenActions,
    CORE_ADDRESSES, 
    TOKEN_ADDRESSES,
    tokenActions
} from '@aastar/core';
import { decodeContractError } from '../errors/decoder.js';

export type AdminClient = Client<Transport, Chain, Account | undefined> & PublicActions<Transport, Chain, Account | undefined> & WalletActions<Chain, Account | undefined> & RegistryActions & SuperPaymasterActions & PaymasterV4Actions & StakingActions & SBTActions & DVTActions & XPNTsFactoryActions & AggregatorActions & TokenActions & {
    system: SystemModule;
    finance: FinanceModule;
    operators: OperatorsModule;
};

async function wrapAdminCall<T>(fn: () => Promise<T>, operationName: string): Promise<T> {
    try {
        return await fn();
    } catch (error: any) {
        const decodedMsg = decodeContractError(error);
        if (decodedMsg) {
            throw new Error(`Admin Operation [${operationName}] Failed: ${decodedMsg}`);
        }
        throw error;
    }
}

class SystemModule {
    constructor(private client: AdminClient) {}

    // Registry / Configuration Management
    async grantRole(args: { roleId: `0x${string}`; user: Address; data: `0x${string}`; account?: Account }) {
        return wrapAdminCall(() => this.client.registerRole(args), 'grantRole'); 
    }
    
    async revokeRole(args: { roleId: `0x${string}`; user: Address; account?: Account }) {
        return wrapAdminCall(() => this.client.unRegisterRole(args), 'revokeRole');
    }

    async setSuperPaymaster(paymaster: Address) {
        return wrapAdminCall(() => this.client.setSuperPaymaster({ paymaster }), 'setSuperPaymaster');
    }
}

class FinanceModule {
    constructor(private client: AdminClient) {}

    async deposit(args: { amount: bigint; account?: Account | Address }) {
        return wrapAdminCall(() => this.client.deposit(args), 'deposit');
    }

    async depositForOperator(args: { operator: Address; amount: bigint; account?: Account | Address }) {
        return wrapAdminCall(() => this.client.depositForOperator(args), 'depositForOperator');
    }

    async withdrawTo(args: { to: Address; amount: bigint; account?: Account | Address }) {
        return wrapAdminCall(() => this.client.withdrawTo(args), 'withdrawTo');
    }
}

class OperatorsModule {
    constructor(private client: AdminClient) {}

    async ban(operator: Address) {
        return wrapAdminCall(() => this.client.updateOperatorBlacklist({ operator, isBlacklisted: true }), 'ban');
    }

    async unban(operator: Address) {
        return wrapAdminCall(() => this.client.updateOperatorBlacklist({ operator, isBlacklisted: false }), 'unban');
    }

    async setPaused(operator: Address, paused: boolean) {
        return wrapAdminCall(() => this.client.setOperatorPaused({ operator, paused }), 'setPaused');
    }
}

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
        ...superPaymasterActions(usedAddresses.superPaymaster)(baseClient as any),
        ...paymasterV4Actions(usedAddresses.paymasterV4)(baseClient as any),
        ...stakingActions(usedAddresses.gTokenStaking)(baseClient as any),
        ...sbtActions(usedAddresses.mySBT)(baseClient as any),
        ...dvtActions()(baseClient as any),
        ...xPNTsFactoryActions(usedAddresses.xPNTsFactory || '0x')(baseClient as any),
        ...aggregatorActions()(baseClient as any),
        ...tokenActions()(baseClient as any),
    };

    const client = Object.assign(baseClient, actions) as any;
    
    // Attach Namespaces
    client.system = new SystemModule(client as AdminClient);
    client.finance = new FinanceModule(client as AdminClient);
    client.operators = new OperatorsModule(client as AdminClient);

    return client as AdminClient;
}
