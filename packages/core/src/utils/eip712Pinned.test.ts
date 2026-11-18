import { describe, it, expect, vi } from 'vitest';
import { decodeFunctionData, domainSeparator, encodeFunctionResult, keccak256, toHex, type Abi, type Address, type Hex } from 'viem';
import { resolveReportedEip712Domain, verifyPinnedEip712Domain } from './eip712Pinned.js';
import { GTokenAuthorizationABI } from '../abis/index.js';

const C = '0x37578b70B231CC0Eda5991CA633ae99eb35f3818' as Address;
const HASH = ('0x' + 'aa'.repeat(32)) as Hex;
const READ_ABI = (GTokenAuthorizationABI as any[]).filter((e) => e.name === 'eip712Domain' || e.name === 'DOMAIN_SEPARATOR') as Abi;
const DOMAIN = { name: 'MicroPaymentChannel', version: '1.0.0', chainId: 11155111, verifyingContract: C };

type O = {
    chainId?: number; code?: Hex; report?: readonly unknown[] | 'revert'; separator?: Hex | 'revert' | 'transport'; blockFails?: boolean;
};
function client(o: O = {}) {
    const request = vi.fn(async ({ method, params }: any) => {
        if (params[1]?.blockHash !== HASH || params[1]?.requireCanonical !== true) throw new Error(`${method} not pinned to the checked block hash`);
        if (method === 'eth_getCode') return o.code ?? '0x6080';
        const { functionName } = decodeFunctionData({ abi: READ_ABI, data: params[0].data });
        const revert = () => { const e: any = new Error('execution reverted'); e.code = 3; throw e; };
        if (functionName === 'eip712Domain') {
            if (o.report === 'revert') revert();
            return encodeFunctionResult({ abi: READ_ABI, functionName, result: o.report ?? ['0x0f', DOMAIN.name, DOMAIN.version, 11155111n, C, '0x' + '00'.repeat(32), []] } as any);
        }
        if (o.separator === 'transport') throw new Error('fetch failed: socket hang up');
        if (o.separator === undefined || o.separator === 'revert') revert();
        return encodeFunctionResult({ abi: READ_ABI, functionName, result: o.separator } as any);
    });
    return {
        getChainId: vi.fn(async () => o.chainId ?? 11155111),
        getBlock: vi.fn(async () => { if (o.blockFails) throw { code: -32000 }; return { number: 1n, hash: HASH }; }),
        request,
    } as any;
}

describe('resolveReportedEip712Domain (EIP-5267, DOMAIN_SEPARATOR() optional)', () => {
    it('returns the reported domain, marked unchecked when there is no DOMAIN_SEPARATOR()', async () => {
        await expect(resolveReportedEip712Domain(client(), C, { expectedChainId: 11155111 })).resolves.toEqual({ domain: DOMAIN, separator: domainSeparator({ domain: DOMAIN }), separatorChecked: false });
    });

    it('a matching DOMAIN_SEPARATOR() marks it checked; a different one refuses', async () => {
        await expect(resolveReportedEip712Domain(client({ separator: domainSeparator({ domain: DOMAIN }) }), C)).resolves.toMatchObject({ separatorChecked: true });
        await expect(resolveReportedEip712Domain(client({ separator: ('0x' + 'ee'.repeat(32)) as Hex }), C)).rejects.toMatchObject({ data: { reason: 'separator-mismatch' } });
    });

    it('a transport failure on DOMAIN_SEPARATOR() refuses instead of counting as "not present"', async () => {
        await expect(resolveReportedEip712Domain(client({ separator: 'transport' }), C)).rejects.toMatchObject({ data: { reason: 'block-unavailable' } });
    });

    it.each([
        ['the RPC is on another chain', { chainId: 10 }, 'chain-mismatch'],
        ['no code', { code: '0x' as Hex }, 'no-code'],
        ['no eip712Domain()', { report: 'revert' as const }, 'no-eip712-domain'],
        ['a reported chainId other than the RPC\'s', { report: ['0x0f', 'X', '1', 1n, C, '0x' + '00'.repeat(32), []] }, 'reported-chain-mismatch'],
        ['a reported verifyingContract other than the contract', { report: ['0x0f', 'X', '1', 11155111n, '0x' + '11'.repeat(20), '0x' + '00'.repeat(32), []] }, 'reported-contract-mismatch'],
        ['extensions', { report: ['0x0f', 'X', '1', 11155111n, C, '0x' + '00'.repeat(32), [1n]] }, 'unsupported-fields'],
        ['a latest-block read that rejects with a non-Error', { blockFails: true }, 'block-unavailable'],
    ])('refuses when %s', async (_l, o, reason) => {
        await expect(resolveReportedEip712Domain(client(o as O), C, { expectedChainId: 11155111 })).rejects.toMatchObject({ data: { reason } });
    });
});

describe('verifyPinnedEip712Domain (no getters; the code must contain the domain constants)', () => {
    const PINNED = { name: 'X402Facilitator', version: '1', typeStrings: ['T(uint256 a)'] };
    const constants = ['X402Facilitator', '1', 'EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)', 'T(uint256 a)'];
    const codeWith = (cs: string[]) => ('0x6080' + cs.map((c) => keccak256(toHex(c)).slice(2)).join('')) as Hex;

    it('passes when the code contains every constant, and returns the pinned domain for the live chain', async () => {
        const r = await verifyPinnedEip712Domain(client({ code: codeWith(constants) }), C, PINNED, { expectedChainId: 11155111 });
        expect(r).toMatchObject({ domain: { name: 'X402Facilitator', version: '1', chainId: 11155111, verifyingContract: C }, separatorChecked: false });
    });

    it.each(constants.map((c) => [c]))('refuses when the code lacks keccak256(%j)', async (missing) => {
        await expect(verifyPinnedEip712Domain(client({ code: codeWith(constants.filter((c) => c !== missing)) }), C, PINNED))
            .rejects.toMatchObject({ data: { reason: 'code-lacks-domain-constants' } });
    });

    it('a DOMAIN_SEPARATOR() that disagrees with the pinned domain refuses; one that agrees is checked', async () => {
        const domain = { name: 'X402Facilitator', version: '1', chainId: 11155111, verifyingContract: C };
        await expect(verifyPinnedEip712Domain(client({ code: codeWith(constants), separator: ('0x' + 'ee'.repeat(32)) as Hex }), C, PINNED)).rejects.toMatchObject({ data: { reason: 'separator-mismatch' } });
        await expect(verifyPinnedEip712Domain(client({ code: codeWith(constants), separator: domainSeparator({ domain }) }), C, PINNED)).resolves.toMatchObject({ separatorChecked: true });
    });
});
