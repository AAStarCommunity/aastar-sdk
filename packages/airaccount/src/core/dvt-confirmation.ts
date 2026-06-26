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
 * This only POLLS / reads status — it never calls `POST /signature/confirm` (that's the user's
 * independent channel, by design). Browser-safe (fetch).
 */

export type ConfirmationStatus = 'pending' | 'approved' | 'expired' | 'not_found';

export interface ConfirmationState {
  userOpHash: string;
  status: ConfirmationStatus;
  /** Epoch ms when the pending confirmation expires (null if not pending). */
  expiresAt: number | null;
}

/** Read (does NOT consume) a node's out-of-band confirmation status: `GET /signature/confirmation/:userOpHash`. */
export async function getDvtConfirmationStatus(nodeEndpoint: string, userOpHash: string): Promise<ConfirmationState> {
  const base = nodeEndpoint.replace(/\/$/, '');
  const res = await fetch(`${base}/signature/confirmation/${userOpHash}`);
  if (!res.ok) throw new Error(`DVT confirmation status ${res.status} from ${base} for ${userOpHash}`);
  const body = (await res.json()) as { userOpHash?: string; status: ConfirmationStatus; expiresAt: number | null };
  return { userOpHash, status: body.status, expiresAt: body.expiresAt ?? null };
}

export interface PollConfirmationOptions {
  /** Poll interval (ms). Default 3000. */
  intervalMs?: number;
  /** Give up after this long (ms). Default 600_000 (the node's 10-min TTL). */
  timeoutMs?: number;
  /** Abort the poll. */
  signal?: AbortSignal;
  /** Called on each status read (for UI progress). */
  onStatus?: (state: ConfirmationState) => void;
}

/**
 * Poll a node until the out-of-band confirmation is `approved` (re-submit the sign then) or terminal
 * (`expired`/`not_found`) or the timeout elapses. Resolves with the final state; the caller decides
 * what to do (re-submit on `approved`, surface failure otherwise).
 */
export async function pollDvtConfirmation(
  nodeEndpoint: string,
  userOpHash: string,
  options: PollConfirmationOptions = {},
): Promise<ConfirmationState> {
  const intervalMs = options.intervalMs ?? 3000;
  const timeoutMs = options.timeoutMs ?? 600_000;
  const deadline = Date.now() + timeoutMs;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (options.signal?.aborted) throw new Error('pollDvtConfirmation: aborted');
    const state = await getDvtConfirmationStatus(nodeEndpoint, userOpHash);
    options.onStatus?.(state);
    // Terminal states: stop polling.
    if (state.status === 'approved' || state.status === 'expired' || state.status === 'not_found') return state;
    if (Date.now() >= deadline) return state; // timed out while still pending
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}
