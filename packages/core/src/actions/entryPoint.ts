import { type Address, type PublicClient, type WalletClient, type Hash, type Account } from 'viem';
import { EntryPointABI } from '../abis/index.js';
import { validateAddress, validateRequired, validateAmount } from '../validators/index.js';
import { AAStarError } from '../errors/index.js';

export enum EntryPointVersion {
    V06 = '0.6',
    V07 = '0.7',
}

export type EntryPointActions = {
    balanceOf: (args: { account: Address }) => Promise<bigint>;
    depositTo: (args: { account: Address, amount: bigint, txAccount?: Account | Address }) => Promise<Hash>;
    getNonce: (args: { sender: Address, key: bigint }) => Promise<bigint>;
    getDepositInfo: (args: { account: Address }) => Promise<{ deposit: bigint, staked: boolean, stake: bigint, unstakeDelaySec: number, withdrawTime: number }>;
    entryPointAddress: Address;
};

export const entryPointActions = (address: Address) => (client: PublicClient | WalletClient): EntryPointActions => ({
    entryPointAddress: address,
    async balanceOf({ account }) {
        try {
            validateAddress(account, 'account');
            return await (client as PublicClient).readContract({
                address,
                abi: EntryPointABI,
                functionName: 'balanceOf',
                args: [account]
            }) as Promise<bigint>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'balanceOf');
        }
    },

    async depositTo({ account, amount, txAccount }) {
        try {
            validateAddress(account, 'account');
            validateAmount(amount, 'amount');
            return await (client as any).writeContract({
                address,
                abi: EntryPointABI,
                functionName: 'depositTo',
                args: [account],
                value: amount,
                account: txAccount as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'depositTo');
        }
    },

    async getNonce({ sender, key }) {
        try {
            validateAddress(sender, 'sender');
            validateRequired(key, 'key');
            return await (client as PublicClient).readContract({
                address,
                abi: EntryPointABI,
                functionName: 'getNonce',
                args: [sender, key]
            }) as Promise<bigint>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'getNonce');
        }
    },

    async getDepositInfo({ account }) {
        try {
            validateAddress(account, 'account');
            const result = await (client as PublicClient).readContract({
                address,
                abi: EntryPointABI,
                functionName: 'getDepositInfo',
                args: [account]
            }) as any;

            return {
                deposit: result[0],
                staked: result[1],
                stake: result[2],
                unstakeDelaySec: result[3],
                withdrawTime: result[4]
            };
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'getDepositInfo');
        }
    }
});
