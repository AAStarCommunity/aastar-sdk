import { type Address, type PublicClient, type WalletClient, type Hex, type Hash } from 'viem';
import { GTokenStakingABI } from '../abis/index.js';

export type StakingActions = {
    lockStake: (args: { user: Address, roleId: Hex, stakeAmount: bigint, entryBurn: bigint, payer: Address, account?: Address }) => Promise<Hash>;
    unlockStake: (args: { user: Address, roleId: Hex, account?: Address }) => Promise<Hash>;
    getStakeInfo: (args: { operator: Address, roleId: Hex }) => Promise<any>;
    getStakingBalance: (args: { user: Address }) => Promise<bigint>;
};

export const stakingActions = (address: Address) => (client: PublicClient | WalletClient): StakingActions => ({
    async lockStake({ user, roleId, stakeAmount, entryBurn, payer, account }) {
        return (client as any).writeContract({
            address,
            abi: GTokenStakingABI,
            functionName: 'lockStake',
            args: [user, roleId, stakeAmount, entryBurn, payer],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async unlockStake({ user, roleId, account }) {
        return (client as any).writeContract({
            address,
            abi: GTokenStakingABI,
            functionName: 'unlockAndTransfer',
            args: [user, roleId],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async getStakeInfo({ operator, roleId }) {
        return (client as PublicClient).readContract({
            address,
            abi: GTokenStakingABI,
            functionName: 'getStakeInfo',
            args: [operator, roleId]
        });
    },

    async getStakingBalance({ user }) {
        return (client as PublicClient).readContract({
            address,
            abi: GTokenStakingABI,
            functionName: 'balanceOf',
            args: [user]
        }) as Promise<bigint>;
    }
});
