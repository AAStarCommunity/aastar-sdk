import { describe, it, expect, vi } from 'vitest';
import { createContactBindingClient, type KmsWebAuthn } from './contact-binding.js';

const ACCOUNT = '0xaCC0000000000000000000000000000000000001' as const; // mixed-case (EIP-55) to test normalization
const LC = ACCOUNT.toLowerCase();
const KMS = 'https://kms.aastar.io';
const ASSERTION: KmsWebAuthn = { ChallengeId: 'chal-1', Credential: { id: 'cred' } };

function mk(responses: Record<string, any>) {
  const calls: any[] = [];
  const fetchImpl = vi.fn(async (url: string, init: any) => {
    calls.push({ url, method: init.method, headers: init.headers, body: init.body ? JSON.parse(init.body) : undefined, signal: init.signal });
    const key = `${init.method} ${url.replace(KMS, '')}`;
    const body = responses[key] ?? responses[Object.keys(responses).find((k) => key.startsWith(k.split('?')[0])) ?? ''];
    return { ok: body !== undefined, status: body !== undefined ? 200 : 404, json: async () => body };
  });
  const ceremony = vi.fn(async () => ASSERTION);
  const client = createContactBindingClient({ kmsEndpoint: KMS, apiKey: 'k', ceremony, fetchImpl: fetchImpl as any });
  return { client, calls, fetchImpl, ceremony };
}

describe('contact-binding client (#193 / KMS v0.27.0)', () => {
  it('beginContactBinding runs the owner ceremony + posts the capitalized WebAuthn field', async () => {
    const { client, calls, ceremony } = mk({ 'POST /contact/begin-binding': { bindingCode: 'B-123', expiresAt: 999 } });
    const r = await client.beginContactBinding({ account: ACCOUNT, channel: 'telegram' });
    expect(r).toEqual({ bindingCode: 'B-123', expiresAt: 999 });
    expect(ceremony).toHaveBeenCalledWith({ account: LC, purpose: 'begin-binding' }); // lowercased
    const post = calls[0];
    expect(post.headers['x-api-key']).toBe('k');
    expect(post.body).toEqual({ account: LC, channel: 'telegram', WebAuthn: ASSERTION }); // capital W + lowercase account
  });

  it('confirmContactBinding posts bindingCode + verifyToken + ceremony assertion', async () => {
    const { client, calls } = mk({ 'POST /contact/confirm-binding': { status: 'verified' } });
    const r = await client.confirmContactBinding({ account: ACCOUNT, bindingCode: 'B-123', verifyToken: 'T-9' });
    expect(r.status).toBe('verified');
    expect(calls[0].body).toEqual({ account: LC, bindingCode: 'B-123', verifyToken: 'T-9', WebAuthn: ASSERTION });
  });

  it('normalizes the account to lowercase for the KMS (v0.27.2 #129/#203 — checksummed would fail-close)', async () => {
    const { client, calls } = mk({ [`GET /contact/${LC}`]: { contacts: [] } });
    await client.getContacts(ACCOUNT); // pass EIP-55 checksummed in
    expect(calls[0].url).toBe(`${KMS}/contact/${LC}`); // URL is lowercased
    expect(calls[0].url).not.toContain('aCC0'); // not the mixed-case form
  });

  it('getContacts reads GET /contact/:account and returns the list (no ceremony)', async () => {
    const contacts = [{ channel: 'telegram', contactRef: '12345', status: 'verified', verifiedAt: 100 }];
    const { client, calls, ceremony } = mk({ [`GET /contact/${LC}`]: { contacts } });
    expect(await client.getContacts(ACCOUNT)).toEqual(contacts);
    expect(ceremony).not.toHaveBeenCalled(); // read is unauthenticated-by-owner here (x-api-key only)
    expect(calls[0].method).toBe('GET');
  });

  it('removeContact unbinds with a ceremony', async () => {
    const { client, calls } = mk({ 'POST /contact/unbind': { status: 'revoked' } });
    expect((await client.removeContact({ account: ACCOUNT, channel: 'telegram' })).status).toBe('revoked');
    expect(calls[0].body).toMatchObject({ account: LC, channel: 'telegram', WebAuthn: ASSERTION });
  });

  it('rejects email until the KMS endpoint opens (no silent no-op)', async () => {
    const { client, fetchImpl } = mk({});
    await expect(client.beginContactBinding({ account: ACCOUNT, channel: 'email' })).rejects.toThrow(/email.*not available/i);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('passes a per-request timeout signal to fetch (#203 N3)', async () => {
    const { client, calls } = mk({ [`GET /contact/${LC}`]: { contacts: [] } });
    await client.getContacts(ACCOUNT);
    expect(calls[0].signal).toBeInstanceOf(AbortSignal); // hung KMS request times out, not blocks the ceremony
  });

  it('throws on a non-OK KMS response', async () => {
    const { client } = mk({}); // begin-binding not stubbed → 404
    await expect(client.beginContactBinding({ account: ACCOUNT, channel: 'telegram' })).rejects.toThrow(/begin-binding → 404/);
  });
});
