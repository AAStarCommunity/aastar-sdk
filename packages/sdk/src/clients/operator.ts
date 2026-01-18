import { createClient, type Client, type Transport, type Chain, type Account, type Hash, type Hex, erc20Abi, parseAbi, publicActions, walletActions, type PublicActions, type WalletActions, type Address, keccak256, stringToBytes } from 'viem';

import { 
    stakingActions, 
    registryActions,
    RegistryABI,
    superPaymasterActions,

    paymasterActions,
    PaymasterFactoryABI,
    type StakingActions, 
    type RegistryActions,
    type SuperPaymasterActions,
    type PaymasterActions,
    CORE_ADDRESSES,
    TEST_TOKEN_ADDRESSES,
    TEST_ACCOUNT_ADDRESSES
} from '@aastar/core';
import { RoleDataFactory } from '../utils/roleData.js';
import { decodeContractError } from '../errors/decoder.js';

export type OperatorClient = Client<Transport, Chain, Account | undefined> & PublicActions<Transport, Chain, Account | undefined> & WalletActions<Chain, Account | undefined> & RegistryActions & SuperPaymasterActions & PaymasterActions & StakingActions & {
    /**
     * High-level API: Setup operator with automatic funding and onboarding
     */
    setup: (args: { stakeAmount: bigint, depositAmount: bigint, roleId: Hex, roleData?: Hex }) => Promise<{ txs: Hash[] }>;
    deployPaymasterV4: (args?: { version?: string, initData?: Hex }) => Promise<Hash>;
    /**
     * Orchestrates the full onboarding flow:
     * 1. Approve GToken (Stake)
     * 2. Register Role (Stake Lock)
     * 3. Approve aPNTs (Deposit)
     * 4. Deposit aPNTs (SuperPaymaster)
     */
    onboardOperator: (args: { stakeAmount: bigint, depositAmount: bigint, roleId: Hex, roleData?: Hex }) => Promise<Hash[]>;
    /** @deprecated Use onboardOperator */
    onboardToSuperPaymaster: (args: { stakeAmount: bigint, depositAmount: bigint, roleId: Hex }) => Promise<Hash[]>
    configureOperator: (args: { xPNTsToken: Address, treasury: Address, exchangeRate: bigint, account?: Account | Address }) => Promise<Hash>
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
    }>
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
    const pmV4Actions = paymasterActions(usedAddresses.paymasterV4)(client as any);

    const actions = {
        ...stkActions,
        ...spActions,
        ...pmV4Actions,
        ...regActions,

        async setup(args: { stakeAmount: bigint, depositAmount: bigint, roleId: Hex, roleData?: Hex }) {
            console.log('⚙️ Setting up operator...');
            const txs = await (this as any)._onboardOperator(args);
            console.log(`✅ Operator setup complete! Transactions: ${txs.length}`);
            return { txs };
        },
        async onboardOperator(args: { stakeAmount: bigint, depositAmount: bigint, roleId: Hex, roleData?: Hex }) {
            return this.onboardFully(args);
        },
        async onboardFully(args: { stakeAmount: bigint, depositAmount: bigint, roleId: Hex, roleData?: Hex }) {
            return (this as any)._onboardOperator(args);
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
        async _onboardOperator({ stakeAmount, depositAmount, roleId, roleData }: { stakeAmount: bigint, depositAmount: bigint, roleId: Hex, roleData?: Hex }) {
            const txs: Hash[] = [];
            const accountToUse = account; 
            if (!accountToUse) throw new Error("Account required for onboarding");

            try {
                // 1. Fetch Entry Burn & Approve GToken
                console.log('   SDK: Fetching role config for entry burn...');
                const roleConfig = await (client as any).readContract({
                    address: usedAddresses.registry,
                    abi: RegistryABI,
                    functionName: 'roleConfigs',
                    args: [roleId]
                }) as any; 

                const entryBurn = roleConfig[1]; 
                const totalStakeNeeded = stakeAmount + entryBurn;

                console.log(`   SDK: Approving GToken (Stake: ${stakeAmount}, Burn: ${entryBurn})...`);
                const approveGToken = await (client as any).writeContract({
                    address: usedAddresses.gToken,
                    abi: erc20Abi,
                    functionName: 'approve',
                    args: [usedAddresses.gTokenStaking, totalStakeNeeded],
                    account: accountToUse,
                    chain
                });
                await (client as any).waitForTransactionReceipt({ hash: approveGToken });
                txs.push(approveGToken);

                // 2. Register Role
                let data: Hex;
                if (roleData && roleData !== '0x') {
                    data = roleData;
                } else {
                    console.log(`   SDK: Auto-generating roleData for roleId ${roleId}...`);
                    if (roleId === keccak256(stringToBytes('COMMUNITY'))) {
                        data = RoleDataFactory.community();
                    } else if (roleId === keccak256(stringToBytes('ENDUSER'))) {
                        data = RoleDataFactory.endUser();
                    } else if (roleId === keccak256(stringToBytes('PAYMASTER_SUPER'))) {
                        data = RoleDataFactory.paymasterSuper();
                    } else {
                        data = RoleDataFactory.paymasterSuper();
                    }
                }
                
                console.log(`   SDK: Checking if role already granted...`);
                const hasRoleResult = await (client as any).readContract({
                    address: usedAddresses.registry,
                    abi: RegistryABI,
                    functionName: 'hasRole',
                    args: [roleId, accountToUse!.address]
                }) as boolean;

                if (hasRoleResult) {
                    console.log(`   ℹ️  Role already granted, skipping registration`);
                } else {
                    console.log(`   SDK: Registering role ${roleId}...`);
                    const registerTx = await actions.registerRoleSelf({
                        roleId,
                        data, 
                        account: accountToUse
                    });
                    await (client as any).waitForTransactionReceipt({ hash: registerTx });
                    txs.push(registerTx);
                }

                if (depositAmount > 0n) {
                    console.log('   SDK: Depositing aPNTs via depositFor...');
                    const depositTx = await (client as any).writeContract({
                        address: usedAddresses.superPaymaster,
                        abi: parseAbi(['function depositFor(address targetOperator, uint256 amount) external']),
                        functionName: 'depositFor',
                        args: [accountToUse.address, depositAmount],
                        account: accountToUse,
                        chain
                    });
                    await (client as any).waitForTransactionReceipt({ hash: depositTx });
                    txs.push(depositTx);
                }

                return txs;
            } catch (error) {
                const decodedMsg = decodeContractError(error);
                throw decodedMsg ? new Error(`Onboarding Failed: ${decodedMsg}`) : error;
            }
        },
        async onboardToSuperPaymaster(args: { stakeAmount: bigint, depositAmount: bigint, roleId: Hex }) {
            return this.onboardOperator(args);
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
        }
    };

    return Object.assign(client, actions) as unknown as OperatorClient;
}
