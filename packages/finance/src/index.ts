
import { type Address, parseAbi, type WalletClient } from 'viem';
import { SUPERPAYMASTER_ABI } from '@aastar/core';

const STAKING_ABI = parseAbi([
    'function stake(uint256)',
    'function withdraw(uint256)'
]);

export class FinanceClient {
    static async depositToPaymaster(wallet: WalletClient, paymaster: Address, amount: bigint) {
        return wallet.writeContract({
            address: paymaster,
            abi: SUPERPAYMASTER_ABI,
            functionName: 'deposit',
            args: [amount]
        });
    }

    static async depositViaTransferAndCall(wallet: WalletClient, token: Address, paymaster: Address, amount: bigint) {
        const ERC1363_ABI = [{
            name: 'transferAndCall',
            type: 'function',
            stateMutability: 'nonpayable',
            inputs: [{ type: 'address', name: 'to' }, { type: 'uint256', name: 'value' }],
            outputs: [{ type: 'bool' }]
        }] as const;

        return wallet.writeContract({
            address: token,
            abi: ERC1363_ABI,
            functionName: 'transferAndCall',
            args: [paymaster, amount]
        });
    }

    static async stakeGToken(wallet: WalletClient, stakingAddr: Address, amount: bigint) {
         return wallet.writeContract({
            address: stakingAddr,
            abi: STAKING_ABI,
            functionName: 'stake',
            args: [amount]
        });
    }
}
