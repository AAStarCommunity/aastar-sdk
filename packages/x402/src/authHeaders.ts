import type { FacilitatorConfig } from './types.js';

/** HMAC-SHA256(secret, message) as lowercase hex, via Web Crypto (Node 18+ / browser). */
export async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Build a `FacilitatorConfig.createAuthHeaders` for the DVT facilitator's optional stateless-HMAC
 * gate (x402-facilitator spec §4). Only emits headers for `POST /x402/settle` (the only guarded
 * endpoint); other endpoints get no auth headers. Use ONLY when the target node runs with
 * `X402_AUTH_ENABLED=true` and shares `X402_AUTH_SECRET`:
 *
 *   X-X402-Timestamp: <unix epoch ms>
 *   X-X402-Auth:      hex HMAC-SHA256(secret, `${timestamp}.${rawBody}`)
 *
 * The node accepts iff `|now − timestamp| ≤ X402_AUTH_TTL_MS` and the HMAC matches over the raw body.
 *
 * @param secret  the shared `X402_AUTH_SECRET`.
 * @param opts.now injectable clock (ms) for tests; defaults to `Date.now`.
 */
export function createX402AuthHeaders(
  secret: string,
  opts?: { now?: () => number },
): NonNullable<FacilitatorConfig['createAuthHeaders']> {
  const now = opts?.now ?? (() => Date.now());
  return async ({ endpoint, body }): Promise<Record<string, string>> => {
    if (endpoint !== 'settle') return {}; // only /x402/settle is HMAC-gated
    const timestamp = String(now());
    const mac = await hmacSha256Hex(secret, `${timestamp}.${body}`);
    return { 'X-X402-Timestamp': timestamp, 'X-X402-Auth': mac };
  };
}
