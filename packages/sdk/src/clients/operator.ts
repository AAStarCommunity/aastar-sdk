import { createClient, type Client, type Transport, type Chain, type Account, type Hash, type Hex, erc20Abi, publicActions, walletActions, type PublicActions, type WalletActions, type Address } from 'viem';
import { 
    stakingActions, 
    paymasterActions, 
    registryActions,
    type StakingActions, 
    type PaymasterActions, 
    type RegistryActions,
    CORE_ADDRESSES,
    TEST_TOKEN_ADDRESSES
} from '@aastar/core';

export type OperatorClient = Client<Transport, Chain, Account | undefined> & PublicActions<Transport, Chain, Account | undefined> & WalletActions<Chain, Account | undefined> & StakingActions & PaymasterActions & RegistryActions & {
    onboardToSuperPaymaster: (args: { stakeAmount: bigint, depositAmount: bigint, roleId: Hex }) => Promise<Hash[]>
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
        ...paymasterActions(usedAddresses.superPaymasterV2)(client as any),
        ...registryActions(usedAddresses.registry)(client as any),
    };

    return Object.assign(client, actions, {
        async onboardToSuperPaymaster({ stakeAmount, depositAmount, roleId }: { stakeAmount: bigint, depositAmount: bigint, roleId: Hex }) {
            const txs: Hash[] = [];
            
            // 1. Approve GToken needed for staking
            const approveGToken = await (client as any).writeContract({
                address: usedAddresses.gToken,
                abi: erc20Abi,
                functionName: 'approve',
                args: [usedAddresses.gTokenStaking, stakeAmount],
                account,
                chain
            });
            await (client as any).waitForTransactionReceipt({ hash: approveGToken });
            txs.push(approveGToken);
            
            // ... (rest uses actions which capture usedAddresses)
            // But we need to update steps 2 and 3 and 4 to use usedAddresses too if they use raw calls? 
            // Step 2 is actions.lockStake.
            // Step 3 is approve APNTs.
            
            // 2. Register Role (locks stake)
            const registerTx = await actions.registerRoleSelf({
                roleId,
                data: '0x',
                account: account
            });
            await (client as any).waitForTransactionReceipt({ hash: registerTx });
            txs.push(registerTx);

            // 3. Approve APNTs needed for deposit
            const approveAPNTs = await (client as any).writeContract({
                address: usedAddresses.aPNTs!,
                abi: erc20Abi,
                functionName: 'approve',
                args: [usedAddresses.superPaymasterV2, depositAmount],
                account,
                chain
            });
            await (client as any).waitForTransactionReceipt({ hash: approveAPNTs });
            txs.push(approveAPNTs);

            // 4. Deposit APNTs
            const depositTx = await actions.depositAPNTs({
                amount: depositAmount,
                account: account
            });
            txs.push(depositTx);

            return txs;
        }
    }) as OperatorClient;
}
