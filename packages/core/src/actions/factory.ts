import { type Address, type PublicClient, type WalletClient, type Hex, type Hash, type Account } from 'viem';
import { PaymasterV4ABI, xPNTsFactoryABI, PaymasterFactoryABI } from '../abis/index.js';

// Factory actions for xPNTs and Paymaster deployment
export type FactoryActions = {
    // xPNTs Factory
    createXPNTs: (args: { name: string, symbol: string, community: Address, account?: Account | Address }) => Promise<Hash>;
    predictXPNTsAddress: (args: { community: Address }) => Promise<Address>;
    getXPNTsForCommunity: (args: { community: Address }) => Promise<Address>;
    
    // Paymaster Factory
    deployPaymaster: (args: { owner: Address, account?: Account | Address }) => Promise<Hash>;
    predictPaymasterAddress: (args: { owner: Address }) => Promise<Address>;
    getPaymasterForOwner: (args: { owner: Address }) => Promise<Address>;
};

export const factoryActions = () => (client: PublicClient | WalletClient): FactoryActions => ({
    // xPNTs Factory
    async createXPNTs({ name, symbol, community, account }) {
        // Assuming xPNTsFactory address is known or passed separately
        const factoryAddress = (client as any).xPNTsFactoryAddress;
        return (client as any).writeContract({
            address: factoryAddress,
            abi: xPNTsFactoryABI,
            functionName: 'createXPNTs',
            args: [name, symbol, community],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async predictXPNTsAddress({ community }) {
        const factoryAddress = (client as any).xPNTsFactoryAddress;
        return (client as PublicClient).readContract({
            address: factoryAddress,
            abi: xPNTsFactoryABI,
            functionName: 'predictAddress',
            args: [community]
        }) as Promise<Address>;
    },

    async getXPNTsForCommunity({ community }) {
        const factoryAddress = (client as any).xPNTsFactoryAddress;
        return (client as PublicClient).readContract({
            address: factoryAddress,
            abi: xPNTsFactoryABI,
            functionName: 'getTokenForCommunity',
            args: [community]
        }) as Promise<Address>;
    },

    // Paymaster Factory
    async deployPaymaster({ owner, account }) {
        const factoryAddress = (client as any).paymasterFactoryAddress;
        return (client as any).writeContract({
            address: factoryAddress,
            abi: PaymasterFactoryABI,
            functionName: 'deployPaymaster',
            args: [owner],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async predictPaymasterAddress({ owner }) {
        const factoryAddress = (client as any).paymasterFactoryAddress;
        return (client as PublicClient).readContract({
            address: factoryAddress,
            abi: PaymasterFactoryABI,
            functionName: 'calculateAddress',
            args: [owner]
        }) as Promise<Address>;
    },

    async getPaymasterForOwner({ owner }) {
        const factoryAddress = (client as any).paymasterFactoryAddress;
        return (client as PublicClient).readContract({
            address: factoryAddress,
            abi: PaymasterFactoryABI,
            functionName: 'getPaymaster',
            args: [owner]
        }) as Promise<Address>;
    }
});
