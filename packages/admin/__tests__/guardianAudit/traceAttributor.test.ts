import { describe, expect, it } from 'vitest';
import { getAddress, getContractAddress, type Hex } from 'viem';
import type { FoundAction } from '../../src/guardianAudit/scan';
import type { RawRpc } from '../../src/guardianAudit/rpc';
import { MEASURE_NODES } from '../../src/guardianAudit/attribute';
import { traceAttributor } from '../../src/guardianAudit/traceAttributor';
import { isolatedClone } from '../../src/guardianAudit/isolated';

const FROM = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd';
const OTHER = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const TARGET = '0xcccccccccccccccccccccccccccccccccccccccc';
const TOPIC = `0x${'ab'.repeat(32)}` as Hex;
const BLOCK = `0x${'11'.repeat(32)}` as Hex;
const TX = `0x${'22'.repeat(32)}` as Hex;
const LEAK = 'https://rpc.example/secret-LEAKED';

function action(logIndex = 7): FoundAction {
    return {
        blockNumber: 16,
        blockHash: BLOCK,
        txHash: TX,
        logIndex,
        address: getAddress(TARGET),
        kind: 'execute',
        decoded: { kind: 'execute' },
        log: {
            address: getAddress(TARGET),
            topics: [TOPIC],
            data: '0x',
            blockNumber: '0x10',
            blockHash: BLOCK,
            transactionHash: TX,
            logIndex: '0x7',
        },
    };
}

function traceOf(from = FROM) {
    return {
        type: 'CALL',
        from,
        to: TARGET,
        input: '0x12345678',
        calls: [{
            type: 'CALL',
            from: TARGET,
            to: OTHER,
            error: 'execution reverted',
            logs: [{ address: OTHER, topics: [TOPIC], data: '0x' }],
        }],
        value: '0x00',
        logs: [{ address: TARGET, topics: [TOPIC], data: '0x' }],
    };
}

function txOf(over: Record<string, unknown> = {}) {
    return {
        hash: TX,
        from: FROM,
        to: TARGET as string | null,
        input: '0x12345678',
        value: '0x0',
        nonce: '0x01',
        transactionIndex: '0x3',
        blockHash: BLOCK,
        blockNumber: '0x10',
        ...over,
    };
}

function receiptOf(over: Record<string, unknown> = {}, logOver: Record<string, unknown> = {}) {
    return {
        transactionHash: TX.toUpperCase(),
        blockHash: BLOCK.toUpperCase(),
        status: '0x1',
        blockNumber: '0x10',
        transactionIndex: '0x03',
        logs: [{
            address: getAddress(TARGET),
            topics: [`0x${'AB'.repeat(32)}`],
            data: '0x',
            logIndex: '0x7',
            ...logOver,
        }],
        ...over,
    };
}

function pair(
    answer: (name: string, method: string) => unknown,
    txFor: (name: string) => unknown = () => txOf(),
    names: readonly [string, string] = ['alpha', 'beta'],
) {
    const calls: { name: string; method: string; params: unknown[] }[] = [];
    const make = (name: string): RawRpc => ({
        name,
        async request({ method, params = [] }) {
            calls.push({ name, method, params: params as unknown[] });
            if (method === 'eth_getTransactionByHash') return txFor(name);
            return answer(name, method);
        },
    });
    const providers = [make(names[0]), make(names[1])] as const;
    return { calls, providers, traceProviders: providers };
}

function attr(bound: { providers: readonly [RawRpc, RawRpc]; traceProviders: readonly [RawRpc, ...RawRpc[]] }) {
    const traces = bound.traceProviders;
    const traceProviders = (traces.length === 1 ? [traces[0]!] : [traces[0]!, traces[1]!]) as
        readonly [RawRpc] | readonly [RawRpc, RawRpc];
    return traceAttributor({ providers: bound.providers, traceProviders });
}

describe('guardian-audit trace attributor (unit, not acceptance)', () => {
    it('returns the attribution when both providers agree, ignoring address case', async () => {
        const { calls, providers, traceProviders } = pair((name, method) => {
            if (method === 'eth_getTransactionReceipt') return receiptOf();
            return traceOf(name === 'alpha' ? `0x${FROM.slice(2).toUpperCase()}` : FROM);
        });
        const result = await attr({ providers, traceProviders }).attribute(action());
        expect(result).toEqual({
            ok: true,
            attribution: {
                transactionSender: getAddress(FROM),
                immediateCaller: getAddress(FROM),
                emitter: getAddress(TARGET),
                forwardingPath: [{
                    type: 'CALL',
                    from: getAddress(FROM),
                    to: getAddress(TARGET),
                    selector: '0x12345678',
                }],
                attributionSource: 'dual:alpha+beta',
            },
        });
        // scanRange copies attribution with isolatedClone, which accepts plain data only (#445).
        expect(result.ok && isolatedClone(result.attribution)).toEqual(result.ok && result.attribution);
        expect(calls.map((c) => `${c.name}:${c.method}`)).toEqual(expect.arrayContaining([
            'alpha:eth_getTransactionReceipt',
            'beta:eth_getTransactionReceipt',
            'alpha:eth_getTransactionByHash',
            'beta:eth_getTransactionByHash',
            'alpha:debug_traceTransaction',
            'beta:debug_traceTransaction',
        ]));
        expect(calls.find((c) => c.method === 'debug_traceTransaction')?.params).toEqual([
            TX,
            { tracer: 'callTracer', tracerConfig: { withLog: true } },
        ]);
    });

    it('hides the RPC text when a trace method is unsupported', async () => {
        const cases: { who: 'alpha' | 'beta'; fail: (name: string) => unknown }[] = [
            {
                who: 'beta',
                fail: (name) => (name === 'beta'
                    ? { error: { code: -32601, message: `nope ${LEAK}` } }
                    : traceOf()),
            },
            {
                who: 'alpha',
                fail: (name) => {
                    if (name === 'alpha') throw { info: { error: { code: -32601, message: 'nope' } } };
                    return traceOf();
                },
            },
            {
                who: 'alpha',
                fail: (name) => {
                    if (name === 'alpha') throw { code: -32600, message: 'invalid request' };
                    return traceOf();
                },
            },
            {
                who: 'alpha',
                fail: (name) => {
                    if (name === 'alpha') throw { shortMessage: `unknown tracer ${LEAK}` };
                    return traceOf();
                },
            },
        ];
        for (const item of cases) {
            const { providers, traceProviders } = pair((name, method) => {
                if (method === 'eth_getTransactionReceipt') return receiptOf();
                return item.fail(name);
            });
            const result = await attr({ providers, traceProviders }).attribute(action());
            expect(result).toEqual({ ok: false, reason: 'trace unsupported' });
            if (!result.ok) expect(result.reason).not.toContain('LEAKED');
        }
    });

    it('reports a trace read failure without the RPC message', async () => {
        const { providers, calls, traceProviders } = pair((name, method) => {
            if (method === 'eth_getTransactionReceipt') return receiptOf();
            if (name === 'alpha') throw new Error(`socket hang up ${LEAK}`);
            return traceOf();
        });
        const result = await attr({ providers, traceProviders }).attribute(action());
        expect(result).toEqual({ ok: false, reason: 'trace read failed' });
        expect(calls.some((c) => c.name === 'beta' && c.method === 'debug_traceTransaction')).toBe(true);
    });

    it('does not treat a reverted call frame as an RPC error', async () => {
        const rootReverted = { ...traceOf(), error: 'execution reverted', logs: [] };
        const { providers, traceProviders } = pair((name, method) => {
            if (method === 'eth_getTransactionReceipt') return receiptOf();
            return name === 'alpha' ? rootReverted : traceOf();
        });
        const result = await attr({ providers, traceProviders }).attribute(action());
        expect(result).toEqual({ ok: false, reason: 'trace has 0 logs receipt 1' });
    });

    it('rejects providers that disagree on the caller', async () => {
        const viaChild = {
            type: 'CALL',
            from: FROM,
            to: TARGET,
            input: '0x12345678',
            value: '0x00',
            calls: [{
                type: 'CALL',
                from: TARGET,
                to: TARGET,
                input: '0xabcdef01',
                logs: [{ address: TARGET, topics: [TOPIC], data: '0x' }],
            }],
        };
        const { providers, traceProviders } = pair((_name, method) => {
            if (method === 'eth_getTransactionReceipt') return receiptOf();
            return _name === 'alpha' ? traceOf() : viaChild;
        });
        const result = await attr({ providers, traceProviders }).attribute(action());
        expect(result).toEqual({ ok: false, reason: 'trace providers disagree' });
    });

    it('rejects status 0, another block hash, another transaction, and a missing log', async () => {
        const run = async (receipt: unknown) => {
            const { providers, traceProviders } = pair((_name, method) => (method === 'eth_getTransactionReceipt' ? receipt : traceOf()));
            return attr({ providers, traceProviders }).attribute(action());
        };
        expect(await run(receiptOf({ status: '0x0' }))).toEqual({
            ok: false, reason: 'receipt status is not success',
        });
        expect(await run(receiptOf({ blockHash: `0x${'33'.repeat(32)}` }))).toEqual({
            ok: false, reason: 'receipt block mismatch',
        });
        expect(await run(receiptOf({ transactionHash: `0x${'44'.repeat(32)}` }))).toEqual({
            ok: false, reason: 'receipt transaction mismatch',
        });
        expect(await run(receiptOf({}, { data: '0x01' }))).toEqual({
            ok: false, reason: 'receipt log missing',
        });
        expect(await run(receiptOf({ logs: [] }))).toEqual({
            ok: false, reason: 'receipt log missing',
        });
        expect(await run(null)).toEqual({ ok: false, reason: 'no receipt' });
        expect(await run(receiptOf({ logs: { length: 1 } }))).toEqual({
            ok: false, reason: 'receipt logs missing',
        });
    });

    it('hides a receipt transport error', async () => {
        const { providers, traceProviders } = pair((_name, method) => {
            if (method === 'eth_getTransactionReceipt') throw new Error(`down ${LEAK}`);
            return traceOf();
        });
        const result = await attr({ providers, traceProviders }).attribute(action());
        expect(result).toEqual({ ok: false, reason: 'receipt read failed' });
    });

    it('turns an exception from attribution into a controlled failure', async () => {
        const { providers, traceProviders } = pair((_name, method) => {
            if (method === 'eth_getTransactionReceipt') return receiptOf();
            const trace = traceOf();
            Object.defineProperty(trace.logs[0], 'data', {
                get() {
                    throw new Error(`boom ${LEAK}`);
                },
            });
            return trace;
        });
        const result = await attr({ providers, traceProviders }).attribute(action());
        expect(result).toEqual({ ok: false, reason: 'attribution failed' });
    });

    function countingArray(length: number, fill: (i: number) => unknown = () => null) {
        let reads = 0;
        const raw = new Array(length);
        for (let i = 0; i < length; i++) raw[i] = fill(i);
        const arr = new Proxy(raw, {
            get(target, prop, recv) {
                if (typeof prop === 'string' && /^\d+$/.test(prop)) reads += 1;
                return Reflect.get(target, prop, recv);
            },
        });
        return { arr, reads: () => reads };
    }

    it('rejects 20 levels of 10000 children before the queued frames exhaust memory', async () => {
        let reads = 0;
        const level = (depth: number): unknown => {
            const raw = new Array(10_000);
            raw[9_999] = depth === 20 ? null : level(depth + 1);
            const calls = new Proxy(raw, {
                get(target, prop, recv) {
                    if (typeof prop === 'string' && /^\d+$/.test(prop)) reads += 1;
                    return Reflect.get(target, prop, recv);
                },
            });
            return { type: 'CALL', from: FROM, to: TARGET, calls };
        };
        const trace = level(1);
        const { providers, traceProviders } = pair((_name, method) => (
            method === 'eth_getTransactionReceipt' ? receiptOf() : trace
        ));
        const started = Date.now();
        const result = await attr({ providers, traceProviders }).attribute(action());
        expect(Date.now() - started).toBeLessThan(1_000);
        expect(result).toEqual({ ok: false, reason: 'trace too large' });
        expect(reads).toBeLessThanOrEqual(MEASURE_NODES + 64);
    });

    it('rejects 100001 null receipt logs before scanning them', async () => {
        const { arr, reads } = countingArray(100_001);
        const receipt = receiptOf();
        receipt.logs = arr as unknown as typeof receipt.logs;
        const { providers, traceProviders } = pair((_name, method) => (
            method === 'eth_getTransactionReceipt' ? receipt : traceOf()
        ));
        const started = Date.now();
        const result = await attr({ providers, traceProviders }).attribute(action());
        expect(Date.now() - started).toBeLessThan(1_000);
        expect(result).toEqual({ ok: false, reason: 'trace too large' });
        expect(reads()).toBeLessThanOrEqual(MEASURE_NODES + 64);
        expect(reads()).toBeLessThan(100_001);
    });

    it('rejects 100001 null topics before scanning them', async () => {
        const { arr, reads } = countingArray(100_001);
        const trace = traceOf();
        trace.logs[0]!.topics = arr as unknown as string[];
        const { providers, traceProviders } = pair((_name, method) => (
            method === 'eth_getTransactionReceipt' ? receiptOf() : trace
        ));
        const started = Date.now();
        const result = await attr({ providers, traceProviders }).attribute(action());
        expect(Date.now() - started).toBeLessThan(1_000);
        expect(result).toEqual({ ok: false, reason: 'trace too large' });
        expect(reads()).toBeLessThanOrEqual(MEASURE_NODES + 64);
        expect(reads()).toBeLessThan(100_001);
    });

    it('classifies a 10 MB rejection message without matching it', async () => {
        const huge = `method not found ${'x'.repeat(10 * 1024 * 1024)}`;
        const { providers, traceProviders } = pair((name, method) => {
            if (method === 'eth_getTransactionReceipt') return receiptOf();
            if (name === 'alpha') throw { message: huge, shortMessage: huge, error: { message: huge } };
            return traceOf();
        });
        const exec = RegExp.prototype.exec;
        let sawLong = false;
        RegExp.prototype.exec = function (this: RegExp, s: string) {
            if (typeof s === 'string' && s.length > 512) sawLong = true;
            return exec.call(this, s);
        };
        try {
            const started = performance.now();
            const result = await attr({ providers, traceProviders }).attribute(action());
            expect(performance.now() - started).toBeLessThan(50);
            expect(result).toEqual({ ok: false, reason: 'trace read failed' });
            expect(sawLong).toBe(false);
        } finally {
            RegExp.prototype.exec = exec;
        }
    });

    it('reads a numeric cause.code only up to 3 levels', async () => {
        const nest = (levels: number): unknown => {
            let node: unknown = { code: -32601 };
            for (let i = 0; i < levels; i++) node = { cause: node };
            return node;
        };
        const run = async (levels: number) => {
            const { providers, traceProviders } = pair((name, method) => {
                if (method === 'eth_getTransactionReceipt') return receiptOf();
                if (name === 'alpha') throw nest(levels);
                return traceOf();
            });
            return attr({ providers, traceProviders }).attribute(action());
        };
        expect(await run(3)).toEqual({ ok: false, reason: 'trace unsupported' });
        expect(await run(4)).toEqual({ ok: false, reason: 'trace read failed' });
    });

    async function withTrace(trace: unknown, receipt: ReturnType<typeof receiptOf> = receiptOf(), tx: ReturnType<typeof txOf> = txOf()) {
        const { providers } = pair(
            (_name, method) => (method === 'eth_getTransactionReceipt' ? receipt : trace),
            () => tx,
        );
        return attr({ providers, traceProviders: [providers[0]] }).attribute(action());
    }

    it('rejects a trace that drops one receipt log', async () => {
        const receipt = receiptOf({
            logs: [
                { address: getAddress(TARGET), topics: [TOPIC], data: '0x', logIndex: '0x7' },
                { address: getAddress(TARGET), topics: [TOPIC], data: '0x01', logIndex: '0x8' },
            ],
        });
        const trace = { ...traceOf(), logs: [{ address: TARGET, topics: [TOPIC], data: '0x' }] };
        expect(await withTrace(trace, receipt)).toEqual({ ok: false, reason: 'trace has 1 logs receipt 2' });
    });

    it('rejects a trace that reorders receipt logs', async () => {
        const receipt = receiptOf({
            logs: [
                { address: getAddress(TARGET), topics: [TOPIC], data: '0x', logIndex: '0x7' },
                { address: getAddress(TARGET), topics: [TOPIC], data: '0x01', logIndex: '0x8' },
            ],
        });
        const trace = {
            ...traceOf(),
            logs: [
                { address: TARGET, topics: [TOPIC], data: '0x01', position: 0 },
                { address: TARGET, topics: [TOPIC], data: '0x', position: 1 },
            ],
        };
        expect(await withTrace(trace, receipt)).toEqual({
            ok: false, reason: 'log 0 differs between trace and receipt',
        });
    });

    it('rejects a trace log that differs from the receipt', async () => {
        const trace = { ...traceOf(), logs: [{ address: TARGET, topics: [TOPIC], data: '0xab' }] };
        expect(await withTrace(trace)).toEqual({ ok: false, reason: 'log 0 differs between trace and receipt' });
    });

    it('rejects a receipt log emitted only inside a reverted frame', async () => {
        const trace = {
            ...traceOf(),
            calls: [{
                type: 'CALL',
                from: TARGET,
                to: OTHER,
                error: 'execution reverted',
                logs: [{ address: OTHER, topics: [TOPIC], data: '0x' }],
            }],
        };
        const receipt = receiptOf({
            logs: [
                { address: getAddress(TARGET), topics: [TOPIC], data: '0x', logIndex: '0x7' },
                { address: getAddress(OTHER), topics: [TOPIC], data: '0x', logIndex: '0x8' },
            ],
        });
        expect(await withTrace(trace, receipt)).toEqual({ ok: false, reason: 'trace has 1 logs receipt 2' });
    });

    it('rejects a reverted log that the trace also keeps as a surviving log', async () => {
        const extra = { address: TARGET, topics: [TOPIC], data: '0xbb' };
        const trace = {
            ...traceOf(),
            logs: [
                { address: TARGET, topics: [TOPIC], data: '0x', position: 0 },
                { ...extra, position: 1 },
            ],
            calls: [{
                type: 'CALL',
                from: TARGET,
                to: TARGET,
                error: 'execution reverted',
                logs: [extra],
            }],
        };
        expect(await withTrace(trace)).toEqual({ ok: false, reason: 'trace has 2 logs receipt 1' });
    });

    it('rejects a top-level from, to, input, or value mismatch', async () => {
        expect(await withTrace(traceOf(OTHER))).toEqual({ ok: false, reason: 'trace from mismatch' });
        expect(await withTrace({ ...traceOf(), to: OTHER })).toEqual({ ok: false, reason: 'trace to mismatch' });
        expect(await withTrace({ ...traceOf(), input: '0xdeadbeef' })).toEqual({
            ok: false, reason: 'trace input mismatch',
        });
        expect(await withTrace({ ...traceOf(), value: '0x2' })).toEqual({
            ok: false, reason: 'trace value mismatch',
        });
    });

    it('agrees when quantities match numerically and a receipt carries an extra field', async () => {
        const actionLog = {
            address: getAddress(TARGET),
            topics: [TOPIC],
            data: '0x',
            logIndex: '0x7',
        };
        const { providers, traceProviders } = pair(
            (name, method) => {
                if (method !== 'eth_getTransactionReceipt') return traceOf();
                if (name === 'beta') {
                    return receiptOf({
                        status: '0x01',
                        l1Fee: '0x1',
                        logs: [{ ...actionLog, logIndex: '0x07' }],
                    });
                }
                return receiptOf({ logs: [actionLog] });
            },
            (name) => txOf(name === 'beta' ? { value: '0x00', nonce: '0x1' } : { value: '0x0', nonce: '0x01' }),
        );
        const result = await attr({ providers, traceProviders }).attribute(action());
        expect(result).toMatchObject({
            ok: true,
            attribution: { attributionSource: 'dual:alpha+beta', immediateCaller: getAddress(FROM) },
        });
    });

    it('rejects providers that agree on the receipt except for one log data field', async () => {
        const actionLog = {
            address: getAddress(TARGET),
            topics: [TOPIC],
            data: '0x',
            logIndex: '0x7',
        };
        const { providers, traceProviders } = pair((name, method) => {
            if (method !== 'eth_getTransactionReceipt') return traceOf();
            const other = {
                address: getAddress(OTHER),
                topics: [TOPIC],
                data: name === 'beta' ? '0xbb' : '0xaa',
                logIndex: '0x8',
            };
            return receiptOf({ logs: [actionLog, other] });
        });
        const result = await attr({ providers, traceProviders }).attribute(action());
        expect(result).toEqual({ ok: false, reason: 'providers disagree on the transaction' });
    });

    it('rejects completeness providers that disagree on the transaction', async () => {
        const { providers, traceProviders } = pair(
            (_name, method) => (method === 'eth_getTransactionReceipt' ? receiptOf() : traceOf()),
            (name) => txOf(name === 'beta' ? { input: '0xdeadbeef' } : {}),
        );
        const result = await attr({ providers, traceProviders }).attribute(action());
        expect(result).toEqual({ ok: false, reason: 'providers disagree on the transaction' });
    });

    it('binds a creation trace to the receipt contract and the sender nonce', async () => {
        const created = getContractAddress({ from: getAddress(FROM), nonce: 1n, opcode: 'CREATE' });
        const tx = txOf({ to: null, nonce: '0x01' });
        const receipt = receiptOf({ contractAddress: created });
        const guardian = {
            type: 'CALL',
            from: created,
            to: TARGET,
            input: '0x12345678',
            logs: [{ address: TARGET, topics: [TOPIC], data: '0x' }],
        };
        const accepted = await withTrace({
            type: 'CREATE',
            from: FROM,
            to: created,
            input: '0x12345678',
            value: '0x00',
            calls: [guardian],
        }, receipt, tx);
        expect(accepted).toMatchObject({
            ok: true,
            attribution: {
                attributionSource: 'single:alpha',
                immediateCaller: getAddress(created),
                emitter: getAddress(TARGET),
            },
        });
        const impostor = {
            type: 'CREATE',
            from: FROM,
            to: OTHER,
            input: '0x12345678',
            value: '0x00',
            calls: [{ ...guardian, from: OTHER }],
        };
        expect(await withTrace(impostor, receipt, tx)).toEqual({
            ok: false, reason: 'trace to mismatch',
        });
        expect(await withTrace(
            { ...impostor, to: OTHER, calls: [{ ...guardian, from: OTHER }] },
            receiptOf({ contractAddress: OTHER }),
            tx,
        )).toEqual({ ok: false, reason: 'contract address mismatch' });
        expect(await withTrace({ ...impostor, type: 'CREATE2', to: created, calls: [guardian] }, receipt, tx)).toEqual({
            ok: false, reason: 'trace to mismatch',
        });
        expect(await withTrace(traceOf(), receipt, tx)).toEqual({
            ok: false, reason: 'trace to mismatch',
        });
    });

    it('returns single:alchemy from one trace provider and dual from two', async () => {
        const calls: string[] = [];
        const make = (name: string): RawRpc => ({
            name,
            async request({ method }) {
                calls.push(`${name}:${method}`);
                if (method === 'eth_getTransactionReceipt') return receiptOf();
                if (method === 'eth_getTransactionByHash') {
                    return txOf(name === 'infura' ? { from: `0x${FROM.slice(2).toUpperCase()}` } : {});
                }
                return traceOf();
            },
        });
        const alchemy = make('alchemy');
        const infura = make('infura');
        const tenderly = make('tenderly');
        const single = await traceAttributor({
            providers: [alchemy, infura],
            traceProviders: [alchemy],
        }).attribute(action());
        expect(single).toMatchObject({ ok: true, attribution: { attributionSource: 'single:alchemy' } });
        expect(calls).toContain('alchemy:debug_traceTransaction');
        expect(calls).toContain('infura:eth_getTransactionByHash');
        expect(calls).not.toContain('infura:debug_traceTransaction');

        calls.length = 0;
        const dual = await traceAttributor({
            providers: [alchemy, infura],
            traceProviders: [alchemy, tenderly],
        }).attribute(action());
        expect(dual).toMatchObject({ ok: true, attribution: { attributionSource: 'dual:alchemy+tenderly' } });
        expect(calls).toContain('alchemy:debug_traceTransaction');
        expect(calls).toContain('tenderly:debug_traceTransaction');
        expect(calls).not.toContain('infura:debug_traceTransaction');
    });

    it('rejects completeness providers that agree on the wrong transaction', async () => {
        const wrong = `0x${'ab'.repeat(32)}` as Hex;
        expect(await withTrace(traceOf(), receiptOf(), txOf({ hash: wrong }))).toEqual({
            ok: false, reason: 'transaction hash mismatch',
        });
        expect(await withTrace(
            traceOf(),
            receiptOf({ transactionIndex: '0x5' }),
            txOf({ transactionIndex: '0x1' }),
        )).toEqual({ ok: false, reason: 'transaction index mismatch' });
    });

    it('accepts 1 ETH and a value above the safe-integer boundary', async () => {
        const oneEth = `0x${(10n ** 18n).toString(16)}`;
        const above = `0x${(1n << 200n).toString(16)}`;
        expect(await withTrace(
            { ...traceOf(), value: `0x0${oneEth.slice(2)}` },
            receiptOf(),
            txOf({ value: oneEth }),
        )).toMatchObject({ ok: true, attribution: { attributionSource: 'single:alpha' } });
        expect(await withTrace(
            { ...traceOf(), value: `0x${above.slice(2).toUpperCase()}` },
            receiptOf(),
            txOf({ value: `0x0${above.slice(2)}` }),
        )).toMatchObject({ ok: true, attribution: { attributionSource: 'single:alpha' } });
    });

    it('rejects a missing transaction value and a missing trace value', async () => {
        const tx = txOf();
        delete tx.value;
        expect(await withTrace({ ...traceOf(), value: undefined }, receiptOf(), tx)).toEqual({
            ok: false, reason: 'transaction value invalid',
        });
        const trace = traceOf();
        delete trace.value;
        expect(await withTrace(trace)).toEqual({ ok: false, reason: 'trace value mismatch' });
    });

    it('rejects a block number that is not the action block', async () => {
        expect(await withTrace(
            traceOf(),
            receiptOf({ blockNumber: '0x11' }),
            txOf({ blockNumber: '0x11' }),
        )).toEqual({ ok: false, reason: 'block number mismatch' });
    });

    it('rejects a trace provider receipt from another block or index', async () => {
        const otherBlock = `0x${'33'.repeat(32)}` as Hex;
        const run = async (second: Record<string, unknown>) => {
            const seen: string[] = [];
            let alphaReceipts = 0;
            const alpha: RawRpc = {
                name: 'alpha',
                async request({ method }) {
                    seen.push(`alpha:${method}`);
                    if (method === 'eth_getTransactionReceipt') {
                        alphaReceipts += 1;
                        return alphaReceipts > 1 ? receiptOf(second) : receiptOf();
                    }
                    if (method === 'eth_getTransactionByHash') return txOf();
                    return traceOf();
                },
            };
            const beta: RawRpc = {
                name: 'beta',
                async request({ method }) {
                    if (method === 'eth_getTransactionReceipt') return receiptOf();
                    if (method === 'eth_getTransactionByHash') return txOf();
                    return traceOf();
                },
            };
            const result = await traceAttributor({
                providers: [alpha, beta],
                traceProviders: [alpha],
            }).attribute(action());
            return { result, seen };
        };
        const wrongBlock = await run({ blockHash: otherBlock });
        expect(wrongBlock.result).toEqual({ ok: false, reason: 'trace receipt block mismatch' });
        const traceAt = wrongBlock.seen.indexOf('alpha:debug_traceTransaction');
        expect(traceAt).toBeGreaterThan(wrongBlock.seen.indexOf('alpha:eth_getTransactionReceipt'));
        expect(wrongBlock.seen.lastIndexOf('alpha:eth_getTransactionReceipt')).toBeGreaterThan(traceAt);
        expect(await run({ transactionIndex: '0x9' })).toMatchObject({
            result: { ok: false, reason: 'trace receipt index mismatch' },
        });
    });

    it('ignores mutations of the caller provider arrays', async () => {
        const calls: string[] = [];
        const make = (name: string): RawRpc => ({
            name,
            async request({ method }) {
                calls.push(`${name}:${method}`);
                if (method === 'eth_getTransactionReceipt') return receiptOf();
                if (method === 'eth_getTransactionByHash') return txOf();
                return traceOf();
            },
        });
        const alpha = make('alpha');
        const beta = make('beta');
        const gamma = make('gamma');
        const providers = [alpha, beta];
        const traces = [alpha];
        const built = traceAttributor({
            providers: providers as unknown as readonly [RawRpc, RawRpc],
            traceProviders: traces as unknown as readonly [RawRpc],
        });
        providers[0] = gamma;
        providers[1] = gamma;
        traces[0] = gamma;
        const result = await built.attribute(action());
        expect(result).toMatchObject({ ok: true, attribution: { attributionSource: 'single:alpha' } });
        expect(calls.some((call) => call.startsWith('gamma:'))).toBe(false);
        expect(calls).toContain('alpha:eth_getTransactionByHash');
        expect(calls).toContain('beta:eth_getTransactionByHash');
        expect(calls).toContain('alpha:debug_traceTransaction');
    });

    it('rejects a URL-like provider name without echoing it', () => {
        const leak = 'https://rpc.example/secret-LEAKED';
        const make = (name: string): RawRpc => ({ name, async request() { return null; } });
        const blow = (run: () => unknown) => {
            expect(run).toThrow(/^guardian audit provider name is invalid$/);
        };
        blow(() => traceAttributor({
            providers: [make(leak), make('beta')],
            traceProviders: [make('gamma')],
        }));
        blow(() => traceAttributor({
            providers: [make('alpha'), make('beta')],
            traceProviders: [make(leak)],
        }));
    });

    it('returns frozen attributions that share no hop objects across calls', async () => {
        const { providers, traceProviders } = pair((_name, method) => (
            method === 'eth_getTransactionReceipt' ? receiptOf() : traceOf()
        ));
        const built = attr({ providers, traceProviders });
        const first = await built.attribute(action());
        const second = await built.attribute(action());
        expect(first.ok).toBe(true);
        expect(second.ok).toBe(true);
        if (!first.ok || !second.ok) return;
        expect(first.attribution).not.toBe(second.attribution);
        expect(first.attribution.forwardingPath).not.toBe(second.attribution.forwardingPath);
        expect(first.attribution.forwardingPath[0]).not.toBe(second.attribution.forwardingPath[0]);
        expect(Object.isFrozen(first.attribution)).toBe(true);
        expect(Object.isFrozen(first.attribution.forwardingPath)).toBe(true);
        expect(Object.isFrozen(first.attribution.forwardingPath[0])).toBe(true);
        const kept = second.attribution.forwardingPath[0]!.to;
        const hop = first.attribution.forwardingPath[0]!;
        try {
            (hop as { to: string }).to = OTHER;
        } catch {
            // Frozen in strict mode.
        }
        expect(hop.to).not.toBe(OTHER);
        expect(second.attribution.forwardingPath[0]!.to).toBe(kept);
    });

    it('rejects completeness or trace providers that are not distinct', () => {
        const make = (name: string): RawRpc => ({ name, async request() { return null; } });
        const alpha = make('alpha');
        const beta = make('beta');
        const again = make('alpha');
        expect(() => traceAttributor({ providers: [alpha, again], traceProviders: [beta] }))
            .toThrow('guardian audit requires two distinct providers');
        expect(() => traceAttributor({ providers: [alpha, alpha], traceProviders: [beta] }))
            .toThrow('guardian audit requires two distinct providers');
        expect(() => traceAttributor({ providers: [alpha, beta], traceProviders: [alpha, again] }))
            .toThrow('guardian audit requires two distinct providers');
    });

    it('keeps the verified sender when the provider mutates its transaction during the trace', async () => {
        let live: Record<string, unknown> | null = null;
        const act = action();
        const alpha: RawRpc = {
            name: 'alpha',
            async request({ method, params }) {
                if (method === 'eth_getTransactionReceipt') {
                    act.txHash = `0x${'33'.repeat(32)}` as Hex;
                    act.blockNumber = 99;
                    return receiptOf();
                }
                if (method === 'eth_getTransactionByHash') {
                    live = txOf();
                    return live;
                }
                live!.from = OTHER;
                expect(params?.[0]).toBe(TX);
                return traceOf(OTHER);
            },
        };
        const beta: RawRpc = {
            name: 'beta',
            async request({ method }) {
                if (method === 'eth_getTransactionReceipt') return receiptOf();
                if (method === 'eth_getTransactionByHash') return txOf();
                return traceOf();
            },
        };
        const result = await traceAttributor({
            providers: [alpha, beta],
            traceProviders: [alpha],
        }).attribute(act);
        expect(result).toEqual({ ok: false, reason: 'trace from mismatch' });
        if (result.ok) expect(result.attribution.transactionSender).not.toBe(getAddress(OTHER));
    });

    it('uses the name and request captured at construction', async () => {
        let fail = false;
        const alpha: RawRpc = {
            name: 'alpha',
            async request({ method }) {
                if (fail) throw new Error(LEAK);
                if (method === 'eth_getTransactionReceipt') return receiptOf();
                if (method === 'eth_getTransactionByHash') return txOf();
                return traceOf();
            },
        };
        const beta: RawRpc = {
            name: 'beta',
            async request({ method }) {
                if (method === 'eth_getTransactionReceipt') return receiptOf();
                if (method === 'eth_getTransactionByHash') return txOf();
                return traceOf();
            },
        };
        const built = traceAttributor({ providers: [alpha, beta], traceProviders: [alpha] });
        alpha.name = LEAK;
        fail = true;
        const failed = await built.attribute(action());
        expect(failed).toEqual({ ok: false, reason: 'receipt read failed' });
        if (!failed.ok) {
            expect(failed.reason).not.toContain('LEAKED');
            expect(failed.reason).not.toContain('https');
        }

        let replaced = 0;
        const alpha2: RawRpc = {
            name: 'alpha',
            async request({ method }) {
                if (method === 'eth_getTransactionReceipt') return receiptOf();
                if (method === 'eth_getTransactionByHash') return txOf();
                return traceOf();
            },
        };
        const built2 = traceAttributor({ providers: [alpha2, beta], traceProviders: [alpha2] });
        alpha2.request = async () => {
            replaced += 1;
            throw new Error(LEAK);
        };
        const kept = await built2.attribute(action());
        expect(replaced).toBe(0);
        expect(kept).toMatchObject({ ok: true, attribution: { attributionSource: 'single:alpha' } });
    });

    it('gives every trace request its own tracer config', async () => {
        const seen: boolean[] = [];
        const make = (name: string): RawRpc => ({
            name,
            async request({ method, params }) {
                if (method === 'eth_getTransactionReceipt') return receiptOf();
                if (method === 'eth_getTransactionByHash') return txOf();
                const opts = params?.[1] as { tracerConfig: { withLog: boolean } };
                seen.push(opts.tracerConfig.withLog);
                opts.tracerConfig.withLog = false;
                await Promise.resolve();
                return traceOf();
            },
        });
        const alpha = make('alpha');
        const beta = make('beta');
        const built = traceAttributor({ providers: [alpha, beta], traceProviders: [alpha, beta] });
        expect(await built.attribute(action())).toMatchObject({
            ok: true,
            attribution: { attributionSource: 'dual:alpha+beta' },
        });
        expect(await built.attribute(action())).toMatchObject({ ok: true });
        expect(seen).toEqual([true, true, true, true]);
    });

    it('rejects a trace receipt for a different transaction, height, or status', async () => {
        const otherTx = `0x${'44'.repeat(32)}` as Hex;
        const run = async (second: Record<string, unknown>) => {
            let alphaReceipts = 0;
            const alpha: RawRpc = {
                name: 'alpha',
                async request({ method }) {
                    if (method === 'eth_getTransactionReceipt') {
                        alphaReceipts += 1;
                        return alphaReceipts > 1 ? receiptOf(second) : receiptOf();
                    }
                    if (method === 'eth_getTransactionByHash') return txOf();
                    return traceOf();
                },
            };
            const beta: RawRpc = {
                name: 'beta',
                async request({ method }) {
                    if (method === 'eth_getTransactionReceipt') return receiptOf();
                    if (method === 'eth_getTransactionByHash') return txOf();
                    return traceOf();
                },
            };
            return traceAttributor({ providers: [alpha, beta], traceProviders: [alpha] }).attribute(action());
        };
        expect(await run({ transactionHash: otherTx })).toEqual({
            ok: false, reason: 'trace receipt transaction mismatch',
        });
        expect(await run({ blockNumber: '0x11' })).toEqual({
            ok: false, reason: 'trace receipt block number mismatch',
        });
        expect(await run({ status: '0x0' })).toEqual({
            ok: false, reason: 'trace receipt status mismatch',
        });
        expect(await run({ error: { code: -32000, message: LEAK } })).toEqual({
            ok: false, reason: 'trace receipt read failed',
        });
        const malformed = await run({ transactionHash: undefined, blockNumber: 16 });
        expect(malformed).toEqual({ ok: false, reason: 'trace receipt read failed' });
        if (!malformed.ok) expect(malformed.reason).not.toContain('LEAKED');
    });

    it('rejects a two-element trace list that does not contain two providers', () => {
        const make = (name: string): RawRpc => ({ name, async request() { return null; } });
        const alpha = make('alpha');
        const beta = make('beta');
        const t = make('t');
        const blow = (run: () => unknown) => {
            let thrown = '';
            try {
                run();
            } catch (e) {
                thrown = e instanceof Error ? e.message : String(e);
            }
            expect(thrown).toBe('guardian audit provider is invalid');
            expect(thrown).not.toContain('secret');
            expect(thrown).not.toContain('https');
        };
        blow(() => traceAttributor({
            providers: [alpha, beta],
            traceProviders: [t, null] as unknown as readonly [RawRpc, RawRpc],
        }));
        blow(() => traceAttributor({
            providers: [alpha, beta],
            traceProviders: [t, undefined] as unknown as readonly [RawRpc, RawRpc],
        }));
        blow(() => traceAttributor({
            providers: [alpha, beta],
            traceProviders: [{ name: 't', request: 'nope' } as unknown as RawRpc],
        }));
        blow(() => traceAttributor({
            providers: [alpha, { name: 'beta', request: 1 } as unknown as RawRpc],
            traceProviders: [t],
        }));
    });

    it('rejects a malformed action before any RPC and rejects agreeing garbage calldata', async () => {
        let calls = 0;
        const make = (name: string): RawRpc => ({
            name,
            async request() {
                calls += 1;
                return null;
            },
        });
        const built = traceAttributor({
            providers: [make('alpha'), make('beta')],
            traceProviders: [make('gamma')],
        });
        const bad = action();
        bad.txHash = 'not-a-hash' as Hex;
        bad.blockHash = 'not-a-block' as Hex;
        bad.log = { ...bad.log, data: 'garbage' as Hex };
        const rejected = await built.attribute(bad);
        expect(rejected).toEqual({ ok: false, reason: 'action invalid' });
        expect(calls).toBe(0);
        if (!rejected.ok) {
            expect(rejected.reason).not.toContain('not-a-hash');
            expect(rejected.reason).not.toContain('garbage');
        }
        expect(await withTrace(
            { ...traceOf(), input: 'garbage' },
            receiptOf(),
            txOf({ input: 'garbage' }),
        )).toEqual({ ok: false, reason: 'transaction input invalid' });
    });

    it('accepts a forged intermediate caller from one trace provider and rejects it from two', async () => {
        // Single mode checks the root and the emitter, not the frames between them.
        const middle = OTHER;
        const forged = {
            type: 'CALL',
            from: FROM,
            to: TARGET,
            input: '0x12345678',
            value: '0x00',
            calls: [{
                type: 'CALL',
                from: TARGET,
                to: middle,
                input: '0x11111111',
                calls: [{
                    type: 'CALL',
                    from: middle,
                    to: TARGET,
                    input: '0x22222222',
                    logs: [{ address: TARGET, topics: [TOPIC], data: '0x' }],
                }],
            }],
        };
        const make = (name: string, trace: unknown): RawRpc => ({
            name,
            async request({ method }) {
                if (method === 'eth_getTransactionReceipt') return receiptOf();
                if (method === 'eth_getTransactionByHash') return txOf();
                return trace;
            },
        });
        const alpha = make('alpha', forged);
        const beta = make('beta', traceOf());
        const single = await traceAttributor({
            providers: [alpha, beta],
            traceProviders: [alpha],
        }).attribute(action());
        expect(single.ok).toBe(true);
        if (!single.ok) return;
        expect(single.attribution.attributionSource.startsWith('single:')).toBe(true);
        expect(single.attribution.immediateCaller).toBe(getAddress(middle));
        expect(single.attribution.transactionSender).toBe(getAddress(FROM));
        expect(single.attribution.emitter).toBe(getAddress(TARGET));
        const dual = await traceAttributor({
            providers: [alpha, beta],
            traceProviders: [alpha, beta],
        }).attribute(action());
        expect(dual).toEqual({ ok: false, reason: 'trace providers disagree' });
    });

    it('rejects completeness providers that differ only in tx.from', async () => {
        // Alpha is also the only trace provider, so its trace matches the lying sender.
        const forged = {
            type: 'CALL',
            from: OTHER,
            to: TARGET,
            input: '0x12345678',
            value: '0x00',
            logs: [{ address: TARGET, topics: [TOPIC], data: '0x' }],
        };
        const alpha: RawRpc = {
            name: 'alpha',
            async request({ method }) {
                if (method === 'eth_getTransactionReceipt') return receiptOf();
                if (method === 'eth_getTransactionByHash') return txOf({ from: OTHER });
                return forged;
            },
        };
        const beta: RawRpc = {
            name: 'beta',
            async request({ method }) {
                if (method === 'eth_getTransactionReceipt') return receiptOf();
                if (method === 'eth_getTransactionByHash') return txOf();
                return traceOf();
            },
        };
        const result = await traceAttributor({
            providers: [alpha, beta],
            traceProviders: [alpha],
        }).attribute(action());
        expect(result).toEqual({ ok: false, reason: 'providers disagree on the transaction' });
    });

    it('rejects completeness providers that differ only in tx.to', async () => {
        const forged = {
            type: 'CALL',
            from: FROM,
            to: OTHER,
            input: '0x12345678',
            value: '0x00',
            calls: [{
                type: 'CALL',
                from: OTHER,
                to: TARGET,
                input: '0xabcdef01',
                logs: [{ address: TARGET, topics: [TOPIC], data: '0x' }],
            }],
        };
        const alpha: RawRpc = {
            name: 'alpha',
            async request({ method }) {
                if (method === 'eth_getTransactionReceipt') return receiptOf();
                if (method === 'eth_getTransactionByHash') return txOf({ to: OTHER });
                return forged;
            },
        };
        const beta: RawRpc = {
            name: 'beta',
            async request({ method }) {
                if (method === 'eth_getTransactionReceipt') return receiptOf();
                if (method === 'eth_getTransactionByHash') return txOf();
                return traceOf();
            },
        };
        const result = await traceAttributor({
            providers: [alpha, beta],
            traceProviders: [alpha],
        }).attribute(action());
        expect(result).toEqual({ ok: false, reason: 'providers disagree on the transaction' });
    });

    it('rejects completeness providers that differ only in tx.nonce', async () => {
        const { providers, traceProviders } = pair(
            (_name, method) => (method === 'eth_getTransactionReceipt' ? receiptOf() : traceOf()),
            (name) => txOf({ nonce: name === 'beta' ? '0x02' : '0x01' }),
        );
        const result = await attr({ providers, traceProviders }).attribute(action());
        expect(result).toEqual({ ok: false, reason: 'providers disagree on the transaction' });
    });

    it('rejects dual traces that differ only in hop selector', async () => {
        const act = action();
        act.address = getAddress(OTHER);
        act.log = { ...act.log, address: getAddress(OTHER) };
        const child = (input: string) => ({
            type: 'CALL',
            from: FROM,
            to: TARGET,
            input: '0x12345678',
            value: '0x00',
            calls: [{
                type: 'CALL',
                from: TARGET,
                to: OTHER,
                input,
                logs: [{ address: OTHER, topics: [TOPIC], data: '0x' }],
            }],
        });
        const { providers, traceProviders } = pair((name, method) => {
            if (method === 'eth_getTransactionReceipt') return receiptOf({}, { address: getAddress(OTHER) });
            return child(name === 'alpha' ? '0x11111111' : '0x22222222');
        });
        const result = await attr({ providers, traceProviders }).attribute(act);
        expect(result).toEqual({ ok: false, reason: 'trace providers disagree' });
    });

    it('rejects dual traces that differ only in hop type', async () => {
        const act = action();
        act.address = getAddress(OTHER);
        act.log = { ...act.log, address: getAddress(OTHER) };
        const created = (type: 'CREATE' | 'CREATE2') => ({
            type: 'CALL',
            from: FROM,
            to: TARGET,
            input: '0x12345678',
            value: '0x00',
            calls: [{
                type,
                from: TARGET,
                to: OTHER,
                input: '0x60806040',
                logs: [{ address: OTHER, topics: [TOPIC], data: '0x' }],
            }],
        });
        const { providers, traceProviders } = pair((name, method) => {
            if (method === 'eth_getTransactionReceipt') return receiptOf({}, { address: getAddress(OTHER) });
            return created(name === 'alpha' ? 'CREATE' : 'CREATE2');
        });
        const result = await attr({ providers, traceProviders }).attribute(act);
        expect(result).toEqual({ ok: false, reason: 'trace providers disagree' });
    });

    it('rejects dual traces that differ only in hop to', async () => {
        const codeB = '0xdddddddddddddddddddddddddddddddddddddddd';
        const delegated = (code: string) => ({
            type: 'CALL',
            from: FROM,
            to: TARGET,
            input: '0x12345678',
            value: '0x00',
            calls: [{
                type: 'DELEGATECALL',
                from: TARGET,
                to: code,
                input: '0xabcdef01',
                logs: [{ address: TARGET, topics: [TOPIC], data: '0x' }],
            }],
        });
        const { providers, traceProviders } = pair((name, method) => {
            if (method === 'eth_getTransactionReceipt') return receiptOf();
            return delegated(name === 'alpha' ? OTHER : codeB);
        });
        const result = await attr({ providers, traceProviders }).attribute(action());
        expect(result).toEqual({ ok: false, reason: 'trace providers disagree' });
    });

    it('refuses a CREATE or CREATE2 root on a call transaction', async () => {
        for (const type of ['CREATE', 'CREATE2'] as const) {
            expect(await withTrace({
                type,
                from: FROM,
                to: TARGET,
                input: '0x12345678',
                value: '0x00',
                logs: [{ address: TARGET, topics: [TOPIC], data: '0x' }],
            })).toEqual({ ok: false, reason: 'trace to mismatch' });
        }
    });

    it('names a provider transaction block that does not match its own receipt', async () => {
        const other = `0x${'33'.repeat(32)}` as Hex;
        expect(await withTrace(traceOf(), receiptOf(), txOf({ blockHash: other }))).toEqual({
            ok: false,
            reason: 'provider tx block does not match its receipt',
        });
    });

    it('attributes a call whose calldata is about 2 MB', async () => {
        const data = `0x${'ab'.repeat(1_000_000)}` as Hex;
        expect(data.length).toBe(2_000_002);
        const act = action();
        act.log = { ...act.log, data };
        const trace = { ...traceOf(), input: data, logs: [{ address: TARGET, topics: [TOPIC], data }] };
        const { providers } = pair(
            (_name, method) => (method === 'eth_getTransactionReceipt' ? receiptOf({}, { data }) : trace),
            () => txOf({ input: data }),
        );
        const result = await attr({ providers, traceProviders: [providers[0]] }).attribute(act);
        expect(result).toMatchObject({
            ok: true,
            attribution: { attributionSource: 'single:alpha', emitter: getAddress(TARGET) },
        });
    });

    it('rejects odd-length calldata before attributing it', async () => {
        let calls = 0;
        const make = (name: string): RawRpc => ({
            name,
            async request() {
                calls += 1;
                return null;
            },
        });
        const built = traceAttributor({
            providers: [make('alpha'), make('beta')],
            traceProviders: [make('gamma')],
        });
        const bad = action();
        bad.log = { ...bad.log, data: '0x0' as Hex };
        expect(await built.attribute(bad)).toEqual({ ok: false, reason: 'action invalid' });
        expect(calls).toBe(0);
        expect(await withTrace(traceOf(), receiptOf(), txOf({ input: '0xabc' }))).toEqual({
            ok: false,
            reason: 'transaction input invalid',
        });
        const extra = receiptOf({
            logs: [
                { address: getAddress(TARGET), topics: [TOPIC], data: '0x', logIndex: '0x7' },
                { address: getAddress(OTHER), topics: [TOPIC], data: '0xabc', logIndex: '0x8' },
            ],
        });
        expect(await withTrace(traceOf(), extra)).toEqual({ ok: false, reason: 'receipt log missing' });
    });

    it('keeps every trace rejection reason inside safeReason', async () => {
        const safe = /^[0-9A-Za-z ._-]{1,64}$/;
        const alpha = 'a'.repeat(64);
        const beta = 'b'.repeat(64);
        const got = new Set<string>();
        const take = async (
            answer: (name: string, method: string) => unknown,
            txFor: (name: string) => unknown = () => txOf(),
            act: FoundAction = action(),
        ) => {
            const { providers, traceProviders } = pair(answer, txFor, [alpha, beta]);
            const result = await attr({ providers, traceProviders }).attribute(act);
            expect(result.ok).toBe(false);
            if (result.ok) return;
            expect(result.reason).toMatch(safe);
            expect(result.reason.includes(alpha)).toBe(false);
            expect(result.reason.includes(beta)).toBe(false);
            got.add(result.reason);
        };
        const otherHash = `0x${'44'.repeat(32)}` as Hex;
        const otherBlock = `0x${'33'.repeat(32)}` as Hex;
        const receipt = (_name: string, method: string) => (
            method === 'eth_getTransactionReceipt' ? receiptOf() : traceOf()
        );
        await take(() => { throw new Error(LEAK); });
        await take(receipt, () => { throw new Error(LEAK); });
        await take((_name, method) => (
            method === 'eth_getTransactionReceipt'
                ? receiptOf({ logs: Array.from({ length: 10_001 }, () => null) })
                : traceOf()
        ));
        await take((_name, method) => (method === 'eth_getTransactionReceipt' ? null : traceOf()));
        await take((_name, method) => (
            method === 'eth_getTransactionReceipt' ? receiptOf({ transactionHash: otherHash }) : traceOf()
        ));
        await take((_name, method) => (
            method === 'eth_getTransactionReceipt' ? receiptOf({ blockHash: otherBlock }) : traceOf()
        ));
        await take((_name, method) => (
            method === 'eth_getTransactionReceipt' ? receiptOf({ status: '0x0' }) : traceOf()
        ));
        await take((_name, method) => (
            method === 'eth_getTransactionReceipt' ? receiptOf({ logs: { length: 1 } }) : traceOf()
        ));
        await take((_name, method) => (
            method === 'eth_getTransactionReceipt' ? receiptOf({ logs: [] }) : traceOf()
        ));
        await take(receipt, () => txOf({ blockHash: otherBlock }));
        await take(receipt, (name) => txOf(name === beta ? { input: '0xdeadbeef' } : {}));
        await take(
            (_name, method) => (method === 'eth_getTransactionReceipt' ? receiptOf({ blockNumber: '0x11' }) : traceOf()),
            () => txOf({ blockNumber: '0x11' }),
        );
        await take(receipt, () => txOf({ hash: otherHash }));
        await take(receipt, () => txOf({ from: '0x12' }));
        await take(receipt, () => txOf({ to: '0x12' }));
        await take(
            (_name, method) => (
                method === 'eth_getTransactionReceipt' ? receiptOf({ contractAddress: '0x12' }) : traceOf()
            ),
            () => txOf({ to: null }),
        );
        const missingValue = txOf();
        delete missingValue.value;
        await take(receipt, () => missingValue);
        await take(receipt, () => txOf({ input: '0x0' }));
        const missingNonce = txOf();
        delete missingNonce.nonce;
        await take(receipt, () => missingNonce);
        await take(
            (_name, method) => (method === 'eth_getTransactionReceipt' ? receiptOf({ transactionIndex: '0x4' }) : traceOf()),
            () => txOf({ transactionIndex: '0x3' }),
        );
        await take(receipt, () => null);
        await take((name, method) => {
            if (method === 'eth_getTransactionReceipt') return receiptOf();
            if (name === alpha) throw { code: -32601, message: `method not found ${LEAK}` };
            return traceOf();
        });
        await take((name, method) => {
            if (method === 'eth_getTransactionReceipt') return receiptOf();
            if (name === alpha) throw new Error(`socket ${LEAK}`);
            return traceOf();
        });
        await take((_name, method) => (method === 'eth_getTransactionReceipt' ? receiptOf() : null));
        await take((_name, method) => (method === 'eth_getTransactionReceipt' ? receiptOf() : traceOf(OTHER)));
        await take((_name, method) => (
            method === 'eth_getTransactionReceipt' ? receiptOf() : { ...traceOf(), to: OTHER }
        ));
        await take((_name, method) => (
            method === 'eth_getTransactionReceipt' ? receiptOf() : { ...traceOf(), input: '0xdeadbeef' }
        ));
        await take((_name, method) => (
            method === 'eth_getTransactionReceipt' ? receiptOf() : { ...traceOf(), value: '0x2' }
        ));
        await take((_name, method) => (
            method === 'eth_getTransactionReceipt' ? receiptOf() : { ...traceOf(), error: 'execution reverted', logs: [] }
        ));
        await take((_name, method) => (
            method === 'eth_getTransactionReceipt'
                ? receiptOf()
                : { ...traceOf(), logs: [{ address: TARGET, topics: [TOPIC], data: '0xab' }] }
        ));
        await take((_name, method) => (method === 'eth_getTransactionReceipt' ? receiptOf() : {
            type: 'DELEGATECALL',
            from: FROM,
            to: TARGET,
            input: '0x12345678',
            value: '0x00',
            logs: [{ address: TARGET, topics: [TOPIC], data: '0x' }],
        }));
        await take((_name, method) => (method === 'eth_getTransactionReceipt' ? receiptOf() : {
            type: 'STATICCALL',
            from: FROM,
            to: TARGET,
            input: '0x12345678',
            value: '0x00',
            logs: [{ address: TARGET, topics: [TOPIC], data: '0x' }],
        }));
        const calls: Record<string, number> = {};
        await take((name, method) => {
            if (method !== 'eth_getTransactionReceipt') return traceOf();
            calls[name] = (calls[name] ?? 0) + 1;
            return calls[name]! > 1 ? receiptOf({ transactionHash: otherHash }) : receiptOf();
        });
        const badBlock: Record<string, number> = {};
        await take((name, method) => {
            if (method !== 'eth_getTransactionReceipt') return traceOf();
            badBlock[name] = (badBlock[name] ?? 0) + 1;
            return badBlock[name]! > 1 ? receiptOf({ blockHash: otherBlock }) : receiptOf();
        });
        const badHeight: Record<string, number> = {};
        await take((name, method) => {
            if (method !== 'eth_getTransactionReceipt') return traceOf();
            badHeight[name] = (badHeight[name]! ?? 0) + 1;
            return badHeight[name]! > 1 ? receiptOf({ blockNumber: '0x11' }) : receiptOf();
        });
        const badIndex: Record<string, number> = {};
        await take((name, method) => {
            if (method !== 'eth_getTransactionReceipt') return traceOf();
            badIndex[name] = (badIndex[name] ?? 0) + 1;
            return badIndex[name]! > 1 ? receiptOf({ transactionIndex: '0x9' }) : receiptOf();
        });
        const badStatus: Record<string, number> = {};
        await take((name, method) => {
            if (method !== 'eth_getTransactionReceipt') return traceOf();
            badStatus[name] = (badStatus[name] ?? 0) + 1;
            return badStatus[name]! > 1 ? receiptOf({ status: '0x0' }) : receiptOf();
        });
        const badRead: Record<string, number> = {};
        await take((name, method) => {
            if (method !== 'eth_getTransactionReceipt') return traceOf();
            badRead[name] = (badRead[name] ?? 0) + 1;
            if (badRead[name]! > 1) throw new Error(LEAK);
            return receiptOf();
        });
        await take((name, method) => {
            if (method === 'eth_getTransactionReceipt') return receiptOf();
            if (name !== alpha) return traceOf();
            const trace = traceOf();
            Object.defineProperty(trace.logs[0], 'data', { get() { throw new Error(LEAK); } });
            return trace;
        });
        const act = action();
        act.address = getAddress(OTHER);
        act.log = { ...act.log, address: getAddress(OTHER) };
        await take((name, method) => {
            if (method === 'eth_getTransactionReceipt') return receiptOf({}, { address: getAddress(OTHER) });
            const input = name === alpha ? '0x11111111' : '0x22222222';
            return {
                type: 'CALL',
                from: FROM,
                to: TARGET,
                input: '0x12345678',
                value: '0x00',
                calls: [{
                    type: 'CALL',
                    from: TARGET,
                    to: OTHER,
                    input,
                    logs: [{ address: OTHER, topics: [TOPIC], data: '0x' }],
                }],
            };
        }, () => txOf(), act);
        const built = traceAttributor({
            providers: [makeNamed(alpha), makeNamed(beta)],
            traceProviders: [makeNamed('gamma')],
        });
        const malformed = action();
        malformed.txHash = 'not-a-hash' as Hex;
        const rejected = await built.attribute(malformed);
        expect(rejected).toEqual({ ok: false, reason: 'action invalid' });
        if (!rejected.ok) {
            expect(rejected.reason).toMatch(safe);
            got.add(rejected.reason);
        }
        // `attribution missing` is not reachable: a receipt log that passes checkReceipt is
        // present in attributeTx's map. The literal stays fixed so safeReason would keep it.
        expect('attribution missing').toMatch(safe);
        expect([...got].sort()).toEqual([
            'action invalid',
            'attribution failed',
            'block number mismatch',
            'contract address mismatch',
            'delegatecall at trace root',
            'log 0 differs between trace and receipt',
            'no receipt',
            'no trace',
            'no transaction',
            'provider tx block does not match its receipt',
            'providers disagree on the transaction',
            'receipt block mismatch',
            'receipt log missing',
            'receipt logs missing',
            'receipt read failed',
            'receipt status is not success',
            'receipt transaction mismatch',
            'staticcall emitted a log',
            'trace from mismatch',
            'trace has 0 logs receipt 1',
            'trace input mismatch',
            'trace providers disagree',
            'trace read failed',
            'trace receipt block mismatch',
            'trace receipt block number mismatch',
            'trace receipt index mismatch',
            'trace receipt read failed',
            'trace receipt status mismatch',
            'trace receipt transaction mismatch',
            'trace to mismatch',
            'trace too large',
            'trace unsupported',
            'trace value mismatch',
            'transaction from invalid',
            'transaction hash mismatch',
            'transaction index mismatch',
            'transaction input invalid',
            'transaction nonce invalid',
            'transaction read failed',
            'transaction to invalid',
            'transaction value invalid',
        ]);
    });
});

function makeNamed(name: string): RawRpc {
    return { name, async request() { return null; } };
}
