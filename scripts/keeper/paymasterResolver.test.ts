import { describe, expect, it, vi } from 'vitest';
import {
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

    it('derived from the factory and verified → found; reverse-mapping RPC failure → transient', async () => {
        expect(await resolvePaymasterV4(client(['0x6080']), params({ candidate: null }))).toEqual({ kind: 'found', address: V4 });
        const cl = client(['0x6080']);
        cl.readContract.mockImplementation(async ({ functionName }: any) => {
            if (functionName === 'getOperatorByPaymaster') throw new Error('rate limited');
            return V4;
        });
        expect((await resolvePaymasterV4(cl, params())).kind).toBe('transient');
    });

    it('verifyOperatorMapping=false skips the reverse mapping (explicit candidate, no --paymaster-operator)', async () => {
        const cl = client(['0x6080'], { mapped: OTHER });
        expect(await resolvePaymasterV4(cl, params({ verifyOperatorMapping: false }))).toEqual({ kind: 'found', address: V4 });
        expect(cl.readContract).not.toHaveBeenCalled();
    });

    it('an explicitly configured zero address is absent — it does NOT fall through to factory derivation', async () => {
        const cl = client(['0x6080']);
        const r = await resolvePaymasterV4(cl, params({ candidate: ZERO, verifyOperatorMapping: false }));
        expect(r).toMatchObject({ kind: 'absent', reason: 'no-candidate' });
        expect(cl.readContract).not.toHaveBeenCalled();
        expect(cl.getBytecode).not.toHaveBeenCalled();
    });
});
