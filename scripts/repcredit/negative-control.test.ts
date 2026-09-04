/**
 * Reverse tests for the RepCredit negative controls (CC-50 H1).
 *
 * A negative control is only worth something if it FAILS when the property it guards is broken.
 * Every test below breaks one property and asserts the control throws. The first describe block
 * additionally pins the exact bug that made this file necessary: the original sentinel-inside-try
 * pattern silently passed, and the replacement does not.
 */
import { describe, expect, it } from 'vitest';
import { keccak256, toHex } from 'viem';
import type { Abi } from 'viem';
import {
  NegativeControlFailure,
  REJECTION_CODES,
  assertHttpRejections,
  assertRevertedNotOutOfGas,
  classifyHttpRejection,
  errorSelector,
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

describe('assertHttpRejections — rejection taxonomy', () => {
  const WRONG_CHAIN = {
    demonstrates: 'chain-id rebinding',
    reason: /chainId mismatch: request=/i,
  };
  const controls = { wrongChain: WRONG_CHAIN };

  it('accepts the service validation the control actually targets', () => {
    expect(() =>
      assertHttpRejections(
        { wrongChain: { ok: false, status: 400, body: { message: 'chainId mismatch: request=11155111, local=31337' } } },
        controls,
      ),
    ).not.toThrow();
  });

  it('fails when the node ACCEPTED an invalid request', () => {
    expect(() => assertHttpRejections({ wrongChain: { ok: true, status: 200 } }, controls))
      .toThrow(/got ACCEPTED/);
  });

  it('fails when the node 5xx-ed — a broken node is not a validating node', () => {
    expect(() => assertHttpRejections({ wrongChain: { ok: false, status: 500 } }, controls))
      .toThrow(/got SERVER_FAULT/);
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
      expect(() => assertHttpRejections({ wrongChain: { ok: false, ...response } }, controls))
        .toThrow(NegativeControlFailure);
    }
  });

  /**
   * THE CC-50 round-3 HIGH, as an executable regression.
   *
   * These are the four real 403 bodies an independent reviewer fed to the previous implementation;
   * all four were ACCEPTED AS EVIDENCE. The first two are per-request and transient (they fire
   * whenever the node's audit-slot scan hits RPC turbulence), so on a live Sepolia run all five
   * controls could come back like this and the evidence would claim every security property was
   * verified while the service inspected nothing.
   */
  const REVIEWER_FALSE_GREENS: { why: string; message: string }[] = [
    {
      why: 'transient RPC during the audit-slot scan',
      message:
        'could not determine whether the local BLS key is active at audit aggregator slot 3 — ' +
        'refusing to sign on an indeterminate isolation check',
    },
    {
      why: 'transient RPC reading the audit aggregator',
      message:
        'cannot read the audit aggregator at 0x174b60bB462b00550F0EC7Bc35Fe39dDB6310158 — refusing ' +
        'to sign without a verifiable production aggregator to isolate against',
    },
    {
      why: 'node not armed for audit isolation',
      message: 'AUDIT_BLS_AGGREGATOR_ADDRESS is required when armed',
    },
    {
      why: 'validator slot not active',
      message: 'configured validator slot 3 is not active',
    },
  ];

  it.each(REVIEWER_FALSE_GREENS)('fails on a service prerequisite/infra 403 ($why)', ({ message }) => {
    expect(() => assertHttpRejections({ wrongChain: { ok: false, status: 403, body: { message } } }, controls))
      .toThrow(/INFRASTRUCTURE|SERVICE_PREREQUISITE/);
  });

  it('classifies each reviewer 403 as never-evidence rather than as validation', () => {
    for (const { message } of REVIEWER_FALSE_GREENS) {
      const verdict = classifyHttpRejection(403, { message });
      expect(verdict.code).not.toBe(REJECTION_CODES.SERVICE_VALIDATION);
    }
    // ...and the control's own target still classifies as validation, so this is not a blanket ban.
    expect(classifyHttpRejection(400, { message: 'chainId mismatch: request=1, local=31337' }).code)
      .toBe(REJECTION_CODES.SERVICE_VALIDATION);
  });

  it('fails on an UNATTRIBUTABLE 403 — default-deny, not default-accept', () => {
    expect(() =>
      assertHttpRejections({ wrongChain: { ok: false, status: 403, body: { message: 'nope' } } }, controls),
    ).toThrow(NegativeControlFailure);
  });

  it('fails on any other unclassifiable 4xx', () => {
    for (const status of [404, 405, 429]) {
      expect(() => assertHttpRejections({ wrongChain: { ok: false, status, body: {} } }, controls))
        .toThrow(/got UNKNOWN/);
    }
  });

  // MEDIUM-1's HTTP half: the right class is not enough, it must be the right RULE.
  it('fails when the service refused for a DIFFERENT validation than the one under test', () => {
    expect(() =>
      assertHttpRejections(
        { wrongChain: { ok: false, status: 400, body: { message: 'duplicate validator slot 2' } } },
        controls,
      ),
    ).toThrow(/not for the reason this control demonstrates/);
  });

  it('fails when a declared control never ran, and when a result has no declaration', () => {
    expect(() => assertHttpRejections({}, controls)).toThrow(/never executed/);
    expect(() =>
      assertHttpRejections({ mystery: { ok: false, status: 400, body: {} } }, controls),
    ).toThrow(/no expectation was declared/);
  });

  // Forward compatibility with the structured error code YAAA has been asked to emit: when the
  // body carries one it is matched EXACTLY and prose is not consulted.
  /**
   * The structured-code contract, as YAAA `e0b5efe` actually ships it. A code names the RULE
   * FAMILY (`REPCREDIT_AGGREGATION_INVALID` covers threshold, duplicate slot AND bad signature),
   * so it narrows the control but does not identify it — the declared prose still has to match.
   */
  const coded = {
    demonstrates: 'chain-id rebinding',
    reason: /chainId mismatch/,
    upstreamCode: 'REPCREDIT_PROPOSAL_INVALID',
  };
  const codedBody = (extra: Record<string, unknown>) => ({
    ok: false as const,
    status: 400,
    body: { errorCodeVersion: 1, category: 'validation', ...extra },
  });

  it('accepts the declared code together with the declared reason', () => {
    expect(() =>
      assertHttpRejections(
        { wrongChain: codedBody({ errorCode: 'REPCREDIT_PROPOSAL_INVALID', message: 'chainId mismatch: request=1' }) },
        { wrongChain: coded },
      ),
    ).not.toThrow();
  });

  it('FAILS on a different code — a different rule fired', () => {
    expect(() =>
      assertHttpRejections(
        { wrongChain: codedBody({ errorCode: 'REPCREDIT_AGGREGATION_INVALID', message: 'chainId mismatch: request=1' }) },
        { wrongChain: coded },
      ),
    ).toThrow(/not the expected REPCREDIT_PROPOSAL_INVALID/);
  });

  it('FAILS when the code matches but the rule inside that family does not', () => {
    // Same family, different rule: exactly the case a code alone cannot distinguish.
    expect(() =>
      assertHttpRejections(
        { wrongChain: codedBody({ errorCode: 'REPCREDIT_PROPOSAL_INVALID', message: 'messageHash does not match' }) },
        { wrongChain: coded },
      ),
    ).toThrow(/not for the reason this control demonstrates/);
  });

  /**
   * CC-50 round-4 LOW-1. Before this, a control that DECLARED a code and got none silently fell
   * back to prose — so "the node stopped emitting structured errors" read as a pass.
   */
  it('REQUIRE MODE: FAILS when a declared code is absent from the response', () => {
    expect(() =>
      assertHttpRejections(
        { wrongChain: { ok: false, status: 400, body: { message: 'chainId mismatch: request=1' } } },
        { wrongChain: coded },
      ),
    ).toThrow(/requires the structured error code REPCREDIT_PROPOSAL_INVALID/);
  });

  describe('the upstream category envelope decides the class', () => {
    const classify = (status: number, body: unknown) => classifyHttpRejection(status, body).code;

    it('maps every category YAAA defines', () => {
      expect(classify(403, { category: 'auth', errorCode: 'REPCREDIT_NOT_ARMED' })).toBe(REJECTION_CODES.GUARD_AUTH);
      expect(classify(403, { category: 'prerequisite', errorCode: 'REPCREDIT_SLOT_NOT_ACTIVE' }))
        .toBe(REJECTION_CODES.SERVICE_PREREQUISITE);
      expect(classify(400, { category: 'validation', errorCode: 'REPCREDIT_PROPOSAL_INVALID' }))
        .toBe(REJECTION_CODES.SERVICE_VALIDATION);
      expect(classify(503, { category: 'infrastructure', errorCode: 'REPCREDIT_RPC_UNAVAILABLE' }))
        .toBe(REJECTION_CODES.INFRASTRUCTURE);
    });

    /**
     * The one place the SDK does NOT defer to the node. `validation` is the only evidence-bearing
     * class, so it is the only one worth mislabelling — and a 403 labelled "validation" is two
     * upstream signals contradicting each other. Default-deny.
     */
    it('refuses a "validation" label on any status other than 400', () => {
      expect(classify(403, { category: 'validation', errorCode: 'REPCREDIT_PROPOSAL_INVALID' }))
        .toBe(REJECTION_CODES.UNKNOWN);
      expect(classify(503, { category: 'validation', errorCode: 'REPCREDIT_PROPOSAL_INVALID' }))
        .toBe(REJECTION_CODES.UNKNOWN);
    });

    it('refuses a category it does not recognise rather than guessing', () => {
      expect(classify(400, { category: 'something-new', errorCode: 'X' })).toBe(REJECTION_CODES.UNKNOWN);
    });

    it('still classifies a body with no envelope, so an older node degrades to a failure not a pass', () => {
      expect(classify(403, { message: 'configured validator slot 2 is not active' }))
        .toBe(REJECTION_CODES.SERVICE_PREREQUISITE);
    });
  });

  it('MUTATION BASELINE: the old "any non-guard 4xx is evidence" rule passed all four false greens', () => {
    // The exact predicate the previous implementation used, kept here so the regression is
    // demonstrated rather than asserted.
    const oldRuleAccepts = (status: number, message: string) =>
      status < 500 && status !== 401 && status !== 413 &&
      !/experiment signing is disabled|server secret is unset|request body exceeds|loopback callers only|missing X-RepCredit|auth timestamp outside|HMAC verification failed|auth token already used|replay cache is full/i.test(message);
    for (const { message } of REVIEWER_FALSE_GREENS) {
      expect(oldRuleAccepts(403, message)).toBe(true);   // the defect
      expect(() => assertHttpRejections({ wrongChain: { ok: false, status: 403, body: { message } } }, controls))
        .toThrow(NegativeControlFailure);                 // the fix
    }
  });
});

describe('errorSelector / revert expectations', () => {
  const abi = [
    { type: 'error', name: 'AggregateCreditUpliftExceeded', inputs: [{ type: 'uint256' }, { type: 'uint256' }] },
    { type: 'error', name: 'SignatureVerificationFailed', inputs: [] },
    {
      type: 'error',
      name: 'WithTuple',
      inputs: [{ type: 'tuple', components: [{ type: 'address' }, { type: 'uint8' }] }],
    },
  ] as unknown as Abi;

  const selectorOf = (signature: string) => keccak256(toHex(signature)).slice(0, 10);

  /**
   * Independent vectors, not recomputed with the same expression the implementation uses:
   * `Unauthorized()` and OpenZeppelin v5's `OwnableUnauthorizedAccount(address)` have published
   * selectors, so these prove the derivation itself rather than its self-consistency.
   */
  it('matches published selectors (golden vectors)', () => {
    const golden = [
      { type: 'error', name: 'Unauthorized', inputs: [] },
      { type: 'error', name: 'OwnableUnauthorizedAccount', inputs: [{ type: 'address' }] },
    ] as unknown as Abi;
    expect(errorSelector(golden, 'Unauthorized')).toBe('0x82b42900');
    expect(errorSelector(golden, 'OwnableUnauthorizedAccount')).toBe('0x118cdaa7');
  });

  it('derives the selector from the ABI, expanding tuples', () => {
    expect(errorSelector(abi, 'AggregateCreditUpliftExceeded')).toBe(selectorOf('AggregateCreditUpliftExceeded(uint256,uint256)'));
    expect(errorSelector(abi, 'SignatureVerificationFailed')).toBe(selectorOf('SignatureVerificationFailed()'));
    expect(errorSelector(abi, 'WithTuple')).toBe(selectorOf('WithTuple((address,uint8))'));
  });

  // The stale-ABI tripwire: CC-50 B2 is open, so this is the state the runner must fail loudly in.
  it('throws when the vendored ABI no longer declares the error', () => {
    expect(() => errorSelector(abi, 'SomeErrorTheUpstreamRenamed')).toThrow(/does not declare error/);
  });

  const upliftSelector = selectorOf('AggregateCreditUpliftExceeded(uint256,uint256)');
  const expectation = { describe: 'Registry.AggregateCreditUpliftExceeded', selectors: [upliftSelector as `0x${string}`] };
  const revertWith = (data: string) => Object.assign(new Error('execution reverted'), { data });

  it('accepts the declared selector', async () => {
    await expect(
      expectCallRejected('uplift cap', async () => { throw revertWith(`${upliftSelector}${'00'.repeat(64)}`); }, sanitize, {
        revert: expectation,
      }),
    ).resolves.toContain('execution reverted');
  });

  it('FAILS when a different rule reverted — "any revert" is not evidence', async () => {
    await expect(
      expectCallRejected('uplift cap', async () => { throw revertWith(`${selectorOf('Unauthorized()')}`); }, sanitize, {
        revert: expectation,
      }),
    ).rejects.toThrow(/only demonstrates its security property/);
  });

  it('FAILS when no revert data can be extracted at all', async () => {
    await expect(
      expectCallRejected('uplift cap', async () => { throw new Error('execution reverted'); }, sanitize, {
        revert: expectation,
      }),
    ).rejects.toThrow(/no revert data could be extracted/);
  });

  it('FAILS on an undecodable revert (stale ABI shape)', async () => {
    await expect(
      expectCallRejected(
        'uplift cap',
        async () => { throw new Error('The contract function reverted with an unknown signature 0xdeadbeef'); },
        sanitize,
        { revert: expectation },
      ),
    ).rejects.toThrow(/could not decode|only demonstrates/);
  });

  it('requires the INNER selector when the revert is wrapped', async () => {
    const wrapper = selectorOf('ProposalExecutionFailed(uint256,bytes)') as `0x${string}`;
    const wrapped = {
      describe: 'ProposalExecutionFailed(AggregateCreditUpliftExceeded)',
      selectors: [wrapper],
      innerSelectors: [upliftSelector as `0x${string}`],
    };
    await expect(
      expectCallRejected('uplift cap', async () => { throw revertWith(`${wrapper}${upliftSelector.slice(2)}`); }, sanitize, { revert: wrapped }),
    ).resolves.toBeTruthy();
    await expect(
      expectCallRejected('uplift cap', async () => { throw revertWith(`${wrapper}${'ab'.repeat(32)}`); }, sanitize, { revert: wrapped }),
    ).rejects.toThrow(/inner selectors/);
  });

  it('applies the same rule to a view that reverts', async () => {
    await expect(
      expectViewRejected('post-slash liveness', async () => { throw revertWith(selectorOf('Unauthorized()')); }, sanitize, {
        revert: expectation,
      }),
    ).rejects.toThrow(NegativeControlFailure);
    // Returning false is still the primary accepted outcome and is not affected by the matcher.
    await expect(expectViewRejected('post-slash liveness', async () => false, sanitize, { revert: expectation }))
      .resolves.toMatchObject({ outcome: 'returned-false' });
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
