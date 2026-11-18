import { describe, it, expect, vi, beforeEach } from 'vitest';
import { domainSeparator, type Address, type Hex } from 'viem';
import { resolveEip712Domain, clearEip712DomainCache } from './eip712Domain.js';

// Real values read with eth_call from public RPCs on 2026-11-18 (name(), version(), DOMAIN_SEPARATOR()).
const OP_USDC = '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85' as Address; // OP Mainnet native USDC
const OP_USDC_SEPARATOR = '0x26d9c34bb1a1c312f69c53b2d93b8be20faafba63af2438c6811713c9b1f933f' as Hex;
const SEPOLIA_USDC = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' as Address;
const SEPOLIA_USDC_SEPARATOR = '0xb90e5057db141a932946e64d09ccb7ffc9b00bd79fec26f698d29af0c83320a6' as Hex;
const OP_USDC_E = '0x7F5c764cBc14f9669B88837ca1490cCa17c31607' as Address; // bridged: version() and DOMAIN_SEPARATOR() revert
const HELPER = '0x8d08fBD8297355BC93397820AE1CfFD884BEaA00' as Address;

type Reads = Record<string, unknown | Error>;
function fakeClient(chainId: number, reads: Reads) {
    const readContract = vi.fn(async ({ functionName }: any) => {
        if (!(functionName in reads)) throw new Error(`execution reverted (${functionName})`);
        const v = reads[functionName];
        if (v instanceof Error) throw v;
        return v;
    });
    return { client: { getChainId: vi.fn(async () => chainId), readContract } as any, readContract };
}

beforeEach(() => clearEip712DomainCache());

describe('resolveEip712Domain', () => {
    it('OP Mainnet native USDC resolves to "USD Coin" / "2", matching its real DOMAIN_SEPARATOR', async () => {
        const { client } = fakeClient(10, { name: 'USD Coin', version: '2', DOMAIN_SEPARATOR: OP_USDC_SEPARATOR });
        const r = await resolveEip712Domain(client, OP_USDC);
        expect(r.domain).toEqual({ name: 'USD Coin', version: '2', chainId: 10, verifyingContract: OP_USDC });
        expect(r.source).toBe('getters');
        expect(r.separator).toBe(OP_USDC_SEPARATOR);
    });

    it('the old default { name: "USDC", version: "2" } does not produce OP Mainnet USDC\'s separator', () => {
        const old = domainSeparator({ domain: { name: 'USDC', version: '2', chainId: 10, verifyingContract: OP_USDC } });
        expect(old).not.toBe(OP_USDC_SEPARATOR);
    });

    it('Sepolia USDC resolves to "USDC" / "2", matching its real DOMAIN_SEPARATOR', async () => {
        const { client } = fakeClient(11155111, { name: 'USDC', version: '2', DOMAIN_SEPARATOR: SEPOLIA_USDC_SEPARATOR });
        expect((await resolveEip712Domain(client, SEPOLIA_USDC)).domain.name).toBe('USDC');
    });

    it('a local domain that does not match DOMAIN_SEPARATOR() is refused', async () => {
        // e.g. a token whose version() reports something other than what its separator was built with
        const { client } = fakeClient(10, { name: 'USD Coin', version: '', DOMAIN_SEPARATOR: OP_USDC_SEPARATOR });
        await expect(resolveEip712Domain(client, OP_USDC)).rejects.toThrow('does not match DOMAIN_SEPARATOR()');
    });

    it('OP USDC.e (version() and DOMAIN_SEPARATOR() revert) is refused, with no default version', async () => {
        const { client } = fakeClient(10, { name: 'USD Coin' });
        await expect(resolveEip712Domain(client, OP_USDC_E)).rejects.toThrow('neither eip712Domain() nor name()/version() could be read');
    });

    it('readable getters but no DOMAIN_SEPARATOR() is refused: an unchecked domain is not used', async () => {
        const { client } = fakeClient(10, { name: 'USD Coin', version: '2' });
        await expect(resolveEip712Domain(client, OP_USDC)).rejects.toThrow('DOMAIN_SEPARATOR() could not be read');
    });

    it('an expected name that differs from the chain throws instead of being used', async () => {
        const { client } = fakeClient(10, { name: 'USD Coin', version: '2', DOMAIN_SEPARATOR: OP_USDC_SEPARATOR });
        await expect(resolveEip712Domain(client, OP_USDC, { expected: { name: 'USDC' } })).rejects.toThrow('expected name "USDC"');
        await expect(resolveEip712Domain(client, OP_USDC, { expected: { version: '1' } })).rejects.toThrow('expected version "1"');
        await expect(resolveEip712Domain(client, OP_USDC, { expected: { name: 'USD Coin', version: '2' } })).resolves.toBeTruthy();
    });

    describe('EIP-5267 eip712Domain()', () => {
        const domain = { name: 'GToken', version: '1', chainId: 11155111, verifyingContract: HELPER };
        const sep = domainSeparator({ domain });
        const report = (over: Partial<{ fields: Hex; chainId: bigint; vc: Address; ext: bigint[] }> = {}) =>
            [over.fields ?? '0x0f', 'GToken', '1', over.chainId ?? 11155111n, over.vc ?? HELPER, ('0x' + '00'.repeat(32)) as Hex, over.ext ?? []] as const;

        it('is preferred and honours the fields bitmap', async () => {
            const { client, readContract } = fakeClient(11155111, { eip712Domain: report(), DOMAIN_SEPARATOR: sep, name: 'wrong', version: 'wrong' });
            const r = await resolveEip712Domain(client, HELPER);
            expect(r).toMatchObject({ domain, source: 'eip5267' });
            expect(readContract).not.toHaveBeenCalledWith(expect.objectContaining({ functionName: 'name' }));
        });

        it('a reported chainId other than the RPC\'s throws', async () => {
            const { client } = fakeClient(11155111, { eip712Domain: report({ chainId: 1n }), DOMAIN_SEPARATOR: sep });
            await expect(resolveEip712Domain(client, HELPER)).rejects.toThrow('reports chainId 1');
        });

        it('a reported verifyingContract other than the contract throws', async () => {
            const { client } = fakeClient(11155111, { eip712Domain: report({ vc: OP_USDC }), DOMAIN_SEPARATOR: sep });
            await expect(resolveEip712Domain(client, HELPER)).rejects.toThrow('reports verifyingContract');
        });

        it('extensions or unknown fields throw', async () => {
            const a = fakeClient(11155111, { eip712Domain: report({ ext: [1n] }), DOMAIN_SEPARATOR: sep });
            await expect(resolveEip712Domain(a.client, HELPER)).rejects.toThrow('extensions');
            const b = fakeClient(11155111, { eip712Domain: report({ fields: '0x2f' }), DOMAIN_SEPARATOR: sep });
            await expect(resolveEip712Domain(b.client, HELPER)).rejects.toThrow('unknown fields');
        });

        it('is still checked against DOMAIN_SEPARATOR()', async () => {
            const { client } = fakeClient(11155111, { eip712Domain: report(), DOMAIN_SEPARATOR: OP_USDC_SEPARATOR });
            await expect(resolveEip712Domain(client, HELPER)).rejects.toThrow('does not match DOMAIN_SEPARATOR()');
        });
    });

    it("getters: 'constants' reads NAME()/VERSION() (BuyHelper)", async () => {
        const domain = { name: 'MyceliumBuyHelper', version: '1', chainId: 11155111, verifyingContract: HELPER };
        const { client } = fakeClient(11155111, { NAME: 'MyceliumBuyHelper', VERSION: '1', DOMAIN_SEPARATOR: domainSeparator({ domain }) });
        expect((await resolveEip712Domain(client, HELPER, { getters: 'constants' })).domain).toEqual(domain);
    });

    it('caches only a checked domain, and hands out copies', async () => {
        const bad = fakeClient(10, { name: 'USDC', version: '2', DOMAIN_SEPARATOR: OP_USDC_SEPARATOR });
        await expect(resolveEip712Domain(bad.client, OP_USDC)).rejects.toThrow();
        const good = fakeClient(10, { name: 'USD Coin', version: '2', DOMAIN_SEPARATOR: OP_USDC_SEPARATOR });
        const first = await resolveEip712Domain(good.client, OP_USDC); // the failure above was not cached
        first.domain.name = 'tampered';
        const calls = good.readContract.mock.calls.length;
        const second = await resolveEip712Domain(good.client, OP_USDC);
        expect(good.readContract.mock.calls.length).toBe(calls); // served from the cache
        expect(second.domain.name).toBe('USD Coin');
    });

    it('the cache is keyed by chain: the same address on another chain is read again', async () => {
        const op = fakeClient(10, { name: 'USD Coin', version: '2', DOMAIN_SEPARATOR: OP_USDC_SEPARATOR });
        await resolveEip712Domain(op.client, OP_USDC);
        const other = fakeClient(11155420, { name: 'USD Coin', version: '2', DOMAIN_SEPARATOR: OP_USDC_SEPARATOR });
        await expect(resolveEip712Domain(other.client, OP_USDC)).rejects.toThrow('does not match');
    });
});
