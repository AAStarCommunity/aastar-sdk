import { createClient, type Client, type Transport, type Chain, type Account, publicActions, walletActions, type PublicActions, type WalletActions, type Address, type Hex, parseAbi } from 'viem';
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
    tokenActions,
    validateAddress,
    validateAmount,
    validateHex
} from '@aastar/core';
import { AAStarError, createError } from '../errors/AAStarError.js';
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
        throw createError.contract(operationName, decodedMsg || error.message);
    }
}

class SystemModule {
    constructor(private client: AdminClient) {}

    // Registry / Configuration Management
    async grantRole(args: { roleId: Hex; user: Address; data: Hex; account?: Account | Address }) {
        validateHex(args.roleId, 'Role ID');
        validateAddress(args.user, 'User Address');
        return wrapAdminCall(() => (this.client as any).registryRegisterRole(args), 'grantRole'); 
    }
    
    async revokeRole(args: { roleId: Hex; user: Address; account?: Account | Address }) {
        validateHex(args.roleId, 'Role ID');
        validateAddress(args.user, 'User Address');
        return wrapAdminCall(() => (this.client as any).registryUnRegisterRole(args), 'revokeRole');
    }

    async setSuperPaymaster(paymaster: Address) {
        validateAddress(paymaster, 'SuperPaymaster Address');
        return wrapAdminCall(() => (this.client as any).registrySetSuperPaymaster({ paymaster }), 'setSuperPaymaster');
    }
}

class FinanceModule {
    constructor(private client: AdminClient) {}

    async deposit(args: { amount: bigint; account?: Account | Address }) {
        validateAmount(args.amount, 'Deposit Amount');
        return wrapAdminCall(() => (this.client as any).superPaymasterDeposit(args), 'deposit');
    }

    async depositForOperator(args: { operator: Address; amount: bigint; account?: Account | Address }) {
        validateAddress(args.operator, 'Operator Address');
        validateAmount(args.amount, 'Deposit Amount');
        return wrapAdminCall(() => (this.client as any).superPaymasterDepositFor(args), 'depositForOperator');
    }

    async withdrawTo(args: { to: Address; amount: bigint; account?: Account | Address }) {
        validateAddress(args.to, 'To Address');
        validateAmount(args.amount, 'Withdraw Amount');
        return wrapAdminCall(() => (this.client as any).superPaymasterWithdrawTo(args), 'withdrawTo');
    }
}

class OperatorsModule {
    constructor(private client: AdminClient) {}

    async ban(operator: Address) {
        validateAddress(operator, 'Operator Address');
        // V3 update: updateOperatorBlacklist logic might need proof, users, statuses
        // For now, mapping to registryUpdateOperatorBlacklist with defaults if compatible
        return wrapAdminCall(() => (this.client as any).registryUpdateOperatorBlacklist({ 
            users: [operator], 
            statuses: [true], 
            proof: '0x' 
        }), 'ban');
    }

    async unban(operator: Address) {
        validateAddress(operator, 'Operator Address');
        return wrapAdminCall(() => (this.client as any).registryUpdateOperatorBlacklist({ 
            users: [operator], 
            statuses: [false], 
            proof: '0x' 
        }), 'unban');
    }

    async setPaused(operator: Address, paused: boolean) {
        validateAddress(operator, 'Operator Address');
        return wrapAdminCall(() => (this.client as any).superPaymasterSetOperatorPaused({ operator, paused }), 'setPaused');
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
