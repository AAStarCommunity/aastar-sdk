import { KMS } from '@aastar/sdk';
import type { WidgetConfig } from '../config';

// `KMS.YAAAClient` is the browser AirAccount client (email + WebAuthn passkey).
// It is also available via the `@aastar/sdk/kms` subpath. We use the root `KMS`
// namespace re-export here so the whole widget pulls from a single package.
type YAAAClient = InstanceType<typeof KMS.YAAAClient>;

let cached: YAAAClient | null = null;

/** Lazily construct (and memoize) the AirAccount client from widget config. */
export function getYaaaClient(config: WidgetConfig): YAAAClient {
  if (cached) return cached;
  cached = new KMS.YAAAClient({
    apiURL: config.apiURL,
    // The widget stores the JWT in localStorage after register/login.
    tokenProvider: () =>
      typeof window === 'undefined' ? null : window.localStorage.getItem('aastar.token'),
    bls: {
      seedNodes: config.blsSeedNodes,
      discoveryTimeout: 5000,
    },
  });
  return cached;
}

export interface RegisteredAccount {
  /** Smart account address returned by the backend. */
  address: string;
  /** Raw backend user object (shape is backend-defined). */
  user: unknown;
  token: string;
}

/**
 * Email + passkey register. Triggers a WebAuthn (biometric) prompt in the browser,
 * then returns the smart account address the backend provisioned.
 *
 * Requires a LIVE AirAccount/KMS backend at config.apiURL (see .env.example).
 */
export async function registerWithEmail(
  config: WidgetConfig,
  email: string,
  username: string,
): Promise<RegisteredAccount> {
  const yaaa = getYaaaClient(config);
  const result = await yaaa.passkey.register({ email, username });

  if (result.token) {
    window.localStorage.setItem('aastar.token', result.token);
    window.localStorage.setItem('aastar.user', JSON.stringify(result.user));
  }

  const address = extractAddress(result.user);
  return { address, user: result.user, token: result.token };
}

/** Login an already-registered email/passkey. */
export async function loginWithPasskey(
  config: WidgetConfig,
  email?: string,
): Promise<RegisteredAccount> {
  const yaaa = getYaaaClient(config);
  const result = await yaaa.passkey.authenticate(email ? { email } : undefined);
  if (result.token) {
    window.localStorage.setItem('aastar.token', result.token);
    window.localStorage.setItem('aastar.user', JSON.stringify(result.user));
  }
  return { address: extractAddress(result.user), user: result.user, token: result.token };
}

/**
 * Gasless transfer via passkey + SuperPaymaster.
 *
 * Browser flow (matches packages/airaccount/examples/basic-usage.ts):
 *   1. yaaa.passkey.verifyTransaction(...) -> WebAuthn assertion + userOpHash
 *   2. POST the assertion to the AirAccount backend, which builds & signs the
 *      UserOperation via KMS and submits it through the bundler with usePaymaster.
 *
 * Requires a LIVE AirAccount backend; the /transfer endpoint path may differ per
 * deployment. TODO: confirm the endpoint and request body with your backend.
 */
export async function sendGaslessTransfer(
  config: WidgetConfig,
  params: { to: string; value?: string; data?: string },
): Promise<{ ok: boolean; userOpHash: string; response: unknown }> {
  const yaaa = getYaaaClient(config);

  const verification = await yaaa.passkey.verifyTransaction({
    to: params.to,
    value: params.value,
    data: params.data,
  });

  const token = window.localStorage.getItem('aastar.token');
  const res = await fetch(`${config.apiURL}/transfer`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      to: params.to,
      amount: params.value ?? '0',
      data: params.data ?? '0x',
      // KMS passkey assertion (Legacy hex format used for BLS dual-signing).
      passkeyAssertion: {
        AuthenticatorData: verification.credential.authenticatorData,
        ClientDataHash: verification.credential.clientDataHash,
        Signature: verification.credential.signature,
      },
      usePaymaster: true,
      operator: config.operator,
    }),
  });

  const response = await res.json().catch(() => ({}));
  return { ok: res.ok, userOpHash: verification.userOpHash, response };
}

/** Best-effort address extraction from the backend user object. */
function extractAddress(user: unknown): string {
  const u = (user ?? {}) as Record<string, unknown>;
  // TODO: align with your backend's user shape. Common field names below.
  const candidate =
    (u.aaAddress as string) ??
    (u.smartAccountAddress as string) ??
    (u.accountAddress as string) ??
    (u.address as string) ??
    '';
  return candidate;
}
