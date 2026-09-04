/**
 * What the KMS client does about credentials — characterised, not assumed.
 *
 * CC-19 hardened the KMS server to be fail-closed on the API key. This file asks the matching
 * question on the client: when the key is missing, does the SDK stop, or does it send an
 * unauthenticated request?
 *
 * The answer today is: **it sends the request**. `ensureEnabled()` is fail-closed on the
 * `kmsEnabled` flag, but nothing gates `kmsApiKey` — an undefined key simply means the `x-api-key`
 * header is never attached, and every call proceeds.
 *
 * These tests do not change that. They pin it, because the realistic failure is quiet: every caller
 * in this repo passes `process.env.KMS_API_KEY`, so forgetting to set that variable produces a
 * client that looks configured, reports `enabled === true`, and fails later at the server as an
 * auth error indistinguishable from a revoked key or a bad endpoint. The config mistake and the
 * credential mistake surface identically, at the wrong layer, at the wrong time.
 *
 * WHY NOT JUST MAKE IT THROW
 * --------------------------
 * Because that is a behaviour change with a blast radius this task cannot see. A deployment
 * pointing at an unauthenticated KMS (local TEE emulator, a test fixture, an internal endpoint that
 * does its own network-level auth) would go from working to throwing at construction. Whether the
 * key should be mandatory is a product decision about supported deployments, and unattended work
 * does not get to make those. It is written up in the follow-up ledger with the evidence, for a
 * human to decide.
 *
 * So the contract these tests hold is narrower and honest: the current behaviour is EXPLICIT. If
 * someone later makes the key mandatory, these tests fail and force the change to be deliberate —
 * which is exactly what should happen. A characterisation test that goes red on an intentional
 * change is doing its job, not obstructing.
 */
import { describe, expect, it } from 'vitest';

import { KmsHttpClient } from '../services/kms-http-client.js';

/** A logger that says nothing, so the suite output stays about assertions. */
const silent = { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} };

/** The axios instance the client built, reached through the one seam that exposes it. */
function headersOf(client: KmsHttpClient): Record<string, unknown> {
  const http = (client as unknown as { http: { defaults: { headers: Record<string, unknown> } } }).http;
  return http.defaults.headers;
}

describe('KmsHttpClient: the enabled flag is fail-closed', () => {
  it('refuses every operation when kmsEnabled is not true', () => {
    const client = new KmsHttpClient({ kmsEnabled: false, kmsApiKey: 'k', logger: silent });
    expect(client.enabled).toBe(false);
    expect(() => client.ensureEnabled()).toThrow(/not enabled/i);
  });

  it('treats a missing kmsEnabled as disabled, not as a default-on', () => {
    // `=== true` rather than truthiness: "enabled" must be asserted, never inferred.
    const client = new KmsHttpClient({ kmsApiKey: 'k', logger: silent });
    expect(client.enabled).toBe(false);
    expect(() => client.ensureEnabled()).toThrow();
  });
});

describe('KmsHttpClient: the API key is NOT gated — characterised, pending a product decision', () => {
  it('attaches x-api-key when a key is supplied', () => {
    const client = new KmsHttpClient({ kmsEnabled: true, kmsApiKey: 'secret-key', logger: silent });
    expect(headersOf(client)['x-api-key']).toBe('secret-key');
  });

  it('CURRENT BEHAVIOUR: an enabled client with NO key is still usable, and sends no credential', () => {
    // This is the characterisation. It is not an endorsement — see the file header. The point is
    // that `enabled === true` here: nothing in the SDK distinguishes "configured" from
    // "configured without a credential", so the mistake travels to the server.
    const client = new KmsHttpClient({ kmsEnabled: true, logger: silent });
    expect(client.enabled).toBe(true);
    expect(() => client.ensureEnabled()).not.toThrow();
    expect(headersOf(client)['x-api-key']).toBeUndefined();
  });

  it('CURRENT BEHAVIOUR: an empty-string key is dropped exactly like a missing one', () => {
    // `if (this.apiKey)` is truthiness, so "" behaves as absent. Worth pinning separately: an
    // unset env var and an env var set to "" reach this constructor as different values but come
    // out identical, and "" is the shape a misconfigured deployment actually produces
    // (`KMS_API_KEY=` in an env file).
    const client = new KmsHttpClient({ kmsEnabled: true, kmsApiKey: '', logger: silent });
    expect(client.enabled).toBe(true);
    expect(headersOf(client)['x-api-key']).toBeUndefined();
  });

  it('the two failure modes are indistinguishable from the SDK surface', () => {
    // The concrete reason this matters. A client that was never given a key and a client that was
    // given one are distinguishable only by reading a private field; both report enabled === true
    // and both pass ensureEnabled(). Whatever the product decision turns out to be, THIS is the
    // property that has to change for it to have any effect.
    const withKey = new KmsHttpClient({ kmsEnabled: true, kmsApiKey: 'k', logger: silent });
    const without = new KmsHttpClient({ kmsEnabled: true, logger: silent });

    expect(withKey.enabled).toBe(without.enabled);
    expect(() => withKey.ensureEnabled()).not.toThrow();
    expect(() => without.ensureEnabled()).not.toThrow();
    // …and the only thing that differs is a header the SDK never checks back on.
    expect(headersOf(withKey)['x-api-key']).toBeDefined();
    expect(headersOf(without)['x-api-key']).toBeUndefined();
  });
});
