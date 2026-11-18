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

    it('caches only a checked domain, re-checks DOMAIN_SEPARATOR() on every use, and hands out copies', async () => {
        const bad = fakeClient(10, { name: 'USDC', version: '2', DOMAIN_SEPARATOR: OP_USDC_SEPARATOR });
        await expect(resolveEip712Domain(bad.client, OP_USDC)).rejects.toThrow();
        const good = fakeClient(10, { name: 'USD Coin', version: '2', DOMAIN_SEPARATOR: OP_USDC_SEPARATOR });
        const first = await resolveEip712Domain(good.client, OP_USDC);
        first.domain.name = 'tampered';
        good.readContract.mockClear();
        const second = await resolveEip712Domain(good.client, OP_USDC);
        // A warm hit reads exactly DOMAIN_SEPARATOR() again, and nothing else.
        expect(good.readContract.mock.calls.map(([c]: any) => c.functionName)).toEqual(['DOMAIN_SEPARATOR']);
        expect(second.domain.name).toBe('USD Coin');
    });

    it('a domain that failed the check is refused again on the next call through the same client', async () => {
        const { client } = fakeClient(10, { name: 'USDC', version: '2', DOMAIN_SEPARATOR: OP_USDC_SEPARATOR });
        await expect(resolveEip712Domain(client, OP_USDC)).rejects.toThrow('does not match');
        await expect(resolveEip712Domain(client, OP_USDC)).rejects.toThrow('does not match');
    });

    it('a warm cache whose DOMAIN_SEPARATOR() has become unreadable throws', async () => {
        const reads: Reads = { name: 'USD Coin', version: '2', DOMAIN_SEPARATOR: OP_USDC_SEPARATOR };
        const { client } = fakeClient(10, reads);
        await resolveEip712Domain(client, OP_USDC);
        reads.DOMAIN_SEPARATOR = new Error('execution reverted');
        await expect(resolveEip712Domain(client, OP_USDC)).rejects.toThrow('cached domain cannot be checked');
    });

    it('an upgrade that changes the domain is picked up on the next call, not served from the cache', async () => {
        const reads: Reads = { name: 'USD Coin', version: '2', DOMAIN_SEPARATOR: OP_USDC_SEPARATOR };
        const { client } = fakeClient(10, reads);
        await resolveEip712Domain(client, OP_USDC);
        const upgraded = { name: 'USD Coin', version: '3', chainId: 10, verifyingContract: OP_USDC };
        reads.version = '3';
        reads.DOMAIN_SEPARATOR = domainSeparator({ domain: upgraded });
        expect((await resolveEip712Domain(client, OP_USDC)).domain).toEqual(upgraded);
    });

    it('one client cannot supply another client\'s domain (e.g. a fork seeding production)', async () => {
        const fork = fakeClient(10, { name: 'USD Coin', version: '2', DOMAIN_SEPARATOR: OP_USDC_SEPARATOR });
        await resolveEip712Domain(fork.client, OP_USDC);
        const prod = fakeClient(10, {}); // every read reverts
        await expect(resolveEip712Domain(prod.client, OP_USDC)).rejects.toThrow('refusing to sign');
    });

    it('the cache is keyed by chain: the same client on another chain reads again', async () => {
        const { client } = fakeClient(10, { name: 'USD Coin', version: '2', DOMAIN_SEPARATOR: OP_USDC_SEPARATOR });
        await resolveEip712Domain(client, OP_USDC);
        client.getChainId.mockResolvedValue(11155420);
        await expect(resolveEip712Domain(client, OP_USDC)).rejects.toThrow('does not match');
    });

    it('a resolution still in flight when the cache is cleared does not repopulate it', async () => {
        let release!: () => void;
        const gate = new Promise<void>((r) => { release = r; });
        const reads: Reads = { name: 'USD Coin', version: '2', DOMAIN_SEPARATOR: OP_USDC_SEPARATOR };
        const { client, readContract } = fakeClient(10, reads);
        const inner = readContract.getMockImplementation()!;
        readContract.mockImplementation(async (args: any) => { if (args.functionName === 'name') await gate; return inner(args); });
        const pending = resolveEip712Domain(client, OP_USDC);
        clearEip712DomainCache();
        release();
        await pending;
        readContract.mockClear();
        await resolveEip712Domain(client, OP_USDC);
        expect(readContract.mock.calls.map(([c]: any) => c.functionName)).toContain('name'); // resolved afresh
    });

    it('EIP-5267: omitted fields stay out of the domain, and a salt is included', async () => {
        const salt = ('0x' + '5a'.repeat(32)) as Hex;
        const d = { name: 'X', chainId: 11155111, verifyingContract: HELPER, salt }; // fields 0x1d: no version
        const { client } = fakeClient(11155111, {
            eip712Domain: ['0x1d', 'X', 'ignored', 11155111n, HELPER, salt, []],
            DOMAIN_SEPARATOR: domainSeparator({ domain: d }),
        });
        expect((await resolveEip712Domain(client, HELPER)).domain).toEqual(d);
    });
});
