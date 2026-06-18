import { KMS } from '@aastar/sdk';
import { runtime } from '../config';

// Browser AirAccount client (email + WebAuthn passkey), via the `@aastar/sdk` root
// `KMS` namespace (also available at the `@aastar/sdk/kms` subpath).
type YAAAClient = InstanceType<typeof KMS.YAAAClient>;

let cached: YAAAClient | null = null;

export function getYaaaClient(): YAAAClient {
  if (cached) return cached;
  cached = new KMS.YAAAClient({
    apiURL: runtime.apiURL,
    tokenProvider: () =>
      typeof window === 'undefined' ? null : window.localStorage.getItem('aastar.token'),
    bls: { seedNodes: runtime.blsSeedNodes, discoveryTimeout: 5000 },
  });
  return cached;
}

export interface Session {
  address: string;
  user: unknown;
  token: string;
}

export async function registerWithEmail(email: string, username: string): Promise<Session> {
  const result = await getYaaaClient().passkey.register({ email, username });
  persist(result);
  return { address: extractAddress(result.user), user: result.user, token: result.token };
}

export async function loginWithPasskey(email?: string): Promise<Session> {
  const result = await getYaaaClient().passkey.authenticate(email ? { email } : undefined);
  persist(result);
  return { address: extractAddress(result.user), user: result.user, token: result.token };
}

/**
 * Gasless transfer via passkey + SuperPaymaster. Mirrors the browser flow in
 * packages/airaccount/examples/basic-usage.ts: verifyTransaction -> POST /transfer.
 * Requires a LIVE AirAccount backend. TODO: confirm endpoint/body for your deployment.
 */
export async function sendGaslessTransfer(params: {
  to: string;
  value?: string;
  data?: string;
}): Promise<{ ok: boolean; userOpHash: string; response: unknown }> {
  const yaaa = getYaaaClient();
  const verification = await yaaa.passkey.verifyTransaction({
    to: params.to,
    value: params.value,
    data: params.data,
  });

  const token = window.localStorage.getItem('aastar.token');
  const res = await fetch(`${runtime.apiURL}/transfer`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      to: params.to,
      amount: params.value ?? '0',
      data: params.data ?? '0x',
      passkeyAssertion: {
        AuthenticatorData: verification.credential.authenticatorData,
        ClientDataHash: verification.credential.clientDataHash,
        Signature: verification.credential.signature,
      },
      usePaymaster: true,
      operator: runtime.operator,
    }),
  });
  const response = await res.json().catch(() => ({}));
  return { ok: res.ok, userOpHash: verification.userOpHash, response };
}

function persist(result: { user: unknown; token: string }): void {
  if (result.token) {
    window.localStorage.setItem('aastar.token', result.token);
    window.localStorage.setItem('aastar.user', JSON.stringify(result.user));
  }
}

function extractAddress(user: unknown): string {
  const u = (user ?? {}) as Record<string, unknown>;
  // TODO: align with your backend's user shape.
  return (
    (u.aaAddress as string) ??
    (u.smartAccountAddress as string) ??
    (u.accountAddress as string) ??
    (u.address as string) ??
    ''
  );
}

/** Restore a session previously saved to localStorage (no network). */
export function restoreSession(): Session | null {
  const token = window.localStorage.getItem('aastar.token');
  const userRaw = window.localStorage.getItem('aastar.user');
  if (!token || !userRaw) return null;
  try {
    const user = JSON.parse(userRaw);
    return { address: extractAddress(user), user, token };
  } catch {
    return null;
  }
}

export function clearSession(): void {
  window.localStorage.removeItem('aastar.token');
  window.localStorage.removeItem('aastar.user');
}
