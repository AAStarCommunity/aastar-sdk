/**
 * Tests for the RepCredit experiment-endpoint auth client (CC-49 BLOCKER-1 sync, CC-50 round 2).
 *
 * Three layers, deliberately:
 *
 *   1. CLIENT BEHAVIOUR — signed bytes == sent bytes, a retry mints a NEW token, no secret in
 *      any error. The expected HMAC is recomputed here with `node:crypto` directly rather than
 *      through `computeAuthHeaders`, so a bug in the helper cannot validate itself.
 *   2. UPSTREAM CONTRACT PIN — the YAAA guard's own source is read and asserted to still use the
 *      same header names and the same `${timestamp}.${rawBody}` preimage. If DVT changes the
 *      scheme (the announced aggregator-domain change will touch this file), this fails loudly
 *      instead of the whole evidence run failing with an opaque 403.
 *   3. REAL YAAA HTTP INTEGRATION — boots the actual `dist/main.js` against a throwaway anvil and
 *      exercises the real guard: unsigned, wrong secret, stale timestamp, tampered body, replay,
 *      and the happy path. Skipped (loudly) when the sibling checkout or anvil is missing; set
 *      REPCREDIT_YAAA_HTTP_TEST=1 to turn that skip into a failure, so "we did not run it" can
 *      never be mistaken for "it passed".
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { createHmac, randomBytes } from 'node:crypto';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  ExperimentAuthError,
  ExperimentSecrets,
  HEADER_AUTH,
  HEADER_TIMESTAMP,
  assertSecretsAbsent,
  computeAuthHeaders,
  generateExperimentSecret,
  postSignedJson,
} from './experiment-auth.js';

/** Independent reimplementation of the guard's preimage; never calls the code under test. */
const expectedHmac = (secret: string, ts: number | string, rawBody: string) =>
  createHmac('sha256', secret).update(`${ts}.${rawBody}`).digest('hex');

type Captured = { url: string; headers: Record<string, string>; body: string };

/** fetch double that records what actually went on the wire and replies with a scripted queue. */
function recordingFetch(responses: Array<{ status: number; body?: unknown } | 'network-error'>) {
  const calls: Captured[] = [];
  const impl = (async (url: any, init: any) => {
    calls.push({ url: String(url), headers: { ...(init.headers as Record<string, string>) }, body: String(init.body) });
    const next = responses.shift() ?? { status: 200, body: {} };
    if (next === 'network-error') throw new Error('fetch failed: ECONNREFUSED');
    return {
      ok: next.status >= 200 && next.status < 300,
      status: next.status,
      json: async () => next.body ?? {},
      text: async () => JSON.stringify(next.body ?? {}),
    } as unknown as Response;
  }) as unknown as typeof fetch;
  return { impl, calls };
}

describe('experiment auth client', () => {
  it('signs the exact bytes it sends', async () => {
    const secret = generateExperimentSecret();
    const { impl, calls } = recordingFetch([{ status: 200, body: { ok: true } }]);
    const body = { schemaVersion: 'repcredit-reputation-v1', users: ['0xabc'], scores: ['100'] };

    await postSignedJson('http://127.0.0.1:1/repcredit/sign', secret, body, { fetchImpl: impl, now: () => 1_700_000_000_000 });

    expect(calls).toHaveLength(1);
    const sent = calls[0];
    // The bytes on the wire, not a re-serialisation of the object.
    expect(sent.body).toBe(JSON.stringify(body));
    expect(sent.headers[HEADER_TIMESTAMP]).toBe('1700000000000');
    expect(sent.headers[HEADER_AUTH]).toBe(expectedHmac(secret, 1_700_000_000_000, sent.body));
    expect(sent.headers['content-type']).toBe('application/json');
  });

  it('detects a signature computed over re-serialised bytes (mutation baseline)', () => {
    // The bug this design avoids: sign the object, send a differently-serialised string.
    const secret = generateExperimentSecret();
    const body = { b: 1, a: 2 };
    const sentBytes = JSON.stringify(body);
    const reSerialised = JSON.stringify({ a: 2, b: 1 });
    const headers = computeAuthHeaders(secret, 1_700_000_000_000, sentBytes);
    expect(headers[HEADER_AUTH]).not.toBe(expectedHmac(secret, 1_700_000_000_000, reSerialised));
  });

  it('mints a new timestamp and token on every retry', async () => {
    const secret = generateExperimentSecret();
    const { impl, calls } = recordingFetch(['network-error', { status: 502 }, { status: 200, body: { ok: true } }]);
    let clock = 1_700_000_000_000;

    const result = await postSignedJson('http://127.0.0.1:1/repcredit/sign', secret, { a: 1 }, {
      fetchImpl: impl,
      now: () => (clock += 1_000),
      sleep: async () => {},
    });

    expect(result.status).toBe(200);
    expect(calls).toHaveLength(3);
    // Same bytes, three DIFFERENT tokens — a reused token would be rejected as a replay.
    expect(new Set(calls.map(c => c.body)).size).toBe(1);
    expect(new Set(calls.map(c => c.headers[HEADER_AUTH])).size).toBe(3);
    expect(new Set(calls.map(c => c.headers[HEADER_TIMESTAMP])).size).toBe(3);
  });

  it('does not retry a 4xx decision or a 503', async () => {
    const secret = generateExperimentSecret();
    for (const status of [400, 401, 403, 413, 503]) {
      const { impl, calls } = recordingFetch([{ status, body: { message: 'nope' } }]);
      const result = await postSignedJson('http://127.0.0.1:1/repcredit/sign', secret, { a: 1 }, {
        fetchImpl: impl,
        sleep: async () => {},
      });
      expect(result.status).toBe(status);
      expect(result.ok).toBe(false);
      expect(calls).toHaveLength(1);
    }
  });

  it('returns non-2xx as data so negative controls can inspect it', async () => {
    const { impl } = recordingFetch([{ status: 400, body: { message: 'chainId mismatch' } }]);
    const result = await postSignedJson('http://127.0.0.1:1/repcredit/sign', generateExperimentSecret(), {}, {
      fetchImpl: impl,
    });
    expect(result).toMatchObject({ ok: false, status: 400, body: { message: 'chainId mismatch' } });
  });

  it('throws without leaking the secret when the node is unreachable', async () => {
    const secret = generateExperimentSecret();
    const { impl } = recordingFetch(['network-error', 'network-error', 'network-error']);
    await expect(
      postSignedJson('http://127.0.0.1:1/repcredit/sign', secret, { a: 1 }, { fetchImpl: impl, sleep: async () => {} }),
    ).rejects.toThrow(ExperimentAuthError);

    try {
      await postSignedJson('http://127.0.0.1:1/repcredit/sign', secret, { a: 1 }, {
        fetchImpl: recordingFetch(['network-error']).impl,
        retries: 0,
      });
      throw new Error('unreachable');
    } catch (error) {
      const rendered = `${(error as Error).message}\n${(error as Error).stack}`;
      expect(rendered).not.toContain(secret);
    }
  });

  it('refuses to sign with an empty secret instead of sending unauthenticated', () => {
    expect(() => computeAuthHeaders('', Date.now(), '{}')).toThrow(ExperimentAuthError);
  });

  it('issues one distinct high-entropy secret per node and refuses unknown nodes', () => {
    const secrets = new ExperimentSecrets();
    const a = secrets.issue('http://127.0.0.1:29301');
    const b = secrets.issue('http://127.0.0.1:29302/');
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(secrets.forEndpoint('http://127.0.0.1:29301/repcredit/sign')).toBe(a);
    expect(secrets.forEndpoint('http://127.0.0.1:29302/repcredit/slash/aggregate')).toBe(b);
    expect(() => secrets.forEndpoint('http://127.0.0.1:29399/repcredit/sign')).toThrow(ExperimentAuthError);
    expect(secrets.values().sort()).toEqual([a, b].sort());
  });

  it('assertSecretsAbsent catches a secret that survived into evidence', () => {
    const secret = generateExperimentSecret();
    expect(() => assertSecretsAbsent(`log line secret=${secret}`, [secret], 'logs/node-1.log')).toThrow(
      /leaked into logs\/node-1\.log/,
    );
    expect(() => assertSecretsAbsent('log line secret=[REDACTED]', [secret], 'logs/node-1.log')).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 2. Upstream contract pin
// ---------------------------------------------------------------------------

const yaaaDir = resolve(
  process.env.REPCREDIT_YAAA_DIR ?? join(process.cwd(), '..', 'YetAnotherAA-Validator'),
);
const guardSource = join(yaaaDir, 'src/modules/repcredit/repcredit-experiment.guard.ts');

describe('YAAA guard contract pin', () => {
  const available = existsSync(guardSource);
  const gate = available ? it : it.skip;

  it('reports whether the upstream guard source was available to pin against', () => {
    if (!available && process.env.REPCREDIT_YAAA_HTTP_TEST === '1') {
      throw new Error(
        `REPCREDIT_YAAA_HTTP_TEST=1 but the YAAA guard source is missing at ${guardSource}. ` +
          'Set REPCREDIT_YAAA_DIR to the checkout.',
      );
    }
    expect(true).toBe(true);
  });

  gate('still uses the same header names and HMAC preimage', () => {
    const source = readFileSync(guardSource, 'utf8');
    expect(source).toContain(`HEADER_TIMESTAMP = "${HEADER_TIMESTAMP}"`);
    expect(source).toContain(`HEADER_AUTH = "${HEADER_AUTH}"`);
    // The preimage. If DVT adds the announced aggregator domain tag, this string changes and this
    // assertion is the thing that tells us to resync — see the CC-49 blocker note.
    expect(source).toContain('createHmac("sha256", this.secret).update(`${ts}.${rawBody}`)');
    expect(source).toContain('auth token already used');
  });
});

// ---------------------------------------------------------------------------
// 3. Real YAAA HTTP integration + negative controls
// ---------------------------------------------------------------------------

const nodeEntry = join(yaaaDir, 'dist/main.js');
const anvilPort = Number(process.env.REPCREDIT_TEST_ANVIL_PORT ?? 18997);
const httpPort = Number(process.env.REPCREDIT_TEST_NODE_PORT ?? 18996);
const canRunHttp = existsSync(nodeEntry);
const forceHttp = process.env.REPCREDIT_YAAA_HTTP_TEST === '1';

async function waitFor(check: () => Promise<boolean>, attempts: number, delayMs: number): Promise<boolean> {
  for (let i = 0; i < attempts; i++) {
    try {
      if (await check()) return true;
    } catch { /* not ready */ }
    await new Promise(r => setTimeout(r, delayMs));
  }
  return false;
}

describe('real YAAA /repcredit HTTP guard', () => {
  const secret = randomBytes(32).toString('hex');
  const base = `http://127.0.0.1:${httpPort}`;
  const endpoint = `${base}/repcredit/sign`;
  let anvil: ChildProcess | undefined;
  let node: ChildProcess | undefined;
  let workdir: string | undefined;
  let booted = false;

  beforeAll(async () => {
    if (!canRunHttp) return;
    workdir = mkdtempSync(join(tmpdir(), 'repcredit-authtest-'));
    mkdirSync(join(workdir, 'data'), { recursive: true });
    anvil = spawn('anvil', ['--port', String(anvilPort), '--chain-id', '31337', '--silent'], {
      stdio: 'ignore',
    });
    const chainUp = await waitFor(async () => {
      const r = await fetch(`http://127.0.0.1:${anvilPort}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }),
      });
      return r.ok;
    }, 60, 250);
    if (!chainUp) return;

    node = spawn('node', [nodeEntry], {
      cwd: workdir,
      // The secret goes through the ENVIRONMENT, never argv — the property under test in the runner.
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        NODE_ENV: 'test',
        PORT: String(httpPort),
        PUBLIC_URL: base,
        ETH_RPC_URL: `http://127.0.0.1:${anvilPort}`,
        VALIDATOR_CONTRACT_ADDRESS: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
        ENTRY_POINT_ADDRESS: '0x0000000071727De22E5E9d8BAf0edAc6f37da032',
        REPCREDIT_EXPERIMENT_SIGNING: 'true',
        REPCREDIT_BLS_AGGREGATOR_ADDRESS: '0x1111111111111111111111111111111111111111',
        REPCREDIT_VALIDATOR_SLOT: '1',
        REPCREDIT_EXPERIMENT_AUTH_SECRET: secret,
      },
      stdio: 'ignore',
    });
    // Readiness = the guard answers. `/node/info` is NOT usable here: a fresh node has no state
    // file ("Node is not created yet"), so it never returns ok and the wait would always time out.
    booted = await waitFor(async () => {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      });
      return response.status === 401; // armed, guarded, and refusing unauthenticated callers
    }, 160, 250);
  }, 90_000);

  afterAll(async () => {
    node?.kill('SIGTERM');
    anvil?.kill('SIGTERM');
    await new Promise(r => setTimeout(r, 300));
    if (workdir) rmSync(workdir, { recursive: true, force: true });
  });

  it('has a live node to test against (or is explicitly allowed to skip)', () => {
    if (!booted && forceHttp) {
      throw new Error(
        `REPCREDIT_YAAA_HTTP_TEST=1 but no YAAA node came up. entry=${nodeEntry} exists=${canRunHttp}. ` +
          'Build the sibling checkout (pnpm build) and make sure anvil is on PATH.',
      );
    }
    if (!booted) {
      // Visible in the test output: this suite did NOT verify anything this run.
      console.warn(
        `[skip] real YAAA HTTP guard tests: node not booted (entry present: ${canRunHttp}). ` +
          'Set REPCREDIT_YAAA_HTTP_TEST=1 to make this a failure.',
      );
    }
    expect(true).toBe(true);
  });

  /**
   * Dynamic gate. It CANNOT be `booted ? it : it.skip` at describe time: the describe body runs
   * during collection, before `beforeAll` has booted anything, so that form skips every test even
   * on a machine where the node comes up fine — a silently vacuous suite.
   */
  const requireLive = (ctx: { skip: () => void }): void => {
    if (booted) return;
    if (forceHttp) throw new Error('REPCREDIT_YAAA_HTTP_TEST=1 but the YAAA node did not boot');
    ctx.skip();
  };
  const post = async (body: string, headers: Record<string, string>) => {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body,
    });
    let parsed: any;
    try { parsed = await response.json(); } catch { parsed = await response.text(); }
    return { status: response.status, body: parsed };
  };
  // A well-formed proposal is not required: these assert WHERE the request was refused, and the
  // guard runs before the service. The happy path asserts we got past the guard, not that the
  // proposal was accepted.
  const proposal = () => JSON.stringify({ schemaVersion: 'repcredit-reputation-v1', proposalId: '1' });

  /** Messages only the admission guard produces. Anything else means the service answered. */
  const GUARD_MESSAGE = /missing X-RepCredit|HMAC verification failed|timestamp outside|already used|replay cache is full|signing is disabled|server secret is unset|body exceeds|loopback callers only/i;
  const expectPastTheGuard = (result: { status: number; body: any }) => {
    // Not a status assertion on purpose: the RepCredit SERVICE legitimately answers 400 or 403
    // depending on which of its own checks fires first, and DVT is still changing those (the
    // in-flight round 2 adds an explicit-AUDIT_BLS_AGGREGATOR_ADDRESS refusal). What must hold is
    // that the request was ADMITTED — i.e. refused by the service, never by the guard.
    expect(result.status).not.toBe(401);
    expect(String(result.body?.message)).not.toMatch(GUARD_MESSAGE);
  };

  it('rejects an unsigned request (this is why the client exists)', async ctx => {
    requireLive(ctx);
    const result = await post(proposal(), {});
    expect(result.status).toBe(401);
    expect(String(result.body?.message)).toMatch(/missing X-RepCredit/i);
  }, 20_000);

    it('rejects a wrong secret', async ctx => {
    requireLive(ctx);
    const raw = proposal();
    const ts = Date.now();
    const result = await post(raw, {
      [HEADER_TIMESTAMP]: String(ts),
      [HEADER_AUTH]: expectedHmac(randomBytes(32).toString('hex'), ts, raw),
    });
    expect(result.status).toBe(403);
    expect(String(result.body?.message)).toMatch(/HMAC verification failed/i);
  }, 20_000);

    it('rejects a stale timestamp', async ctx => {
    requireLive(ctx);
    const raw = proposal();
    const ts = Date.now() - 10 * 60_000;
    const result = await post(raw, { [HEADER_TIMESTAMP]: String(ts), [HEADER_AUTH]: expectedHmac(secret, ts, raw) });
    expect(result.status).toBe(401);
    expect(String(result.body?.message)).toMatch(/timestamp outside/i);
  }, 20_000);

    it('rejects a body mutated after signing', async ctx => {
    requireLive(ctx);
    const raw = proposal();
    const ts = Date.now();
    const headers = { [HEADER_TIMESTAMP]: String(ts), [HEADER_AUTH]: expectedHmac(secret, ts, raw) };
    const result = await post(`${raw} `, headers); // one byte of trailing whitespace
    expect(result.status).toBe(403);
    expect(String(result.body?.message)).toMatch(/HMAC verification failed/i);
  }, 20_000);

    it('accepts a correctly signed request and rejects its replay', async ctx => {
    requireLive(ctx);
    const raw = proposal();
    const ts = Date.now();
    const headers = { [HEADER_TIMESTAMP]: String(ts), [HEADER_AUTH]: expectedHmac(secret, ts, raw) };

    const first = await post(raw, headers);
    expectPastTheGuard(first);

    const replay = await post(raw, headers);
    expect(replay.status).toBe(403);
    expect(String(replay.body?.message)).toMatch(/auth token already used/i);
  }, 20_000);

    it('the client itself gets through the real guard, twice in a row', async ctx => {
    requireLive(ctx);
    const body = { schemaVersion: 'repcredit-reputation-v1', proposalId: '2' };
    const first = await postSignedJson<any>(endpoint, secret, body);
    const second = await postSignedJson<any>(endpoint, secret, body);
    // Same payload, two independent tokens: neither may be refused as a replay.
    for (const result of [first, second]) expectPastTheGuard(result);
  }, 20_000);

    it('never puts the secret on the node process command line', async ctx => {
    requireLive(ctx);
    const { execFileSync } = await import('node:child_process');
    const args = execFileSync('ps', ['-o', 'command=', '-p', String(node!.pid)], { encoding: 'utf8' });
    expect(args).not.toContain(secret);
  }, 20_000);
});
