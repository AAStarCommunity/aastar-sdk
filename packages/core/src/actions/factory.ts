import { type Address, type PublicClient, type WalletClient, type Hex, type Hash, type Account } from 'viem';
import { xPNTsFactoryABI } from '../abis/index.js';

export type FactoryActions = {
    createXPNTs: (args: { address: Address, name: string, symbol: string, hub: string, domain: string, pool: bigint, account?: Account | Address }) => Promise<Hash>;
    setSuperPaymasterInFactory: (args: { address: Address, paymaster: Address, account?: Account | Address }) => Promise<Hash>;
    getXPNTsTokenAddress: (args: { address: Address, hub: string }) => Promise<Address>;
};

export const factoryActions = () => (client: PublicClient | WalletClient): FactoryActions => ({
    async createXPNTs({ address, name, symbol, hub, domain, pool, account }) {
        return (client as any).writeContract({
            address,
            abi: xPNTsFactoryABI,
            functionName: 'createXPNTs',
            args: [name, symbol, hub, domain, pool],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async setSuperPaymasterInFactory({ address, paymaster, account }) {
        return (client as any).writeContract({
            address,
            abi: xPNTsFactoryABI,
            functionName: 'setSuperPaymaster',
            args: [paymaster],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async getXPNTsTokenAddress({ address, hub }) {
        return (client as PublicClient).readContract({
            address,
            abi: xPNTsFactoryABI,
            functionName: 'getXPNTsToken',
            args: [hub]
        }) as Promise<Address>;
    }
});
