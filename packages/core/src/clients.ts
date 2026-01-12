
import { createPublicClient, http, type Chain, type PublicClient } from 'viem';
import { sepolia, optimism } from 'viem/chains';

/**
 * Creates a standard AAStar public client for any given chain.
 */
export function createAAStarPublicClient(rpcUrl: string, chain: Chain = sepolia): PublicClient {
    return createPublicClient({
        chain,
        transport: http(rpcUrl)
    }) as unknown as PublicClient;
}
