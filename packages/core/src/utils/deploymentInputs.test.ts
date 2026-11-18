import { describe, it, expect, vi } from 'vitest';
import { type Abi, type Address, decodeFunctionData, encodeFunctionResult } from 'viem';
import { SimpleAccountFactoryABI, SimpleAccountABI } from '../abis/index.js';
import {
    resolveEthUsdFeedAddress, verifyEthUsdFeed, resolveAccountFactoryAddress, verifyAccountFactory, assertSameChain,
    requireLocalSigner, confirmSentOnChain,
} from './deploymentInputs.js';
import { getCanonicalAddresses } from '../addresses.js';

const OP_FEED = '0x13e3Ee699D1909E989722E753853AE30b17e08c5' as Address;
const SEPOLIA_FEED = '0x694AA1769357215DE4FAC081bf1f309aDC325306' as Address;
const V07_FACTORY = '0x91E60e0613810449d098b0b5Ec8b51A0FE8c8985' as Address;
const V06_FACTORY = '0x9406Cc6185a346906296840746125a0E44976454' as Address;
const EP_V07 = '0x0000000071727De22E5E9d8BAf0edAc6f37da032' as Address;
const EP_V06 = '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789' as Address;
const IMPL = '0x68641DE71cfEa5a5d0D29712449Ee254bb1400C2' as Address;

const NOW = 1_800_000_000n;
const BLOCK = 123n;
const HASH = ('0x' + 'aa'.repeat(32)) as `0x${string}`;
const clock = { nowSeconds: () => Number(NOW) + 5 }; // wall clock 5 s ahead of the head

// The code under test reads through raw eth_getCode / eth_call pinned to {blockHash, requireCanonical}; this decodes
// those requests, refuses any that are not pinned to HASH, and answers through `readContract` (the recorder below).
const AGG = [
    { type: 'function', name: 'decimals', inputs: [], outputs: [{ type: 'uint8' }], stateMutability: 'view' },
    { type: 'function', name: 'description', inputs: [], outputs: [{ type: 'string' }], stateMutability: 'view' },
    { type: 'function', name: 'latestRoundData', inputs: [], outputs: [{ type: 'uint80' }, { type: 'int256' }, { type: 'uint256' }, { type: 'uint256' }, { type: 'uint80' }], stateMutability: 'view' },
] as const;
const ALL = [...AGG, ...(SimpleAccountFactoryABI as any[]), ...(SimpleAccountABI as any[])] as Abi;
function pinnedRequest(fake: { readContract: any; code: () => string; unavailable?: boolean }) {
    return vi.fn(async ({ method, params }: any) => {
        const pin = params[1];
        if (pin?.blockHash !== HASH || pin.requireCanonical !== true) throw new Error(`${method} not pinned to the checked block hash`);
        if (fake.unavailable) throw new Error('header not found');
        if (method === 'eth_getCode') return fake.code();
        if (method !== 'eth_call') throw new Error(`unexpected ${method}`);
        const { functionName } = decodeFunctionData({ abi: ALL, data: params[0].data });
        const value = await fake.readContract({ functionName, address: params[0].to });
        return encodeFunctionResult({ abi: ALL, functionName, result: value } as any);
    });
}
function feedClient(o: { code?: string; decimals?: number; description?: string; answer?: bigint; updatedAt?: bigint; readError?: boolean; unavailable?: boolean } = {}) {
    const readContract = vi.fn(async ({ functionName }: any) => {
            if (o.readError) throw new Error('execution reverted');
            if (functionName === 'decimals') return o.decimals ?? 8;
            if (functionName === 'description') return o.description ?? 'ETH / USD';
            if (functionName === 'latestRoundData') return [1n, o.answer ?? 3_000_00000000n, NOW - 60n, o.updatedAt ?? NOW - 60n, 1n];
            throw new Error(`unexpected ${functionName}`);
    });
    return {
        getBlock: vi.fn(async () => ({ timestamp: NOW, number: BLOCK, hash: HASH })),
        readContract,
        request: pinnedRequest({ readContract, code: () => o.code ?? '0x6080', unavailable: o.unavailable }),
    } as any;
}

describe('ETH/USD feed', () => {
    it('comes from the caller, else the address book for the chain; no book entry and no caller value throws', () => {
        expect(resolveEthUsdFeedAddress(10)).toBe(OP_FEED);
        expect(resolveEthUsdFeedAddress(11155111)).toBe(SEPOLIA_FEED);
        expect(resolveEthUsdFeedAddress(10, SEPOLIA_FEED)).toBe(SEPOLIA_FEED); // explicit wins; verifyEthUsdFeed judges it
        expect(() => resolveEthUsdFeedAddress(8453)).toThrow('no ETH/USD price feed for chain 8453');
    });

    it('OP Mainnet\'s default is not the Sepolia feed any more', () => {
        expect(resolveEthUsdFeedAddress(10)).not.toBe(SEPOLIA_FEED);
    });

    it('a healthy feed passes', async () => {
        await expect(verifyEthUsdFeed(feedClient(), OP_FEED, clock)).resolves.toMatchObject({ decimals: 8, description: 'ETH / USD' });
    });

    it.each([
        ['no code (e.g. the Sepolia feed address on OP Mainnet)', { code: '0x' }, 'has no code'],
        ['not an aggregator', { readError: true }, 'could not be read as a Chainlink aggregator'],
        ['18 decimals', { decimals: 18 }, 'decimals 18, expected 8'],
        ['another pair', { description: 'BTC / USD' }, 'expected "ETH / USD"'],
        ['a non-positive answer', { answer: 0n }, 'non-positive answer'],
        ['stale under the 3600 s default (the paymaster\'s staleness threshold)', { updatedAt: NOW - 3601n }, 'max age 3600s'],
        ['never updated', { updatedAt: 0n }, 'last updated at 0'],
        ['updated in the future', { updatedAt: NOW + 10n }, 'block time'],
    ])('refuses a feed with %s', async (_label, o, msg) => {
        await expect(verifyEthUsdFeed(feedClient(o), OP_FEED, clock)).rejects.toThrow(msg);
    });

    it('the freshness bound is configurable', async () => {
        await expect(verifyEthUsdFeed(feedClient({ updatedAt: NOW - 100n }), OP_FEED, { ...clock, maxAgeSeconds: 50 })).rejects.toThrow('max age 50s');
        await expect(verifyEthUsdFeed(feedClient({ updatedAt: NOW - 3600n }), OP_FEED, clock)).resolves.toBeTruthy(); // exactly at the bound
    });

    it('every read is pinned to the checked block hash; a node that cannot serve it (orphaned, pruned, no EIP-1898) refuses', async () => {
        await expect(verifyEthUsdFeed(feedClient({ unavailable: true }), OP_FEED, clock)).rejects.toMatchObject({ data: { reason: 'block-unavailable' } });
    });

    it('refusals carry a fixed data.reason', async () => {
        await expect(verifyEthUsdFeed(feedClient({ code: '0x' }), OP_FEED, clock)).rejects.toMatchObject({ data: { reason: 'no-code', address: OP_FEED } });
        await expect(verifyEthUsdFeed(feedClient({ decimals: 18 }), OP_FEED, clock)).rejects.toMatchObject({ data: { reason: 'wrong-decimals' } });
    });

    it('an RPC whose latest block lags the wall clock is refused (its "fresh" feed may be hours old)', async () => {
        await expect(verifyEthUsdFeed(feedClient(), OP_FEED, { nowSeconds: () => Number(NOW) + 601 })).rejects.toThrow('601s behind the clock (max 600s)');
        await expect(verifyEthUsdFeed(feedClient(), OP_FEED, { nowSeconds: () => Number(NOW) + 601, maxHeadLagSeconds: Infinity })).resolves.toBeTruthy();
    });
});

function factoryClient(o: { code?: string; implEntryPoint?: Address; readError?: boolean; unavailable?: boolean } = {}) {
    const readContract = vi.fn(async ({ functionName }: any) => {
        if (o.readError) throw new Error('execution reverted');
        if (functionName === 'accountImplementation') return IMPL;
        if (functionName === 'entryPoint') return o.implEntryPoint ?? EP_V07;
        throw new Error(`unexpected ${functionName}`);
    });
    return {
        getBlock: vi.fn(async () => ({ number: BLOCK, hash: HASH })),
        readContract,
        request: pinnedRequest({ readContract, code: () => o.code ?? '0x6080', unavailable: o.unavailable }),
    } as any;
}

describe('account factory', () => {
    it('comes from the caller, else the address book; the zero address counts as unset', () => {
        expect(resolveAccountFactoryAddress(10)).toBe(V07_FACTORY);
        expect(resolveAccountFactoryAddress(10, V06_FACTORY)).toBe(V06_FACTORY);
        expect(resolveAccountFactoryAddress(10, '0x0000000000000000000000000000000000000000')).toBe(V07_FACTORY);
        expect(() => resolveAccountFactoryAddress(8453)).toThrow('no simpleAccountFactory for chain 8453');
    });

    it('the address book names the v0.7 factory on all three chains (OP Sepolia had a typo with no code)', () => {
        for (const id of [10, 11155111, 11155420]) expect(getCanonicalAddresses(id)!.simpleAccountFactory).toBe(V07_FACTORY);
    });

    it('a v0.7 factory with the v0.7 EntryPoint passes', async () => {
        await expect(verifyAccountFactory(factoryClient(), V07_FACTORY, EP_V07)).resolves.toEqual({ implementation: IMPL });
    });

    it('a v0.6 factory with the v0.7 EntryPoint is refused, naming both EntryPoints', async () => {
        await expect(verifyAccountFactory(factoryClient({ implEntryPoint: EP_V06 }), V06_FACTORY, EP_V07))
            .rejects.toThrow(`builds accounts for EntryPoint ${EP_V06}, but the SDK is configured for ${EP_V07}`);
    });

    it('a block the node cannot serve refuses, and an EntryPoint mismatch carries the value read', async () => {
        await expect(verifyAccountFactory(factoryClient({ unavailable: true }), V07_FACTORY, EP_V07)).rejects.toMatchObject({ data: { reason: 'block-unavailable' } });
        await expect(verifyAccountFactory(factoryClient({ implEntryPoint: EP_V06 }), V06_FACTORY, EP_V07))
            .rejects.toMatchObject({ data: { reason: 'entrypoint-mismatch', reported: EP_V06, expected: EP_V07 } });
    });

    it('no code, or no accountImplementation().entryPoint(), is refused', async () => {
        await expect(verifyAccountFactory(factoryClient({ code: '0x' }), V07_FACTORY, EP_V07)).rejects.toThrow('has no code');
        await expect(verifyAccountFactory(factoryClient({ readError: true }), V07_FACTORY, EP_V07)).rejects.toThrow('could not be read');
    });
});

describe('assertSameChain', () => {
    it('returns the shared chain id, and throws when the reader and the signer are on different chains', async () => {
        const on = (id: number, configured: number | undefined = id) => ({ getChainId: async () => id, chain: configured === undefined ? undefined : { id: configured } });
        await expect(assertSameChain(on(10), on(10))).resolves.toBe(10);
        await expect(assertSameChain(on(11155111), on(10))).rejects.toThrow('reading client is on chain 11155111 but the signing client is on chain 10');
    });

    it('a signing client with no configured chain (so viem would not re-check it at send time) is refused', async () => {
        const reader = { getChainId: async () => 10 };
        await expect(assertSameChain(reader, { getChainId: async () => 10 })).rejects.toThrow('has no configured chain 10 (it has none)');
        await expect(assertSameChain(reader, { getChainId: async () => 10, chain: { id: 11155111 } })).rejects.toThrow('(it has 11155111)');
    });
});

describe('requireLocalSigner', () => {
    it('accepts a local account; refuses a JSON-RPC account or a bare address unless allowJsonRpcAccount is set (warning once)', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        expect(() => requireLocalSigner({ type: 'local' }, { path: 'p' })).not.toThrow();
        expect(() => requireLocalSigner({ type: 'json-rpc' }, { path: 'p' })).toThrow('pass allowJsonRpcAccount: true');
        expect(() => requireLocalSigner('0x1111111111111111111111111111111111111111', { path: 'p' })).toThrow('not a local account');
        try { requireLocalSigner({ type: 'json-rpc' }, { path: 'p' }); } catch (e: any) { expect(e.data).toEqual({ reason: 'json-rpc-account', path: 'p' }); }
        requireLocalSigner({ type: 'json-rpc' }, { path: 'p', allowJsonRpcAccount: true });
        requireLocalSigner({ type: 'json-rpc' }, { path: 'p', allowJsonRpcAccount: true });
        expect(warn).toHaveBeenCalledTimes(1);
        warn.mockRestore();
    });
});

describe('confirmSentOnChain', () => {
    const TX = ('0x' + 'cd'.repeat(32)) as `0x${string}`;
    function sendClient(o: { chainIds?: number[]; receipt?: any; receiptError?: boolean; canonical?: string } = {}) {
        const ids = [...(o.chainIds ?? [10, 10])];
        return {
            getChainId: vi.fn(async () => ids.shift() ?? 10),
            waitForTransactionReceipt: vi.fn(async () => { if (o.receiptError) throw new Error('timeout'); return o.receipt ?? { status: 'success', blockNumber: BLOCK, blockHash: HASH }; }),
            getBlock: vi.fn(async () => ({ number: BLOCK, hash: o.canonical ?? HASH })),
        } as any;
    }
    it('passes when the receipt is on the checked chain, successful, and in the canonical block', async () => {
        await expect(confirmSentOnChain(sendClient(), TX, 10)).resolves.toEqual({ blockNumber: BLOCK, blockHash: HASH });
    });
    it.each([
        ['the client is on another chain before waiting', { chainIds: [11155111] }, 'tx-chain-unconfirmed'],
        ['no receipt on the checked chain', { receiptError: true }, 'tx-chain-unconfirmed'],
        ['a reverted receipt', { receipt: { status: 'reverted', blockNumber: BLOCK, blockHash: HASH } }, 'tx-reverted'],
        ['a receipt block that is no longer canonical', { canonical: ('0x' + 'ee'.repeat(32)) }, 'tx-not-canonical'],
        ['the client switched chain while waiting', { chainIds: [10, 11155111] }, 'tx-chain-unconfirmed'],
    ])('stops on %s', async (_l, o, reason) => {
        await expect(confirmSentOnChain(sendClient(o as any), TX, 10)).rejects.toMatchObject({ data: { reason } });
    });
});
