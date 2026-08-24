/**
 * Reverse tests for the RepCredit negative controls (CC-50 H1).
 *
 * A negative control is only worth something if it FAILS when the property it guards is broken.
 * Every test below breaks one property and asserts the control throws. The first describe block
 * additionally pins the exact bug that made this file necessary: the original sentinel-inside-try
 * pattern silently passed, and the replacement does not.
 */
import { describe, expect, it } from 'vitest';
import {
  NegativeControlFailure,
  assertHttpRejections,
  assertRevertedNotOutOfGas,
  expectCallRejected,
  expectViewRejected,
} from './negative-control.js';

const sanitize = (error: unknown) => (error instanceof Error ? error.message : String(error));
const reverts = (reason = 'execution reverted: AggregateUpliftCapExceeded') => async () => {
  throw new Error(reason);
};
const succeeds = async () => '0x';

describe('the swallowed-sentinel bug this module replaces', () => {
  /** Verbatim shape of the original control, kept as the mutation baseline. */
  async function originalPattern(call: () => Promise<unknown>): Promise<string> {
    let recorded: string;
    try {
      await call();
      throw new Error('attack unexpectedly succeeded');
    } catch (error) {
      recorded = sanitize(error);
    }
    return recorded;
  }

  it('the ORIGINAL pattern silently passes when the attack succeeds (the defect)', async () => {
    // No throw escapes: the sentinel is caught by its own catch and returned as the "reason".
    await expect(originalPattern(succeeds)).resolves.toContain('attack unexpectedly succeeded');
  });

  it('the REPLACEMENT throws on that exact input', async () => {
    await expect(expectCallRejected('uplift cap', succeeds, sanitize)).rejects.toThrow(NegativeControlFailure);
  });
});

describe('expectCallRejected', () => {
  it('returns the sanitized reason when the call is rejected', async () => {
    await expect(expectCallRejected('uplift cap', reverts(), sanitize)).resolves.toContain('AggregateUpliftCapExceeded');
  });

  it('fails when the attack simulates successfully (property broken)', async () => {
    await expect(expectCallRejected('uplift cap', succeeds, sanitize)).rejects.toThrow(/expected rejection, but the call SUCCEEDED/);
  });

  it('fails when the call died of gas rather than a contract rule', async () => {
    await expect(expectCallRejected('uplift cap', reverts('out of gas'), sanitize))
      .rejects.toThrow(/ran out of gas/);
  });

  it('fails when the call died of a transport error rather than a contract rule', async () => {
    await expect(expectCallRejected('uplift cap', reverts('fetch failed'), sanitize))
      .rejects.toThrow(/transport error/);
  });

  it('fails on an empty rejection reason (nothing to put in evidence)', async () => {
    await expect(expectCallRejected('uplift cap', reverts(''), sanitize)).rejects.toThrow(/empty reason/);
  });

  it('fails when the revert is not the expected one', async () => {
    await expect(
      expectCallRejected('uplift cap', reverts('execution reverted: Pausable: paused'), sanitize, {
        reasonMatches: /AggregateUpliftCap/,
      }),
    ).rejects.toThrow(/not with the expected reason/);
  });

  it('passes when the revert matches the expected reason', async () => {
    await expect(
      expectCallRejected('uplift cap', reverts(), sanitize, { reasonMatches: /AggregateUpliftCap/ }),
    ).resolves.toBeTruthy();
  });
});

describe('expectViewRejected — the bool-returning view case', () => {
  it('accepts a reverting view', async () => {
    await expect(expectViewRejected('post-slash liveness', reverts(), sanitize))
      .resolves.toMatchObject({ outcome: 'reverted' });
  });

  it('accepts a view that returns false', async () => {
    await expect(expectViewRejected('post-slash liveness', async () => false, sanitize))
      .resolves.toMatchObject({ outcome: 'returned-false' });
  });

  it('FAILS when the slashed guardian set stays BLS-eligible (view returns true)', async () => {
    // This is the mutation that the original try/catch control could not detect at all.
    await expect(expectViewRejected('post-slash liveness', async () => true, sanitize))
      .rejects.toThrow(/returned true/);
  });

  it('fails when the view returns any other truthy value', async () => {
    await expect(expectViewRejected('post-slash liveness', async () => 1n, sanitize))
      .rejects.toThrow(NegativeControlFailure);
  });
});

describe('assertHttpRejections', () => {
  it('accepts 4xx refusals', () => {
    expect(() => assertHttpRejections({ tamperedMessage: { ok: false, status: 400 } })).not.toThrow();
  });

  it('fails when the node ACCEPTED an invalid request', () => {
    expect(() => assertHttpRejections({ belowThreshold: { ok: true, status: 200 } }))
      .toThrow(/ACCEPTED the invalid request/);
  });

  it('fails when the node 5xx-ed — a broken node is not a validating node', () => {
    expect(() => assertHttpRejections({ duplicateSlot: { ok: false, status: 500 } }))
      .toThrow(/server fault is not proof/);
  });

  // Since YAAA 840bfdc every /repcredit endpoint sits behind a mandatory HMAC gate. An
  // unauthenticated control gets a 4xx from the GUARD, so the old "any 4xx is a rejection" rule
  // would have marked a suite that never reached the service as fully passing.
  it('fails when the admission guard refused before the service saw the request', () => {
    const guardResponses = [
      { status: 401, body: { message: 'missing X-RepCredit-Timestamp/X-RepCredit-Auth headers' } },
      { status: 403, body: { message: 'HMAC verification failed' } },
      { status: 403, body: { message: 'auth token already used' } },
      { status: 403, body: { message: 'RepCredit experiment signing is disabled' } },
      { status: 503, body: { message: 'RepCredit experiment signing is armed but the server secret is unset' } },
      { status: 413, body: { message: 'request body exceeds 65536 bytes' } },
      { status: 403, body: { message: 'RepCredit experiment endpoints accept loopback callers only' } },
    ];
    for (const response of guardResponses) {
      expect(() => assertHttpRejections({ wrongChain: { ok: false, ...response } }))
        .toThrow(NegativeControlFailure);
    }
  });

  it('still accepts a genuine service-level rejection', () => {
    expect(() =>
      assertHttpRejections({
        wrongChain: { ok: false, status: 400, body: { message: 'chainId does not match the local RPC' } },
        tamperedMessage: { ok: false, status: 400, body: { message: 'messageHash does not match the recomputed hash' } },
      }),
    ).not.toThrow();
  });
});

describe('assertRevertedNotOutOfGas', () => {
  it('accepts a rule-based revert that refunded gas', () => {
    expect(() => assertRevertedNotOutOfGas('blocked exit', { status: 'reverted', gasUsed: 60_000n }, 8_000_000n))
      .not.toThrow();
  });

  it('fails when the transaction actually succeeded', () => {
    expect(() => assertRevertedNotOutOfGas('blocked exit', { status: 'success', gasUsed: 60_000n }, 8_000_000n))
      .toThrow(/expected a reverted receipt/);
  });

  it('fails when the "revert" burned the whole gas limit (out of gas)', () => {
    expect(() => assertRevertedNotOutOfGas('blocked exit', { status: 'reverted', gasUsed: 8_000_000n }, 8_000_000n))
      .toThrow(/out-of-gas failure/);
  });
});
