import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
    createPublicClient,
    custom,
    encodeAbiParameters,
    encodeEventTopics,
    encodeFunctionResult,
    getAddress,
    toFunctionSelector,
    toHex,
    zeroAddress,
    type Address,
    type Hex,
    type PublicClient,
} from 'viem';
import { sepolia } from 'viem/chains';
import { SuperPaymasterABI, xPNTsTokenABI } from '@aastar/core';
import { DataCollector } from '../src/core/DataCollector';

const BLOCK = 123456n;
const BLOCK_TAG = toHex(BLOCK);
const TX = `0x${'ab'.repeat(32)}` as Hex;
const BLOCK_HASH = `0x${'22'.repeat(32)}` as Hex;
const OPERATOR = getAddress('0x1111111111111111111111111111111111111111');
const USER = getAddress('0x2222222222222222222222222222222222222222');
const SP = getAddress('0x3333333333333333333333333333333333333333');
const TOKEN = getAddress('0x4444444444444444444444444444444444444444');
const CONFIGURED_SP = getAddress('0x9999999999999999999999999999999999999999');
const PRICE = 2_000_000n;
const RATE = 350n;

const VERSION_SELECTOR = toFunctionSelector('function version()');
const PRICE_SELECTOR = toFunctionSelector('function aPNTsPriceUSD()');
const OPERATORS_SELECTOR = toFunctionSelector('function operators(address)');
const RATE_SELECTOR = toFunctionSelector('function exchangeRate()');

const SUPPORTED_VERSIONS = [
    'SuperPaymaster-5.4.1',
    'SuperPaymaster-5.4.2',
    'SuperPaymaster-5.5.0',
    'SuperPaymaster-5.5.1',
] as const;

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

type EthCall = { selector: string; data: Hex; block: string; to: string };

function sponsoredLog() {
    const topics = encodeEventTopics({
        abi: SPONSORED_ABI,
        eventName: 'TransactionSponsored',
        args: { operator: OPERATOR, user: USER },
    });
    const data = encodeAbiParameters(
        [{ type: 'uint256' }, { type: 'uint256' }],
        [1n, 2n],
    );
    return {
        address: SP,
        topics,
        data,
        blockNumber: BLOCK_TAG,
        blockHash: BLOCK_HASH,
        transactionHash: TX,
        transactionIndex: '0x0',
        logIndex: '0x0',
        removed: false,
    };
}

function unrelatedLog() {
    return { ...sponsoredLog(), topics: [`0x${'11'.repeat(32)}`], data: '0x' };
}

function receipt(logs: unknown[]) {
    return {
        transactionHash: TX,
        transactionIndex: '0x0',
        blockHash: BLOCK_HASH,
        blockNumber: BLOCK_TAG,
        from: USER,
        to: SP,
        cumulativeGasUsed: '0x5208',
        gasUsed: '0x5208',
        effectiveGasPrice: '0x1',
        status: '0x1',
        logsBloom: `0x${'00'.repeat(256)}`,
        logs,
        type: '0x2',
        contractAddress: null,
    };
}

function block() {
    return {
        number: BLOCK_TAG,
        hash: BLOCK_HASH,
        parentHash: `0x${'33'.repeat(32)}`,
        nonce: '0x0000000000000000',
        sha3Uncles: `0x${'00'.repeat(32)}`,
        logsBloom: `0x${'00'.repeat(256)}`,
        transactionsRoot: `0x${'00'.repeat(32)}`,
        stateRoot: `0x${'00'.repeat(32)}`,
        receiptsRoot: `0x${'00'.repeat(32)}`,
        miner: USER,
        difficulty: '0x0',
        totalDifficulty: '0x0',
        extraData: '0x',
        size: '0x1',
        gasLimit: '0x1c9c380',
        gasUsed: '0x5208',
        timestamp: toHex(1_700_000_000n),
        transactions: [],
        uncles: [],
        baseFeePerGas: '0x1',
    };
}

function encoded(functionName: 'version' | 'aPNTsPriceUSD' | 'operators' | 'exchangeRate', result: unknown): Hex {
    if (functionName === 'exchangeRate') {
        return encodeFunctionResult({ abi: xPNTsTokenABI as never, functionName, result: result as never });
    }
    return encodeFunctionResult({ abi: SuperPaymasterABI as never, functionName, result: result as never });
}

function operatorResult(token: Address) {
    return [0n, true, false, token, 0, 0, zeroAddress, 0n, 0n];
}

type Answers = {
    sponsored?: boolean;
    version?: string;
    versionError?: Error;
    price?: bigint;
    priceError?: Error;
    token?: Address;
    operatorsError?: Error;
    rate?: bigint;
    rateError?: Error;
};

function harness(answers: Answers = {}) {
    const calls: EthCall[] = [];
    const sponsored = answers.sponsored !== false;
    const request = async ({ method, params }: { method: string; params?: unknown[] }) => {
        if (method === 'eth_chainId') return '0xaa36a7';
        if (method === 'eth_getTransactionReceipt') return receipt(sponsored ? [sponsoredLog()] : [unrelatedLog()]);
        if (method === 'eth_getBlockByNumber') return block();
        if (method === 'eth_call') {
            const tx = (params?.[0] ?? {}) as { data?: Hex; input?: Hex };
            const data = (tx.data ?? tx.input ?? '0x') as Hex;
            const blockTag = String(params?.[1] ?? '');
            const selector = data.slice(0, 10);
            calls.push({ selector, data, block: blockTag, to: String((tx as { to?: string }).to ?? '') });
            if (selector === VERSION_SELECTOR) {
                if (answers.versionError) throw answers.versionError;
                return encoded('version', answers.version ?? 'SuperPaymaster-5.4.2');
            }
            if (selector === PRICE_SELECTOR) {
                if (answers.priceError) throw answers.priceError;
                return encoded('aPNTsPriceUSD', answers.price ?? PRICE);
            }
            if (selector === OPERATORS_SELECTOR) {
                if (answers.operatorsError) throw answers.operatorsError;
                return encoded('operators', operatorResult(answers.token ?? TOKEN));
            }
            if (selector === RATE_SELECTOR) {
                if (answers.rateError) throw answers.rateError;
                return encoded('exchangeRate', answers.rate ?? RATE);
            }
            throw new Error(`unexpected eth_call ${selector}`);
        }
        throw new Error(`unexpected ${method}`);
    };
    const client = createPublicClient({
        chain: sepolia,
        transport: custom({ request }, { retryCount: 0 }),
    });
    return { client, calls };
}

function collectorFor(client: PublicClient, cacheDir?: string, enableCache = false) {
    return new DataCollector('http://127.0.0.1:1', sepolia, CONFIGURED_SP, cacheDir, enableCache, client);
}

describe('DataCollector historical SuperPaymaster reads', () => {
    const cacheDirs: string[] = [];

    beforeEach(() => {
        vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
        for (const dir of cacheDirs) fs.rmSync(dir, { recursive: true, force: true });
        cacheDirs.length = 0;
    });

    function cacheDir() {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aastar-datacollector-'));
        cacheDirs.push(dir);
        return dir;
    }

    it.each(SUPPORTED_VERSIONS)('reads aPNTsPriceUSD and operator exchangeRate at the receipt block for %s', async (version) => {
        const { client, calls } = harness({ version });
        const data = await collectorFor(client).enrichFromChain(TX);

        expect(data).not.toBeNull();
        expect(data?.aPNTsPriceUSD).toBe(PRICE);
        expect(data?.exchangeRate).toBe(RATE);
        expect(calls.map((call) => call.selector)).toEqual([
            VERSION_SELECTOR,
            PRICE_SELECTOR,
            OPERATORS_SELECTOR,
            RATE_SELECTOR,
        ]);
        expect(calls.every((call) => call.block === BLOCK_TAG)).toBe(true);
        const operatorCall = calls.find((call) => call.selector === OPERATORS_SELECTOR);
        expect(operatorCall?.data.toLowerCase()).toContain(OPERATOR.slice(2).toLowerCase());
        const rateCall = calls.find((call) => call.selector === RATE_SELECTOR);
        expect(rateCall?.to.toLowerCase()).toBe(TOKEN.toLowerCase());
        expect(calls.filter((call) => call.selector !== RATE_SELECTOR).every((call) => call.to.toLowerCase() === SP.toLowerCase())).toBe(true);
    });

    it('does not call exchangeRate when the named xPNTsToken is the zero address', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { client, calls } = harness({ token: zeroAddress });

        const data = await collectorFor(client).enrichFromChain(TX);

        expect(data?.aPNTsPriceUSD).toBe(PRICE);
        expect(data?.exchangeRate).toBeUndefined();
        expect(calls.map((call) => call.selector)).toEqual([
            VERSION_SELECTOR,
            PRICE_SELECTOR,
            OPERATORS_SELECTOR,
        ]);
        expect(warn).not.toHaveBeenCalled();
    });

    it('skips price and rate for an unsupported version and warns once', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { client, calls } = harness({ version: 'SuperPaymaster-3.2.2' });
        const collector = collectorFor(client);

        const first = await collector.enrichFromChain(TX);
        const second = await collector.enrichFromChain(TX);

        expect(first).not.toBeNull();
        expect(second).not.toBeNull();
        expect(first?.aPNTsPriceUSD).toBeUndefined();
        expect(first?.exchangeRate).toBeUndefined();
        expect(calls.every((call) => call.selector === VERSION_SELECTOR)).toBe(true);
        expect(calls.every((call) => call.block === BLOCK_TAG)).toBe(true);
        const lines = warn.mock.calls.map((call) => String(call[0]));
        expect(lines.filter((line) => line.includes('exchangeRate:unsupported-version:SuperPaymaster-3.2.2'))).toHaveLength(1);
    });

    it('warns unsupported-version:unreadable when version() cannot be read and still returns the tx', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { client, calls } = harness({ versionError: new Error('missing trie node') });

        const data = await collectorFor(client).enrichFromChain(TX);

        expect(data).not.toBeNull();
        expect(data?.aPNTsPriceUSD).toBeUndefined();
        expect(data?.exchangeRate).toBeUndefined();
        expect(calls.map((call) => call.selector)).toEqual([VERSION_SELECTOR]);
        const lines = warn.mock.calls.map((call) => String(call[0]));
        expect(lines.filter((line) => line.includes('exchangeRate:unsupported-version:unreadable'))).toHaveLength(1);
    });

    it('leaves only the failed field undefined when exchangeRate is a missing getter', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { client, calls } = harness({
            rateError: new Error('The function "exchangeRate" does not exist on the contract'),
        });

        const data = await collectorFor(client).enrichFromChain(TX);

        expect(data).not.toBeNull();
        expect(data?.aPNTsPriceUSD).toBe(PRICE);
        expect(data?.exchangeRate).toBeUndefined();
        expect(calls.map((call) => call.selector)).toContain(RATE_SELECTOR);
        const lines = warn.mock.calls.map((call) => String(call[0]));
        expect(lines.filter((line) => line.includes('exchangeRate:missing-getter'))).toHaveLength(1);
    });

    it('does not read protocol state when the receipt has no TransactionSponsored event', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { client, calls } = harness({ sponsored: false });

        const data = await collectorFor(client).enrichFromChain(TX);

        expect(data).not.toBeNull();
        expect(data?.paymasterEvents).toEqual([]);
        expect(data?.aPNTsPriceUSD).toBeUndefined();
        expect(data?.exchangeRate).toBeUndefined();
        expect(calls).toEqual([]);
        expect(warn).not.toHaveBeenCalled();
    });

    it('re-enriches a legacy cache entry that has no schemaVersion', async () => {
        const dir = cacheDir();
        const legacy = {
            txHash: TX,
            blockNumber: '1n',
            blockTimestamp: '1n',
            gasUsed: '1n',
            effectiveGasPrice: '1n',
            status: 'success',
            paymasterEvents: [],
            aPNTsPriceUSD: '1n',
            exchangeRate: '1n',
            receipt: {},
        };
        fs.writeFileSync(path.join(dir, `${TX}.json`), JSON.stringify(legacy));
        const { client, calls } = harness({});

        const data = await collectorFor(client, dir, true).enrichFromChain(TX);

        expect(data?.aPNTsPriceUSD).toBe(PRICE);
        expect(data?.exchangeRate).toBe(RATE);
        expect(calls.length).toBeGreaterThan(0);
        const stored = JSON.parse(fs.readFileSync(path.join(dir, `${TX}.json`), 'utf8'));
        expect(stored.schemaVersion).toBe(1);
    });

    it('round-trips bigints from a schemaVersion cache entry without another eth_call', async () => {
        const dir = cacheDir();
        const { client, calls } = harness({});
        const first = await collectorFor(client, dir, true).enrichFromChain(TX);
        expect(first?.aPNTsPriceUSD).toBe(PRICE);
        expect(first?.exchangeRate).toBe(RATE);
        expect(typeof first?.gasUsed).toBe('bigint');
        const callsAfterWrite = calls.length;

        const second = await collectorFor(client, dir, true).enrichFromChain(TX);

        expect(calls.length).toBe(callsAfterWrite);
        expect(second?.aPNTsPriceUSD).toBe(PRICE);
        expect(second?.exchangeRate).toBe(RATE);
        expect(second?.blockNumber).toBe(BLOCK);
        expect(second?.gasUsed).toBe(21_000n);
        expect(typeof second?.aPNTsPriceUSD).toBe('bigint');
    });

    it('does not persist a retryable read, then persists the recovered one', async () => {
        const dir = cacheDir();
        const answers: Answers = { priceError: new Error('historical state is not available') };
        const { client, calls } = harness(answers);
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const failed = await collectorFor(client, dir, true).enrichFromChain(TX);

        expect(failed).not.toBeNull();
        expect(failed?.aPNTsPriceUSD).toBeUndefined();
        expect(fs.readdirSync(dir)).toEqual([]);
        expect(warn.mock.calls.map((call) => String(call[0])).some((line) => line.includes('aPNTsPriceUSD:block-state-header'))).toBe(true);

        answers.priceError = undefined;
        const recovered = await collectorFor(client, dir, true).enrichFromChain(TX);
        expect(recovered?.aPNTsPriceUSD).toBe(PRICE);
        expect(recovered?.exchangeRate).toBe(RATE);
        expect(fs.readdirSync(dir)).toEqual([`${TX}.json`]);

        const callsAfterRecover = calls.length;
        const cached = await collectorFor(client, dir, true).enrichFromChain(TX);
        expect(calls.length).toBe(callsAfterRecover);
        expect(cached?.aPNTsPriceUSD).toBe(PRICE);
    });

    it.each([
        'header not found',
        'block not found',
        'state not found',
    ])('does not persist a %s read, then recovers', async (message) => {
        const dir = cacheDir();
        const answers: Answers = { priceError: new Error(message) };
        const { client, calls } = harness(answers);
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const failed = await collectorFor(client, dir, true).enrichFromChain(TX);

        expect(failed).not.toBeNull();
        expect(failed?.aPNTsPriceUSD).toBeUndefined();
        expect(fs.readdirSync(dir)).toEqual([]);
        const lines = warn.mock.calls.map((call) => String(call[0]));
        expect(lines.some((line) => line.includes('aPNTsPriceUSD:block-state-header'))).toBe(true);
        expect(lines.some((line) => line.includes('missing-getter'))).toBe(false);

        answers.priceError = undefined;
        const recovered = await collectorFor(client, dir, true).enrichFromChain(TX);
        expect(recovered?.aPNTsPriceUSD).toBe(PRICE);
        expect(recovered?.exchangeRate).toBe(RATE);
        expect(fs.readdirSync(dir)).toEqual([`${TX}.json`]);
        const callsAfterRecover = calls.length;
        const cached = await collectorFor(client, dir, true).enrichFromChain(TX);
        expect(calls.length).toBe(callsAfterRecover);
        expect(cached?.aPNTsPriceUSD).toBe(PRICE);
    });

    it.each([
        'The function "aPNTsPriceUSD" does not exist on the contract',
        'unknown selector 0x594a6f23',
    ])('persists a permanent missing getter (%s) so the next read does not eth_call', async (message) => {
        const dir = cacheDir();
        const { client, calls } = harness({ priceError: new Error(message) });
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const first = await collectorFor(client, dir, true).enrichFromChain(TX);
        expect(first).not.toBeNull();
        expect(first?.aPNTsPriceUSD).toBeUndefined();
        expect(first?.exchangeRate).toBe(RATE);
        expect(fs.readdirSync(dir)).toEqual([`${TX}.json`]);
        expect(warn.mock.calls.map((call) => String(call[0])).some((line) => line.includes('aPNTsPriceUSD:missing-getter'))).toBe(true);

        const callsAfter = calls.length;
        const again = await collectorFor(client, dir, true).enrichFromChain(TX);
        expect(calls.length).toBe(callsAfter);
        expect(again?.aPNTsPriceUSD).toBeUndefined();
        expect(again?.exchangeRate).toBe(RATE);
    });

    it('persists an unsupported version so the next read does not eth_call', async () => {
        const dir = cacheDir();
        const { client, calls } = harness({ version: 'SuperPaymaster-3.2.2' });
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        const collector = collectorFor(client, dir, true);

        await collector.enrichFromChain(TX);
        const callsAfter = calls.length;
        const again = await collector.enrichFromChain(TX);

        expect(calls.length).toBe(callsAfter);
        expect(again?.exchangeRate).toBeUndefined();
        expect(again?.aPNTsPriceUSD).toBeUndefined();
        const stored = JSON.parse(fs.readFileSync(path.join(dir, `${TX}.json`), 'utf8'));
        expect(stored.schemaVersion).toBe(1);
    });
});
