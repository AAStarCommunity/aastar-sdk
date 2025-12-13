import { createPublicClient, createWalletClient, http, type PublicClient, type WalletClient, type Chain, type Account } from 'viem';
import { sepolia, optimismSepolia, optimism } from 'viem/chains';

// In the future, this comes from @aastar/shared-config
export const SHARED_CONFIG_MOCK = {
    contracts: {
        superPaymaster: "0xSuperPaymasterAddress",
        entryPoint: "0xEntryPointAddress"
    }
};

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
