import { describe, expect, it, vi } from 'vitest';
import {
    PaymasterTracker,
    paymasterTickStep,
    resolvePaymasterV4,
    type PaymasterResolverClient,
    type PaymasterResolverParams,
} from './paymasterResolver';

const V4 = '0x2118e9a404C15F70B1D4f53b400c8a566A5ea4B6' as const;
const FACTORY = '0x00000000000000000000000000000000000000f1' as const;
const OPERATOR = '0xb5600060e6de5E11D3636731964218E53caadf0E' as const;
const OTHER = '0x00000000000000000000000000000000000000aa' as const;
const ZERO = '0x0000000000000000000000000000000000000000' as const;

const params = (over: Partial<PaymasterResolverParams> = {}): PaymasterResolverParams => ({
    candidate: V4,
    factory: FACTORY,
    factoryAbi: [],
    operator: OPERATOR,
    verifyOperatorMapping: true,
    ...over,
});

/** A client whose getBytecode answers come from a queue: an Error is thrown, a string returned. */
function client(bytecode: (string | Error)[], opts: { mapped?: string; derived?: string } = {}) {
    const getBytecode = vi.fn(async () => {
        const next = bytecode.length > 1 ? bytecode.shift()! : bytecode[0];
        if (next instanceof Error) throw next;
        return next as `0x${string}`;
    });
    const readContract = vi.fn(async ({ functionName }: any) => {
        if (functionName === 'getOperatorByPaymaster') return opts.mapped ?? OPERATOR;
        if (functionName === 'paymasterByOperator') return opts.derived ?? V4;
        throw new Error(`unexpected ${functionName}`);
    });
    return { getBytecode, readContract } as unknown as PaymasterResolverClient & {
        getBytecode: typeof getBytecode;
        readContract: typeof readContract;
    };
}

const ctx = () => {
    const lines: string[] = [];
    const notes: string[] = [];
    return {
        lines,
        notes,
        c: { network: 'sepolia', candidateLabel: V4, operator: OPERATOR, log: (l: string) => lines.push(l), notify: async (t: string) => { notes.push(t); } },
    };
};

describe('keeper PaymasterV4 resolution survives a boot-time RPC failure', () => {
    // The Mini incident: RPC not ready at boot → getBytecode threw → V4 skipped until restart.
    it('getBytecode throws on tick 1 and succeeds on tick 2 → tick 2 refreshes V4', async () => {
        const cl = client([new Error('fetch failed (ECONNREFUSED)'), '0x6080']);
        const tracker = new PaymasterTracker(cl, params(), 1800n);
        const { c, lines } = ctx();

        expect(await paymasterTickStep(tracker, 1000n, c)).toBeNull();
        expect(lines.at(-1)).toMatch(/decision=skip reason=not-found transient error=getBytecode/);

        expect(await paymasterTickStep(tracker, 1060n, c)).toBe(V4);
        expect(lines.at(-1)).toBe(`paymaster resolved=${V4} afterSec=60`);
        expect(cl.getBytecode).toHaveBeenCalledTimes(2);

        // Once found it is kept: no further chain reads.
        expect(await paymasterTickStep(tracker, 1120n, c)).toBe(V4);
        expect(cl.getBytecode).toHaveBeenCalledTimes(2);
    });

    it('a resolution after an outage is announced; a first-try resolution is not', async () => {
        const { c, notes } = ctx();
        await paymasterTickStep(new PaymasterTracker(client(['0x6080']), params(), 1800n), 1000n, c);
        expect(notes).toHaveLength(0);
        const t = new PaymasterTracker(client([new Error('timeout'), '0x6080']), params(), 1800n);
        await paymasterTickStep(t, 1000n, c);
        await paymasterTickStep(t, 1300n, c);
        expect(notes).toEqual([expect.stringMatching(/paymaster resolved[\s\S]*unresolvedSec=300/)]);
    });
});

describe('transient vs absent', () => {
    it.each([
        ['getBytecode throws', client([new Error('socket hang up')]), 'transient'],
        ['empty bytecode', client(['0x']), 'absent:no-bytecode'],
        ['factory maps the V4 to another operator', client(['0x6080'], { mapped: OTHER }), 'absent:operator-mismatch'],
    ])('%s', async (_n, cl, expected) => {
        const r = await resolvePaymasterV4(cl, params());
        const got = r.kind === 'absent' ? `absent:${r.reason}` : r.kind;
        expect(got).toBe(expected);
    });

    it('derived from the factory: a thrown paymasterByOperator is transient, a zero answer is absent', async () => {
        const throwing = client(['0x6080']);
        throwing.readContract.mockRejectedValueOnce(new Error('upstream timeout'));
        expect((await resolvePaymasterV4(throwing, params({ candidate: null }))).kind).toBe('transient');
        const r = await resolvePaymasterV4(client(['0x6080'], { derived: ZERO }), params({ candidate: null }));
        expect(r).toEqual({ kind: 'absent', reason: 'no-candidate' });
    });

    it('both kinds are re-resolved every tick (a V4 deployed later is picked up)', async () => {
        const cl = client(['0x', '0x', '0x6080']);
        const t = new PaymasterTracker(cl, params(), 1800n);
        const { c } = ctx();
        expect(await paymasterTickStep(t, 0n, c)).toBeNull();
        expect(await paymasterTickStep(t, 60n, c)).toBeNull();
        expect(await paymasterTickStep(t, 120n, c)).toBe(V4);
    });
});

describe('not-found alert', () => {
    it('fires once the V4 has been unresolved for the threshold, then at most once per threshold', async () => {
        const t = new PaymasterTracker(client([new Error('down')]), params(), 600n);
        const { c, notes } = ctx();
        for (const now of [0n, 300n, 599n]) await paymasterTickStep(t, now, c);
        expect(notes).toHaveLength(0);
        await paymasterTickStep(t, 600n, c);
        expect(notes).toEqual([expect.stringMatching(/paymaster not found[\s\S]*transient[\s\S]*unresolvedSec=600/)]);
        await paymasterTickStep(t, 900n, c);
        expect(notes).toHaveLength(1);
        await paymasterTickStep(t, 1200n, c);
        expect(notes).toHaveLength(2);
    });

    it('threshold 0 disables the alert', async () => {
        const t = new PaymasterTracker(client([new Error('down')]), params(), 0n);
        const { c, notes } = ctx();
        for (const now of [0n, 10_000n, 20_000n]) await paymasterTickStep(t, now, c);
        expect(notes).toHaveLength(0);
    });
});
