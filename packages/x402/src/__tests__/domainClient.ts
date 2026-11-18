import { domainSeparator, type Address } from 'viem';

/**
 * A publicClient stand-in for X402Client tests: it serves exactly the reads resolveEip712Domain makes
 * (no eip712Domain(), then name()/version()/DOMAIN_SEPARATOR()) as an ERC-20 with the given domain.
 */
export function domainClient(chainId: number, name: string, version: string) {
    return {
        getChainId: async () => chainId,
        readContract: async ({ address, functionName }: { address: Address; functionName: string }) => {
            if (functionName === 'name') return name;
            if (functionName === 'version') return version;
            if (functionName === 'DOMAIN_SEPARATOR') return domainSeparator({ domain: { name, version, chainId, verifyingContract: address } });
            throw new Error(`execution reverted (${functionName})`);
        },
    } as never;
}
