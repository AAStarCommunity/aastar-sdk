import { describe, expect, it } from 'vitest';
import { getAddress, type Hex } from 'viem';
import type { FoundAction } from '../../src/guardianAudit/scan';
import type { RawRpc } from '../../src/guardianAudit/rpc';
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
        logs: [{ address: TARGET, topics: [TOPIC], data: '0x' }],
    };
}

function receiptOf(over: Record<string, unknown> = {}, logOver: Record<string, unknown> = {}) {
    return {
        transactionHash: TX.toUpperCase(),
        blockHash: BLOCK.toUpperCase(),
        status: '0x1',
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

function pair(answer: (name: string, method: string) => unknown) {
    const calls: { name: string; method: string; params: unknown[] }[] = [];
    const make = (name: string): RawRpc => ({
        name,
        async request({ method, params = [] }) {
            calls.push({ name, method, params: params as unknown[] });
            return answer(name, method);
        },
    });
    return { calls, providers: [make('alpha'), make('beta')] as const };
}

describe('guardian-audit trace attributor (unit, not acceptance)', () => {
    it('returns the attribution when both providers agree, ignoring address case', async () => {
        const { calls, providers } = pair((name, method) => {
            if (method === 'eth_getTransactionReceipt') return receiptOf();
            return traceOf(name === 'alpha' ? `0x${FROM.slice(2).toUpperCase()}` : FROM);
        });
        const result = await traceAttributor({ providers }).attribute(action());
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
            },
        });
        expect(calls.map((c) => `${c.name}:${c.method}`)).toEqual(expect.arrayContaining([
            'alpha:eth_getTransactionReceipt',
            'beta:eth_getTransactionReceipt',
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
            const { providers } = pair((name, method) => {
                if (method === 'eth_getTransactionReceipt') return receiptOf();
                return item.fail(name);
            });
            const result = await traceAttributor({ providers }).attribute(action());
            expect(result).toEqual({ ok: false, reason: `trace unsupported on ${item.who}` });
            if (!result.ok) expect(result.reason).not.toContain('LEAKED');
        }
    });

    it('reports a trace read failure without the RPC message', async () => {
        const { providers, calls } = pair((name, method) => {
            if (method === 'eth_getTransactionReceipt') return receiptOf();
            if (name === 'alpha') throw new Error(`socket hang up ${LEAK}`);
            return traceOf();
        });
        const result = await traceAttributor({ providers }).attribute(action());
        expect(result).toEqual({ ok: false, reason: 'trace read failed on alpha' });
        expect(calls.some((c) => c.name === 'beta' && c.method === 'debug_traceTransaction')).toBe(true);
    });

    it('does not treat a reverted call frame as an RPC error', async () => {
        const rootReverted = { ...traceOf(), error: 'execution reverted', logs: [] };
        const { providers } = pair((name, method) => {
            if (method === 'eth_getTransactionReceipt') return receiptOf();
            return name === 'alpha' ? rootReverted : traceOf();
        });
        const result = await traceAttributor({ providers }).attribute(action());
        expect(result).toEqual({ ok: false, reason: 'trace has 0 logs, receipt 1' });
    });

    it('rejects providers that disagree on the caller', async () => {
        const { providers } = pair((name, method) => {
            if (method === 'eth_getTransactionReceipt') return receiptOf();
            return traceOf(name === 'alpha' ? FROM : OTHER);
        });
        const result = await traceAttributor({ providers }).attribute(action());
        expect(result).toEqual({ ok: false, reason: 'providers disagree on attribution' });
    });

    it('rejects status 0, another block hash, another transaction, and a missing log', async () => {
        const run = async (receipt: unknown) => {
            const { providers } = pair((_name, method) => (method === 'eth_getTransactionReceipt' ? receipt : traceOf()));
            return traceAttributor({ providers }).attribute(action());
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
        const { providers } = pair((_name, method) => {
            if (method === 'eth_getTransactionReceipt') throw new Error(`down ${LEAK}`);
            return traceOf();
        });
        const result = await traceAttributor({ providers }).attribute(action());
        expect(result).toEqual({ ok: false, reason: 'receipt read failed on alpha' });
    });

    it('turns an exception from attribution into a controlled failure', async () => {
        const { providers } = pair((_name, method) => {
            if (method === 'eth_getTransactionReceipt') return receiptOf();
            const trace = traceOf();
            Object.defineProperty(trace.logs[0], 'data', {
                get() {
                    throw new Error(`boom ${LEAK}`);
                },
            });
            return trace;
        });
        const result = await traceAttributor({ providers }).attribute(action());
        expect(result).toEqual({ ok: false, reason: 'attribution failed' });
    });
});
