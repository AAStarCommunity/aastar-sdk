/**
 * Client half of the YAAA RepCredit experiment-endpoint admission gate (CC-49 BLOCKER-1).
 *
 * WHAT CHANGED UPSTREAM
 * ---------------------
 * YetAnotherAA-Validator 840bfdc put `RepCreditExperimentGuard` in front of every
 * `/repcredit/*` endpoint. The gate is mandatory and fail-closed, so the previous
 * "POST plain JSON" orchestration no longer works at all:
 *
 *   0. scheme       X-RepCredit-Scheme must be "v2" (YAAA df9c8a35; no v1 fallback)     (401)
 *   1. armed        REPCREDIT_EXPERIMENT_SIGNING=true, else 403
 *   2. secret       armed without REPCREDIT_EXPERIMENT_AUTH_SECRET rejects every request (503)
 *   3. body size    bounded before any HMAC work (413)
 *   4. source       loopback only unless REPCREDIT_ALLOW_REMOTE=true (403)
 *   5. HMAC         X-RepCredit-Timestamp + X-RepCredit-Auth =
 *                     hex HMAC-SHA256(secret, "v2\nMETHOD\nTARGET\nTS\nBODY")   (401/403)
 *   6. replay       each auth token is accepted AT MOST ONCE (403)
 *
 * THE TWO PROPERTIES THIS FILE EXISTS TO GUARANTEE
 * ------------------------------------------------
 * a) The HMAC covers the EXACT BYTES THAT GO ON THE WIRE. The body is serialised once,
 *    here, and the same string is both signed and sent. Serialising twice (once to sign,
 *    once inside fetch) is the classic way to produce a signature over bytes that differ
 *    from the request — key order, whitespace and bigint handling all drift.
 * b) A RETRY IS A NEW TOKEN. The guard's replay cache accepts a token once, so re-sending
 *    a previously-signed request is indistinguishable from an attacker replaying it and is
 *    rejected with 403 "auth token already used". Every attempt therefore re-stamps the
 *    timestamp and recomputes the HMAC over the same raw bytes.
 *
 * SECRET HANDLING (CC-50 second round, [from:docs]): the secret is generated per node with
 * the OS CSPRNG, handed to the node process through its environment only (never argv — argv
 * is world-readable via `ps`), and never returned in an error message, log line, manifest or
 * evidence file. `assertSecretsAbsent` is the belt-and-braces check over written evidence.
 */
import { createHmac, randomBytes } from 'node:crypto';

/** Header carrying the caller's millisecond unix timestamp. Must match the YAAA guard. */
export const HEADER_TIMESTAMP = 'X-RepCredit-Timestamp';
/** Header carrying hex HMAC-SHA256(secret, {@link buildAuthPreimage}). Must match the YAAA guard. */
export const HEADER_AUTH = 'X-RepCredit-Auth';
/** Header carrying the preimage scheme version. Mandatory since YAAA df9c8a35 — there is no v1 fallback. */
export const HEADER_SCHEME = 'X-RepCredit-Scheme';
/**
 * Wire version of the HMAC preimage, pinned to YAAA `REPCREDIT_AUTH_SCHEME`.
 *
 * v1 signed `${timestamp}.${rawBody}` only, so a captured token was in principle movable between
 * the four `/repcredit/*` endpoints. v2 binds the METHOD and the REQUEST TARGET as well, so a
 * token authorises exactly one call on exactly one endpoint. This is a byte-for-byte sync with
 * the upstream commit — the SDK does not invent or extend the schema (CC-50/CC-49).
 */
export const REPCREDIT_AUTH_SCHEME = 'v2';

/**
 * The exact bytes both sides HMAC:
 *
 *   v2 \n METHOD \n REQUEST-TARGET \n TIMESTAMP-MS \n RAW-BODY
 *
 * Newline-joined with the raw body LAST, so no field can be shifted into another by choosing a
 * value that contains the separator. REQUEST-TARGET is the path (+query, if any) exactly as it
 * goes on the request line, which is what express reports as `req.originalUrl`.
 *
 * Mirrors `buildRepCreditAuthPreimage` in YetAnotherAA-Validator
 * `src/modules/repcredit/repcredit-experiment.guard.ts`; `experiment-auth.test.ts` pins that
 * source at a committed revision so an upstream change cannot pass silently.
 */
export function buildAuthPreimage(input: {
  method: string;
  requestTarget: string;
  timestampMs: number | string;
  rawBody: string;
}): string {
  return [
    REPCREDIT_AUTH_SCHEME,
    String(input.method).toUpperCase(),
    input.requestTarget,
    String(input.timestampMs),
    input.rawBody,
  ].join('\n');
}

/**
 * Request target exactly as it goes on the wire: path plus query string, no origin.
 *
 * Signing the full URL (or a normalised path) instead would produce a preimage the node cannot
 * reproduce, and the failure would surface as an opaque 403 rather than as a mismatch.
 */
export function requestTargetOf(url: string): string {
  const parsed = new URL(url);
  return `${parsed.pathname}${parsed.search}`;
}

/**
 * Distinct error type so the runner can tell "the node refused us" from "we could not reach the
 * node". Never carries the secret: the message is built from the URL and status only.
 */
export class ExperimentAuthError extends Error {
  readonly status: number | null;
  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = 'ExperimentAuthError';
    this.status = status;
  }
}

/**
 * Fresh 32-byte secret from the OS CSPRNG, one per validator.
 *
 * Per-node rather than shared: a shared secret would let a co-signature request captured at one
 * node be replayed at the others, which is exactly the property the quorum is supposed to have.
 */
export function generateExperimentSecret(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Reference header computation — the exact bytes the YAAA guard recomputes.
 * Mirrors `RepCreditExperimentGuard.computeHeaders`; `experiment-auth.test.ts` pins this
 * against the guard's own source so an upstream change to the preimage cannot pass silently.
 */
export function computeAuthHeaders(
  secret: string,
  input: { method: string; requestTarget: string; timestampMs: number; rawBody: string },
): Record<string, string> {
  if (!secret) throw new ExperimentAuthError('refusing to sign a RepCredit request with an empty secret');
  const ts = String(input.timestampMs);
  return {
    [HEADER_SCHEME]: REPCREDIT_AUTH_SCHEME,
    [HEADER_TIMESTAMP]: ts,
    [HEADER_AUTH]: createHmac('sha256', secret)
      .update(buildAuthPreimage({ ...input, timestampMs: ts }))
      .digest('hex'),
  };
}

/**
 * Strictly increasing millisecond stamp (CC-50 round-3 LOW).
 *
 * Token uniqueness must not rest on `Date.now()` happening to advance: two attempts inside the
 * same millisecond over the same body produce the SAME preimage and therefore the same token,
 * which the node rejects as a replay — a retry that can never succeed. One millisecond of forward
 * drift is far inside the guard's forward-skew allowance.
 */
function makeMonotonicClock(now: () => number): () => number {
  let last = -1;
  return () => {
    const value = Math.max(now(), last + 1);
    last = value;
    return value;
  };
}

export type SignedPostResult<T> = { ok: boolean; status: number; body: T | any };

export type SignedPostOptions = {
  /** Extra attempts after the first. Each one mints a brand-new timestamp + HMAC. */
  retries?: number;
  retryDelayMs?: number;
  /** Test seams. */
  now?: () => number;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
};

/**
 * Statuses worth another attempt. Deliberately NARROW:
 *   - 4xx is a decision, not a hiccup — retrying an auth/validation failure only burns tokens
 *     and, for a negative control, would turn a real rejection into noise.
 *   - 503 from this gate means "armed without a secret" or "replay cache full". Neither heals
 *     on retry, and retrying the second one makes it worse.
 * Transport failures (no response at all) are retried separately, below.
 */
const RETRYABLE_STATUS = new Set([502, 504]);

const defaultSleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

/**
 * POST a JSON body to a guarded `/repcredit/*` endpoint with a per-request HMAC.
 *
 * The returned shape matches the runner's previous `postJson`, so non-2xx responses are DATA
 * (negative controls need to inspect them) while unreachable nodes throw.
 */
export async function postSignedJson<T>(
  url: string,
  secret: string,
  body: unknown,
  options: SignedPostOptions = {},
): Promise<SignedPostResult<T>> {
  const {
    retries = 2,
    retryDelayMs = 250,
    now = () => Date.now(),
    fetchImpl = fetch,
    sleep = defaultSleep,
  } = options;
  const stamp = makeMonotonicClock(now);
  const requestTarget = requestTargetOf(url);

  // Serialise ONCE. This exact string is what gets signed and what gets sent.
  const raw = JSON.stringify(body);
  if (typeof raw !== 'string') {
    throw new ExperimentAuthError(`request body for ${url} is not JSON-serialisable`);
  }

  let lastTransportError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await sleep(retryDelayMs);
    // A NEW timestamp and therefore a NEW auth token on every attempt: the guard accepts each
    // token exactly once, so reusing the previous attempt's headers would be rejected as a replay.
    const headers = {
      'content-type': 'application/json',
      ...computeAuthHeaders(secret, { method: 'POST', requestTarget, timestampMs: stamp(), rawBody: raw }),
    };
    let response: Response;
    try {
      response = await fetchImpl(url, { method: 'POST', headers, body: raw });
    } catch (error) {
      lastTransportError = error;
      continue;
    }
    if (RETRYABLE_STATUS.has(response.status) && attempt < retries) continue;
    let parsed: unknown;
    try {
      parsed = await response.json();
    } catch {
      parsed = await response.text().catch(() => '');
    }
    return { ok: response.ok, status: response.status, body: parsed as T };
  }

  // Message intentionally carries the URL and the transport error only — never the secret.
  const detail = lastTransportError instanceof Error ? lastTransportError.message : String(lastTransportError);
  throw new ExperimentAuthError(`POST ${url} failed after ${retries + 1} attempt(s): ${detail}`);
}

/**
 * Per-node secret registry.
 *
 * Holds the secrets in memory for the life of the run; `values()` feeds the evidence redactor so
 * a secret that somehow reached a log line is scrubbed before the evidence is sealed.
 */
export class ExperimentSecrets {
  private readonly byUrl = new Map<string, string>();

  /** Mint and remember a secret for `baseUrl` (e.g. http://127.0.0.1:29301). */
  issue(baseUrl: string): string {
    const secret = generateExperimentSecret();
    this.byUrl.set(normaliseBase(baseUrl), secret);
    return secret;
  }

  /** Secret for whichever node `endpointUrl` addresses. Throws rather than sending unsigned. */
  forEndpoint(endpointUrl: string): string {
    const base = normaliseBase(new URL(endpointUrl).origin);
    const secret = this.byUrl.get(base);
    if (!secret) {
      throw new ExperimentAuthError(`no RepCredit experiment secret was issued for ${base}`);
    }
    return secret;
  }

  values(): string[] {
    return [...this.byUrl.values()];
  }
}

function normaliseBase(url: string): string {
  return url.replace(/\/+$/, '');
}

/**
 * Fail if any secret survived into written evidence.
 *
 * The runner already redacts; this asserts the redaction actually worked, because "we call a
 * redactor" is not the same claim as "the bytes on disk are clean".
 */
export function assertSecretsAbsent(text: string, secrets: string[], where: string): void {
  for (const secret of secrets) {
    if (secret && text.includes(secret)) {
      throw new ExperimentAuthError(`a RepCredit experiment secret leaked into ${where}`);
    }
  }
}
