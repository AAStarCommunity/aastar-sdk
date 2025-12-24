import { type Address, type PublicClient, type WalletClient, type Hex, type Hash, type Account } from 'viem';
import { GTokenStakingABI } from '../abis/index.js';

export type StakingActions = {
    lockStake: (args: { user: Address, roleId: Hex, stakeAmount: bigint, entryBurn: bigint, payer: Address, account?: Account | Address }) => Promise<Hash>;
    unlockStake: (args: { user: Address, roleId: Hex, account?: Account | Address }) => Promise<Hash>;
    getStakeInfo: (args: { operator: Address, roleId: Hex }) => Promise<any>;
    getStakingBalance: (args: { user: Address }) => Promise<bigint>;
    slashByDVT: (args: { user: Address, roleId: Hex, amount: bigint, reason: string, account?: Account | Address }) => Promise<Hash>;
    setAuthorizedSlasher: (args: { slasher: Address, authorized: boolean, account?: Account | Address }) => Promise<Hash>;
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
        return (client as any).readContract({
            address,
            abi: GTokenStakingABI,
            functionName: 'stakes',
            args: [operator]
        });
    },

    async getStakingBalance({ user }) {
        return (client as PublicClient).readContract({
            address,
            abi: GTokenStakingABI,
            functionName: 'balanceOf',
            args: [user]
        }) as Promise<bigint>;
    },

    async slashByDVT({ user, roleId, amount, reason, account }) {
        return (client as any).writeContract({
            address,
            abi: GTokenStakingABI,
            functionName: 'slashByDVT',
            args: [user, roleId, amount, reason],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async setAuthorizedSlasher({ slasher, authorized, account }) {
        return (client as any).writeContract({
            address,
            abi: GTokenStakingABI,
            functionName: 'setAuthorizedSlasher',
            args: [slasher, authorized],
            account: account as any,
            chain: (client as any).chain
        });
    }
});
