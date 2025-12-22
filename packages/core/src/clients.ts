
import { createPublicClient, createWalletClient, http, type Chain, type Transport, type PublicClient, type WalletClient, type Account } from 'viem';

export type AAStarClientConfig = {
    chain: Chain;
    rpcUrl?: string; // Optional override, defaults to chain.rpc
    transport?: Transport; // Optional override
};

export function createAAStarPublicClient(config: AAStarClientConfig): PublicClient {
    return createPublicClient({
        chain: config.chain,
        transport: config.transport || http(config.rpcUrl)
    });
}

export function createAAStarWalletClient(config: AAStarClientConfig & { account: Account }): WalletClient {
    return createWalletClient({
        account: config.account,
        chain: config.chain,
        transport: config.transport || http(config.rpcUrl)
    });
}
