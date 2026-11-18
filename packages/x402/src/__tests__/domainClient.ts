import { decodeFunctionData, domainSeparator, encodeErrorResult, recoverTypedDataAddress, type Address } from 'viem';
import { X402FacilitatorABI } from '@aastar/core';
import { X402_PAYMENT_AUTHORIZATION_TYPES } from '../x402auth.js';

const BLOCK_HASH = ('0x' + 'ab'.repeat(32)) as `0x${string}`;

export type FacilitatorBehaviour =
    | { kind: 'verifier'; version?: string } // checks the signature first, under { X402Facilitator, version }
    | { kind: 'role-first' }                  // reverts Unauthorized before looking at the signature
    | { kind: 'no-data' }                     // reverts without revert data
    | { kind: 'no-code' };                    // an address with no code: eth_call returns 0x

/**
 * A publicClient stand-in for X402Client tests.
 * - Asset domain (eip-3009 path): serves the reads resolveEip712Domain makes (no eip712Domain(), then
 *   name()/version()/DOMAIN_SEPARATOR()) as an ERC-20 with the given domain.
 * - Facilitator (direct path): eth_call of settleX402PaymentDirect, pinned to one block hash, behaves like
 *   X402Facilitator: it recovers the payer under its own domain and reverts InvalidX402Signature when that is not
 *   `from`, otherwise Unauthorized (the first check after the signature). `facilitator` changes that behaviour.
 */
export function domainClient(chainId: number, name: string, version: string, opts: { facilitator?: FacilitatorBehaviour } = {}) {
    const behaviour = opts.facilitator ?? { kind: 'verifier' };
    const revert = (errorName: string) => {
        const e: any = new Error('execution reverted');
        e.code = 3;
        e.data = encodeErrorResult({ abi: X402FacilitatorABI, errorName } as any);
        throw e;
    };
    return {
        getChainId: async () => chainId,
        getBlock: async () => ({ number: 1n, hash: BLOCK_HASH, timestamp: BigInt(Math.floor(Date.now() / 1000)) }),
        request: async ({ method, params }: { method: string; params: any[] }) => {
            if (params[1]?.blockHash !== BLOCK_HASH || params[1]?.requireCanonical !== true) throw new Error(`${method} not pinned`);
            if (method !== 'eth_call') throw new Error(`unexpected ${method}`);
            if (behaviour.kind === 'no-code') return '0x';
            if (behaviour.kind === 'no-data') { const e: any = new Error('execution reverted'); e.code = 3; throw e; }
            if (behaviour.kind === 'role-first') return revert('Unauthorized');
            const { args } = decodeFunctionData({ abi: X402FacilitatorABI, data: params[0].data }) as any;
            const [from, to, asset, amount, maxFee, validBefore, nonce, signature] = args;
            const signer = await recoverTypedDataAddress({
                domain: { name: 'X402Facilitator', version: behaviour.version ?? '1', chainId, verifyingContract: params[0].to },
                types: X402_PAYMENT_AUTHORIZATION_TYPES, primaryType: 'X402PaymentAuthorization',
                message: { from, to, asset, amount, maxFee, validBefore, nonce }, signature,
            });
            return revert(signer.toLowerCase() === from.toLowerCase() ? 'Unauthorized' : 'InvalidX402Signature');
        },
        readContract: async ({ address, functionName }: { address: Address; functionName: string }) => {
            if (functionName === 'name') return name;
            if (functionName === 'version') return version;
            if (functionName === 'DOMAIN_SEPARATOR') return domainSeparator({ domain: { name, version, chainId, verifyingContract: address } });
            throw new Error(`execution reverted (${functionName})`);
        },
    } as never;
}
