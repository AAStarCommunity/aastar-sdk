import { createPublicClient, createWalletClient, http } from 'viem';
export function createAAStarPublicClient(config) {
    return createPublicClient({
        chain: config.chain,
        transport: config.transport || http(config.rpcUrl)
    });
}
export function createAAStarWalletClient(config) {
    return createWalletClient({
        account: config.account,
        chain: config.chain,
        transport: config.transport || http(config.rpcUrl)
    });
}
