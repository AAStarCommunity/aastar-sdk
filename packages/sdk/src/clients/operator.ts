import { createClient, type Client, type Transport, type Chain, type Account, type Hash, type Hex, erc20Abi, publicActions, walletActions, type PublicActions, type WalletActions, type Address, keccak256, stringToBytes, zeroAddress } from 'viem';

import {
    stakingActions,
    registryActions,
    RegistryABI,
    superPaymasterActions,
    SuperPaymasterABI,
    paymasterActions,
    PaymasterFactoryABI,
    xPNTsTokenABI,
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
    configureOperator: (args: { xPNTsToken: Address, treasury: Address, account?: Account | Address }) => Promise<Hash>
    getOperatorStatus: (accountAddress: Address) => Promise<{
        type: 'super' | 'v4' | null;
        superPaymaster: {
            hasRole: boolean;
            isConfigured: boolean;
            balance: bigint;
            /** Exchange rate read from xPNTsToken.exchangeRate() — not from operators() */
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
                        abi: SuperPaymasterABI,
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
        async configureOperator({ xPNTsToken, treasury, account: accountOverride }: { xPNTsToken: Address, treasury: Address, account?: Account | Address }) {
            const tx = await spActions.configureOperator({
                xPNTsToken,
                opTreasury: treasury,
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
                    // v5.3.3: operators() is 9-field tuple (exchangeRate removed, minTxInterval added)
                    // [0] aPNTsBalance, [1] isConfigured, [2] isPaused, [3] xPNTsToken,
                    // [4] reputation, [5] minTxInterval, [6] treasury, [7] totalSpent, [8] totalTxSponsored
                    const operatorData = await client.readContract({
                        address: usedAddresses.superPaymaster!,
                        abi: SuperPaymasterABI,
                        functionName: 'operators',
                        args: [accountAddress]
                    }) as any;

                    if (operatorData && operatorData[1]) { // isConfigured at index 1
                        operatorType = 'super';
                        // Exchange rate is now on the xPNTs token contract, not in operators()
                        const xPNTsTokenAddr = operatorData[3] as Address;
                        let exchangeRate = 0n;
                        if (xPNTsTokenAddr && xPNTsTokenAddr !== zeroAddress) {
                            try {
                                exchangeRate = await client.readContract({
                                    address: xPNTsTokenAddr,
                                    abi: xPNTsTokenABI,
                                    functionName: 'exchangeRate',
                                }) as bigint;
                            } catch (rateErr: unknown) {
                                // ContractFunctionExecutionError = contract not deployed yet (expected, silent)
                                // Anything else = RPC or decode failure (log warning)
                                const msg = rateErr instanceof Error ? rateErr.message : String(rateErr);
                                if (!msg.includes('ContractFunctionExecutionError') && !msg.includes('code: -32')) {
                                    console.warn(`   ⚠️ Unexpected error reading exchangeRate from ${xPNTsTokenAddr}:`, msg);
                                }
                            }
                        }
                        superPaymasterInfo = {
                            hasRole: true,
                            isConfigured: true,
                            balance: operatorData[0],
                            exchangeRate,
                            treasury: operatorData[6]
                        };
                    }
                }
                
                // 检查 Paymaster V4 (Direct)
                if (usedAddresses.paymasterFactory && usedAddresses.paymasterFactory !== zeroAddress) {
                    try {
                        const pmAddr = await client.readContract({
                            address: usedAddresses.paymasterFactory,
                            abi: PaymasterFactoryABI,
                            functionName: 'getPaymasterByOperator',
                            args: [accountAddress]
                        }) as Address;
            
                        if (pmAddr !== zeroAddress) {
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
