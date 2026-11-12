import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
    createPublicClient,
    custom,
    encodeAbiParameters,
    encodeEventTopics,
    encodeFunctionData,
    encodeFunctionResult,
    getAddress,
    toFunctionSelector,
    toHex,
    zeroAddress,
    type Address,
    type Hex,
    type PublicClient,
} from 'viem';
import { mainnet, sepolia } from 'viem/chains';
import { getCanonicalAddresses, SuperPaymasterABI, xPNTsTokenABI } from '@aastar/core';
import { DataCollector } from '../src/core/DataCollector';
import { CostCalculator } from '../src/core/CostCalculator';
import { readAnalyzeOverrides, TransactionAnalyzer } from '../src/analyzers/TransactionAnalyzer';

const BLOCK = 123456n;
const BLOCK_TAG = toHex(BLOCK);
const TX = `0x${'ab'.repeat(32)}` as Hex;
const BLOCK_HASH = `0x${'22'.repeat(32)}` as Hex;
const OPERATOR = getAddress('0x1111111111111111111111111111111111111111');
const IMPOSTOR_OPERATOR = getAddress('0x5555555555555555555555555555555555555555');
const USER = getAddress('0x2222222222222222222222222222222222222222');
// Lowercase on purpose. viem checksums the log address, so a case-sensitive compare misses it.
const CONFIGURED_SP = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd';
const SP = getAddress(CONFIGURED_SP);
const FOREIGN = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const TOKEN = getAddress('0x4444444444444444444444444444444444444444');
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

function sponsoredLog(address: Address = SP, operator: Address = OPERATOR, apnts = 1n, xpnts = 2n) {
    const topics = encodeEventTopics({
        abi: SPONSORED_ABI,
        eventName: 'TransactionSponsored',
        args: { operator, user: USER },
    });
    const data = encodeAbiParameters(
        [{ type: 'uint256' }, { type: 'uint256' }],
        [apnts, xpnts],
    );
    return {
        address,
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
    logAddress?: Address;
    logs?: unknown[];
    onEthCall?: (selector: string) => void;
};

function harness(answers: Answers = {}) {
    const calls: EthCall[] = [];
    const sponsored = answers.sponsored !== false;
    const request = async ({ method, params }: { method: string; params?: unknown[] }) => {
        if (method === 'eth_chainId') return '0xaa36a7';
        if (method === 'eth_getTransactionReceipt') {
            return receipt(answers.logs ?? (sponsored ? [sponsoredLog(answers.logAddress)] : [unrelatedLog()]));
        }
        if (method === 'eth_getBlockByNumber') return block();
        if (method === 'eth_call') {
            const tx = (params?.[0] ?? {}) as { data?: Hex; input?: Hex };
            const data = (tx.data ?? tx.input ?? '0x') as Hex;
            const blockTag = String(params?.[1] ?? '');
            const selector = data.slice(0, 10);
            calls.push({ selector, data, block: blockTag, to: String((tx as { to?: string }).to ?? '') });
            answers.onEthCall?.(selector);
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

function collectorFor(
    client: PublicClient,
    cacheDir?: string,
    enableCache = false,
    allowlist?: readonly string[],
    superPaymaster: string = CONFIGURED_SP,
) {
    return new DataCollector('http://127.0.0.1:1', sepolia, superPaymaster, cacheDir, enableCache, client, allowlist);
}

function operatorsCalldata(operator: Address): string {
    return encodeFunctionData({
        abi: SuperPaymasterABI,
        functionName: 'operators',
        args: [operator],
    }).toLowerCase();
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
        expect(SP).not.toBe(CONFIGURED_SP);
        expect(calls.filter((call) => call.selector !== RATE_SELECTOR).every((call) => call.to.toLowerCase() === CONFIGURED_SP)).toBe(true);
    });

    it('matches the configured SuperPaymaster address case-insensitively', async () => {
        expect(SP.toLowerCase()).toBe(CONFIGURED_SP);
        expect(SP).not.toBe(CONFIGURED_SP);
        const { client, calls } = harness({});

        const data = await collectorFor(client).enrichFromChain(TX);

        expect(data?.aPNTsPriceUSD).toBe(PRICE);
        expect(data?.exchangeRate).toBe(RATE);
        expect(calls.filter((call) => call.selector !== RATE_SELECTOR).every((call) => call.to.toLowerCase() === CONFIGURED_SP)).toBe(true);
    });

    it('reads price and rate when the log address is on the constructor allowlist', async () => {
        const foreignLog = getAddress(FOREIGN);
        expect(foreignLog).not.toBe(FOREIGN);
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { client, calls } = harness({ logAddress: foreignLog });

        const data = await collectorFor(client, undefined, false, [FOREIGN]).enrichFromChain(TX);

        expect(data?.aPNTsPriceUSD).toBe(PRICE);
        expect(data?.exchangeRate).toBe(RATE);
        expect(calls.filter((call) => call.selector !== RATE_SELECTOR).every((call) => call.to.toLowerCase() === FOREIGN)).toBe(true);
        expect(calls.some((call) => call.to.toLowerCase() === CONFIGURED_SP)).toBe(false);
        expect(warn).not.toHaveBeenCalled();
    });

    it('reads the configured SuperPaymaster when an untrusted TransactionSponsored log precedes it', async () => {
        const impostorApnts = 9_000000000000000000n;
        const trustedApnts = 1_000000000000000000n;
        const impostor = sponsoredLog(getAddress(FOREIGN), IMPOSTOR_OPERATOR, impostorApnts);
        const trusted = { ...sponsoredLog(SP, OPERATOR, trustedApnts), logIndex: '0x1' };
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { client, calls } = harness({ logs: [impostor, trusted] });

        const data = await collectorFor(client).enrichFromChain(TX);

        expect(data?.aPNTsPriceUSD).toBe(PRICE);
        expect(data?.exchangeRate).toBe(RATE);
        expect(data?.paymasterEvents.filter((event) => event.type === 'TransactionSponsored').map((event) => event.operator.toLowerCase())).toEqual([
            IMPOSTOR_OPERATOR.toLowerCase(),
            OPERATOR.toLowerCase(),
        ]);
        expect(data?.pricedSponsored).toEqual({ logIndex: 1, operator: OPERATOR });
        const cost = new CostCalculator(3000, 0.02).calculate(data!);
        expect(cost.meta.mode).toBe('super');
        expect(cost.economic.protocolUsdRevenue).toBeCloseTo(0.02);
        expect(calls.filter((call) => call.selector !== RATE_SELECTOR).every((call) => call.to.toLowerCase() === CONFIGURED_SP)).toBe(true);
        expect(calls.some((call) => call.to.toLowerCase() === FOREIGN)).toBe(false);
        const operatorCall = calls.find((call) => call.selector === OPERATORS_SELECTOR);
        expect(operatorCall?.data.toLowerCase()).toBe(operatorsCalldata(OPERATOR));
        expect(warn).not.toHaveBeenCalled();
    });

    it('does not read price or rate when the TransactionSponsored log address is not the configured SuperPaymaster', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const dir = cacheDir();
        const { client, calls } = harness({ logAddress: getAddress(FOREIGN) });
        const collector = collectorFor(client, dir, true);

        const first = await collector.enrichFromChain(TX);
        const second = await collector.enrichFromChain(TX);

        expect(first).not.toBeNull();
        expect(first?.paymasterEvents).toHaveLength(1);
        expect(first?.aPNTsPriceUSD).toBeUndefined();
        expect(first?.exchangeRate).toBeUndefined();
        expect(second?.aPNTsPriceUSD).toBeUndefined();
        expect(second?.exchangeRate).toBeUndefined();
        expect(calls).toEqual([]);
        expect(fs.readdirSync(dir)).toEqual([]);
        const lines = warn.mock.calls.map((call) => String(call[0]));
        expect(lines.filter((line) => line.includes('transaction-sponsored:untrusted-address'))).toHaveLength(1);
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
        expect(stored.schemaVersion).toBe(3);
        expect(stored.trust).toEqual({ superPaymaster: CONFIGURED_SP, allowlist: [] });
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
        expect(stored.schemaVersion).toBe(3);
        expect(stored.trust).toEqual({ superPaymaster: CONFIGURED_SP, allowlist: [] });
    });

    it('re-enriches a schemaVersion 1 entry even when its trust object matches', async () => {
        const dir = cacheDir();
        const legacy = {
            schemaVersion: 1,
            trust: { superPaymaster: CONFIGURED_SP, allowlist: [] },
            data: {
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
            },
        };
        fs.writeFileSync(path.join(dir, `${TX}.json`), JSON.stringify(legacy));
        const { client, calls } = harness({});

        const data = await collectorFor(client, dir, true).enrichFromChain(TX);

        expect(data?.aPNTsPriceUSD).toBe(PRICE);
        expect(data?.exchangeRate).toBe(RATE);
        expect(calls.length).toBeGreaterThan(0);
        const stored = JSON.parse(fs.readFileSync(path.join(dir, `${TX}.json`), 'utf8'));
        expect(stored.schemaVersion).toBe(3);
    });

    it('re-enriches a schemaVersion 2 entry that has no pricedSponsored', async () => {
        const dir = cacheDir();
        const legacy = {
            schemaVersion: 2,
            trust: { superPaymaster: CONFIGURED_SP, allowlist: [] },
            data: {
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
            },
        };
        fs.writeFileSync(path.join(dir, `${TX}.json`), JSON.stringify(legacy));
        const { client, calls } = harness({});

        const data = await collectorFor(client, dir, true).enrichFromChain(TX);

        expect(data?.aPNTsPriceUSD).toBe(PRICE);
        expect(data?.pricedSponsored).toEqual({ logIndex: 0, operator: OPERATOR });
        expect(calls.length).toBeGreaterThan(0);
        const stored = JSON.parse(fs.readFileSync(path.join(dir, `${TX}.json`), 'utf8'));
        expect(stored.schemaVersion).toBe(3);
        expect(stored.data.pricedSponsored).toEqual({ logIndex: 0, operator: OPERATOR });
    });

    it('does not reuse a cached price after the allowlist that trusted the emitter is removed', async () => {
        const dir = cacheDir();
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { client, calls } = harness({ logAddress: getAddress(FOREIGN) });

        const priced = await collectorFor(client, dir, true, [FOREIGN]).enrichFromChain(TX);
        expect(priced?.aPNTsPriceUSD).toBe(PRICE);
        expect(priced?.exchangeRate).toBe(RATE);
        const callsAfter = calls.length;

        const stripped = await collectorFor(client, dir, true).enrichFromChain(TX);

        expect(stripped?.aPNTsPriceUSD).toBeUndefined();
        expect(stripped?.exchangeRate).toBeUndefined();
        expect(calls.length).toBe(callsAfter);
        expect(warn.mock.calls.map((call) => String(call[0])).filter((line) => line.includes('transaction-sponsored:untrusted-address'))).toHaveLength(1);
    });

    it('keeps the construction-time allowlist when the caller clears it during version()', async () => {
        const dir = cacheDir();
        const allowlist = [FOREIGN];
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { client, calls } = harness({
            logAddress: getAddress(FOREIGN),
            onEthCall: (selector) => {
                if (selector === VERSION_SELECTOR) allowlist.splice(0, allowlist.length);
            },
        });

        const priced = await collectorFor(client, dir, true, allowlist).enrichFromChain(TX);

        expect(allowlist).toEqual([]);
        expect(priced?.aPNTsPriceUSD).toBe(PRICE);
        expect(priced?.exchangeRate).toBe(RATE);
        const stored = JSON.parse(fs.readFileSync(path.join(dir, `${TX}.json`), 'utf8'));
        expect(stored.trust).toEqual({ superPaymaster: CONFIGURED_SP, allowlist: [FOREIGN] });

        const callsAfter = calls.length;
        const stripped = await collectorFor(client, dir, true).enrichFromChain(TX);
        expect(stripped?.aPNTsPriceUSD).toBeUndefined();
        expect(stripped?.exchangeRate).toBeUndefined();
        expect(calls.length).toBe(callsAfter);
    });

    it('reuses the cache when the configured address and allowlist differ only by case or order', async () => {
        const other = '0xcccccccccccccccccccccccccccccccccccccccc';
        const dir = cacheDir();
        const { client, calls } = harness({ logAddress: getAddress(FOREIGN) });

        const first = await collectorFor(client, dir, true, [FOREIGN, other, FOREIGN]).enrichFromChain(TX);
        expect(first?.aPNTsPriceUSD).toBe(PRICE);
        const callsAfter = calls.length;

        const again = await collectorFor(
            client,
            dir,
            true,
            [getAddress(other), FOREIGN.toUpperCase()],
            getAddress(CONFIGURED_SP),
        ).enrichFromChain(TX);

        expect(calls.length).toBe(callsAfter);
        expect(again?.aPNTsPriceUSD).toBe(PRICE);
        expect(again?.exchangeRate).toBe(RATE);
    });

    it('defaults to the canonical Sepolia SuperPaymaster and prices a 0x09DF receipt', async () => {
        const canonical = getCanonicalAddresses(sepolia.id)!.superPaymaster;
        expect(canonical.toLowerCase()).toBe('0x09df0d2e3722ec0e401fe3819e64278a42ae4de9');
        const { client, calls } = harness({ logAddress: getAddress(canonical) });

        const data = await new DataCollector('http://127.0.0.1:1', sepolia, undefined, undefined, false, client).enrichFromChain(TX);

        expect(data?.pricedSponsored).toEqual({ logIndex: 0, operator: OPERATOR });
        expect(data?.aPNTsPriceUSD).toBe(PRICE);
        expect(data?.exchangeRate).toBe(RATE);
        expect(calls.filter((call) => call.selector !== RATE_SELECTOR).every((call) => call.to.toLowerCase() === canonical.toLowerCase())).toBe(true);
    });

    it('throws when the chain has no canonical SuperPaymaster and no address is passed', () => {
        expect(() => new DataCollector('http://127.0.0.1:1', mainnet)).toThrow(/No canonical SuperPaymaster for chain 1/);
    });
});

const prices = { getEthPrice: async () => 3000, getAPNTsPrice: async () => 0.02 };
const benchmarks = { loadAll: async () => ({ l2: [], paymasters: [] }) };

describe('TransactionAnalyzer deployment address', () => {
    beforeEach(() => {
        vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('analyzes a canonical Sepolia SuperPaymaster receipt as super', async () => {
        const canonical = getCanonicalAddresses(sepolia.id)!.superPaymaster;
        const { client } = harness({
            logs: [sponsoredLog(getAddress(canonical), OPERATOR, 1_000000000000000000n)],
        });

        const report = await new TransactionAnalyzer('http://127.0.0.1:1', {
            client,
            enableCache: false,
            priceOracle: prices,
            benchmarkLoader: benchmarks,
        }).analyze(TX);

        expect(report).toContain('**模式**: SuperPaymaster');
        expect(report).toContain('**协议收入 (Revenue)** | $0.0200');
    });

    it('forwards an explicit SuperPaymaster address and allowlist', async () => {
        const canonical = getCanonicalAddresses(sepolia.id)!.superPaymaster;
        const { client } = harness({
            logs: [sponsoredLog(getAddress(FOREIGN), OPERATOR, 1_000000000000000000n)],
        });

        const report = await new TransactionAnalyzer('http://127.0.0.1:1', {
            chain: mainnet,
            superPaymasterAddress: canonical,
            paymasterAllowlist: [FOREIGN],
            client,
            enableCache: false,
            priceOracle: prices,
            benchmarkLoader: benchmarks,
        }).analyze(TX);

        expect(report).toContain('**模式**: SuperPaymaster');
        expect(report).toContain('**协议收入 (Revenue)** | $0.0200');
    });

    it('reads --super-paymaster and --allowlist for the CLIs', () => {
        expect(readAnalyzeOverrides([
            'analyze',
            TX,
            '--super-paymaster',
            '0x09DF0d2e3722EC0e401fE3819E64278a42ae4DE9',
            '--allowlist',
            `${FOREIGN}, 0x09DF0d2e3722EC0e401fE3819E64278a42ae4DE9`,
        ])).toEqual({
            superPaymasterAddress: '0x09DF0d2e3722EC0e401fE3819E64278a42ae4DE9',
            paymasterAllowlist: [FOREIGN, '0x09DF0d2e3722EC0e401fE3819E64278a42ae4DE9'],
        });
    });
});
