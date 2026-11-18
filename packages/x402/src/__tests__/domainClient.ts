import { domainSeparator, type Address } from 'viem';
import { X402FacilitatorArtifact } from '@aastar/core';

const BLOCK_HASH = ('0x' + 'ab'.repeat(32)) as `0x${string}`;
const FACILITATOR_CODE = (() => {
    const b = (X402FacilitatorArtifact as any).bytecode;
    return (typeof b === 'string' ? b : b.object) as `0x${string}`;
})();

/**
 * A publicClient stand-in for X402Client tests.
 * - Asset domain (eip-3009 path): serves the reads resolveEip712Domain makes (no eip712Domain(), then
 *   name()/version()/DOMAIN_SEPARATOR()) as an ERC-20 with the given domain.
 * - Facilitator domain (direct path): eth_getCode pinned to one block hash returns the vendored X402Facilitator
 *   bytecode (which contains its domain constants) and DOMAIN_SEPARATOR() reverts, as on the deployed contract.
 *   `facilitatorCode` overrides the code (e.g. '0x' or a contract lacking the constants).
 */
export function domainClient(chainId: number, name: string, version: string, opts: { facilitatorCode?: `0x${string}` } = {}) {
    return {
        getChainId: async () => chainId,
        getBlock: async () => ({ number: 1n, hash: BLOCK_HASH }),
        request: async ({ method, params }: { method: string; params: any[] }) => {
            if (params[1]?.blockHash !== BLOCK_HASH || params[1]?.requireCanonical !== true) throw new Error(`${method} not pinned`);
            if (method === 'eth_getCode') return opts.facilitatorCode ?? FACILITATOR_CODE;
            const e: any = new Error('execution reverted'); e.code = 3; throw e; // no DOMAIN_SEPARATOR() on the facilitator
        },
        readContract: async ({ address, functionName }: { address: Address; functionName: string }) => {
            if (functionName === 'name') return name;
            if (functionName === 'version') return version;
            if (functionName === 'DOMAIN_SEPARATOR') return domainSeparator({ domain: { name, version, chainId, verifyingContract: address } });
            throw new Error(`execution reverted (${functionName})`);
        },
    } as never;
}
