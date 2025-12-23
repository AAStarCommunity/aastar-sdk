import { type Chain, type Transport, type PublicClient, type WalletClient, type Account } from 'viem';
export type AAStarClientConfig = {
    chain: Chain;
    rpcUrl?: string;
    transport?: Transport;
};
export declare function createAAStarPublicClient(config: AAStarClientConfig): PublicClient;
export declare function createAAStarWalletClient(config: AAStarClientConfig & {
    account: Account;
}): WalletClient;
