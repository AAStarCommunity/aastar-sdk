import { describe, it, expect } from 'vitest';
import { superPaymasterHasTwoStepWithdrawal, superPaymasterWithdrawalActions } from './superPaymasterWithdrawal.js';
import { ErrorCode } from '../errors/index.js';

const SP = '0x' + '5a'.repeat(20) as `0x${string}`;
const OP = '0x' + '0b'.repeat(20) as `0x${string}`;
const NOW = 1_800_000_000n;

/** A mocked chain: pending request, balance, slash flag; writes are recorded, never sent. */
function chain(o: { amount?: bigint; readyAt?: bigint; balance?: bigint; slash?: boolean } = {}) {
    const reads: any[] = [], writes: any[] = [];
    const client: any = {
        getBlock: async () => ({ number: 9n, timestamp: NOW }),
        readContract: async (p: any) => {
            reads.push(p);
            switch (p.functionName) {
                case 'pendingWithdrawals': return [o.amount ?? 0n, o.readyAt ?? 0n];
                case 'operators': return [o.balance ?? 1000n, true, false, '0x' + '00'.repeat(20), 0, 60, '0x' + '00'.repeat(20), 0n, 0n];
                case 'isSlashPending': return o.slash ?? false;
                case 'OPERATOR_WITHDRAWAL_DELAY': return 172800;
                case 'slashQueues': return ['0x' + '11'.repeat(20), 123, true];
                case 'inflightReserved': return 42n;
            }
            throw new Error(`unexpected read ${p.functionName}`);
        },
        writeContract: async (p: any) => { writes.push(p); return '0xhash'; },
    };
    return { a: superPaymasterWithdrawalActions(SP)(client), reads, writes };
}

describe('SuperPaymaster-5.5.1 operator withdrawal: request -> delay -> withdraw', () => {
    it('requestWithdraw / cancelWithdraw call the two-step entry points', async () => {
        const { a, writes } = chain();
        await a.requestWithdraw({ amount: 500n });
        await a.cancelWithdraw({});
        expect(writes.map((w) => [w.functionName, w.args])).toEqual([['requestWithdraw', [500n]], ['cancelWithdraw', []]]);
    });
    it('executeWithdraw sends withdraw(amount) only for a matured request, defaulting to the whole request', async () => {
        const { a, writes } = chain({ amount: 300n, readyAt: NOW - 1n });
        await a.executeWithdraw({ operator: OP });
        expect(writes).toHaveLength(1);
        expect(writes[0]).toMatchObject({ functionName: 'withdraw', args: [300n] });
    });
    it.each([
        ['no request', { amount: 0n }, /no withdrawal request/],
        ['not matured', { amount: 300n, readyAt: NOW + 1n }, /matures at/],
        ['a slash is queued', { amount: 300n, readyAt: NOW - 1n, slash: true }, /slash is queued/],
        ['more than the request', { amount: 300n, readyAt: NOW - 1n, ask: 301n }, /outside 1\.\.300/],
        ['more than the balance', { amount: 300n, readyAt: NOW - 1n, balance: 200n }, /exceeds the operator balance 200/],
    ])('executeWithdraw refuses before sending: %s', async (_n, o: any, msg) => {
        const { a, writes } = chain(o);
        const err = await a.executeWithdraw({ operator: OP, amount: o.ask }).catch((e) => e);
        expect(err.code).toBe(ErrorCode.INVALID_PARAMETER);
        expect(err.message).toMatch(msg);
        expect(writes).toEqual([]);
    });
    it('withdrawalStatus reads every field at one block and reports maturity from block time', async () => {
        const { a, reads } = chain({ amount: 5n, readyAt: NOW, balance: 9n });
        expect(await a.withdrawalStatus({ operator: OP })).toEqual({ amount: 5n, readyAt: NOW, balance: 9n, now: NOW, matured: true, slashQueued: false });
        expect(reads.every((r) => r.blockNumber === 9n)).toBe(true);
    });
    it('getters decode their tuples', async () => {
        const { a } = chain({ amount: 7n, readyAt: 8n });
        expect(await a.pendingWithdrawal({ operator: OP })).toEqual({ amount: 7n, readyAt: 8n });
        expect(await a.withdrawalDelay()).toBe(172800n);
        expect(await a.inflightReserved({ operator: OP })).toBe(42n);
        expect(await a.slashQueue({ operator: OP })).toEqual({ queuedBy: '0x' + '11'.repeat(20), queuedAt: 123n, guardianQueued: true });
    });
    it('pauseUnderstakedOperator and slashOperatorAfterReleasing pass their arguments through', async () => {
        const { a, writes } = chain();
        const h = ('0x' + 'aa'.repeat(32)) as `0x${string}`;
        await a.pauseUnderstakedOperator({ operator: OP });
        await a.slashOperatorAfterReleasing({ operator: OP, level: 1, penaltyAmount: 10n, reason: 'r', staleOpHashes: [h] });
        expect(writes.map((w) => [w.functionName, w.args])).toEqual([
            ['pauseUnderstakedOperator', [OP]], ['slashOperatorAfterReleasing', [OP, 1, 10n, 'r', [h]]],
        ]);
    });
});

describe('superPaymasterHasTwoStepWithdrawal', () => {
    it('5.5.1 and later are two-step; 5.4.2 and the 5.5.0 rc builds are one call', () => {
        expect(['SuperPaymaster-5.4.2', 'SuperPaymaster-5.5.0'].map(superPaymasterHasTwoStepWithdrawal)).toEqual([false, false]);
        expect(['SuperPaymaster-5.5.1', 'SuperPaymaster-5.5.9', 'SuperPaymaster-5.6.0'].map(superPaymasterHasTwoStepWithdrawal)).toEqual([true, true, true]);
        expect(() => superPaymasterHasTwoStepWithdrawal('PMV4-1.0.0')).toThrow(/Unrecognised/);
    });
    it('reads go to the reader when one is given, writes to the client', async () => {
        const writes: any[] = [], reads: any[] = [];
        const wallet: any = { writeContract: async (p: any) => { writes.push(p); return '0xh'; } };
        const reader: any = { readContract: async (p: any) => { reads.push(p); return [1n, 2n]; } };
        const a = superPaymasterWithdrawalActions(SP)(wallet, reader);
        expect(await a.pendingWithdrawal({ operator: OP })).toEqual({ amount: 1n, readyAt: 2n });
        await a.requestWithdraw({ amount: 1n });
        expect([reads.length, writes.length]).toEqual([1, 1]);
    });
});
