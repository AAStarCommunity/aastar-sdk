import { createPublicClient, createWalletClient, http, type PublicClient, type WalletClient, type Chain, type Account } from 'viem';
import { sepolia, optimismSepolia, optimism } from 'viem/chains';

// Re-export contracts from shared-config
export { contracts } from '@aastar/shared-config';

export type AAStarClientConfig = {
    chain: Chain;
    rpcUrl?: string;
    account?: Account | `0x${string}`;
};

export const createAAStarPublicClient = (config: AAStarClientConfig): PublicClient => {
    return createPublicClient({
        chain: config.chain,
        transport: http(config.rpcUrl)
    });
};

export const createAAStarWalletClient = (config: AAStarClientConfig): WalletClient => {
    return createWalletClient({
        chain: config.chain,
        transport: http(config.rpcUrl),
        account: config.account
    });
};

export * from 'viem';
export { sepolia, optimismSepolia, optimism };
export * from './utils';
