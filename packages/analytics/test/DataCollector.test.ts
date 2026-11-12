import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    encodeAbiParameters,
    encodeEventTopics,
    getAddress,
    zeroAddress,
    type Address,
    type Hash,
    type PublicClient,
    type TransactionReceipt,
} from 'viem';
import { sepolia } from 'viem/chains';
import { SuperPaymasterABI, xPNTsTokenABI } from '@aastar/core';
import { DataCollector } from '../src/core/DataCollector';

const BLOCK = 123456n;
const TX = `0x${'ab'.repeat(32)}` as Hash;
const OPERATOR = getAddress('0x1111111111111111111111111111111111111111');
const USER = getAddress('0x2222222222222222222222222222222222222222');
const SP = getAddress('0x3333333333333333333333333333333333333333');
const TOKEN = getAddress('0x4444444444444444444444444444444444444444');
const CONFIGURED_SP = getAddress('0x9999999999999999999999999999999999999999');

const SPONSORED_ABI = [{
    type: 'event',
    name: 'TransactionSponsored',
    inputs: [
        { name: 'operator', type: 'address', indexed: true },
        { name: 'user', type: 'address', indexed: true },
        { name: 'aPNTsCost', type: 'uint256', indexed: false },
        { name: 'xPNTsCost', type: 'uint256', indexed: false },
    ],
}] as const;

type ReadCall = {
    address: Address;
    abi: unknown;
    functionName: string;
    args?: readonly unknown[];
    blockNumber?: bigint;
};

function sponsoredLog(address: Address = SP) {
    const topics = encodeEventTopics({
        abi: SPONSORED_ABI,
        eventName: 'TransactionSponsored',
        args: { operator: OPERATOR, user: USER },
    });
    const data = encodeAbiParameters(
        [{ type: 'uint256' }, { type: 'uint256' }],
        [1n, 2n],
    );
    return { address, topics, data };
}

function makeReceipt(logs: unknown[]): TransactionReceipt {
    return {
        blockNumber: BLOCK,
        gasUsed: 21_000n,
        effectiveGasPrice: 1n,
        status: 'success',
        logs,
    } as unknown as TransactionReceipt;
}

function operatorTuple(token: Address) {
    // operators() outputs: aPNTsBalance, isConfigured, isPaused, xPNTsToken, ...
    return [0n, true, false, token, 0, 0, zeroAddress, 0n, 0n];
}

function collectorWith(readContract: ReturnType<typeof vi.fn>, logs: unknown[]) {
    const client = {
        getTransactionReceipt: vi.fn(async () => makeReceipt(logs)),
        getBlock: vi.fn(async () => ({ timestamp: 1_700_000_000n })),
        readContract,
    } as unknown as PublicClient;
    const collector = new DataCollector('http://127.0.0.1:1', sepolia, CONFIGURED_SP, undefined, false, client);
    return { collector, readContract };
}

function readCalls(readContract: ReturnType<typeof vi.fn>): ReadCall[] {
    return readContract.mock.calls.map((call) => call[0] as ReadCall);
}

describe('DataCollector historical SuperPaymaster reads', () => {
    beforeEach(() => {
        vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('reads aPNTsPriceUSD and operator exchangeRate at the receipt block', async () => {
        const readContract = vi.fn(async (call: ReadCall) => {
            if (call.functionName === 'aPNTsPriceUSD') return 2_000_000n;
            if (call.functionName === 'operators') return operatorTuple(TOKEN);
            if (call.functionName === 'exchangeRate') return 350n;
            throw new Error(`unexpected ${call.functionName}`);
        });
        const { collector } = collectorWith(readContract, [sponsoredLog()]);

        const data = await collector.enrichFromChain(TX);

        expect(data).not.toBeNull();
        expect(data?.aPNTsPriceUSD).toBe(2_000_000n);
        expect(data?.exchangeRate).toBe(350n);

        const calls = readCalls(readContract);
        expect(calls.map((call) => call.functionName)).toEqual([
            'aPNTsPriceUSD',
            'operators',
            'exchangeRate',
        ]);
        expect(calls[0]).toEqual(expect.objectContaining({
            address: SP,
            abi: SuperPaymasterABI,
            functionName: 'aPNTsPriceUSD',
            blockNumber: BLOCK,
        }));
        expect(calls[1]).toEqual(expect.objectContaining({
            address: SP,
            abi: SuperPaymasterABI,
            functionName: 'operators',
            args: [OPERATOR],
            blockNumber: BLOCK,
        }));
        expect(calls[2]).toEqual(expect.objectContaining({
            address: TOKEN,
            abi: xPNTsTokenABI,
            functionName: 'exchangeRate',
            blockNumber: BLOCK,
        }));
        expect(calls.every((call) => call.address !== CONFIGURED_SP)).toBe(true);
    });

    it('does not call exchangeRate when operators() has no token', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const readContract = vi.fn(async (call: ReadCall) => {
            if (call.functionName === 'aPNTsPriceUSD') return 1n;
            if (call.functionName === 'operators') return operatorTuple(zeroAddress);
            throw new Error(`unexpected ${call.functionName}`);
        });
        const { collector } = collectorWith(readContract, [sponsoredLog()]);

        const data = await collector.enrichFromChain(TX);

        expect(data?.aPNTsPriceUSD).toBe(1n);
        expect(data?.exchangeRate).toBeUndefined();
        expect(readCalls(readContract).map((call) => call.functionName)).toEqual([
            'aPNTsPriceUSD',
            'operators',
        ]);
        expect(warn).not.toHaveBeenCalled();
    });

    it('leaves the failed field undefined, warns once per cause, and still returns the tx', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        let priceError: Error = new Error('historical state is not available for this block');
        const readContract = vi.fn(async (call: ReadCall) => {
            if (call.functionName === 'aPNTsPriceUSD') throw priceError;
            if (call.functionName === 'operators') return operatorTuple(TOKEN);
            if (call.functionName === 'exchangeRate') {
                throw new Error('The function "exchangeRate" does not exist on the contract');
            }
            throw new Error(`unexpected ${call.functionName}`);
        });
        const { collector } = collectorWith(readContract, [sponsoredLog()]);

        const first = await collector.enrichFromChain(TX);
        const second = await collector.enrichFromChain(TX);

        expect(first).not.toBeNull();
        expect(second).not.toBeNull();
        expect(first?.aPNTsPriceUSD).toBeUndefined();
        expect(first?.exchangeRate).toBeUndefined();
        expect(second?.status).toBe('success');

        const causes = warn.mock.calls.map((call) => String(call[0]));
        expect(causes.filter((line) => line.includes('aPNTsPriceUSD:pruned-history'))).toHaveLength(1);
        expect(causes.filter((line) => line.includes('exchangeRate:missing-getter'))).toHaveLength(1);

        priceError = new Error('execution reverted');
        const third = await collector.enrichFromChain(TX);
        expect(third?.aPNTsPriceUSD).toBeUndefined();
        expect(third?.exchangeRate).toBeUndefined();

        const after = warn.mock.calls.map((call) => String(call[0]));
        expect(after.filter((line) => line.includes('aPNTsPriceUSD:reverted'))).toHaveLength(1);
        expect(after.filter((line) => line.includes('exchangeRate:missing-getter'))).toHaveLength(1);
        expect(after.filter((line) => line.includes('aPNTsPriceUSD:pruned-history'))).toHaveLength(1);
    });

    it('keeps aPNTsPriceUSD when operators() fails and does not read exchangeRate', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const readContract = vi.fn(async (call: ReadCall) => {
            if (call.functionName === 'aPNTsPriceUSD') return 9n;
            if (call.functionName === 'operators') throw new Error('missing trie node');
            throw new Error(`unexpected ${call.functionName}`);
        });
        const { collector } = collectorWith(readContract, [sponsoredLog()]);

        const data = await collector.enrichFromChain(TX);

        expect(data).not.toBeNull();
        expect(data?.aPNTsPriceUSD).toBe(9n);
        expect(data?.exchangeRate).toBeUndefined();
        expect(readCalls(readContract).map((call) => call.functionName)).toEqual([
            'aPNTsPriceUSD',
            'operators',
        ]);
        expect(readCalls(readContract).every((call) => call.blockNumber === BLOCK)).toBe(true);
        const lines = warn.mock.calls.map((call) => String(call[0]));
        expect(lines.filter((line) => line.includes('operators:pruned-history'))).toHaveLength(1);
    });

    it('does not read protocol state when the receipt has no TransactionSponsored event', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const readContract = vi.fn(async () => {
            throw new Error('readContract should not be called');
        });
        const unrelated = {
            address: SP,
            topics: [`0x${'11'.repeat(32)}`],
            data: '0x',
        };
        const { collector } = collectorWith(readContract, [unrelated]);

        const data = await collector.enrichFromChain(TX);

        expect(data).not.toBeNull();
        expect(data?.paymasterEvents).toEqual([]);
        expect(data?.aPNTsPriceUSD).toBeUndefined();
        expect(data?.exchangeRate).toBeUndefined();
        expect(readContract).not.toHaveBeenCalled();
        expect(warn).not.toHaveBeenCalled();
    });
});
