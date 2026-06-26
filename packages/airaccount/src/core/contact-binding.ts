/**
 * Browser-safe KMS contact-binding client (aastar-sdk#193 / AirAccount#129, KMS v0.27.0).
 *
 * Binds a notification channel (Telegram today; email pending KMS `begin_email_binding`) to an
 * AirAccount so the DVT out-of-band confirmation can reach the owner. Every begin/confirm/unbind is
 * gated by an OWNER WebAuthn ceremony (the app proves account ownership): the caller supplies a
 * `ceremony` that runs `POST /BeginAuthentication {KeyId}` → `navigator.credentials.get(challenge)` and
 * returns the assertion in the KMS's capitalized `{ChallengeId, Credential}` shape.
 *
 * Flow (Telegram, user-initiated — Telegram bots cannot DM a user who hasn't /started them):
 *   1. `beginContactBinding({account, channel})` → ceremony → `{bindingCode, expiresAt}`.
 *   2. The user sends `/bind <bindingCode>` to the official @AAStarBot; the bot claims it server-side
 *      (NOT via this SDK) and delivers a `verifyToken` to the chat.
 *   3. The user enters that `verifyToken` in the app → `confirmContactBinding({account, bindingCode,
 *      verifyToken})` → ceremony → `{status:'verified'}`.
 *   4. `getContacts(account)` lists verified channels; `removeContact({account, channel})` unbinds.
 *
 * fetch-based + browser-safe (no node:crypto). The approval side (out-of-band confirm) is a separate
 * passkey-over-userOpHash ceremony submitted to the DVT node — pending the DVT `/signature/confirm`
 * credential format (YetAnotherAA-Validator#124) — and is intentionally not in this module yet.
 */
import type { Address } from 'viem';
import { requestSignal } from './dvt-confirmation.js';

export type ContactChannel = 'telegram' | 'email';

/** A WebAuthn assertion in the KMS's capitalized wire shape (matches the existing KMS API). */
export interface KmsWebAuthn {
  ChallengeId: string;
  Credential: unknown;
}

/**
 * Runs the owner WebAuthn ceremony and returns the KMS assertion. Provided by the app (browser):
 * `POST /BeginAuthentication {KeyId}` → `navigator.credentials.get(challenge)` → `{ChallengeId, Credential}`.
 * Receives the account so a multi-account app can pick the right passkey/key id.
 */
export type OwnerCeremony = (ctx: { account: Address; purpose: 'begin-binding' | 'confirm-binding' | 'unbind' }) => Promise<KmsWebAuthn>;

export interface ContactBindingClientOptions {
  /** KMS base URL, e.g. `https://kms.aastar.io`. */
  kmsEndpoint: string;
  /** KMS `x-api-key`. */
  apiKey: string;
  /** Owner WebAuthn ceremony runner (see {@link OwnerCeremony}). */
  ceremony: OwnerCeremony;
  /** Override fetch (tests / non-global-fetch runtimes). */
  fetchImpl?: typeof fetch;
  /** Per-request timeout (ms) so a hung KMS request can't block the owner ceremony. Default 15000. (#203 N3) */
  requestTimeoutMs?: number;
}

export interface BeginBindingResult {
  bindingCode: string;
  expiresAt: number;
}
export interface ContactRecord {
  channel: ContactChannel;
  /** The verified contact reference (e.g. Telegram chat id / email), as the KMS stores it. */
  contactRef: string;
  status: 'pending' | 'verified' | 'revoked';
  verifiedAt: number | null;
}

export interface ContactBindingClient {
  beginContactBinding(p: { account: Address; channel: ContactChannel }): Promise<BeginBindingResult>;
  confirmContactBinding(p: { account: Address; bindingCode: string; verifyToken: string }): Promise<{ status: 'verified' }>;
  getContacts(account: Address): Promise<ContactRecord[]>;
  removeContact(p: { account: Address; channel: ContactChannel }): Promise<{ status: string }>;
}

/** Create a browser-safe KMS contact-binding client bound to an endpoint + owner ceremony. */
export function createContactBindingClient(options: ContactBindingClientOptions): ContactBindingClient {
  const base = options.kmsEndpoint.replace(/\/$/, '');
  const doFetch = options.fetchImpl ?? fetch;

  const timeoutMs = options.requestTimeoutMs ?? 15_000;
  async function call<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    const res = await doFetch(`${base}${path}`, {
      method,
      headers: { 'content-type': 'application/json', 'x-api-key': options.apiKey },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: requestSignal(undefined, timeoutMs), // #203 N3 — a hung KMS request times out, not hangs
    });
    if (!res.ok) throw new Error(`KMS ${method} ${path} → ${res.status}`);
    return (await res.json()) as T;
  }

  function assertTelegram(channel: ContactChannel) {
    // email endpoints are not open yet (KMS begin_email_binding pending) — fail loudly, not silently.
    if (channel === 'email') throw new Error('email contact binding is not available yet (pending KMS begin_email_binding) — use telegram');
  }

  return {
    async beginContactBinding({ account, channel }) {
      assertTelegram(channel);
      const WebAuthn = await options.ceremony({ account, purpose: 'begin-binding' });
      return call<BeginBindingResult>('POST', '/contact/begin-binding', { account, channel, WebAuthn });
    },
    async confirmContactBinding({ account, bindingCode, verifyToken }) {
      const WebAuthn = await options.ceremony({ account, purpose: 'confirm-binding' });
      return call<{ status: 'verified' }>('POST', '/contact/confirm-binding', { account, bindingCode, verifyToken, WebAuthn });
    },
    async getContacts(account) {
      const r = await call<{ contacts: ContactRecord[] }>('GET', `/contact/${account}`);
      return r.contacts ?? [];
    },
    async removeContact({ account, channel }) {
      assertTelegram(channel);
      const WebAuthn = await options.ceremony({ account, purpose: 'unbind' });
      return call<{ status: string }>('POST', '/contact/unbind', { account, channel, WebAuthn });
    },
  };
}
