import { createClient, type Client, type Transport, type Chain, type Account, type Hash, erc20Abi } from 'viem';
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

export type OperatorClient = Client<Transport, Chain, Account | undefined> & StakingActions & PaymasterActions & RegistryActions & {
    onboardToSuperPaymaster: (args: { stakeAmount: bigint, depositAmount: bigint, roleId: Hex }) => Promise<Hash[]>
};

export function createOperatorClient({ 
    chain, 
    transport, 
    account 
}: { 
    chain: Chain, 
    transport: Transport,
    account?: Account 
}): OperatorClient {
    const client = createClient({ 
        chain, 
        transport,
        account
    });

    const baseClient = client
        .extend(stakingActions(CORE_ADDRESSES.gTokenStaking))
        .extend(paymasterActions(CORE_ADDRESSES.superPaymasterV2))
        .extend(registryActions(CORE_ADDRESSES.registry));

    return Object.assign(baseClient, {
        async onboardToSuperPaymaster({ stakeAmount, depositAmount, roleId }) {
            const txs: Hash[] = [];
            
            // 1. Approve GToken needed for staking
            const approveGToken = await (baseClient as any).writeContract({
                address: CORE_ADDRESSES.gToken,
                abi: erc20Abi,
                functionName: 'approve',
                args: [CORE_ADDRESSES.gTokenStaking, stakeAmount],
                account,
                chain
            });
            txs.push(approveGToken);

            // 2. Lock Stake
            const stakeTx = await baseClient.lockStake({
                user: account!.address,
                roleId,
                stakeAmount,
                entryBurn: 0n, // Assuming 0 for now or fetch from config
                payer: account!.address,
                account: account?.address
            });
            txs.push(stakeTx);

            // 3. Approve APNTs needed for deposit
            const approveAPNTs = await (baseClient as any).writeContract({
                address: TEST_TOKEN_ADDRESSES.aPNTs, // Note: Should dynamic fetch this ideally
                abi: erc20Abi,
                functionName: 'approve',
                args: [CORE_ADDRESSES.superPaymasterV2, depositAmount],
                account,
                chain
            });
            txs.push(approveAPNTs);

            // 4. Deposit APNTs
            const depositTx = await baseClient.depositAPNTs({
                amount: depositAmount,
                account: account?.address
            });
            txs.push(depositTx);

            return txs;
        }
    }) as OperatorClient;
}
