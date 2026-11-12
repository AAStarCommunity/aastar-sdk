import { describe, expect, it } from 'vitest';
import { getAddress, getContractAddress, type Hex } from 'viem';
import type { FoundAction } from '../../src/guardianAudit/scan';
import type { RawRpc } from '../../src/guardianAudit/rpc';
import { MEASURE_NODES } from '../../src/guardianAudit/attribute';
import { traceAttributor } from '../../src/guardianAudit/traceAttributor';

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

    it('names the provider whose trace method is unsupported and hides the RPC text', async () => {
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
            expect(result).toEqual({ ok: false, reason: `trace unsupported on ${item.who}` });
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
        expect(result).toEqual({ ok: false, reason: 'trace read failed on alpha' });
        expect(calls.some((c) => c.name === 'beta' && c.method === 'debug_traceTransaction')).toBe(true);
    });

    it('does not treat a reverted call frame as an RPC error', async () => {
        const rootReverted = { ...traceOf(), error: 'execution reverted', logs: [] };
        const { providers, traceProviders } = pair((name, method) => {
            if (method === 'eth_getTransactionReceipt') return receiptOf();
            return name === 'alpha' ? rootReverted : traceOf();
        });
        const result = await attr({ providers, traceProviders }).attribute(action());
        expect(result).toEqual({ ok: false, reason: 'trace has 0 logs, receipt 1' });
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
            ok: false, reason: 'receipt status is not success on alpha',
        });
        expect(await run(receiptOf({ blockHash: `0x${'33'.repeat(32)}` }))).toEqual({
            ok: false, reason: 'receipt block mismatch on alpha',
        });
        expect(await run(receiptOf({ transactionHash: `0x${'44'.repeat(32)}` }))).toEqual({
            ok: false, reason: 'receipt transaction mismatch on alpha',
        });
        expect(await run(receiptOf({}, { data: '0x01' }))).toEqual({
            ok: false, reason: 'receipt log missing on alpha',
        });
        expect(await run(receiptOf({ logs: [] }))).toEqual({
            ok: false, reason: 'receipt log missing on alpha',
        });
        expect(await run(null)).toEqual({ ok: false, reason: 'no receipt on alpha' });
        expect(await run(receiptOf({ logs: { length: 1 } }))).toEqual({
            ok: false, reason: 'receipt logs missing on alpha',
        });
    });

    it('hides a receipt transport error', async () => {
        const { providers, traceProviders } = pair((_name, method) => {
            if (method === 'eth_getTransactionReceipt') throw new Error(`down ${LEAK}`);
            return traceOf();
        });
        const result = await attr({ providers, traceProviders }).attribute(action());
        expect(result).toEqual({ ok: false, reason: 'receipt read failed on alpha' });
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
            expect(result).toEqual({ ok: false, reason: 'trace read failed on alpha' });
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
        expect(await run(3)).toEqual({ ok: false, reason: 'trace unsupported on alpha' });
        expect(await run(4)).toEqual({ ok: false, reason: 'trace read failed on alpha' });
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
        expect(await withTrace(trace, receipt)).toEqual({ ok: false, reason: 'trace has 1 logs, receipt 2' });
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
        expect(await withTrace(trace, receipt)).toEqual({ ok: false, reason: 'trace has 1 logs, receipt 2' });
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
        expect(await withTrace(trace)).toEqual({ ok: false, reason: 'trace has 2 logs, receipt 1' });
    });

    it('rejects a top-level from, to, input, or value mismatch', async () => {
        expect(await withTrace(traceOf(OTHER))).toEqual({ ok: false, reason: 'trace from mismatch on alpha' });
        expect(await withTrace({ ...traceOf(), to: OTHER })).toEqual({ ok: false, reason: 'trace to mismatch on alpha' });
        expect(await withTrace({ ...traceOf(), input: '0xdeadbeef' })).toEqual({
            ok: false, reason: 'trace input mismatch on alpha',
        });
        expect(await withTrace({ ...traceOf(), value: '0x2' })).toEqual({
            ok: false, reason: 'trace value mismatch on alpha',
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
            ok: false, reason: 'trace to mismatch on alpha',
        });
        expect(await withTrace(
            { ...impostor, to: OTHER, calls: [{ ...guardian, from: OTHER }] },
            receiptOf({ contractAddress: OTHER }),
            tx,
        )).toEqual({ ok: false, reason: 'contract address mismatch on alpha' });
        expect(await withTrace({ ...impostor, type: 'CREATE2', to: created, calls: [guardian] }, receipt, tx)).toEqual({
            ok: false, reason: 'trace to mismatch on alpha',
        });
        expect(await withTrace(traceOf(), receipt, tx)).toEqual({
            ok: false, reason: 'trace to mismatch on alpha',
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
            ok: false, reason: 'transaction hash mismatch on alpha',
        });
        expect(await withTrace(
            traceOf(),
            receiptOf({ transactionIndex: '0x5' }),
            txOf({ transactionIndex: '0x1' }),
        )).toEqual({ ok: false, reason: 'transaction index mismatch on alpha' });
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
            ok: false, reason: 'transaction value invalid on alpha',
        });
        const trace = traceOf();
        delete trace.value;
        expect(await withTrace(trace)).toEqual({ ok: false, reason: 'trace value mismatch on alpha' });
    });

    it('rejects a block number that is not the action block', async () => {
        expect(await withTrace(
            traceOf(),
            receiptOf({ blockNumber: '0x11' }),
            txOf({ blockNumber: '0x11' }),
        )).toEqual({ ok: false, reason: 'block number mismatch on alpha' });
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
        expect(wrongBlock.result).toEqual({ ok: false, reason: 'trace receipt block mismatch on alpha' });
        const traceAt = wrongBlock.seen.indexOf('alpha:debug_traceTransaction');
        expect(traceAt).toBeGreaterThan(wrongBlock.seen.indexOf('alpha:eth_getTransactionReceipt'));
        expect(wrongBlock.seen.lastIndexOf('alpha:eth_getTransactionReceipt')).toBeGreaterThan(traceAt);
        expect(await run({ transactionIndex: '0x9' })).toMatchObject({
            result: { ok: false, reason: 'trace receipt index mismatch on alpha' },
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
});
