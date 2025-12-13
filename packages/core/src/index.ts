import { createPublicClient, createWalletClient, http, type PublicClient, type WalletClient, type Chain, type Account } from 'viem';
import { sepolia, optimismSepolia, optimism } from 'viem/chains';
import { bundlerActions } from 'viem/account-abstraction';

// Re-export contracts from shared-config
export { CONTRACTS } from '@aastar/shared-config';

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

export const createAAStarBundlerClient = (config: AAStarClientConfig) => {
    // If you need specific bundler actions or custom transport, configure here.
    // For now, we return a standard viem public client extended with bundler actions
    // or a dedicated BundlerClient if using permissionless.js
    // Since we are using raw viem:
    return createPublicClient({
        chain: config.chain,
        transport: http(config.rpcUrl),
    }).extend(bundlerActions);
};

// Re-export bundlerActions so users can access sendUserOperation etc directly on the client extension
export { bundlerActions };

export * from 'viem';
export { sepolia, optimismSepolia, optimism };
export * from './utils';
