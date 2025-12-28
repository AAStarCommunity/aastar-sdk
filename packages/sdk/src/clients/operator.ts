import { createClient, type Client, type Transport, type Chain, type Account, type Hash, type Hex, erc20Abi, parseAbi, publicActions, walletActions, type PublicActions, type WalletActions, type Address, keccak256, stringToBytes } from 'viem';

import { 
    stakingActions, 
    registryActions,
    RegistryABI,
    superPaymasterActions,

    paymasterV4Actions,
    type StakingActions, 
    type RegistryActions,
    type SuperPaymasterActions,
    type PaymasterV4Actions,
    CORE_ADDRESSES,
    TEST_TOKEN_ADDRESSES
} from '@aastar/core';
import { RoleDataFactory } from '../utils/roleData.js';
import { decodeContractError } from '../errors/decoder.js';

export type OperatorClient = Client<Transport, Chain, Account | undefined> & PublicActions<Transport, Chain, Account | undefined> & WalletActions<Chain, Account | undefined> & StakingActions & SuperPaymasterActions & PaymasterV4Actions & RegistryActions & {
    /**
     * High-level API: Setup operator with automatic funding and onboarding
     */
    setup: (args: { stakeAmount: bigint, depositAmount: bigint, roleId: Hex, roleData?: Hex }) => Promise<{ txs: Hash[] }>
    /**
     * Orchestrates the full onboarding flow:
     * 1. Approve GToken (Stake)
     * 2. Register Role (Stake Lock)
     * 3. Approve aPNTs (Deposit)
     * 4. Deposit aPNTs (SuperPaymaster)
     */
    onboardOperator: (args: { stakeAmount: bigint, depositAmount: bigint, roleId: Hex, roleData?: Hex }) => Promise<Hash[]>
    /** @deprecated Use onboardOperator */
    onboardToSuperPaymaster: (args: { stakeAmount: bigint, depositAmount: bigint, roleId: Hex }) => Promise<Hash[]>
    configureOperator: (args: { xPNTs: Address, treasury: Address, rate: bigint }) => Promise<Hash>
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

    const usedAddresses = { ...CORE_ADDRESSES, ...TEST_TOKEN_ADDRESSES, ...addresses };

    const actions = {
        ...stakingActions(usedAddresses.gTokenStaking)(client as any),
        ...superPaymasterActions(usedAddresses.superPaymaster)(client as any),
        ...paymasterV4Actions()(client as any),
        ...registryActions(usedAddresses.registry)(client as any),
    };

    return Object.assign(client, actions, {
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
        async _onboardOperator({ stakeAmount, depositAmount, roleId, roleData }: { stakeAmount: bigint, depositAmount: bigint, roleId: Hex, roleData?: Hex }) {
            const txs: Hash[] = [];
            const accountToUse = account; 

            try {
                // 1. Fetch Entry Burn & Approve GToken
                console.log('   SDK: Fetching role config for entry burn...');
                const roleConfig = await (client as any).readContract({
                    address: usedAddresses.registry,
                    abi: RegistryABI,
                    functionName: 'roleConfigs',
                    args: [roleId]
                }) as any; // [minStake, entryBurn, ...]

                const entryBurn = roleConfig[1]; // Index 1 is entryBurn in struct
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
                // Auto-select roleData based on roleId if not provided
                let data: Hex;
                if (roleData) {
                    data = roleData;
                } else {
                    // Auto-generate roleData based on role type
                    if (roleId === keccak256(stringToBytes('COMMUNITY'))) {
                        data = RoleDataFactory.community();
                    } else if (roleId === keccak256(stringToBytes('ENDUSER'))) {
                        data = RoleDataFactory.endUser();
                    } else {
                        data = RoleDataFactory.paymasterSuper();
                    }
                }
                
                console.log(`   SDK: Registering role ${roleId}...`);
                const registerTx = await actions.registerRoleSelf({
                    roleId,
                    data, 
                    account: accountToUse
                });
                await (client as any).waitForTransactionReceipt({ hash: registerTx });
                txs.push(registerTx);

                // 3. Deposit aPNTs via transferAndCall (ERC1363 Push)
                // Note: SuperPaymaster blocks standard transferFrom, so we must use push.
                if (depositAmount > 0n) {
                    console.log('   SDK: Depositing aPNTs via transferAndCall...');
                    
                    const erc1363Abi = parseAbi([
                        'function transferAndCall(address to, uint256 value) external returns (bool)'
                    ]);

                    const depositTx = await (client as any).writeContract({
                        address: usedAddresses.aPNTs!,
                        abi: erc1363Abi,
                        functionName: 'transferAndCall',
                        args: [usedAddresses.superPaymaster, depositAmount],
                        account: accountToUse,
                        chain
                    });
                    await (client as any).waitForTransactionReceipt({ hash: depositTx });
                    txs.push(depositTx);
                } else {
                    console.log('   SDK: Skipping deposit (amount is 0 or Community registration)...');
                }



                return txs;

            } catch (error) {
                const decodedMsg = decodeContractError(error);
                if (decodedMsg) {
                    throw new Error(`Onboarding Failed: ${decodedMsg}`);
                }
                throw error;
            }
        },
        // Backwards compatibility wrappers
        async onboardToSuperPaymaster(args: { stakeAmount: bigint, depositAmount: bigint, roleId: Hex }) {
            return this.onboardOperator(args);
        },
        async configureOperator({ xPNTs, treasury, rate }: { xPNTs: Address, treasury: Address, rate: bigint }) {
            console.log(`   SDK: Configuring Operator (xPNTs: ${xPNTs}, Treasury: ${treasury}, Rate: ${rate})...`);
            
            // Minimal ABI for configuration
            const configAbi = parseAbi([
                'function configureOperator(address xPNTsToken, address _opTreasury, uint256 exchangeRate) external'
            ]);

            const tx = await (client as any).writeContract({
                address: usedAddresses.superPaymaster,
                abi: configAbi,
                functionName: 'configureOperator',
                args: [xPNTs, treasury, rate],
                account: account,
                chain
            });
            await (client as any).waitForTransactionReceipt({ hash: tx });
            return tx;
        }

    }) as OperatorClient;

}
