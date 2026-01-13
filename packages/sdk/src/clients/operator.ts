import { createClient, type Client, type Transport, type Chain, type Account, type Hash, type Hex, erc20Abi, parseAbi, publicActions, walletActions, type PublicActions, type WalletActions, type Address, keccak256, stringToBytes } from 'viem';

import { 
    stakingActions, 
    registryActions,
    RegistryABI,
    superPaymasterActions,

    paymasterV4Actions,
    PaymasterFactoryABI,
    tokenActions,
    type StakingActions, 
    type RegistryActions,
    type SuperPaymasterActions,
    type PaymasterV4Actions,
    type TokenActions,
    CORE_ADDRESSES,
    TEST_TOKEN_ADDRESSES,
    TEST_ACCOUNT_ADDRESSES
} from '@aastar/core';
import { RoleDataFactory } from '../utils/roleData.js';
import { decodeContractError } from '../errors/decoder.js';
import { decodeContractEvents, logDecodedEvents, type DecodedEvent } from '../utils/eventDecoder.js';

export type OperatorClient = Client<Transport, Chain, Account | undefined> & PublicActions<Transport, Chain, Account | undefined> & WalletActions<Chain, Account | undefined> & RegistryActions & SuperPaymasterActions & PaymasterV4Actions & StakingActions & {
    /**
     * High-level API: Setup operator with automatic funding and onboarding
     */
    setup: (args: { stakeAmount: bigint, depositAmount: bigint, roleId: Hex, roleData?: Hex }) => Promise<{ txs: { hash: Hash, events: DecodedEvent[] }[] }>;
    deployPaymasterV4: (args?: { version?: string, initData?: Hex }) => Promise<Hash>;
    /**
     * Orchestrates the full onboarding flow:
     * 1. Approve GToken (Stake)
     * 2. Register Role (Stake Lock)
     * 3. Approve aPNTs (Deposit)
     * 4. Deposit aPNTs (SuperPaymaster)
     */
    onboardFully: (args: { stakeAmount: bigint, depositAmount: bigint, roleId: Hex, roleData?: Hex, gasTokens?: Address[] }) => Promise<{ hash: Hash, events: DecodedEvent[] }[]>;
    /** @deprecated Use onboardFully */
    onboardOperator: (args: { stakeAmount: bigint, depositAmount: bigint, roleId: Hex, roleData?: Hex }) => Promise<{ hash: Hash, events: DecodedEvent[] }[]>;
    configureOperator: (args: { xPNTsToken: Address, treasury: Address, exchangeRate: bigint, account?: Account | Address }) => Promise<Hash>;
    
    /**
     * 🧙 Wisdom: Check if operator is ready and compliant.
     */
    checkReadiness: () => Promise<{
        isRegistered: boolean;
        isConfigured: boolean;
        collateralBalance: bigint;
        isPaused: boolean;
        roleStatus: boolean;
    }>;

    getOperatorStatus: (accountAddress: Address) => Promise<{
        type: 'super' | 'v4' | null;
        superPaymaster: {
            hasRole: boolean;
            isConfigured: boolean;
            balance: bigint;
            exchangeRate: bigint;
            treasury: Address;
        } | null;
        paymasterV4: {
            address: Address;
            balance: bigint;
        } | null;
    }>;
    isOperator: (operator: Address) => Promise<boolean>;
    getDepositDetails: () => Promise<{ deposit: bigint }>;
};


export function createOperatorClient({ 
    chain, 
    transport, 
    account,
    addresses
}: { 
    chain: Chain, 
    transport: Transport,
    account?: Account,
    addresses?: { [key: string]: Address }
}): OperatorClient {
    const client = createClient({ 
        chain, 
        transport,
        account
    })
    .extend(publicActions)
    .extend(walletActions);

    const usedAddresses = { ...CORE_ADDRESSES, ...TEST_TOKEN_ADDRESSES, ...TEST_ACCOUNT_ADDRESSES, ...addresses };

    const spActions = superPaymasterActions(usedAddresses.superPaymaster)(client as any);
    const regActions = registryActions(usedAddresses.registry)(client as any);
    const stkActions = stakingActions(usedAddresses.gTokenStaking)(client as any);
    const pmV4Actions = paymasterV4Actions(usedAddresses.paymasterV4)(client as any);
    const tkActions = tokenActions()(client as any);

    const actions = {
        ...stkActions,
        ...spActions,
        ...pmV4Actions,
        ...regActions,

        async setup(args: { stakeAmount: bigint, depositAmount: bigint, roleId: Hex, roleData?: Hex }) {
            console.log('⚙️ Setting up operator...');
            const txs = await this.onboardFully(args);
            console.log(`✅ Operator setup complete! Transactions: ${txs.length}`);
            return { txs };
        },

        async onboardOperator(args: { stakeAmount: bigint, depositAmount: bigint, roleId: Hex, roleData?: Hex }) {
            return this.onboardFully(args);
        },

        async onboardToSuperPaymaster(args: { stakeAmount: bigint, depositAmount: bigint, roleId: Hex }) {
            return this.onboardFully(args);
        },

        async onboardFully(args: { stakeAmount: bigint, depositAmount: bigint, roleId: Hex, roleData?: Hex, gasTokens?: Address[] }) {
            const results: { hash: Hash, events: DecodedEvent[] }[] = [];
            const accountToUse = account; 
            if (!accountToUse) throw new Error("Account required for onboarding");

            try {
                // 1. Fetch Entry Burn & Approve GToken
                console.log('   SDK: Fetching role config for entry burn...');
                const roleConfig = await (client as any).readContract({
                    address: usedAddresses.registry,
                    abi: RegistryABI,
                    functionName: 'roleConfigs',
                    args: [args.roleId]
                }) as any; 

                const entryBurn = roleConfig[1]; 
                const totalStakeNeeded = args.stakeAmount + entryBurn;

                console.log(`   SDK: Approving GToken (Stake: ${args.stakeAmount}, Burn: ${entryBurn})...`);
                const approveStkTx = await tkActions.approve({
                    token: usedAddresses.gToken,
                    spender: usedAddresses.gTokenStaking,
                    amount: totalStakeNeeded,
                    account: accountToUse
                });
                const receipt = await (client as any).waitForTransactionReceipt({ hash: approveStkTx });
                const events = decodeContractEvents(receipt.logs);
                logDecodedEvents(events);
                results.push({ hash: approveStkTx, events });

                // 2. Register Role
                let data: Hex;
                if (args.roleData && args.roleData !== '0x') {
                    data = args.roleData;
                } else {
                    console.log(`   SDK: Auto-generating roleData for roleId ${args.roleId}...`);
                    if (args.roleId === keccak256(stringToBytes('COMMUNITY'))) {
                        data = RoleDataFactory.community();
                    } else if (args.roleId === keccak256(stringToBytes('ENDUSER'))) {
                        data = RoleDataFactory.endUser();
                    } else if (args.roleId === keccak256(stringToBytes('PAYMASTER_SUPER'))) {
                        data = RoleDataFactory.paymasterSuper();
                    } else {
                        data = RoleDataFactory.paymasterSuper();
                    }
                }
                
                console.log(`   SDK: Checking if role already granted...`);
                const hasRoleResult = await regActions.hasRole({ 
                    user: accountToUse!.address,
                    roleId: args.roleId 
                });

                if (hasRoleResult) {
                    console.log(`   ℹ️  Role already granted, skipping registration`);
                } else {
                    console.log(`   SDK: Registering role ${args.roleId}...`);
                    const registerTx = await regActions.registerRoleSelf({
                        roleId: args.roleId,
                        data, 
                        account: accountToUse
                    });
                    const receipt = await (client as any).waitForTransactionReceipt({ hash: registerTx });
                    const events = decodeContractEvents(receipt.logs);
                    logDecodedEvents(events);
                    results.push({ hash: registerTx, events });
                }

                // 3. Deposit aPNTs
                if (args.depositAmount > 0n) {
                    console.log('   SDK: Depositing aPNTs via depositForOperator...');
                    const depositTx = await spActions.depositForOperator({
                        operator: accountToUse.address, 
                        amount: args.depositAmount,
                        account: accountToUse
                    });
                    const receipt = await (client as any).waitForTransactionReceipt({ hash: depositTx });
                    const events = decodeContractEvents(receipt.logs);
                    logDecodedEvents(events);
                    results.push({ hash: depositTx, events });
                }

                return results;
            } catch (error) {
                const decodedMsg = decodeContractError(error);
                throw decodedMsg ? new Error(`Onboarding Failed: ${decodedMsg}`) : error;
            }
        },

        async deployPaymasterV4({ version = 'v4.1', initData = '0x' }: { version?: string, initData?: Hex } = {}) {
            console.log(`   SDK: Deploying Paymaster V4 (${version})...`);
            const tx = await (client as any).writeContract({
                address: usedAddresses.paymasterFactory,
                abi: PaymasterFactoryABI,
                functionName: 'deployPaymaster',
                args: [version, initData],
                account,
                chain
            });
            await (client as any).waitForTransactionReceipt({ hash: tx });
            return tx;
        },

        async configureOperator({ xPNTsToken, treasury, exchangeRate, account: accountOverride }: { xPNTsToken: Address, treasury: Address, exchangeRate: bigint, account?: Account | Address }) {
            const tx = await spActions.configureOperator({ 
                xPNTsToken, 
                treasury, 
                exchangeRate,
                account: accountOverride || account
            });
            await (client as any).waitForTransactionReceipt({ hash: tx });
            return tx;
        },

        async checkReadiness() {
            if (!account) throw new Error("Account required for readiness check");
            const addr = account.address;
            
            const roleId = keccak256(stringToBytes('PAYMASTER_SUPER'));
            const roleStatus = await regActions.hasRole({ user: addr, roleId });
            
            const operatorData = await spActions.operators({ operator: addr });
            // operators(address) returns (uint128 aPNTsBalance, uint96 exchangeRate, bool isConfigured, bool isPaused, ...)
            
            return {
                isRegistered: roleStatus,
                isConfigured: operatorData[2],
                collateralBalance: operatorData[0],
                isPaused: operatorData[3],
                roleStatus
            };
        },

        async getOperatorStatus(accountAddress: Address) {
            try {
                const hasRole = await client.readContract({
                    address: usedAddresses.registry,
                    abi: RegistryABI,
                    functionName: 'hasRole',
                    args: [keccak256(stringToBytes('PAYMASTER_SUPER')), accountAddress]
                }) as boolean;

                let operatorType: 'super' | 'v4' | null = null;
                let superPaymasterInfo = null;
                let paymasterV4Info = null;

                if (hasRole && usedAddresses.superPaymaster) {
                    const pmAbi = parseAbi(['function operators(address) view returns (uint128 balance, uint96 exchangeRate, bool isConfigured, bool isPaused, address token, uint32 reputation, address treasury, uint256 spent, uint256 txSponsored)']);
                    const operatorData = await client.readContract({
                        address: usedAddresses.superPaymaster!,
                        abi: pmAbi,
                        functionName: 'operators',
                        args: [accountAddress]
                    }) as any;

                    if (operatorData && operatorData[2]) { // isConfigured
                        operatorType = 'super';
                        superPaymasterInfo = {
                            hasRole: true,
                            isConfigured: true,
                            balance: operatorData[0],
                            exchangeRate: operatorData[1],
                            treasury: operatorData[6]
                        };
                    }
                }
                
                // 检查 Paymaster V4 (Direct)
                if (usedAddresses.paymasterFactory && usedAddresses.paymasterFactory !== '0x0000000000000000000000000000000000000000') {
                    try {
                        const factoryAbi = parseAbi(['function getPaymasterByOperator(address) view returns (address)']);
                        const pmAddr = await client.readContract({
                            address: usedAddresses.paymasterFactory,
                            abi: factoryAbi,
                            functionName: 'getPaymasterByOperator',
                            args: [accountAddress]
                        }) as Address;
            
                        if (pmAddr !== '0x0000000000000000000000000000000000000000') {
                            operatorType = operatorType || 'v4';
                            paymasterV4Info = {
                                address: pmAddr,
                                balance: await client.getBalance({ address: pmAddr })
                            };
                        }
                    } catch (e) {
                        console.warn(`   ⚠️ Failed to fetch V4 info from factory ${usedAddresses.paymasterFactory}:`, e);
                    }
                }

                return { type: operatorType, superPaymaster: superPaymasterInfo, paymasterV4: paymasterV4Info };
            } catch (error) {
                console.error('Error in getOperatorStatus:', error);
                return { type: null, superPaymaster: null, paymasterV4: null };
            }
        },

        async isOperator(operator: Address): Promise<boolean> {
            const data = await spActions.operators({ operator });
            return data[2]; // isConfigured
        },

        async getDepositDetails(): Promise<{ deposit: bigint }> {
            const deposit = await spActions.getDeposit();
            return { deposit };
        }
    };

    return Object.assign(client, actions) as OperatorClient;
}
