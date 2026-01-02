import { type Address, type PublicClient, type WalletClient, type Hex, type Hash, type Account } from 'viem';
import { SuperPaymasterABI } from '../abis/index.js';

export type SuperPaymasterActions = {
    depositAPNTs: (args: { amount: bigint, account?: Account | Address }) => Promise<Hash>;
    withdrawAPNTs: (args: { amount: bigint, account?: Account | Address }) => Promise<Hash>;
    requestSponsorship: (args: { userOp: any, operator: Address, account?: Account | Address }) => Promise<Hash>;
    depositETH: (args: { value: bigint, account?: Address }) => Promise<Hash>;
    withdrawETHStake: (args: { to: Address, account?: Address }) => Promise<Hash>;
    getETHDeposit: () => Promise<bigint>;
    getOperatorInfo: (args: { operator: Address }) => Promise<any>;
    getAvailableCredit: (args: { user: Address, token: Address }) => Promise<bigint>;
    configureOperator: (args: { xPNTsToken: Address, treasury: Address, exchangeRate: bigint, account?: Account | Address }) => Promise<Hash>;
    setAPNTsToken: (args: { token: Address, account?: Account | Address }) => Promise<Hash>;
    setAPNTSPrice: (args: { price: bigint, account?: Account | Address }) => Promise<Hash>;
    setProtocolFee: (args: { feeBps: bigint, account?: Account | Address }) => Promise<Hash>;
    setXPNTsFactory: (args: { factory: Address, account?: Account | Address }) => Promise<Hash>;
    getXPNTsFactory: () => Promise<Address>;
};

export const superPaymasterActions = (address: Address) => (client: PublicClient | WalletClient): SuperPaymasterActions => ({
    async depositAPNTs({ amount, account }) {
        return (client as any).writeContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'deposit',
            args: [amount],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async withdrawAPNTs({ amount, account }) {
        return (client as any).writeContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'withdraw',
            args: [amount],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async requestSponsorship({ userOp, operator, account }) {
        throw new Error("requestSponsorship involves off-chain signature or bundler interaction. Use EndUserClient.executeGasless for full flow.");
    },

    async depositETH({ value, account }) {
        return (client as any).writeContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'deposit',
            args: [],
            value,
            account: account as any,
            chain: (client as any).chain
        });
    },

    async withdrawETHStake({ to, account }) {
        return (client as any).writeContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'withdrawStake',
            args: [to],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async getETHDeposit() {
        return (client as PublicClient).readContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'getDeposit',
            args: []
        }) as Promise<bigint>;
    },

    async getOperatorInfo({ operator }) {
        return (client as PublicClient).readContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'operators',
            args: [operator]
        });
    },

    async getAvailableCredit({ user, token }) {
        return (client as PublicClient).readContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'getAvailableCredit',
            args: [user, token]
        }) as Promise<bigint>;
    },

    async configureOperator({ xPNTsToken, treasury, exchangeRate, account }) {
        return (client as any).writeContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'configureOperator',
            args: [xPNTsToken, treasury, exchangeRate],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async setAPNTsToken({ token, account }) {
        return (client as any).writeContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'setAPNTsToken',
            args: [token],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async setAPNTSPrice({ price, account }) {
        return (client as any).writeContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'setAPNTSPrice',
            args: [price],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async setProtocolFee({ feeBps, account }) {
        return (client as any).writeContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'setProtocolFee',
            args: [feeBps],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async setXPNTsFactory({ factory, account }) {
        return (client as any).writeContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'setXPNTsFactory',
            args: [factory],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async getXPNTsFactory() {
        return (client as any).readContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'xpntsFactory'
        }) as Promise<Address>;
    }
});
