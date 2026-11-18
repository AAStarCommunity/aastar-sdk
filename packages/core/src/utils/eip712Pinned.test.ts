import { describe, it, expect, vi } from 'vitest';
import { decodeFunctionData, domainSeparator, encodeFunctionResult, type Abi, type Address, type Hex } from 'viem';
import { resolveReportedEip712Domain } from './eip712Pinned.js';
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
        const revert = () => { const e: any = new Error('execution reverted'); e.code = 3; e.data = '0x'; throw e; };
        if (functionName === 'eip712Domain') {
            if (o.report === 'revert') revert();
            return encodeFunctionResult({ abi: READ_ABI, functionName, result: o.report ?? ['0x0f', DOMAIN.name, DOMAIN.version, 11155111n, C, '0x' + '00'.repeat(32), []] } as any);
        }
        if (o.separator === 'transport') throw new Error('fetch failed: socket hang up');
        if ((o.separator as any) === 'revert-no-data-field') { const e: any = new Error('execution reverted'); e.code = 3; throw e; }
        if ((o.separator as any) === 'revert-odd-shape') { const e: any = new Error('execution reverted'); e.code = 3; e.data = { originalError: { data: '0x1234' } }; throw e; }
        if ((o.separator as any) === 'revert-with-data') { const e: any = new Error('execution reverted'); e.code = 3; e.data = '0x08c379a0' + '00'.repeat(96); throw e; }
        if ((o.separator as any) === 'transport-revert') throw new Error('upstream proxy: request reverted by gateway');
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
        await expect(resolveReportedEip712Domain(client(), C, { expectedChainId: 11155111, mayLackSeparator: true })).resolves.toEqual({ domain: DOMAIN, separator: domainSeparator({ domain: DOMAIN }), separatorChecked: false, blockHash: HASH });
    });

    it('a missing DOMAIN_SEPARATOR() refuses unless the caller says the contract may lack it', async () => {
        await expect(resolveReportedEip712Domain(client(), C)).rejects.toMatchObject({ data: { reason: 'block-unavailable' } });
    });

    it('a revert whose data is missing or in an unrecognised shape is not "absent", even with mayLackSeparator', async () => {
        for (const separator of ['revert-no-data-field', 'revert-odd-shape']) {
            await expect(resolveReportedEip712Domain(client({ separator: separator as any }), C, { mayLackSeparator: true })).rejects.toMatchObject({ data: { reason: 'block-unavailable' } });
        }
    });

    it('a DOMAIN_SEPARATOR() that exists but reverts (revert data) is not "absent", even with mayLackSeparator', async () => {
        await expect(resolveReportedEip712Domain(client({ separator: 'revert-with-data' as any }), C, { mayLackSeparator: true })).rejects.toMatchObject({ data: { reason: 'block-unavailable' } });
    });

    it('a matching DOMAIN_SEPARATOR() marks it checked; a different one refuses', async () => {
        await expect(resolveReportedEip712Domain(client({ separator: domainSeparator({ domain: DOMAIN }) }), C)).resolves.toMatchObject({ separatorChecked: true });
        await expect(resolveReportedEip712Domain(client({ separator: ('0x' + 'ee'.repeat(32)) as Hex }), C)).rejects.toMatchObject({ data: { reason: 'separator-mismatch' } });
    });

    it('a transport failure on DOMAIN_SEPARATOR() refuses instead of counting as "not present", even if its text says "revert"', async () => {
        await expect(resolveReportedEip712Domain(client({ separator: 'transport' }), C, { mayLackSeparator: true })).rejects.toMatchObject({ data: { reason: 'block-unavailable' } });
        await expect(resolveReportedEip712Domain(client({ separator: 'transport-revert' as any }), C, { mayLackSeparator: true })).rejects.toMatchObject({ data: { reason: 'block-unavailable' } });
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
        await expect(resolveReportedEip712Domain(client(o as O), C, { expectedChainId: 11155111, mayLackSeparator: true })).rejects.toMatchObject({ data: { reason } });
    });
});
