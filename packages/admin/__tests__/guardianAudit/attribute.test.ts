import { describe, expect, it } from 'vitest';
import { getAddress, type Address, type Hex } from 'viem';
import { attributeTx, type CallHop, type LogAttribution } from '../../src/guardianAudit/attribute';

const EOA = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const SAFE = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const TARGET = '0xcccccccccccccccccccccccccccccccccccccccc';
const FWD = '0xdddddddddddddddddddddddddddddddddddddddd';
const SP = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
const EXT = '0xffffffffffffffffffffffffffffffffffffffff';
const OTHER = '0x1111111111111111111111111111111111111111';
const OTHER2 = '0x2222222222222222222222222222222222222222';
const ENTRY = '0x3333333333333333333333333333333333333333';
const GUARD = '0x4444444444444444444444444444444444444444';

const TOPIC = `0x${'ab'.repeat(32)}`;
const TOPIC_B = `0x${'cd'.repeat(32)}`;
const TOPIC_C = `0x${'ef'.repeat(32)}`;

function tlog(address: string, topic = TOPIC, data = '0x', position?: number) {
    return {
        address,
        topics: [topic],
        data,
        ...(position !== undefined ? { position } : {}),
    };
}

function rlog(
    address: string, logIndex: number | string, topic = TOPIC, data = '0x', extra: Record<string, unknown> = {},
) {
    return { address, topics: [topic], data, logIndex, ...extra };
}

function frame(type: string, from: string, to: string, extra: Record<string, unknown> = {}) {
    return { type, from, to, input: '0x12345678', ...extra };
}

function addr(v: string): Address {
    return getAddress(v);
}

function hop(type: CallHop['type'], from: string, to: string, selector: string | null): CallHop {
    return { type, from: addr(from), to: addr(to), selector: selector as Hex | null };
}

function one(trace: unknown, receipt: unknown[], logIndex: number): LogAttribution {
    const res = attributeTx(trace, receipt);
    expect(res.aligned, res.aligned ? '' : res.why).toBe(true);
    if (!res.aligned) throw new Error(res.why);
    const got = res.byLogIndex.get(logIndex);
    expect(got).toBeDefined();
    return got!;
}

describe('guardian-audit trace attribution (unit, not acceptance)', () => {
    it('attributes a direct call to the transaction sender', () => {
        const trace = frame('call', EOA, TARGET, { logs: [tlog(TARGET, TOPIC, '0xab')] });
        const got = one(trace, [rlog(addr(TARGET), '0x0', `0x${'AB'.repeat(32)}`, '0xAB')], 0);
        expect(got).toEqual({
            transactionSender: addr(EOA),
            immediateCaller: addr(EOA),
            emitter: addr(TARGET),
            forwardingPath: [hop('CALL', EOA, TARGET, '0x12345678')],
        });
    });

    it('attributes a Safe execTransaction to the Safe, and records both hops', () => {
        const trace = frame('CALL', EOA, SAFE, {
            input: '0x6a761202ff',
            calls: [frame('CALL', SAFE, TARGET, { input: '0xaabbccdd', logs: [tlog(TARGET)] })],
        });
        const got = one(trace, [rlog(TARGET, 4)], 4);
        expect(got.transactionSender).toBe(addr(EOA));
        expect(got.immediateCaller).toBe(addr(SAFE));
        expect(got.emitter).toBe(addr(TARGET));
        expect(got.forwardingPath).toEqual([
            hop('CALL', EOA, SAFE, '0x6a761202'),
            hop('CALL', SAFE, TARGET, '0xaabbccdd'),
        ]);
    });

    it('attributes an EOA to forwarder to SP forward to the forwarder', () => {
        const trace = frame('CALL', EOA, FWD, {
            calls: [frame('CALL', FWD, SP, { input: '0xabcdef01', logs: [tlog(SP)] })],
        });
        const got = one(trace, [rlog(SP, 0)], 0);
        expect(got.transactionSender).toBe(addr(EOA));
        expect(got.immediateCaller).toBe(addr(FWD));
        expect(got.emitter).toBe(addr(SP));
        expect(got.forwardingPath).toEqual([
            hop('CALL', EOA, FWD, '0x12345678'),
            hop('CALL', FWD, SP, '0xabcdef01'),
        ]);
    });

    it('looks through an SP fallback delegatecall into the extension that emits', () => {
        const trace = frame('CALL', EOA, SP, {
            input: '0x',
            calls: [frame('DELEGATECALL', SP, EXT, {
                input: '0xdeadbeef',
                logs: [tlog(SP)],
            })],
        });
        const got = one(trace, [rlog(SP, 0)], 0);
        expect(got.transactionSender).toBe(addr(EOA));
        expect(got.immediateCaller).toBe(addr(EOA));
        expect(got.emitter).toBe(addr(SP));
        expect(got.forwardingPath).toEqual([
            hop('CALL', EOA, SP, null),
            hop('DELEGATECALL', SP, EXT, '0xdeadbeef'),
        ]);
    });

    it('sets CALLCODE msg.sender to the calling context', () => {
        const trace = frame('CALL', EOA, SP, {
            calls: [frame('CALLCODE', SP, EXT, { logs: [tlog(SP)] })],
        });
        const got = one(trace, [rlog(SP, 0)], 0);
        expect(got.transactionSender).toBe(addr(EOA));
        expect(got.immediateCaller).toBe(addr(SP));
        expect(got.emitter).toBe(addr(SP));
        expect(got.forwardingPath).toEqual([
            hop('CALL', EOA, SP, '0x12345678'),
            hop('CALLCODE', SP, EXT, '0x12345678'),
        ]);
    });

    it('inherits the CALLCODE sender through a later delegatecall, using context not from', () => {
        // CALLCODE's `from` is the code address EXT. The calling context is still SP.
        const trace = frame('CALL', EOA, SP, {
            calls: [frame('CALLCODE', EXT, OTHER2, {
                calls: [frame('DELEGATECALL', EXT, OTHER, { logs: [tlog(SP)] })],
            })],
        });
        const got = one(trace, [rlog(SP, 0)], 0);
        expect(got.immediateCaller).toBe(addr(SP));
        expect(got.emitter).toBe(addr(SP));
        expect(got.transactionSender).toBe(addr(EOA));
        expect(got.forwardingPath).toEqual([
            hop('CALL', EOA, SP, '0x12345678'),
            hop('CALLCODE', EXT, OTHER2, '0x12345678'),
            hop('DELEGATECALL', EXT, OTHER, '0x12345678'),
        ]);
    });

    it.each(['CREATE', 'CREATE2'] as const)('uses to as the %s context', (type) => {
        const got = one(frame(type, EOA, TARGET, { logs: [tlog(TARGET)] }), [rlog(TARGET, 0)], 0);
        expect(got.emitter).toBe(addr(TARGET));
        expect(got.immediateCaller).toBe(addr(EOA));
        expect(got.forwardingPath[0]?.type).toBe(type);
    });

    it('rejects a log emitted anywhere under a staticcall', () => {
        const direct = frame('STATICCALL', EOA, TARGET, { logs: [tlog(TARGET)] });
        expect(attributeTx(direct, [rlog(TARGET, 0)])).toEqual({
            aligned: false,
            why: 'staticcall emitted a log',
        });
        const nested = frame('CALL', EOA, SP, {
            calls: [frame('STATICCALL', SP, TARGET, {
                calls: [frame('CALL', TARGET, OTHER, { logs: [tlog(OTHER)] })],
            })],
        });
        expect(attributeTx(nested, [rlog(OTHER, 0)])).toEqual({
            aligned: false,
            why: 'staticcall emitted a log',
        });
    });

    it('keeps a selfdestruct as a position slot next to a guardian log', () => {
        const trace = frame('CALL', EOA, ENTRY, {
            calls: [
                frame('CALL', ENTRY, GUARD, { logs: [tlog(GUARD)] }),
                { type: 'SELFDESTRUCT', from: ENTRY, to: EOA },
            ],
            logs: [{ ...tlog(ENTRY, TOPIC_B), position: 2 }],
        });
        const res = attributeTx(trace, [rlog(GUARD, 0), rlog(ENTRY, 1, TOPIC_B)]);
        expect(res.aligned).toBe(true);
        if (!res.aligned) return;
        expect(res.byLogIndex.get(0)?.immediateCaller).toBe(addr(ENTRY));
        expect(res.byLogIndex.get(0)?.emitter).toBe(addr(GUARD));
        expect(res.byLogIndex.get(1)?.emitter).toBe(addr(ENTRY));
        expect(res.byLogIndex.get(1)?.forwardingPath).toHaveLength(1);
    });

    it('rejects a selfdestruct that carries logs or children', () => {
        const withLog = frame('CALL', EOA, TARGET, {
            calls: [{ type: 'SELFDESTRUCT', from: TARGET, to: EOA, logs: [tlog(EOA)] }],
            logs: [{ ...tlog(TARGET), position: 1 }],
        });
        expect(attributeTx(withLog, [rlog(TARGET, 0)])).toEqual({
            aligned: false,
            why: 'selfdestruct frame has logs or children',
        });
        const withChild = frame('CALL', EOA, TARGET, {
            calls: [{
                type: 'SELFDESTRUCT',
                from: TARGET,
                to: EOA,
                calls: [frame('CALL', TARGET, OTHER, { logs: [tlog(OTHER)] })],
            }],
        });
        expect(attributeTx(withChild, [])).toEqual({
            aligned: false,
            why: 'selfdestruct frame has logs or children',
        });
    });

    it('drops a reverted sibling subtree and still aligns', () => {
        const kept = tlog(GUARD);
        const trace = frame('CALL', EOA, ENTRY, {
            calls: [
                frame('CALL', ENTRY, OTHER, {
                    error: 'execution reverted',
                    logs: [{ ...tlog(OTHER, TOPIC_B), position: 0 }],
                    calls: [frame('CALL', OTHER, OTHER2, { logs: [tlog(OTHER2, TOPIC_C)] })],
                }),
                frame('CALL', ENTRY, GUARD, { input: '0x11111111', logs: [kept] }),
            ],
        });
        const got = one(trace, [rlog(GUARD, 8)], 8);
        expect(got.immediateCaller).toBe(addr(ENTRY));
        expect(got.transactionSender).toBe(addr(EOA));
        expect(got.forwardingPath).toHaveLength(2);
        expect(got.emitter).toBe(addr(GUARD));
    });

    it('keeps a reverted call as a position slot', () => {
        const trace = frame('CALL', EOA, TARGET, {
            calls: [frame('CALL', TARGET, OTHER, { error: 'reverted', logs: [tlog(OTHER)] })],
            logs: [{ ...tlog(TARGET), position: 1 }],
        });
        const got = one(trace, [rlog(TARGET, 0)], 0);
        expect(got.emitter).toBe(addr(TARGET));
        expect(got.forwardingPath).toHaveLength(1);
    });

    it('refuses a receipt that still contains a reverted subtree log', () => {
        const dropped = { ...tlog(OTHER, TOPIC_B), position: 0 };
        const nested = tlog(OTHER2, TOPIC_C);
        const kept = tlog(GUARD);
        const trace = frame('CALL', EOA, ENTRY, {
            calls: [
                frame('CALL', ENTRY, OTHER, {
                    error: 'execution reverted',
                    logs: [dropped],
                    calls: [frame('CALL', OTHER, OTHER2, { logs: [nested] })],
                }),
                frame('CALL', ENTRY, GUARD, { logs: [kept] }),
            ],
        });
        const receipt = [
            rlog(OTHER, 0, TOPIC_B),
            rlog(OTHER2, 1, TOPIC_C),
            rlog(GUARD, 2),
        ];
        expect(attributeTx(trace, receipt)).toEqual({ aligned: false, why: 'trace has 1 logs, receipt 3' });
    });

    it('attributes execute and revoke in one transaction separately', () => {
        const trace = frame('CALL', EOA, ENTRY, {
            input: '0x',
            calls: [
                frame('CALL', ENTRY, GUARD, { input: '0x11111111', logs: [tlog(GUARD, TOPIC)] }),
                frame('CALL', ENTRY, GUARD, { input: '0x22222222', logs: [tlog(GUARD, TOPIC_B)] }),
            ],
        });
        const res = attributeTx(trace, [rlog(GUARD, 11, TOPIC_B), rlog(GUARD, 10, TOPIC)]);
        expect(res.aligned).toBe(true);
        if (!res.aligned) return;
        expect(res.byLogIndex.size).toBe(2);
        const exec = res.byLogIndex.get(10)!;
        const revoke = res.byLogIndex.get(11)!;
        expect(exec.immediateCaller).toBe(addr(ENTRY));
        expect(revoke.immediateCaller).toBe(addr(ENTRY));
        expect(exec.transactionSender).toBe(addr(EOA));
        expect(exec.forwardingPath[1]?.selector).toBe('0x11111111');
        expect(revoke.forwardingPath[1]?.selector).toBe('0x22222222');
        expect(exec.emitter).toBe(addr(GUARD));
        expect(revoke.emitter).toBe(addr(GUARD));
    });

    it('rejects a log whose address is not the frame context', () => {
        const trace = frame('CALL', EOA, SP, {
            calls: [frame('DELEGATECALL', SP, EXT, { logs: [tlog(EXT)] })],
        });
        expect(attributeTx(trace, [rlog(EXT, 0)])).toEqual({
            aligned: false,
            why: 'log address is not its frame\'s context',
        });
    });

    it('rejects a missing position once a child frame kept a log', () => {
        const trace = frame('CALL', EOA, TARGET, {
            logs: [tlog(TARGET, TOPIC)],
            calls: [frame('CALL', TARGET, OTHER, { logs: [tlog(OTHER, TOPIC_B)] })],
        });
        // The order below is what an unguarded "missing means after children" walk would emit.
        const receipt = [rlog(OTHER, 0, TOPIC_B), rlog(TARGET, 1, TOPIC)];
        expect(attributeTx(trace, receipt)).toEqual({ aligned: false, why: 'trace logs lack positions' });
    });

    it('rejects mixed present and missing positions in one frame', () => {
        const trace = frame('CALL', EOA, TARGET, {
            calls: [frame('CALL', TARGET, OTHER)],
            logs: [tlog(TARGET, TOPIC), { ...tlog(TARGET, TOPIC_B), position: 0 }],
        });
        // That placement emits the positioned log first. The matching receipt must still be refused.
        const receipt = [rlog(TARGET, 0, TOPIC_B), rlog(TARGET, 1, TOPIC)];
        expect(attributeTx(trace, receipt)).toEqual({
            aligned: false,
            why: 'trace log positions are mixed',
        });
    });

    it('keeps array order when every log in the frame lacks a position', () => {
        const trace = frame('CALL', EOA, TARGET, {
            calls: [frame('CALL', TARGET, OTHER)],
            logs: [tlog(TARGET, TOPIC), tlog(TARGET, TOPIC_B)],
        });
        const res = attributeTx(trace, [rlog(TARGET, 0, TOPIC), rlog(TARGET, 1, TOPIC_B)]);
        expect(res.aligned).toBe(true);
        if (!res.aligned) return;
        expect(res.byLogIndex.size).toBe(2);
    });

    it('allows a missing position when every child frame was reverted', () => {
        const trace = frame('CALL', EOA, TARGET, {
            logs: [tlog(TARGET)],
            calls: [frame('CALL', TARGET, OTHER, { error: 'reverted', logs: [tlog(OTHER)] })],
        });
        expect(one(trace, [rlog(TARGET, 0)], 0).emitter).toBe(addr(TARGET));
    });

    it('rejects a position that decreases or falls outside the child calls', () => {
        const decreasing = frame('CALL', EOA, TARGET, {
            calls: [frame('CALL', TARGET, OTHER), frame('CALL', TARGET, OTHER2)],
            logs: [{ ...tlog(TARGET, TOPIC), position: 1 }, { ...tlog(TARGET, TOPIC_B), position: 0 }],
        });
        const inBucketOrder = [rlog(TARGET, 0, TOPIC_B), rlog(TARGET, 1, TOPIC)];
        expect(attributeTx(decreasing, inBucketOrder)).toEqual({
            aligned: false,
            why: 'trace log position invalid or out of order',
        });
        const outOfRange = frame('CALL', EOA, TARGET, { logs: [{ ...tlog(TARGET), position: 5 }] });
        expect(attributeTx(outOfRange, [rlog(TARGET, 0)])).toEqual({
            aligned: false,
            why: 'trace log position invalid or out of order',
        });
    });

    it('rejects non-contiguous, duplicate, and contradictory receipt positions', () => {
        const trace = frame('CALL', EOA, ENTRY, {
            calls: [
                frame('CALL', ENTRY, GUARD, { logs: [tlog(GUARD, TOPIC)] }),
                frame('CALL', ENTRY, GUARD, { logs: [tlog(GUARD, TOPIC_B)] }),
            ],
        });
        const gap = [rlog(GUARD, 1, TOPIC), rlog(GUARD, 3, TOPIC_B)];
        const dup = [rlog(GUARD, 4, TOPIC), rlog(GUARD, 4, TOPIC_B)];
        const clash = [{ ...rlog(GUARD, 2, TOPIC), index: 1 }];
        const why = 'receipt log positions invalid or duplicated';
        expect(attributeTx(trace, gap)).toEqual({ aligned: false, why });
        expect(attributeTx(trace, dup)).toEqual({ aligned: false, why });
        expect(attributeTx(frame('CALL', EOA, GUARD, { logs: [tlog(GUARD)] }), [clash])).toEqual({ aligned: false, why });
    });

    it('accepts a decimal logIndex and an ethers index, in position order', () => {
        const trace = frame('CALL', EOA, ENTRY, {
            calls: [
                frame('CALL', ENTRY, GUARD, { input: '0x11111111', logs: [tlog(GUARD, TOPIC)] }),
                frame('CALL', ENTRY, GUARD, { input: '0x22222222', logs: [tlog(GUARD, TOPIC_B)] }),
            ],
        });
        const receipt = [
            { address: GUARD, topics: [TOPIC_B], data: '0x', index: '0x1' },
            { address: GUARD, topics: [TOPIC], data: '0x', logIndex: '0' },
        ];
        const res = attributeTx(trace, receipt);
        expect(res.aligned).toBe(true);
        if (!res.aligned) return;
        expect([...res.byLogIndex.keys()]).toEqual([0, 1]);
        expect(res.byLogIndex.get(0)?.forwardingPath[1]?.selector).toBe('0x11111111');
        expect(res.byLogIndex.get(1)?.forwardingPath[1]?.selector).toBe('0x22222222');
    });

    it('rejects a trace log that does not equal the receipt log', () => {
        const trace = frame('CALL', EOA, TARGET, { logs: [tlog(TARGET, TOPIC, '0x01')] });
        expect(attributeTx(trace, [rlog(TARGET, 0, TOPIC, '0x02')])).toEqual({
            aligned: false,
            why: 'log 0 differs between trace and receipt',
        });
    });

    it('rejects a missing trace, a bad frame, and a non-array calls or logs field', () => {
        expect(attributeTx(null, [])).toEqual({ aligned: false, why: 'no trace' });
        expect(attributeTx(frame('CALL', EOA, TARGET, { calls: [null] }), [])).toEqual({
            aligned: false,
            why: 'trace frame malformed',
        });
        expect(attributeTx(frame('CALL', '0x1234', TARGET, { logs: [tlog(TARGET)] }), [rlog(TARGET, 0)])).toEqual({
            aligned: false,
            why: 'trace frame address malformed',
        });
        expect(attributeTx({ from: EOA, to: TARGET, logs: [tlog(TARGET)] }, [rlog(TARGET, 0)])).toEqual({
            aligned: false,
            why: 'trace frame type invalid',
        });
        expect(attributeTx({ type: 'CALL', from: EOA, to: TARGET, calls: { length: 2 } }, [])).toEqual({
            aligned: false,
            why: 'trace calls are not an array',
        });
        expect(attributeTx({ type: 'CALL', from: EOA, to: TARGET, logs: { length: 1 } }, [])).toEqual({
            aligned: false,
            why: 'trace logs are not an array',
        });
    });

    it('rejects a trace deeper than 1025, including inside a reverted subtree', () => {
        const leaf = frame('CALL', EOA, TARGET, { logs: [tlog(TARGET)] });
        let ok: Record<string, unknown> = leaf;
        for (let i = 1; i < 1025; i++) ok = frame('CALL', EOA, TARGET, { calls: [ok] });
        expect(attributeTx(ok, [rlog(TARGET, 0)]).aligned).toBe(true);

        let deep: Record<string, unknown> = frame('CALL', EOA, TARGET);
        for (let i = 1; i < 1025; i++) deep = frame('CALL', EOA, TARGET, { calls: [deep] });
        deep.error = 'reverted';
        const wrapped = frame('CALL', EOA, TARGET, { calls: [deep] });
        expect(attributeTx(wrapped, [])).toEqual({ aligned: false, why: 'trace deeper than 1025' });
    });

    it('rejects a trace with more than 100000 frames or 10000 logs', () => {
        const calls: Record<string, unknown>[] = new Array(100_000);
        for (let i = 0; i < calls.length; i++) calls[i] = { type: 'CALL', from: EOA, to: TARGET };
        const wide = { type: 'CALL', from: EOA, to: TARGET, calls, logs: [tlog(TARGET)] };
        expect(attributeTx(wide, [rlog(TARGET, 0)])).toEqual({ aligned: false, why: 'trace too large' });

        const logs: ReturnType<typeof tlog>[] = new Array(10_001);
        for (let i = 0; i < logs.length; i++) logs[i] = tlog(TARGET);
        const chatty = { type: 'CALL', from: EOA, to: TARGET, logs };
        const receipt: ReturnType<typeof rlog>[] = new Array(10_001);
        for (let i = 0; i < receipt.length; i++) receipt[i] = rlog(TARGET, i);
        expect(attributeTx(chatty, receipt)).toEqual({ aligned: false, why: 'trace too large' });
    });

    it('rejects 100001 null children before iterating the calls array', () => {
        let reads = 0;
        const calls = new Proxy(Array.from({ length: 100_001 }, () => null), {
            get(target, prop, recv) {
                if (typeof prop === 'string' && /^\d+$/.test(prop)) reads += 1;
                return Reflect.get(target, prop, recv);
            },
        });
        const started = Date.now();
        const res = attributeTx({ type: 'CALL', from: EOA, to: TARGET, calls }, []);
        expect(Date.now() - started).toBeLessThan(1_000);
        expect(res).toEqual({ aligned: false, why: 'trace too large' });
        expect(reads).toBe(0);
    });

    it('rejects more than 10000 receipt logs before reading them', () => {
        let reads = 0;
        const receipt = new Proxy(new Array(10_001), {
            get(target, prop, recv) {
                if (prop === 'length') return 10_001;
                if (typeof prop === 'string' && /^\d+$/.test(prop)) reads += 1;
                return Reflect.get(target, prop, recv);
            },
        });
        const res = attributeTx(frame('CALL', EOA, TARGET), receipt as unknown[]);
        expect(res).toEqual({ aligned: false, why: 'trace too large' });
        expect(reads).toBe(0);
    });

    it('rejects a 5000000-byte log data field without throwing', () => {
        const data = `0x${'ab'.repeat(5_000_000)}`;
        const started = Date.now();
        const onTrace = attributeTx(
            frame('CALL', EOA, TARGET, { logs: [tlog(TARGET, TOPIC, data)] }),
            [rlog(TARGET, 0)],
        );
        const onReceipt = attributeTx(frame('CALL', EOA, TARGET), [rlog(TARGET, 0, TOPIC, data)]);
        expect(Date.now() - started).toBeLessThan(1_000);
        expect(onTrace).toEqual({ aligned: false, why: 'trace too large' });
        expect(onReceipt).toEqual({ aligned: false, why: 'trace too large' });
    });

    it('rejects odd-length hex data', () => {
        const trace = frame('CALL', EOA, TARGET, { logs: [tlog(TARGET, TOPIC, '0xabc')] });
        expect(attributeTx(trace, [rlog(TARGET, 0, TOPIC, '0xabc')])).toEqual({
            aligned: false,
            why: 'log 0 differs between trace and receipt',
        });
    });

    it('validates megabyte hex data that still fits the byte budget', () => {
        // Just under 8 MiB, and large enough that the old repeated-capture regex overflows.
        const data = `0x${'ab'.repeat(4_194_296)}`;
        expect(data.length).toBe(8_388_594);
        const log = { address: TARGET, topics: [] as string[], data };
        const started = Date.now();
        const res = attributeTx(
            frame('CALL', EOA, TARGET, { logs: [log] }),
            [{ address: TARGET, topics: [], data: '0x', logIndex: 0 }],
        );
        expect(Date.now() - started).toBeLessThan(2_000);
        expect(res).toEqual({ aligned: false, why: 'log 0 differs between trace and receipt' });
    });
});
