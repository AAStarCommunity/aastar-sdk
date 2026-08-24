/**
 * Negative-control assertions for the RepCredit evidence runner (CC-50 H1).
 *
 * THE BUG THIS EXISTS TO PREVENT
 * ------------------------------
 * The original runner wrote every "this attack must be rejected" control like this:
 *
 *     try {
 *       await publicClient.call(attack);
 *       throw new Error("attack unexpectedly succeeded");   // <-- sentinel INSIDE the try
 *     } catch (error) {
 *       recorded = sanitizeError(error);                    // <-- swallows its own sentinel
 *     }
 *
 * If the attack succeeded, the sentinel throw was caught by its own catch, stringified, and
 * written into the evidence file as if it were the rejection reason. The run still reported
 * `status: "passed"`. The control could not fail — it verified nothing.
 *
 * Every helper here keeps the verdict OUTSIDE the try block, so the only thing the catch can ever
 * see is the failure of the call under test. `negative-control.test.ts` proves each one fails when
 * the security property it guards is broken.
 */

/** Thrown when a negative control does not hold. Distinct type so the runner cannot mistake it for a transport error. */
export class NegativeControlFailure extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NegativeControlFailure';
  }
}

/**
 * Failure classes that mean "the call died for an unrelated reason", NOT "the contract enforced
 * the rule". Accepting these would let a broken RPC, a gas misconfiguration or a dead node make
 * every negative control pass — the M4 "judgement too broad" problem, one layer down.
 */
const NON_SECURITY_FAILURES: { pattern: RegExp; why: string }[] = [
  { pattern: /out of gas|OutOfGas|intrinsic gas too low|gas required exceeds/i, why: 'ran out of gas' },
  { pattern: /ECONNREFUSED|ECONNRESET|ETIMEDOUT|fetch failed|socket hang up/i, why: 'transport error' },
  { pattern: /nonce too low|nonce too high|replacement transaction underpriced/i, why: 'nonce problem' },
  { pattern: /timeout|timed out/i, why: 'timed out' },
];

function assertSecurityRejection(label: string, reason: string): void {
  if (!reason.trim()) {
    throw new NegativeControlFailure(`${label}: rejected with an empty reason — cannot be used as evidence`);
  }
  for (const { pattern, why } of NON_SECURITY_FAILURES) {
    if (pattern.test(reason)) {
      throw new NegativeControlFailure(
        `${label}: the call failed because it ${why}, not because the contract rejected it — ` +
          `this proves nothing about the security property. Reason: ${reason}`,
      );
    }
  }
}

export type RejectionOptions = {
  /**
   * Pattern the sanitized rejection reason must match. Use it where the expected revert reason /
   * custom-error name is known, so a *different* revert cannot silently stand in for the one the
   * control is supposed to demonstrate.
   */
  reasonMatches?: RegExp;
};

/**
 * Assert that `call` is REJECTED (reverts / throws), and return the sanitized reason for evidence.
 *
 * The success flag is set as the last statement in the try and inspected after it, so a call that
 * unexpectedly succeeds can never be absorbed by the catch.
 */
export async function expectCallRejected(
  label: string,
  call: () => Promise<unknown>,
  sanitize: (error: unknown) => string,
  options: RejectionOptions = {},
): Promise<string> {
  let succeeded = false;
  let reason = '';
  try {
    await call();
    succeeded = true;
  } catch (error) {
    reason = sanitize(error);
  }
  if (succeeded) {
    throw new NegativeControlFailure(`${label}: expected rejection, but the call SUCCEEDED`);
  }
  assertSecurityRejection(label, reason);
  if (options.reasonMatches && !options.reasonMatches.test(reason)) {
    throw new NegativeControlFailure(
      `${label}: rejected, but not with the expected reason ${options.reasonMatches} — got: ${reason}`,
    );
  }
  return reason;
}

/** Render an on-chain return value for an error message. Plain JSON.stringify throws on bigint. */
function describeValue(value: unknown): string {
  if (typeof value === 'bigint') return `${value}n`;
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

export type ViewRejection = {
  /** How the view refused: it reverted, or it returned the falsy value the caller demanded. */
  outcome: 'reverted' | 'returned-false';
  reason: string;
};

/**
 * Assert that a VIEW function refuses — either by reverting, or by returning `false`.
 *
 * This is the case `expectCallRejected` cannot cover: `BLSAggregator.verify(...)` returns a bool,
 * so a slashed guardian set that remains BLS-eligible returns `true` and never throws. The
 * original control read that view inside a try/catch, so `true` walked straight past it.
 */
export async function expectViewRejected(
  label: string,
  read: () => Promise<unknown>,
  sanitize: (error: unknown) => string,
): Promise<ViewRejection> {
  let returned: unknown;
  let didReturn = false;
  let reason = '';
  try {
    returned = await read();
    didReturn = true;
  } catch (error) {
    reason = sanitize(error);
  }
  if (!didReturn) {
    assertSecurityRejection(label, reason);
    return { outcome: 'reverted', reason };
  }
  if (returned === false) {
    return { outcome: 'returned-false', reason: `${label}: view returned false` };
  }
  throw new NegativeControlFailure(
    `${label}: expected the view to revert or return false, but it returned ${describeValue(returned)}`,
  );
}

/**
 * Rejections produced by the YAAA admission GUARD (`RepCreditExperimentGuard`, CC-49
 * BLOCKER-1) rather than by the RepCredit service's own validation.
 *
 * This distinction became load-bearing the moment the endpoints grew mandatory HMAC auth: a
 * malformed-auth request is refused with 401/403 — also a 4xx — *before the service ever sees
 * the proposal*. A negative control that accidentally sends unauthenticated (or replayed)
 * requests would then "pass" every case while proving nothing about chain-id binding, message
 * rebinding, threshold or signature validation. A guard rejection is a BROKEN CONTROL, not
 * evidence.
 */
const GUARD_REJECTIONS: { pattern: RegExp; why: string }[] = [
  { pattern: /experiment signing is disabled/i, why: 'the node is not armed' },
  { pattern: /server secret is unset/i, why: 'the node is armed without a secret' },
  { pattern: /request body exceeds/i, why: 'the request exceeded the guard body limit' },
  { pattern: /loopback callers only/i, why: 'the guard refused a non-loopback source' },
  { pattern: /missing X-RepCredit/i, why: 'the request carried no auth headers' },
  { pattern: /auth timestamp outside/i, why: 'the auth timestamp was outside the window' },
  { pattern: /HMAC verification failed/i, why: 'the HMAC did not verify' },
  { pattern: /auth token already used/i, why: 'the auth token was replayed' },
  { pattern: /replay cache is full/i, why: 'the guard replay cache is full' },
];

function extractMessage(body: unknown): string {
  if (typeof body === 'string') return body;
  if (body && typeof body === 'object' && 'message' in body) {
    const message = (body as { message: unknown }).message;
    return Array.isArray(message) ? message.join('; ') : String(message ?? '');
  }
  return '';
}

/** Why this rejection came from the admission guard rather than from RepCredit validation, or null. */
function guardRejectionReason(status: number, body: unknown): string | null {
  // 401 is only ever produced by the guard: the RepCredit service rejects with 400/403.
  if (status === 401) return 'the guard rejected it before the service saw it (HTTP 401)';
  if (status === 413) return 'the guard rejected the request body size (HTTP 413)';
  const message = extractMessage(body);
  for (const { pattern, why } of GUARD_REJECTIONS) {
    if (pattern.test(message)) return why;
  }
  return null;
}

/**
 * Assert that a set of HTTP responses were ALL refused by the node's RepCredit VALIDATION.
 *
 * Three ways this check can be too weak, all closed here:
 *   - `!response.ok` alone: a node that 500s on everything makes every control "pass", so a
 *     refusal must be a client-side rejection (4xx);
 *   - a 5xx means the node broke, which is not evidence that it validated anything;
 *   - a guard/auth rejection never reaches the service, so it proves nothing about the
 *     property under test (see GUARD_REJECTIONS).
 */
export function assertHttpRejections(
  results: Record<string, { ok: boolean; status: number; body?: unknown }>,
): void {
  for (const [label, result] of Object.entries(results)) {
    if (result.ok) {
      throw new NegativeControlFailure(`${label}: node ACCEPTED the invalid request (HTTP ${result.status})`);
    }
    if (result.status >= 500) {
      throw new NegativeControlFailure(
        `${label}: node returned HTTP ${result.status} — a server fault is not proof that the request was validated`,
      );
    }
    const guardReason = guardRejectionReason(result.status, result.body);
    if (guardReason) {
      throw new NegativeControlFailure(
        `${label}: the request was refused by the experiment admission guard because ${guardReason} — ` +
          `the RepCredit service never validated it, so this control proves nothing. Re-send the ` +
          `control with valid per-node HMAC auth (scripts/repcredit/experiment-auth.ts).`,
      );
    }
  }
}

/**
 * Assert a reverted receipt reverted for a *rule*, not because it burned every unit of gas.
 * An out-of-gas transaction also lands as `status: "reverted"`, so status alone is not evidence.
 */
export function assertRevertedNotOutOfGas(
  label: string,
  receipt: { status: string; gasUsed: bigint },
  gasLimit: bigint,
): void {
  if (receipt.status !== 'reverted') {
    throw new NegativeControlFailure(`${label}: expected a reverted receipt, got status "${receipt.status}"`);
  }
  // A rule-based revert refunds the unused gas; an OOG consumes essentially the whole limit.
  if (gasLimit > 0n && receipt.gasUsed * 100n >= gasLimit * 99n) {
    throw new NegativeControlFailure(
      `${label}: transaction consumed ${receipt.gasUsed}/${gasLimit} gas — that is an out-of-gas failure, ` +
        `not a contract-enforced rejection`,
    );
  }
}
