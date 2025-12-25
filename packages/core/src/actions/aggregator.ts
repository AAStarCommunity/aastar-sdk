import { type Address, type PublicClient, type WalletClient, type Hex, type Hash, type Account } from 'viem';
import { BLSAggregatorABI } from '../abis/index.js';

export type AggregatorActions = {
    registerBLSPublicKey: (args: { address: Address, publicKey: Hex, account?: Account | Address }) => Promise<Hash>;
    setBLSThreshold: (args: { address: Address, threshold: number, account?: Account | Address }) => Promise<Hash>;
    getBLSThreshold: (args: { address: Address }) => Promise<bigint>;
};

export const aggregatorActions = () => (client: PublicClient | WalletClient): AggregatorActions => ({
    async registerBLSPublicKey({ address, publicKey, account }) {
        return (client as any).writeContract({
            address,
            abi: BLSAggregatorABI,
            functionName: 'registerBLSPublicKey',
            args: [publicKey],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async setBLSThreshold({ address, threshold, account }) {
        return (client as any).writeContract({
            address,
            abi: BLSAggregatorABI,
            functionName: 'setThreshold',
            args: [BigInt(threshold)],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async getBLSThreshold({ address }) {
        return (client as PublicClient).readContract({
            address,
            abi: BLSAggregatorABI,
            functionName: 'threshold',
            args: []
        }) as Promise<bigint>;
    }
});
