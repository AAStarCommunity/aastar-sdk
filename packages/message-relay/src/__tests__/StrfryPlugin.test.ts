// Unit tests for StrfryPlugin — strfry write-policy plugin.
//
// Strategy: mock the entire 'node:readline' module to inject controlled
// line events without needing real stdin. Capture stdout.write() calls
// to verify accept/reject decisions.
// The injectable `onClose` callback prevents process.exit() in tests.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';

// ─── Mock readline at module level ───────────────────────────────────────────
//
// We return a controllable EventEmitter for each createInterface() call.
// Tests push lines via rl.emit('line', ...) and close via rl.emit('close').

const rlEmitter = new EventEmitter();

vi.mock('node:readline', () => ({
    createInterface: vi.fn(() => rlEmitter),
}));

// ─── Imports (after mock) ─────────────────────────────────────────────────────

import { PaymentValidator } from '../middleware/PaymentValidator.js';
import { runStrfryPlugin } from '../strfry/StrfryPlugin.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const VALIDATOR_CONFIG = {
    minFeeUsdc: 1000n,
    operatorAddress: '0xOperator123' as `0x${string}`,
    usdcAddress: '0xUSDC456' as `0x${string}`,
    chainId: 10,
};

function makeValidator(): PaymentValidator {
    return new PaymentValidator(VALIDATOR_CONFIG);
}

function makeFakeEvent(kind = 1, tags: string[][] = [], id = 'fake-id'): object {
    return {
        id,
        pubkey: '0x' + 'ab'.repeat(32),
        kind,
        created_at: Math.floor(Date.now() / 1000),
        tags,
        content: '',
        sig: '0x' + 'cd'.repeat(32),
    };
}

function validPaymentTags(): string[][] {
    return [
        ['payment', '2000', 'USDC', '0xUSDC456', '10'],
        ['nonce', '0xdeadbeef'],
        ['valid_before', String(Math.floor(Date.now() / 1000) + 3600)],
        ['from', '0xSender789'],
        ['to', '0xOperator123'],
        ['sig', '0x' + 'ab'.repeat(65)],
    ];
}

/**
 * Run the plugin, inject `lines` into the mock readline emitter, and
 * collect all stdout.write() calls.
 *
 * Returns the parsed output objects.
 */
function runWithLines(
    lines: string[],
    strictMode = false
): Array<{ id: string; action: string; msg?: string }> {
    const outputs: string[] = [];
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
        if (typeof chunk === 'string') outputs.push(chunk.trim());
        return true;
    });

    let closeCalled = false;
    const onClose = () => { closeCalled = true; };

    runStrfryPlugin(makeValidator(), strictMode, onClose);

    // Inject lines synchronously
    for (const line of lines) {
        rlEmitter.emit('line', line);
    }

    writeSpy.mockRestore();

    return outputs
        .filter(s => s.length > 0)
        .map(s => JSON.parse(s) as { id: string; action: string; msg?: string });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('StrfryPlugin — normal events (non-strict mode)', () => {
    afterEach(() => {
        rlEmitter.removeAllListeners();
    });

    it('accepts a kind:1 event without payment tags', () => {
        const event = makeFakeEvent(1, [], 'event-1');
        const results = runWithLines([
            JSON.stringify({ type: 'new', event, receivedAt: Date.now() }),
        ]);
        expect(results).toHaveLength(1);
        expect(results[0]!.id).toBe('event-1');
        expect(results[0]!.action).toBe('accept');
    });

    it('accepts multiple different event kinds', () => {
        const kinds = [1, 4, 1059, 7];
        const lines = kinds.map((k, i) => JSON.stringify({
            type: 'new',
            event: makeFakeEvent(k, [], `event-${k}-${i}`),
            receivedAt: Date.now(),
        }));
        const results = runWithLines(lines, false);
        expect(results).toHaveLength(4);
        for (const r of results) {
            expect(r.action).toBe('accept');
        }
    });

    it('ignores non-"new" type messages', () => {
        const lines = [
            JSON.stringify({ type: 'req', event: makeFakeEvent(1, [], 'req-1'), receivedAt: 0 }),
            JSON.stringify({ type: 'new', event: makeFakeEvent(1, [], 'new-1'), receivedAt: 0 }),
        ];
        const results = runWithLines(lines, false);
        expect(results).toHaveLength(1);
        expect(results[0]!.id).toBe('new-1');
    });

    it('skips blank and whitespace-only lines', () => {
        const lines = [
            '',
            '   ',
            JSON.stringify({ type: 'new', event: makeFakeEvent(1, [], 'e1'), receivedAt: 0 }),
            '\t',
        ];
        const results = runWithLines(lines);
        expect(results).toHaveLength(1);
        expect(results[0]!.id).toBe('e1');
    });

    it('skips invalid JSON without crashing', () => {
        const lines = [
            'not-valid-json',
            JSON.stringify({ type: 'new', event: makeFakeEvent(1, [], 'e-after-bad'), receivedAt: 0 }),
        ];
        const results = runWithLines(lines);
        expect(results).toHaveLength(1);
        expect(results[0]!.id).toBe('e-after-bad');
    });
});

describe('StrfryPlugin — kind:23405 payment commitment gating', () => {
    afterEach(() => {
        rlEmitter.removeAllListeners();
    });

    it('rejects kind:23405 with no payment tags', () => {
        const event = makeFakeEvent(23405, [], 'pay-no-tags');
        const results = runWithLines([
            JSON.stringify({ type: 'new', event, receivedAt: Date.now() }),
        ]);
        expect(results[0]!.action).toBe('reject');
        expect(results[0]!.msg).toContain('missing payment commitment');
    });

    it('rejects kind:23405 with fee too low', () => {
        const tags = [
            ['payment', '100', 'USDC', '0xUSDC456', '10'], // 100 < min 1000
            ['nonce', '0xnonce'], ['valid_before', String(Math.floor(Date.now() / 1000) + 3600)],
            ['from', '0xfrom'], ['to', '0xOperator123'], ['sig', '0x' + 'ab'.repeat(65)],
        ];
        const event = makeFakeEvent(23405, tags, 'pay-low-fee');
        const results = runWithLines([JSON.stringify({ type: 'new', event, receivedAt: 0 })]);
        expect(results[0]!.action).toBe('reject');
        expect(results[0]!.msg).toBe('fee_too_low');
    });

    it('rejects kind:23405 with wrong recipient', () => {
        const tags = validPaymentTags().map(t => t[0] === 'to' ? ['to', '0xWrongAddr'] : t);
        const event = makeFakeEvent(23405, tags, 'pay-wrong-to');
        const results = runWithLines([JSON.stringify({ type: 'new', event, receivedAt: 0 })]);
        expect(results[0]!.action).toBe('reject');
        expect(results[0]!.msg).toBe('wrong_recipient');
    });

    it('rejects kind:23405 with expired valid_before', () => {
        const tags = validPaymentTags().map(t =>
            t[0] === 'valid_before' ? ['valid_before', String(Math.floor(Date.now() / 1000) - 100)] : t
        );
        const event = makeFakeEvent(23405, tags, 'pay-expired');
        const results = runWithLines([JSON.stringify({ type: 'new', event, receivedAt: 0 })]);
        expect(results[0]!.action).toBe('reject');
        expect(results[0]!.msg).toBe('expired');
    });

    it('kind:23405 with valid fee/expiry/recipient goes to sig check', () => {
        // The sig is invalid (random bytes), so it will be rejected with invalid_signature
        const tags = validPaymentTags();
        const event = makeFakeEvent(23405, tags, 'pay-bad-sig');
        const results = runWithLines([JSON.stringify({ type: 'new', event, receivedAt: 0 })]);
        // Must reach sig validation (not fail earlier)
        expect(results[0]!.id).toBe('pay-bad-sig');
        expect(results[0]!.action).toBe('reject');
        expect(results[0]!.msg).toBe('invalid_signature');
    });
});

describe('StrfryPlugin — strictMode', () => {
    afterEach(() => {
        rlEmitter.removeAllListeners();
    });

    it('rejects kind:1 events when strictMode=true and no payment tags', () => {
        const event = makeFakeEvent(1, [], 'strict-no-pay');
        const results = runWithLines(
            [JSON.stringify({ type: 'new', event, receivedAt: 0 })],
            true
        );
        expect(results[0]!.action).toBe('reject');
        expect(results[0]!.msg).toContain('missing payment commitment');
    });

    it('accepts kind:1 events in non-strict mode regardless of payment', () => {
        const event = makeFakeEvent(1, [], 'non-strict');
        const results = runWithLines([JSON.stringify({ type: 'new', event, receivedAt: 0 })], false);
        expect(results[0]!.action).toBe('accept');
    });
});

describe('StrfryPlugin — onClose callback', () => {
    afterEach(() => {
        rlEmitter.removeAllListeners();
    });

    it('calls onClose when readline emits close', () => {
        const outputs: string[] = [];
        const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
            if (typeof chunk === 'string') outputs.push(chunk);
            return true;
        });

        let closeCalled = false;
        const onClose = () => { closeCalled = true; };

        runStrfryPlugin(makeValidator(), false, onClose);

        // Trigger the close event
        rlEmitter.emit('close');

        expect(closeCalled).toBe(true);

        writeSpy.mockRestore();
    });

    it('does NOT call process.exit when custom onClose is provided', () => {
        // If process.exit were called it would crash the test process.
        // This test verifies the injectable callback is used instead.
        const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as never);
        const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

        const called: string[] = [];
        runStrfryPlugin(makeValidator(), false, () => called.push('closed'));
        rlEmitter.emit('close');

        expect(exitSpy).not.toHaveBeenCalled();
        expect(called).toContain('closed');

        exitSpy.mockRestore();
        writeSpy.mockRestore();
    });
});
