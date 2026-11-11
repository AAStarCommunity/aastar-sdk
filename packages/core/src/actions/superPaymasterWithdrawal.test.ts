import { describe, it, expect } from 'vitest';
import { resolveSuperPaymasterWithdrawalMode, superPaymasterHasTwoStepWithdrawal, superPaymasterWithdrawalActions } from './superPaymasterWithdrawal.js';
import { ErrorCode } from '../errors/index.js';
import { sp550PinnedAddressEntries } from '../sp550Cutover.js';

const SP = '0x' + '5a'.repeat(20) as `0x${string}`;
const OP = '0x' + '0b'.repeat(20) as `0x${string}`;
const NOW = 1_800_000_000n;
/** The window the mocked contract reports (OPERATOR_WITHDRAWAL_WINDOW() = 24 h on 5.5.1). */
const OPERATOR_WITHDRAWAL_WINDOW = 86_400n;

/** A mocked chain: pending request, balance, slash flag; writes are recorded, never sent. */
function chain(o: { amount?: bigint; readyAt?: bigint; balance?: bigint; slash?: boolean; window?: number } = {}) {
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
                case 'OPERATOR_WITHDRAWAL_WINDOW': return o.window ?? 86400;
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
        ['the window has closed (WithdrawalExpired)', { amount: 300n, readyAt: NOW - OPERATOR_WITHDRAWAL_WINDOW - 1n }, /window closed at 1799999999 .*cancelWithdraw returns the escrow, then requestWithdraw again/],
    ])('executeWithdraw refuses before sending: %s', async (_n, o: any, msg) => {
        const { a, writes } = chain(o);
        const err = await a.executeWithdraw({ operator: OP, amount: o.ask }).catch((e) => e);
        expect(err.code).toBe(ErrorCode.INVALID_PARAMETER);
        expect(err.message).toMatch(msg);
        expect(writes).toEqual([]);
    });
    it('withdrawalStatus reads every field at one block and reports maturity from block time', async () => {
        const { a, reads } = chain({ amount: 5n, readyAt: NOW, balance: 9n });
        expect(await a.withdrawalStatus({ operator: OP })).toEqual({
            amount: 5n, readyAt: NOW, balance: 9n, available: 9n, escrowed: 5n, expiresAt: NOW + OPERATOR_WITHDRAWAL_WINDOW,
            now: NOW, phase: 'open', matured: true, expired: false, slashQueued: false,
        });
        expect(reads.every((r) => r.blockNumber === 9n)).toBe(true);
    });
    it('the window is read from the contract (OPERATOR_WITHDRAWAL_WINDOW()), not assumed', async () => {
        const at = async (readyAt: bigint) => (await chain({ amount: 5n, readyAt, window: 3600 }).a.withdrawalStatus({ operator: OP }));
        expect((await at(NOW - 3600n)).phase).toBe('open');
        expect((await at(NOW - 3601n)).phase).toBe('expired');
        expect((await at(NOW - 3600n)).expiresAt).toBe(NOW);
        const { a, reads } = chain({ amount: 5n, readyAt: NOW });
        await a.withdrawalStatus({ operator: OP });
        expect(reads.find((r) => r.functionName === 'OPERATOR_WITHDRAWAL_WINDOW')).toMatchObject({ blockNumber: 9n });
        expect(await a.withdrawalWindow()).toBe(86_400n);
    });
    it('expireWithdraw sends only after the window has closed, for anyone', async () => {
        const { a, writes } = chain({ amount: 300n, readyAt: NOW - OPERATOR_WITHDRAWAL_WINDOW - 1n });
        await a.expireWithdraw({ operator: OP });
        expect(writes.map((w) => [w.functionName, w.args])).toEqual([['expireWithdraw', [OP]]]);
    });
    it.each([
        ['no request', { amount: 0n }, /no withdrawal request .*NoPendingWithdrawal/],
        ['still open (last second)', { amount: 300n, readyAt: NOW - OPERATOR_WITHDRAWAL_WINDOW }, /still open until .*WithdrawalNotReady/],
        ['not matured yet', { amount: 300n, readyAt: NOW + 1n }, /still open until/],
    ])('expireWithdraw refuses before sending: %s', async (_n, o, msg) => {
        const { a, writes } = chain(o);
        await expect(a.expireWithdraw({ operator: OP })).rejects.toThrow(msg);
        expect(writes).toEqual([]);
    });
    it('the window is [readyAt, readyAt + 24 h], both ends inclusive', async () => {
        const phase = async (readyAt: bigint) => (await chain({ amount: 5n, readyAt }).a.withdrawalStatus({ operator: OP })).phase;
        expect(await phase(NOW + 1n)).toBe('waiting');
        expect(await phase(NOW)).toBe('open');
        expect(await phase(NOW - OPERATOR_WITHDRAWAL_WINDOW)).toBe('open');
        expect(await phase(NOW - OPERATOR_WITHDRAWAL_WINDOW - 1n)).toBe('expired');
        expect((await chain({ amount: 0n }).a.withdrawalStatus({ operator: OP }))).toMatchObject({ phase: 'none', expiresAt: 0n, escrowed: 0n });
    });
    it('the escrow pays the withdrawal: an aPNTsBalance below the request does not block it', async () => {
        // From #619 the request has already left aPNTsBalance; checking it against the balance would refuse a valid withdraw.
        const { a, writes } = chain({ amount: 300n, readyAt: NOW - 1n, balance: 0n });
        await a.executeWithdraw({ operator: OP });
        expect(writes[0]).toMatchObject({ functionName: 'withdraw', args: [300n] });
    });
    it('the last second of the window still sends', async () => {
        const { a, writes } = chain({ amount: 300n, readyAt: NOW - OPERATOR_WITHDRAWAL_WINDOW });
        await a.executeWithdraw({ operator: OP });
        expect(writes).toHaveLength(1);
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

describe('resolveSuperPaymasterWithdrawalMode: the read-back-verified pin decides, never an unverified version()', () => {
    const A = (n: number) => ('0x' + n.toString(16).padStart(40, '0')) as `0x${string}`;
    const PINS = {
        tag: 'v5.5.0', spVersion: 'SuperPaymaster-5.5.1', superPaymaster: SP, spImpl: A(1), spImplCodehash: ('0x' + 'ab'.repeat(32)) as `0x${string}`,
        superPaymasterLens: A(3), xPNTsFactoryV2: A(4), xPNTsTokenV2Impl: A(5), xPNTsTokenV2Ext: A(6), aoaProtocolRegistry: A(7),
        globalTierSource: A(8), aPNTsCapped: A(9), readbackBlock: 1n,
    } as Record<string, any>;
    // Complete pins carry a runtime codehash per pinned address (#435); spImpl's is spImplCodehash.
    PINS.codehashes = Object.fromEntries(sp550PinnedAddressEntries(PINS as any).filter(([, a]) => a !== undefined)
        .map(([k], i) => [k, k === 'spImpl' ? PINS.spImplCodehash : '0x' + (i + 1).toString(16).padStart(2, '0').repeat(32)]));
    const live = (version: string, chainId = 11155111) => ({
        getChainId: async () => chainId,
        readContract: async (p: any) => { if (p.functionName !== 'version') throw new Error(p.functionName); return version; },
    }) as any;

    it('usable pins and a matching live version(): the pin decides (5.5.1 -> two-step)', async () => {
        expect(await resolveSuperPaymasterWithdrawalMode(live('SuperPaymaster-5.5.1'), SP, { pins: PINS }))
            .toEqual({ mode: 'two-step', version: 'SuperPaymaster-5.5.1', source: 'pin' });
    });
    it('pin and live version() differ: refuses rather than guess (both directions)', async () => {
        await expect(resolveSuperPaymasterWithdrawalMode(live('SuperPaymaster-5.4.2'), SP, { pins: PINS })).rejects.toThrow(/reports "SuperPaymaster-5\.4\.2" but the read-back pinned "SuperPaymaster-5\.5\.1"/);
        await expect(resolveSuperPaymasterWithdrawalMode(live('SuperPaymaster-5.5.2'), SP, { pins: PINS })).rejects.toThrow(/refusing to guess/);
        const err = await resolveSuperPaymasterWithdrawalMode(live('SuperPaymaster-5.5.2'), SP, { pins: PINS }).catch((e) => e);
        expect(err.code).toBe(ErrorCode.ABI_SHAPE_MISMATCH);
    });
    it('pins that name another proxy do not certify this one', async () => {
        await expect(resolveSuperPaymasterWithdrawalMode(live('SuperPaymaster-5.5.1'), A(0x77), { pins: PINS })).rejects.toThrow(/uncertified proxy/);
    });
    it('no usable pins: a pre-cutover 5.4.2 is one call', async () => {
        expect(await resolveSuperPaymasterWithdrawalMode(live('SuperPaymaster-5.4.2'), SP, { pins: {} }))
            .toEqual({ mode: 'one-call', version: 'SuperPaymaster-5.4.2', source: 'pre-cutover' });
    });
    it.each([
        ['empty pins', {}],
        ['pins missing spVersion', { ...PINS, spVersion: undefined }],
        ['an rc tag without allowRc', { ...PINS, tag: 'v5.5.0-rc.8' }],
    ])('a live 5.5.x with %s is refused (nothing certifies its withdrawal)', async (_n, pins) => {
        await expect(resolveSuperPaymasterWithdrawalMode(live('SuperPaymaster-5.5.1'), SP, { pins: pins as any })).rejects.toThrow(/no read-back-verified 5\.5 pins/);
    });
    it('the shipped Sepolia table is empty today, so a live 5.5.1 there is refused and 5.4.2 is one call', async () => {
        await expect(resolveSuperPaymasterWithdrawalMode(live('SuperPaymaster-5.5.1'), SP)).rejects.toThrow(/no read-back-verified/);
        expect((await resolveSuperPaymasterWithdrawalMode(live('SuperPaymaster-5.4.2'), SP)).mode).toBe('one-call');
    });
    it('OP Mainnet stays held: even complete fresh pins do not certify chain 10', async () => {
        await expect(resolveSuperPaymasterWithdrawalMode(live('SuperPaymaster-5.5.1', 10), SP)).rejects.toThrow(/no read-back-verified/);
    });
});
