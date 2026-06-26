/**
 * Out-of-band confirmation polling (aastar-sdk#176 phase 4 / #124).
 *
 * For a high-value op the DVT signer node WITHHOLDS its signature and sends the account's owner a
 * one-time token over an independent channel (Telegram today; email/Nostr later). The SDK's BLS
 * sign call surfaces this as a {@link DvtPendingConfirmationError} (with the node endpoint +
 * userOpHash). The user approves over their channel (NOT through the app — the app/attacker never
 * sees the token); the consumer then POLLS the node here until `approved`, and RE-SUBMITS the sign to
 * release the signature.
 *
 * Poll-only — it never calls `POST /signature/confirm` (that's the user's independent channel, by
 * design). Browser-safe (fetch). Transient errors during the poll do NOT end the (default 10-min)
 * window; the loop keeps trying until a terminal status, the timeout, or an abort.
 */

export type ConfirmationStatus = 'pending' | 'approved' | 'expired' | 'not_found';

export interface ConfirmationState {
  userOpHash: string;
  status: ConfirmationStatus;
  /** Epoch ms when the pending confirmation expires (null if not pending). */
  expiresAt: number | null;
}

/** A userOpHash is a 32-byte hash — validate before putting it in a public URL path. */
const USEROPHASH_RE = /^0x[0-9a-fA-F]{64}$/;

function assertUserOpHash(userOpHash: string): void {
  if (!USEROPHASH_RE.test(userOpHash)) {
    throw new Error(`getDvtConfirmationStatus: invalid userOpHash ${JSON.stringify(userOpHash)} (expected 0x + 64 hex)`);
  }
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('pollDvtConfirmation aborted', 'AbortError');
}

/** Sleep that rejects with an AbortError if the signal fires (so the poll is promptly cancellable). */
function abortableSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('aborted', 'AbortError'));
    const t = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(new DOMException('aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

const isAbortError = (e: unknown): boolean => e instanceof DOMException && e.name === 'AbortError';

/** Read (does NOT consume) a node's out-of-band confirmation status: `GET /signature/confirmation/:userOpHash`. */
/** Combine an optional caller signal with a per-request timeout (a hung node must not stall the poll). */
function requestSignal(signal: AbortSignal | undefined, timeoutMs: number): AbortSignal {
  // Fast path: native AbortSignal.timeout + .any (Node 20+ / modern browsers).
  if (typeof (AbortSignal as any).timeout === 'function' && typeof (AbortSignal as any).any === 'function') {
    const timeout = (AbortSignal as any).timeout(timeoutMs);
    return signal ? (AbortSignal as any).any([signal, timeout]) : timeout;
  }
  // Fallback (older Safari <17.4 / Chrome <116): a manual controller that aborts on EITHER the caller
  // signal OR the timeout — so the per-request timeout is NEVER lost (the #190 fix must not regress).
  const ctrl = new AbortController();
  const onCallerAbort = () => ctrl.abort((signal as any)?.reason);
  if (signal) {
    if (signal.aborted) ctrl.abort((signal as any).reason);
    else signal.addEventListener('abort', onCallerAbort, { once: true });
  }
  // Pre-aborted caller → no timer (the 'abort' already fired, so the clear-on-abort listener below
  // would never run → a stray timer would leak for timeoutMs). #195 [Low].
  if (ctrl.signal.aborted) return ctrl.signal;
  const timer = setTimeout(() => ctrl.abort(new DOMException('request timeout', 'TimeoutError')), timeoutMs);
  ctrl.signal.addEventListener('abort', () => {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onCallerAbort);
  }, { once: true });
  return ctrl.signal;
}

export async function getDvtConfirmationStatus(
  nodeEndpoint: string,
  userOpHash: string,
  signal?: AbortSignal,
  requestTimeoutMs = 15_000,
): Promise<ConfirmationState> {
  assertUserOpHash(userOpHash);
  const base = nodeEndpoint.replace(/\/$/, '');
  // Per-request timeout (#190 residual): without it a hung node stalls the whole poll cadence.
  const res = await fetch(`${base}/signature/confirmation/${encodeURIComponent(userOpHash)}`, {
    signal: requestSignal(signal, requestTimeoutMs),
  });
  if (!res.ok) throw new Error(`DVT confirmation status ${res.status} from ${base} for ${userOpHash}`);
  const body = (await res.json()) as { userOpHash?: string; status: ConfirmationStatus; expiresAt: number | null };
  return { userOpHash, status: body.status, expiresAt: body.expiresAt ?? null };
}

export interface PollConfirmationOptions {
  /** Poll interval (ms). Default 3000. */
  intervalMs?: number;
  /** Give up after this long (ms). Default 600_000 (the node's 10-min TTL). */
  timeoutMs?: number;
  /** Abort the poll (also cancels the in-flight fetch + the sleep). */
  signal?: AbortSignal;
  /** Called on each successful status read (for UI progress). */
  onStatus?: (state: ConfirmationState) => void;
  /** Called on a transient read error (the poll keeps going until timeout — it does NOT end the window). */
  onError?: (error: unknown) => void;
  /** Per-request fetch timeout (ms). A hung node read times out + retries, not stalls. Default 15000. */
  requestTimeoutMs?: number;
}

/**
 * Poll a node until the out-of-band confirmation is `approved` (re-submit the sign then) or terminal
 * (`expired`/`not_found`) or the timeout elapses. A transient network/5xx error does NOT abort the
 * window — it's reported via `onError` and retried until the deadline (so a blip doesn't waste the
 * user's 10-min approval window). Aborts via `signal` (rejects with an AbortError).
 */
export async function pollDvtConfirmation(
  nodeEndpoint: string,
  userOpHash: string,
  options: PollConfirmationOptions = {},
): Promise<ConfirmationState> {
  assertUserOpHash(userOpHash);
  const intervalMs = options.intervalMs ?? 3000;
  const timeoutMs = options.timeoutMs ?? 600_000;
  const deadline = Date.now() + timeoutMs;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    throwIfAborted(options.signal);
    let state: ConfirmationState;
    try {
      state = await getDvtConfirmationStatus(nodeEndpoint, userOpHash, options.signal, options.requestTimeoutMs);
    } catch (err) {
      // A caller abort ('AbortError') propagates; a per-request TIMEOUT ('TimeoutError') is transient → retry.
      if (isAbortError(err)) throw err;
      options.onError?.(err); // transient — keep the window alive
      if (Date.now() >= deadline) throw err; // out of time: surface the last error
      await abortableSleep(intervalMs, options.signal);
      continue;
    }
    options.onStatus?.(state);
    if (state.status === 'approved' || state.status === 'expired' || state.status === 'not_found') return state;
    if (Date.now() >= deadline) return state; // timed out while still pending
    await abortableSleep(intervalMs, options.signal);
  }
}

// ── Out-of-band APPROVAL (option-2: passkey over userOpHash) — aastar-sdk#193 / Validator#124/#126 ──

/**
 * The WebAuthn assertion exactly as `navigator.credentials.get()` returns it (serialized by e.g.
 * `@simplewebauthn/browser`'s `startAuthentication`). It is POSTed to the DVT node AS-IS — do NOT
 * flatten to `{authenticatorData, clientDataJSON, signature}`: the KMS verifier needs `id`/`rawId`/
 * `type` (the flat shape drops them and verification fails).
 */
export interface AuthenticationResponseJSON {
  id: string;
  rawId: string;
  type: 'public-key';
  response: {
    authenticatorData: string;
    clientDataJSON: string;
    signature: string;
    userHandle?: string;
  };
  authenticatorAttachment?: string;
  clientExtensionResults?: Record<string, unknown>;
}

/**
 * Build the `navigator.credentials.get({ publicKey })` request options for an out-of-band approval:
 * the WebAuthn challenge IS the 32-byte `userOpHash` (WYSIWYS — the user signs exactly the op they're
 * confirming). Run this in the browser, then pass the resulting assertion to {@link submitDvtConfirmation}.
 */
export function confirmationCredentialRequest(
  userOpHash: string,
  opts: { rpId: string; allowCredentials?: { id: BufferSource; type?: 'public-key' }[]; timeoutMs?: number },
): { challenge: Uint8Array; rpId: string; userVerification: 'required'; timeout?: number; allowCredentials?: { id: BufferSource; type: 'public-key' }[] } {
  assertUserOpHash(userOpHash);
  // hexToBytes of the 0x+64hex userOpHash → the exact 32-byte challenge the node binds against.
  const challenge = Uint8Array.from((userOpHash.slice(2).match(/.{2}/g) ?? []).map((b) => parseInt(b, 16)));
  return {
    challenge,
    rpId: opts.rpId,
    userVerification: 'required',
    ...(opts.timeoutMs !== undefined ? { timeout: opts.timeoutMs } : {}),
    ...(opts.allowCredentials ? { allowCredentials: opts.allowCredentials.map((c) => ({ id: c.id, type: 'public-key' as const })) } : {}),
  };
}

/**
 * Submit an out-of-band approval to a DVT node: `POST {node}/signature/confirm { userOpHash, passkey }`.
 * `userOpHash` IS the pendingId; `passkey` is the {@link AuthenticationResponseJSON} passed AS-IS. The
 * node verifies the assertion (challenge==userOpHash + the account's passkey, delegated to the KMS) and
 * releases its withheld signature. Stateless + idempotent — the SAME assertion can be submitted to each
 * quorum node independently.
 */
export async function submitDvtConfirmation(
  nodeEndpoint: string,
  userOpHash: string,
  passkey: AuthenticationResponseJSON,
  signal?: AbortSignal,
): Promise<{ status: 'confirmed' | 'rejected'; confirmed: boolean }> {
  assertUserOpHash(userOpHash);
  const base = nodeEndpoint.replace(/\/$/, '');
  const res = await fetch(`${base}/signature/confirm`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userOpHash, passkey }), // passkey AS-IS — never flattened
    signal,
  });
  if (!res.ok) throw new Error(`DVT confirm ${res.status} from ${base} for ${userOpHash}`);
  const body = (await res.json()) as { status?: 'confirmed' | 'rejected'; confirmed?: boolean };
  return { status: body.status ?? (body.confirmed ? 'confirmed' : 'rejected'), confirmed: !!body.confirmed };
}
