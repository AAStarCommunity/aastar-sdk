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

import { keccak256, toHex } from 'viem';
import type { Abi } from 'viem';

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
  // A revert whose selector the vendored ABI cannot decode proves nothing: while CC-50 B2 is open
  // the SDK's Registry/BLSAggregator copies are known-stale, so "reverted with an unknown error"
  // is exactly the shape a STALE-ABI encoding bug takes. It must never read as "the rule fired".
  {
    pattern: /unable to decode signature|does not match any error|unknown (custom )?error|invalid opcode|reverted with an unknown/i,
    why: 'reverted with an error the ABI could not decode',
  },
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

export type Hex = `0x${string}`;

/**
 * The exact revert a control is allowed to be satisfied by, expressed as 4-byte selectors that
 * are DERIVED FROM THE VENDORED ABI (see {@link errorSelector}) rather than hand-typed.
 *
 * Why selectors and not prose: `publicClient.call` has no ABI, so viem cannot name the custom
 * error — the message is just "execution reverted" plus raw data. Matching prose there is either
 * vacuous or matches the wrong revert. Deriving the selector from the ABI also means that when
 * CC-50 B2 finally lands and the upstream renames/removes the error, `errorSelector` throws at
 * startup instead of the control quietly accepting some other revert.
 */
export type RevertExpectation = {
  /** Human description of the accepted revert, used in failure messages. */
  describe: string;
  /** The revert data must START with one of these selectors. */
  selectors: readonly Hex[];
  /**
   * For wrapper errors (e.g. `BLSAggregator.ProposalExecutionFailed(uint256,bytes)`), one of these
   * selectors must ALSO appear inside the returned data — otherwise the wrapper would accept any
   * inner failure at all.
   */
  innerSelectors?: readonly Hex[];
};

export type RejectionOptions = {
  /**
   * Pattern the sanitized rejection reason must match. Use it where the expected revert reason /
   * custom-error name is known, so a *different* revert cannot silently stand in for the one the
   * control is supposed to demonstrate.
   */
  reasonMatches?: RegExp;
  /** Selector-level expectation. Any other revert — including an undecodable one — fails. */
  revert?: RevertExpectation;
};

/** Solidity type of one ABI parameter, with tuples expanded — needed to rebuild an error signature. */
function abiParamType(param: { type: string; components?: readonly any[] }): string {
  if (param.type.startsWith('tuple')) {
    const inner = (param.components ?? []).map(abiParamType).join(',');
    return `(${inner})${param.type.slice('tuple'.length)}`;
  }
  return param.type;
}

/**
 * 4-byte selector of a custom error, read out of the ABI the runner actually encodes with.
 *
 * Throws when the ABI does not declare the error. That is deliberate and load-bearing: it is how
 * a stale vendored ABI (CC-50 B2) turns into a loud startup failure rather than a negative
 * control that silently accepts the wrong revert.
 */
export function errorSelector(abi: Abi, name: string): Hex {
  const entry = abi.find((item: any) => item.type === 'error' && item.name === name) as
    | { name: string; inputs?: readonly any[] }
    | undefined;
  if (!entry) {
    throw new NegativeControlFailure(
      `the vendored ABI does not declare error ${name}() — the negative control that expects it ` +
        `cannot be evaluated. Re-sync the ABI (CC-50 B2) before trusting this run.`,
    );
  }
  const signature = `${name}(${(entry.inputs ?? []).map(abiParamType).join(',')})`;
  return keccak256(toHex(signature)).slice(0, 10) as Hex;
}

/**
 * Whole bytes, at least a 4-byte selector. Revert data is ALWAYS a whole number of bytes; a
 * value with an odd nibble count is a message fragment, not ABI-encoded return data.
 */
const REVERT_BYTES = /^0x([0-9a-fA-F]{2})+$/;

function revertBytes(value: unknown): Hex | null {
  if (typeof value !== 'string' || !REVERT_BYTES.test(value) || value.length < 10) return null;
  return value.toLowerCase() as Hex;
}

/** `error.cause` chain, outermost first. Equivalent to viem's `BaseError.walk()` traversal. */
function causeChain(error: unknown): Record<string, unknown>[] {
  const chain: Record<string, unknown>[] = [];
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current);
    chain.push(current as Record<string, unknown>);
    current = (current as Record<string, unknown>).cause;
  }
  return chain;
}

/**
 * Raw revert data out of a REAL viem error graph — structured fields only.
 *
 * THE BUG THIS EXISTS TO PREVENT (CC-50 round-4 HIGH-1)
 * ----------------------------------------------------
 * The previous version breadth-searched every `data`/`message`/`shortMessage`/`metaMessages`
 * field and, failing that, scraped the first `0x…` run out of any string it had collected. On
 * `publicClient.call` (no ABI) that happened to work. On `publicClient.readContract` (ABI) it
 * silently returned the WRONG BYTES, because viem's ABI-aware error graph is shaped differently:
 *
 *   ContractFunctionExecutionError.message   contains "Contract Call:\n  address: 0x…"  ← the
 *                                            CONTRACT ADDRESS, 20 clean bytes, scraped first
 *   ContractFunctionRevertedError.data       is the DECODED {abiItem, errorName, args} object,
 *                                            not hex — so the structured branch never matched
 *   ContractFunctionRevertedError.metaMessages contains the formatted decoded ARGS ("0x1111…")
 *   ContractFunctionRevertedError.raw        ← the actual revert bytes, never read
 *
 * Measured on real anvil + viem 2.43.3, a `KeyNotActive(address)` revert produced the contract
 * address (undecodable case) or the decoded argument (decodable case) instead of the selector.
 * The post-slash BLS liveness control therefore saw selector `0x00000000` and could only ever be
 * satisfied by its OTHER branch (`verify` returning false) — a control with an unreachable path,
 * the same defect class as the sentinel-inside-try bug this module exists to kill.
 *
 * So: NO string scraping, at all. Only fields whose contract is "these are the bytes the contract
 * returned" are read. An address, a decoded argument or a transaction's calldata can never be
 * mistaken for revert data because those fields are never consulted. When nothing structured is
 * available the answer is `null`, which fails the control loudly — never a wrong-but-plausible
 * selector, never a false pass.
 */
export function extractRevertData(error: unknown): Hex | null {
  const chain = causeChain(error);

  // 1. ABI-aware path (readContract / simulateContract / writeContract). viem sets `raw` to the
  //    exact bytes the contract returned, whether or not its ABI could decode them.
  for (const node of chain) {
    if (node.name !== 'ContractFunctionRevertedError') continue;
    const raw = revertBytes(node.raw);
    if (raw) return raw;
    // `signature` is viem's own 4-byte selector for a revert its ABI could NOT decode. It is a
    // structured field (AbiErrorSignatureNotFoundError.signature), not scraped prose.
    const signature = revertBytes(node.signature);
    if (signature) return signature;
    // The ABI-aware node exists but carries no bytes ⇒ the revert genuinely had empty data.
    // Stop here rather than falling through to a sibling field that means something else.
    return null;
  }

  // 2. No ABI on the path (`publicClient.call`, estimateGas, raw RPC). Mirrors viem's own
  //    `getRevertErrorData()`: the bytes sit on a cause as `data`, either hex or `{ data: hex }`.
  for (const node of chain) {
    const direct = revertBytes(node.data);
    if (direct) return direct;
    const nested = node.data;
    if (nested && typeof nested === 'object') {
      const inner = revertBytes((nested as Record<string, unknown>).data);
      if (inner) return inner;
    }
  }

  return null;
}

function assertRevertMatches(label: string, error: unknown, reason: string, expectation: RevertExpectation): void {
  const data = extractRevertData(error);
  if (!data) {
    throw new NegativeControlFailure(
      `${label}: expected ${expectation.describe}, but no revert data could be extracted from the ` +
        `failure — an undecodable rejection is not evidence. Reason: ${reason}`,
    );
  }
  const selector = data.slice(0, 10) as Hex;
  if (!expectation.selectors.includes(selector)) {
    throw new NegativeControlFailure(
      `${label}: reverted with selector ${selector}, but this control only demonstrates its ` +
        `security property when it reverts with ${expectation.describe} ` +
        `(${expectation.selectors.join(', ')}). A different revert — including one produced by a ` +
        `stale ABI encoding — proves nothing. Reason: ${reason}`,
    );
  }
  if (expectation.innerSelectors?.length) {
    const body = data.slice(10);
    const found = expectation.innerSelectors.some(inner => body.includes(inner.slice(2)));
    if (!found) {
      throw new NegativeControlFailure(
        `${label}: reverted with the expected wrapper ${selector}, but none of the required inner ` +
          `selectors (${expectation.innerSelectors.join(', ')}) appear in its return data — the ` +
          `wrapper alone does not identify which rule fired. Reason: ${reason}`,
      );
    }
  }
}

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
  let raw: unknown;
  try {
    await call();
    succeeded = true;
  } catch (error) {
    raw = error;
    reason = sanitize(error);
  }
  if (succeeded) {
    throw new NegativeControlFailure(`${label}: expected rejection, but the call SUCCEEDED`);
  }
  assertSecurityRejection(label, reason);
  if (options.revert) assertRevertMatches(label, raw, reason, options.revert);
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
  options: RejectionOptions = {},
): Promise<ViewRejection> {
  let returned: unknown;
  let didReturn = false;
  let reason = '';
  let raw: unknown;
  try {
    returned = await read();
    didReturn = true;
  } catch (error) {
    raw = error;
    reason = sanitize(error);
  }
  if (!didReturn) {
    assertSecurityRejection(label, reason);
    // A revert is only accepted when it is one the control declared: a view that reverts for an
    // unrelated reason (stale ABI, wrong args, dead node) is not proof that the key was ejected.
    if (options.revert) assertRevertMatches(label, raw, reason, options.revert);
    if (options.reasonMatches && !options.reasonMatches.test(reason)) {
      throw new NegativeControlFailure(
        `${label}: reverted, but not with the expected reason ${options.reasonMatches} — got: ${reason}`,
      );
    }
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
 * TAXONOMY OF WHY A `/repcredit/*` REQUEST WAS REFUSED (CC-50 round-3 HIGH).
 * ------------------------------------------------------------------------
 * A negative control is only evidence when the RepCredit service refused the request BECAUSE IT
 * VALIDATED IT. Everything else — the admission guard, the node's own prerequisites, a flaky RPC
 * read inside the node, a server fault — is a BROKEN CONTROL, and must fail the run.
 *
 * The previous rule ("any non-guard 4xx counts") was too weak in a way an independent reviewer
 * reproduced with a probe: YAAA's service raises `ForbiddenException` (403) BEFORE it looks at a
 * single caller field, for at least four reasons, two of which are per-request and transient:
 *
 *   - `cannot read the audit aggregator at <addr>`                     ← transient RPC
 *   - `could not determine whether the local BLS key is active at ...` ← transient RPC
 *   - `AUDIT_BLS_AGGREGATOR_ADDRESS is required when armed`            ← not armed for isolation
 *   - `configured validator slot N is not active`                      ← slot not active
 *
 * On Sepolia, five controls fired at a moment of RPC turbulence would all have come back 403 and
 * been written into the evidence as "chain-id binding / message rebinding / threshold / duplicate
 * slot / bad signature all verified" — while the service looked at nothing.
 *
 * The rule is now POSITIVE and default-deny:
 *   1. every control declares the outcome it must produce;
 *   2. every response is classified into this stable taxonomy;
 *   3. only the declared code + declared reason passes. Anything unclassifiable is `UNKNOWN`,
 *      and `UNKNOWN` fails.
 *
 * The structural half of the classification is the HTTP status, which YAAA assigns by exception
 * type and is far more stable than prose: the RepCredit service reports its own validation
 * failures as `BadRequestException` (400); every prerequisite/admission refusal it raises is a
 * `ForbiddenException` (403); the guard answers 401/403/413/503. So "403 is never evidence" holds
 * structurally, independent of message wording.
 *
 * The prose patterns below only ever make a failure message more specific — they can never
 * promote a response into the evidence-bearing class. That is why message drift upstream degrades
 * to `UNKNOWN` (a failure), not to a false pass. `upstreamCode` is wired for the structured error
 * code YAAA has been asked to emit (CC-50 -> repo:dvt); when the body carries one it is matched
 * exactly and prose is not consulted at all.
 */
export const REJECTION_CODES = {
  /** The node ACCEPTED the invalid request. */
  ACCEPTED: 'ACCEPTED',
  /** The RepCredit service validated the proposal and refused it. The ONLY evidence-bearing class. */
  SERVICE_VALIDATION: 'SERVICE_VALIDATION',
  /** `RepCreditExperimentGuard`: unsigned / bad HMAC / stale ts / replay / body limit / not loopback. */
  GUARD_AUTH: 'GUARD_AUTH',
  /** The service refused before validating: not armed, isolation unconfigured, slot inactive. */
  SERVICE_PREREQUISITE: 'SERVICE_PREREQUISITE',
  /** The service could not complete an on-chain read and fail-closed. Says nothing about the proposal. */
  INFRASTRUCTURE: 'INFRASTRUCTURE',
  /** 5xx — the node broke. */
  SERVER_FAULT: 'SERVER_FAULT',
  /** Anything we cannot attribute. Default-deny: an unattributable rejection is never evidence. */
  UNKNOWN: 'UNKNOWN',
} as const;

export type RejectionCode = (typeof REJECTION_CODES)[keyof typeof REJECTION_CODES];

/** Guard-produced refusals (CC-49 BLOCKER-1). Never reach the service, so never evidence. */
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
  { pattern: /must be "?RepCredit-HMAC/i, why: 'the auth scheme header was missing or wrong' },
];

/**
 * Service refusals raised BEFORE any caller field is inspected. Split from INFRASTRUCTURE only so
 * the failure message names the right thing to fix — both classes fail the control.
 */
const PREREQUISITE_REJECTIONS: { pattern: RegExp; why: string }[] = [
  { pattern: /AUDIT_BLS_AGGREGATOR_ADDRESS is required when armed/i, why: 'the node is not configured for audit isolation' },
  { pattern: /is not active|is not registered at validator slot/i, why: 'the configured validator slot is not active on-chain' },
  { pattern: /REPCREDIT_VALIDATOR_SLOT must be in/i, why: 'the node has an out-of-range validator slot' },
  { pattern: /local BLS public key is malformed/i, why: 'the node has no usable local BLS key' },
  { pattern: /experiment key|byte-valid production slash/i, why: 'the node refused to reuse a production-registered key' },
  { pattern: /does not (expose|implement).*interface|interface on this chain/i, why: 'the audit aggregator address does not answer the expected interface' },
  { pattern: /BLS signer did not return compact signature material/i, why: 'the local BLS signer failed' },
];

/** Fail-closed refusals caused by an on-chain READ failing inside the node. Transient, per request. */
const INFRASTRUCTURE_REJECTIONS: { pattern: RegExp; why: string }[] = [
  { pattern: /cannot read the audit aggregator/i, why: 'the node could not read the audit aggregator (RPC)' },
  { pattern: /could not determine whether the local BLS key is active/i, why: 'the node could not resolve the audit-slot scan (RPC)' },
  { pattern: /refusing to sign without a verifiable production aggregator/i, why: 'the node could not verify the audit aggregator (RPC)' },
];

function extractMessage(body: unknown): string {
  if (typeof body === 'string') return body;
  if (body && typeof body === 'object' && 'message' in body) {
    const message = (body as { message: unknown }).message;
    return Array.isArray(message) ? message.join('; ') : String(message ?? '');
  }
  return '';
}

/** Structured error code, if the node emits one. Preferred over prose when present. */
function extractUpstreamCode(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  for (const key of ['errorCode', 'code', 'repcreditErrorCode']) {
    const value = (body as Record<string, unknown>)[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

/**
 * The node's own coarse classification (`auth` | `prerequisite` | `validation` | `infrastructure`),
 * shipped in the versioned envelope from YAAA `e0b5efe` (`src/common/error-codes.ts`).
 *
 * This is the signal that finally makes the taxonomy an INTERFACE rather than an inference.
 * Upstream's contract: codes are append-only, `category` is exhaustive and never changes meaning,
 * and HTTP status never contradicts the category. So when a category is present it decides the
 * class — with one deliberate exception, see `classifyHttpRejection`.
 */
const UPSTREAM_CATEGORY_TO_CODE: Record<string, RejectionCode> = {
  auth: 'GUARD_AUTH',
  prerequisite: 'SERVICE_PREREQUISITE',
  validation: 'SERVICE_VALIDATION',
  infrastructure: 'INFRASTRUCTURE',
};

function extractUpstreamCategory(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const value = (body as Record<string, unknown>).category;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export type Classification = {
  code: RejectionCode;
  /** Human explanation used in failure messages. */
  detail: string;
  /** Structured code the node returned, when it returned one. */
  upstreamCode: string | null;
  /** The node's own category, when it returned one. */
  upstreamCategory: string | null;
  message: string;
};

/**
 * Classify one `/repcredit/*` response. Structural first (status), prose only to explain.
 * Unrecognised shapes land in `UNKNOWN`, which callers must treat as a failure.
 */
export function classifyHttpRejection(status: number, body: unknown): Classification {
  const message = extractMessage(body);
  const upstreamCode = extractUpstreamCode(body);
  const upstreamCategory = extractUpstreamCategory(body);
  const of = (code: RejectionCode, detail: string): Classification =>
    ({ code, detail, upstreamCode, upstreamCategory, message });

  if (status >= 200 && status < 300) return of(REJECTION_CODES.ACCEPTED, `the node accepted the request (HTTP ${status})`);

  // Structured envelope present: the node states its own category, so stop inferring one.
  if (upstreamCategory !== null) {
    const mapped = UPSTREAM_CATEGORY_TO_CODE[upstreamCategory];
    if (!mapped) {
      return of(REJECTION_CODES.UNKNOWN, `the node returned an unrecognised category "${upstreamCategory}" (HTTP ${status})`);
    }
    // THE ONE PLACE WE DO NOT DEFER. `validation` is the only evidence-bearing class, so it is
    // also the only one worth mislabelling. The service raises its own validation failures as
    // BadRequestException; every admission/prerequisite refusal is 401/403/413 and every
    // dependency failure is 5xx. A "validation" label on any other status is a contradiction
    // between two upstream signals — default-deny rather than believe the convenient one.
    if (mapped === REJECTION_CODES.SERVICE_VALIDATION && status !== 400) {
      return of(
        REJECTION_CODES.UNKNOWN,
        `the node labelled this category="validation" but answered HTTP ${status}; only the service's ` +
          `own HTTP 400 is evidence-bearing (errorCode=${upstreamCode ?? 'none'})`,
      );
    }
    return of(mapped, `the node reported category="${upstreamCategory}" errorCode=${upstreamCode ?? 'none'} (HTTP ${status})`);
  }

  if (status >= 500) {
    return of(REJECTION_CODES.SERVER_FAULT, `the node returned HTTP ${status}; a server fault is not proof of validation`);
  }
  // 401/413 are guard-only; 503 is the guard's "armed without a secret"/"replay cache full" and is
  // caught by the 5xx branch above with an equally fatal verdict.
  if (status === 401) return of(REJECTION_CODES.GUARD_AUTH, 'the admission guard rejected it before the service saw it (HTTP 401)');
  if (status === 413) return of(REJECTION_CODES.GUARD_AUTH, 'the admission guard rejected the request body size (HTTP 413)');

  for (const { pattern, why } of GUARD_REJECTIONS) {
    if (pattern.test(message)) return of(REJECTION_CODES.GUARD_AUTH, why);
  }
  for (const { pattern, why } of INFRASTRUCTURE_REJECTIONS) {
    if (pattern.test(message)) return of(REJECTION_CODES.INFRASTRUCTURE, why);
  }
  for (const { pattern, why } of PREREQUISITE_REJECTIONS) {
    if (pattern.test(message)) return of(REJECTION_CODES.SERVICE_PREREQUISITE, why);
  }
  // 403 that we could not attribute: the RepCredit service raises ForbiddenException only for
  // prerequisites/isolation, never for proposal validation, so an unrecognised 403 is a node-side
  // refusal of unknown origin — never evidence.
  if (status === 403) {
    return of(
      REJECTION_CODES.SERVICE_PREREQUISITE,
      'HTTP 403 — the RepCredit service only answers 403 for admission/prerequisite failures, never for proposal validation',
    );
  }
  if (status === 400) return of(REJECTION_CODES.SERVICE_VALIDATION, 'the RepCredit service validated the request and refused it (HTTP 400)');
  return of(REJECTION_CODES.UNKNOWN, `unattributable HTTP ${status}`);
}

/**
 * What one HTTP negative control must produce to count as evidence.
 *
 * `reason` is required: the reviewer's MEDIUM-1 was that a control which accepts "any rejection"
 * cannot tell the rule it is testing from a different rule firing first.
 */
export type HttpControlExpectation = {
  /** What this control demonstrates, for the failure message. */
  demonstrates: string;
  /** The message the service's own validation must produce. */
  reason: RegExp;
  /** Structured code to require once YAAA emits one; matched exactly, in preference to `reason`. */
  upstreamCode?: string;
  /** Override for a control that legitimately targets something other than service validation. */
  code?: RejectionCode;
};

export type HttpResult = { ok: boolean; status: number; body?: unknown };

/**
 * Assert every HTTP negative control was refused by the RepCredit service's own validation, for
 * the specific reason that control exists to demonstrate.
 *
 * Default-deny in three directions: an undeclared result fails, a declared control with no result
 * fails, and any classification other than the declared one fails.
 */
export function assertHttpRejections(
  results: Record<string, HttpResult>,
  expectations: Record<string, HttpControlExpectation>,
): void {
  for (const label of Object.keys(results)) {
    if (!expectations[label]) {
      throw new NegativeControlFailure(
        `${label}: no expectation was declared for this negative control — an unclassified control ` +
          `cannot be evidence. Declare its target rejection alongside the others.`,
      );
    }
  }
  for (const [label, expectation] of Object.entries(expectations)) {
    const result = results[label];
    if (!result) {
      throw new NegativeControlFailure(`${label}: declared as a negative control but never executed`);
    }
    const wanted = expectation.code ?? REJECTION_CODES.SERVICE_VALIDATION;
    const verdict = classifyHttpRejection(result.status, result.body);
    if (verdict.code !== wanted) {
      throw new NegativeControlFailure(
        `${label}: expected ${wanted} (${expectation.demonstrates}) but got ${verdict.code} — ` +
          `${verdict.detail}. This control did NOT demonstrate ${expectation.demonstrates}; the ` +
          `run must fail rather than record it as evidence. Node said: ${verdict.message || '(no message)'}`,
      );
    }
    if (expectation.upstreamCode) {
      // REQUIRE MODE (CC-50 round-4 LOW-1). Declaring a code means the code is the contract. The
      // previous `&& verdict.upstreamCode` silently degraded to prose matching when the node sent
      // no code — so "the node stopped emitting structured errors" read as a pass, which is the
      // same class of soft failure the whole taxonomy exists to remove.
      if (!verdict.upstreamCode) {
        throw new NegativeControlFailure(
          `${label}: this control requires the structured error code ${expectation.upstreamCode}, but the ` +
            `node returned no errorCode at all (HTTP ${result.status}). Falling back to prose here would ` +
            `make the control depend on wording again. Node said: ${verdict.message || '(no message)'}`,
        );
      }
      if (verdict.upstreamCode !== expectation.upstreamCode) {
        throw new NegativeControlFailure(
          `${label}: the node returned error code ${verdict.upstreamCode}, not the expected ` +
            `${expectation.upstreamCode} — a different rule fired than the one under test.`,
        );
      }
      // The code identifies the RULE; the prose still has to name the same thing, so a code that
      // covers several rules (REPCREDIT_AGGREGATION_INVALID covers five) cannot stand in for them.
    }
    if (!expectation.reason.test(verdict.message)) {
      throw new NegativeControlFailure(
        `${label}: the service rejected it, but not for the reason this control demonstrates ` +
          `(${expectation.demonstrates}, expected ${expectation.reason}). A different validation ` +
          `firing first proves nothing about this property. Node said: ${verdict.message || '(no message)'}`,
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
