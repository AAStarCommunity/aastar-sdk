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
import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { createHmac, randomBytes } from 'node:crypto';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  ExperimentAuthError,
  ExperimentSecrets,
  HEADER_AUTH,
  HEADER_SCHEME,
  HEADER_TIMESTAMP,
  REPCREDIT_AUTH_SCHEME,
  assertSecretsAbsent,
  computeAuthHeaders,
  generateExperimentSecret,
  buildAuthPreimage,
  postSignedJson,
  requestTargetOf,
} from './experiment-auth.js';
import { REJECTION_CODES, assertHttpRejections, classifyHttpRejection } from './negative-control.js';
import { readPinnedServiceRevision, resolveDeclaredRevision, type RevisionOrigin } from './upstream-pin.js';

/**
 * Independent reimplementation of the guard's v2 preimage; never calls the code under test.
 * Kept literal (not built from `buildAuthPreimage`) so a bug in the helper cannot validate itself.
 */
const expectedHmac = (
  secret: string,
  ts: number | string,
  rawBody: string,
  target = '/repcredit/sign',
  method = 'POST',
) => createHmac('sha256', secret).update(['v2', method, target, String(ts), rawBody].join('\n')).digest('hex');

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
    expect(sent.headers[HEADER_SCHEME]).toBe(REPCREDIT_AUTH_SCHEME);
    expect(sent.headers[HEADER_AUTH]).toBe(expectedHmac(secret, 1_700_000_000_000, sent.body));
    expect(sent.headers['content-type']).toBe('application/json');
  });

  it('detects a signature computed over re-serialised bytes (mutation baseline)', () => {
    // The bug this design avoids: sign the object, send a differently-serialised string.
    const secret = generateExperimentSecret();
    const body = { b: 1, a: 2 };
    const sentBytes = JSON.stringify(body);
    const reSerialised = JSON.stringify({ a: 2, b: 1 });
    const input = { method: 'POST', requestTarget: '/repcredit/sign', timestampMs: 1_700_000_000_000 };
    const headers = computeAuthHeaders(secret, { ...input, rawBody: sentBytes });
    expect(headers[HEADER_AUTH]).not.toBe(expectedHmac(secret, 1_700_000_000_000, reSerialised));
  });

  // v2 binds the verb and the request target (YAAA df9c8a35). A token minted for one endpoint
  // must not authenticate another — that is the whole point of the scheme bump.
  it('binds the method and the request target into the preimage (v2)', () => {
    const secret = generateExperimentSecret();
    const raw = JSON.stringify({ proposalId: '1' });
    const base = { timestampMs: 1_700_000_000_000, rawBody: raw };
    const sign = computeAuthHeaders(secret, { ...base, method: 'POST', requestTarget: '/repcredit/sign' });
    const aggregate = computeAuthHeaders(secret, { ...base, method: 'POST', requestTarget: '/repcredit/aggregate' });
    const asGet = computeAuthHeaders(secret, { ...base, method: 'GET', requestTarget: '/repcredit/sign' });
    expect(sign[HEADER_AUTH]).not.toBe(aggregate[HEADER_AUTH]);
    expect(sign[HEADER_AUTH]).not.toBe(asGet[HEADER_AUTH]);
    // Byte-for-byte against the upstream preimage, rebuilt independently.
    expect(sign[HEADER_AUTH]).toBe(expectedHmac(secret, 1_700_000_000_000, raw, '/repcredit/sign'));
    expect(aggregate[HEADER_AUTH]).toBe(expectedHmac(secret, 1_700_000_000_000, raw, '/repcredit/aggregate'));
  });

  it('signs the request target as sent on the wire — path plus query, never the origin', () => {
    expect(requestTargetOf('http://127.0.0.1:29301/repcredit/sign')).toBe('/repcredit/sign');
    expect(requestTargetOf('http://127.0.0.1:29301/repcredit/slash/aggregate?x=1')).toBe('/repcredit/slash/aggregate?x=1');
  });

  /** LOW-2: the collision that survived the per-call clock — two SEPARATE posts, same ms, same body. */
  it('mints a distinct token across two separate calls that land in the same millisecond', async () => {
    const frozen = () => 1_700_000_000_000;
    const sent: string[] = [];
    const fetchImpl = (async (_url: string, init: any) => {
      sent.push(init.headers[HEADER_AUTH]);
      return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
    }) as unknown as typeof fetch;
    const secret = generateExperimentSecret();
    const body = { proposalId: '1' };
    await postSignedJson('http://127.0.0.1:1/repcredit/sign', secret, body, { now: frozen, fetchImpl });
    await postSignedJson('http://127.0.0.1:1/repcredit/sign', secret, body, { now: frozen, fetchImpl });
    expect(sent).toHaveLength(2);
    expect(sent[0]).not.toBe(sent[1]);
  });

  it('mints a distinct token even when two attempts land in the same millisecond', async () => {
    // Token uniqueness must not depend on Date.now() advancing: a frozen clock would otherwise
    // produce an identical preimage, which the node rejects as a replay — an unretryable retry.
    const secret = generateExperimentSecret();
    const { impl, calls } = recordingFetch([{ status: 502 }, { status: 502 }, { status: 200, body: {} }]);
    await postSignedJson('http://127.0.0.1:1/repcredit/sign', secret, { a: 1 }, {
      fetchImpl: impl,
      now: () => 1_700_000_000_000, // frozen
      sleep: async () => {},
    });
    const tokens = calls.map(call => call.headers[HEADER_AUTH]);
    expect(new Set(tokens).size).toBe(tokens.length);
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
    expect(() =>
      computeAuthHeaders('', { method: 'POST', requestTarget: '/repcredit/sign', timestampMs: Date.now(), rawBody: '{}' }),
    ).toThrow(ExperimentAuthError);
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
// 2. Upstream contract pin — against a COMMITTED revision, never a dirty workspace
// ---------------------------------------------------------------------------

/**
 * CC-50 round-3 MEDIUM-2.
 *
 * The previous version of this pin `readFileSync`-ed the sibling checkout's WORKING COPY of the
 * guard. That made the SDK's own gate a function of whether someone in another repository had
 * unsaved edits: it flipped red the moment DVT started its third round (binding method +
 * requestTarget into the preimage and versioning the header scheme), and when it was green it
 * could not say WHICH upstream revision it was green against.
 *
 * Everything upstream is now read out of git at a committed revision:
 *   - the revision is resolved once and PRINTED, so a pass states what it verified;
 *   - the guard source comes from `git show <rev>:<path>`, never from the working tree;
 *   - a dirty upstream checkout makes the real-HTTP suite unusable (the built `dist/` cannot be
 *     attributed to any revision), and REPCREDIT_YAAA_HTTP_TEST=1 turns that into a failure;
 *   - the REVIEWED revision lives IN THIS REPO (`scripts/upstream-abi-pin.json` -> services), so a
 *     local run states which commit it was supposed to verify against instead of silently verifying
 *     whatever happens to be checked out (CC-50 round-5 LOW-1: the local checkout had moved on to a
 *     newer DVT commit and every assertion still passed, green, against the wrong revision);
 *   - REPCREDIT_YAAA_REV may still narrow a LOCAL run to a different commit while a cross-repo
 *     round is in flight, but it CANNOT override the in-repo pin in required/release mode
 *     (REPCREDIT_YAAA_HTTP_TEST=1): there, disagreeing with the pin is a hard failure, which also
 *     makes a drift between the pin and the ref CI checks out impossible to miss.
 */
const REVIEWED_YAAA_REV = readPinnedServiceRevision('YetAnotherAA-Validator');
const yaaaDir = resolve(
  process.env.REPCREDIT_YAAA_DIR ?? join(process.cwd(), '..', 'YetAnotherAA-Validator'),
);
const GUARD_PATH = 'src/modules/repcredit/repcredit-experiment.guard.ts';
const forceHttp = process.env.REPCREDIT_YAAA_HTTP_TEST === '1';

type UpstreamPin = {
  present: boolean;
  rev: string | null;
  dirty: boolean;
  dirtyPaths: string[];
  declaredRev: string | null;
  /** Where `declaredRev` came from — printed, so a run says what authority it verified against. */
  declaredFrom: RevisionOrigin;
  /** Why the upstream cannot be used as a pinned reference, or null when it can. */
  unusable: string | null;
};

function resolveUpstreamPin(): UpstreamPin {
  const declared = resolveDeclaredRevision({
    required: forceHttp,
    envRev: process.env.REPCREDIT_YAAA_REV ?? null,
    pinnedRev: REVIEWED_YAAA_REV,
  });
  const declaredRev = declared.rev;
  const base: UpstreamPin = {
    present: false,
    rev: null,
    dirty: false,
    dirtyPaths: [],
    declaredRev,
    declaredFrom: declared.from,
    unusable: null,
  };
  if (declared.conflict) return { ...base, unusable: declared.conflict };
  if (!existsSync(join(yaaaDir, GUARD_PATH))) {
    return { ...base, unusable: `no YAAA checkout at ${yaaaDir} (set REPCREDIT_YAAA_DIR)` };
  }
  let rev: string;
  let porcelain: string;
  try {
    rev = execFileSync('git', ['-C', yaaaDir, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    porcelain = execFileSync('git', ['-C', yaaaDir, 'status', '--porcelain'], { encoding: 'utf8' });
  } catch (error) {
    return { ...base, present: true, unusable: `${yaaaDir} is not a usable git checkout: ${String(error)}` };
  }
  const dirtyPaths = porcelain.split('\n').map(line => line.trim()).filter(Boolean);
  const pin: UpstreamPin = {
    present: true,
    rev,
    dirty: dirtyPaths.length > 0,
    dirtyPaths,
    declaredRev,
    declaredFrom: declared.from,
    unusable: null,
  };
  if (declaredRev && !rev.startsWith(declaredRev)) {
    return {
      ...pin,
      unusable: `the reviewed revision is ${declaredRev} (${declared.from}) but the checkout is at ${rev}`,
    };
  }
  if (pin.dirty) {
    return { ...pin, unusable: `the YAAA checkout at ${rev.slice(0, 8)} has ${dirtyPaths.length} uncommitted change(s)` };
  }
  return pin;
}

const pin = resolveUpstreamPin();

/** Guard source AS COMMITTED at the pinned revision. Never the working tree. */
function committedGuardSource(): string {
  return execFileSync('git', ['-C', yaaaDir, 'show', `${pin.rev}:${GUARD_PATH}`], {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
}

/**
 * The authority rule itself, tested as a pure function (CC-50 round-5 LOW-1).
 *
 * The module-level `pin` above is resolved once at import from the real environment, so it cannot
 * exercise both modes in one process. These cases do — and a guard nobody can make fire is not a
 * guard: each one below FAILS if the env var is ever allowed to redirect a release-grade run.
 */
describe('reviewed-revision authority', () => {
  const PINNED = 'e0b5efe3c5e86bd070b6e9dc90f8ebd69c4133f9';

  it('release mode takes the revision from the repo, not the environment', () => {
    const resolved = resolveDeclaredRevision({ required: true, envRev: null, pinnedRev: PINNED });
    expect(resolved).toEqual({ rev: PINNED, from: 'scripts/upstream-abi-pin.json', conflict: null });
  });

  it('release mode REFUSES an env var that points somewhere else', () => {
    const resolved = resolveDeclaredRevision({
      required: true,
      envRev: '664ec92185249f231b9e0d276570cedde93c429b',
      pinnedRev: PINNED,
    });
    expect(resolved.conflict).toContain('disagrees with the reviewed revision');
    // ...and it still reports the PIN as the revision, so nothing downstream silently follows the env.
    expect(resolved.rev).toBe(PINNED);
  });

  it('release mode accepts an env var that merely abbreviates the pin', () => {
    expect(resolveDeclaredRevision({ required: true, envRev: PINNED.slice(0, 8), pinnedRev: PINNED }).conflict).toBeNull();
  });

  it('release mode refuses to run at all when the repo declares no reviewed revision', () => {
    const resolved = resolveDeclaredRevision({ required: true, envRev: PINNED, pinnedRev: null });
    expect(resolved.rev).toBeNull();
    expect(resolved.conflict).toContain('cannot authorise a release-grade verification');
  });

  it('local mode may narrow to another commit, and says where that came from', () => {
    const resolved = resolveDeclaredRevision({ required: false, envRev: 'deadbeef', pinnedRev: PINNED });
    expect(resolved).toEqual({ rev: 'deadbeef', from: 'REPCREDIT_YAAA_REV', conflict: null });
  });

  it('local mode with no env var falls back to the in-repo pin instead of "whatever is checked out"', () => {
    expect(resolveDeclaredRevision({ required: false, envRev: null, pinnedRev: PINNED })).toEqual({
      rev: PINNED,
      from: 'scripts/upstream-abi-pin.json',
      conflict: null,
    });
  });

  it('the repo really does declare one (the file, not just the helper)', () => {
    expect(REVIEWED_YAAA_REV).toMatch(/^[0-9a-f]{40}$/);
  });
});

describe('YAAA guard contract pin', () => {
  it('states the upstream revision it is pinned against', () => {
    const where = pin.rev ? `${pin.rev} (${pin.dirty ? `DIRTY: ${pin.dirtyPaths.length} change(s)` : 'clean'})` : 'absent';
    // Print the DECLARED revision next to the checked-out one: "green" only means something if the
    // reader can see the two agreed (CC-50 round-5 LOW-1).
    console.info(
      `[pin] YAAA ${yaaaDir} @ ${where}; reviewed revision ${pin.declaredRev ?? '(none declared)'} ` +
        `[${pin.declaredFrom}]${forceHttp ? ' (required mode: the in-repo pin is authoritative)' : ''}`,
    );
    if (pin.unusable && forceHttp) {
      throw new Error(
        `REPCREDIT_YAAA_HTTP_TEST=1 requires a clean YAAA checkout at the REVIEWED revision, but ${pin.unusable}. ` +
          'Check out the revision pinned in scripts/upstream-abi-pin.json (CI checks it out by ref), or — ' +
          'if the reviewed revision is meant to move — update that pin in the commit that reviews the new ' +
          'one. In required mode REPCREDIT_YAAA_REV cannot redirect this at another commit.',
      );
    }
    if (!pin.rev) {
      console.warn(`[skip] YAAA guard contract pin: ${pin.unusable}`);
    }
    expect(true).toBe(true);
  });

  it('still uses the same header names and scheme version at the pinned revision', ctx => {
    if (!pin.rev) {
      if (forceHttp) throw new Error(`REPCREDIT_YAAA_HTTP_TEST=1 but ${pin.unusable}`);
      ctx.skip();
      return;
    }
    // Read from git, so a colleague's in-progress edit in another repository can neither break
    // nor silently satisfy this assertion.
    const source = committedGuardSource();
    expect(source).toContain(`HEADER_TIMESTAMP = "${HEADER_TIMESTAMP}"`);
    expect(source).toContain(`HEADER_AUTH = "${HEADER_AUTH}"`);
    expect(source).toContain(`HEADER_SCHEME = "${HEADER_SCHEME}"`);
    expect(source).toContain(`REPCREDIT_AUTH_SCHEME = "${REPCREDIT_AUTH_SCHEME}"`);
    expect(source).toContain('auth token already used');
  });

  /**
   * The preimage itself, field by field. This is the assertion that told us to resync: it went red
   * the moment DVT committed the v2 scheme (method + request target), instead of the whole evidence
   * run failing later with an opaque 401.
   */
  it('pins the exact v2 preimage field order', ctx => {
    if (!pin.rev) {
      if (forceHttp) throw new Error(`REPCREDIT_YAAA_HTTP_TEST=1 but ${pin.unusable}`);
      ctx.skip();
      return;
    }
    const source = committedGuardSource();
    const builder = source.slice(source.indexOf('export function buildRepCreditAuthPreimage'));
    const body = builder.slice(0, builder.indexOf('}\n'));
    const fields = ['REPCREDIT_AUTH_SCHEME', 'String(input.method).toUpperCase()', 'input.requestTarget', 'String(input.timestampMs)', 'input.rawBody'];
    let cursor = -1;
    for (const field of fields) {
      const at = body.indexOf(field, cursor + 1);
      expect(at, `${field} must appear, in order, in the upstream preimage`).toBeGreaterThan(cursor);
      cursor = at;
    }
    expect(body).toContain('join("\\n")');
    // ...and the client reproduces it byte-for-byte.
    expect(buildAuthPreimage({ method: 'post', requestTarget: '/repcredit/sign', timestampMs: 7, rawBody: '{}' }))
      .toBe(['v2', 'POST', '/repcredit/sign', '7', '{}'].join('\n'));
  });

  /**
   * The next schema change gets the same treatment: this fails loudly rather than letting the
   * runner sign with a version the node no longer accepts. The SDK never invents a version ahead
   * of upstream (CC-50/CC-49).
   */
  it('has not moved past the scheme version the client implements', ctx => {
    if (!pin.rev) {
      if (forceHttp) throw new Error(`REPCREDIT_YAAA_HTTP_TEST=1 but ${pin.unusable}`);
      ctx.skip();
      return;
    }
    const match = /REPCREDIT_AUTH_SCHEME = "([^"]+)"/.exec(committedGuardSource());
    expect(match?.[1]).toBe(REPCREDIT_AUTH_SCHEME);
  });
});

// ---------------------------------------------------------------------------
// 3. Real YAAA HTTP integration + negative controls
// ---------------------------------------------------------------------------

const nodeEntry = join(yaaaDir, 'dist/main.js');
const anvilPort = Number(process.env.REPCREDIT_TEST_ANVIL_PORT ?? 18997);
const httpPort = Number(process.env.REPCREDIT_TEST_NODE_PORT ?? 18996);
/**
 * The real-HTTP suite runs the sibling's BUILD ARTIFACT. It is therefore only meaningful when the
 * upstream checkout is clean and pinned: a dist built from a dirty tree cannot be attributed to any
 * revision, and its red/green would just mirror another repository's work in progress.
 *
 * A clean tree is still not enough — `dist/` can predate the pinned commit. A stale artifact runs
 * an OLDER guard than the one the pin verified, so every case in this suite would be testing
 * something other than what the report claims. This deliberately does NOT rebuild the sibling
 * checkout — writing into another repository's tree while its owner is working there is not this
 * gate's business.
 *
 * WHAT THIS CAN AND CANNOT PROVE (CC-50 round-3 LOW-3, widened round-4). The markers below are
 * "not older than" witnesses, one per upstream round, each a string that CANNOT exist in a build
 * made before the revision that introduced it:
 *
 *   - `X-RepCredit-Scheme`               → round 3 (versioned HMAC scheme header)
 *   - `REPCREDIT_AUTH_SCHEME_UNSUPPORTED` → `e0b5efe` (the versioned error-code table)
 *
 * That is a LOWER BOUND, not an identity: it still cannot prove the artifact was built from
 * exactly the pinned commit, only that it is at least that new. Making it exact needs the upstream
 * to stamp its own revision into the build — see the ABI-side equivalent, which achieves identity
 * because foundry artifacts record `metadata.sources[*].keccak256` (scripts/check-abi-drift.ts).
 * A `nest build` records nothing comparable, so this stays a bound until DVT stamps one.
 */
const ARTIFACT_MARKERS: { marker: string; since: string }[] = [
  { marker: HEADER_SCHEME, since: 'the round-3 versioned HMAC scheme' },
  { marker: 'REPCREDIT_AUTH_SCHEME_UNSUPPORTED', since: 'the e0b5efe structured error-code table' },
];

function artifactMatchesPin(): string | null {
  if (!existsSync(nodeEntry)) return `no build artifact at ${nodeEntry}`;
  // `nest build` emits file-per-file, so the guard lands at the mirrored path; a bundled build
  // would instead inline it into main.js. Check the mirrored path when it exists, else the bundle.
  const compiledGuard = join(yaaaDir, 'dist', GUARD_PATH.replace(/^src\//, '').replace(/\.ts$/, '.js'));
  const artifact = existsSync(compiledGuard) ? compiledGuard : nodeEntry;
  const compiled = readFileSync(artifact, 'utf8');
  for (const { marker, since } of ARTIFACT_MARKERS) {
    if (!compiled.includes(marker)) {
      return `the build artifact at ${artifact} predates the pinned revision (no "${marker}", i.e. it was built before ${since}) — run \`npm run build\` in the YAAA checkout`;
    }
  }
  return null;
}

const artifactProblem = pin.unusable ?? artifactMatchesPin();
const canRunHttp = artifactProblem === null;

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
        // Throwaway devnet (chain 31337) with nothing deployed. Upstream refuses to arm on the
        // INHERITED Sepolia default for AUDIT_BLS_AGGREGATOR_ADDRESS, and refuses this
        // acknowledgement outright on any chain that carries real deployments — so the only way
        // past `requireArmed()` here is to state explicitly that this chain hosts no production
        // aggregator. Without it every request stops at REPCREDIT_AGGREGATOR_POLICY_VIOLATION and
        // the service's own validation is never reached.
        REPCREDIT_NO_PRODUCTION_AGGREGATOR: 'true',
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
    if (artifactProblem && forceHttp) {
      throw new Error(`REPCREDIT_YAAA_HTTP_TEST=1 but the pinned YAAA node is not runnable: ${artifactProblem}`);
    }
    if (!booted && forceHttp) {
      throw new Error(
        `REPCREDIT_YAAA_HTTP_TEST=1 but no YAAA node came up. entry=${nodeEntry} usable=${canRunHttp}` +
          `${artifactProblem ? ` (${artifactProblem})` : ''}. Build the pinned sibling checkout (pnpm build) ` +
          'and make sure anvil is on PATH.',
      );
    }
    if (!booted) {
      // Visible in the test output: this suite did NOT verify anything this run.
      console.warn(
        `[skip] real YAAA HTTP guard tests: not runnable (${artifactProblem}). ` +
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
      // The scheme header is mandatory upstream; individual cases override it to test the gate.
      headers: { 'content-type': 'application/json', [HEADER_SCHEME]: REPCREDIT_AUTH_SCHEME, ...headers },
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
  const GUARD_MESSAGE = /missing X-RepCredit|X-RepCredit-Scheme must be|HMAC verification failed|timestamp outside|already used|replay cache is full|signing is disabled|server secret is unset|body exceeds|loopback callers only|raw request body unavailable/i;
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

    it('rejects a request with no scheme header (v2 is mandatory upstream)', async ctx => {
    requireLive(ctx);
    const raw = proposal();
    const ts = Date.now();
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        [HEADER_TIMESTAMP]: String(ts),
        [HEADER_AUTH]: expectedHmac(secret, ts, raw, requestTargetOf(endpoint)),
      },
      body: raw,
    });
    expect(response.status).toBe(401);
  }, 20_000);

  it('rejects a token minted for a DIFFERENT endpoint (v2 binds the request target)', async ctx => {
    requireLive(ctx);
    const raw = proposal();
    const ts = Date.now();
    const result = await post(raw, {
      [HEADER_TIMESTAMP]: String(ts),
      // Signed for /repcredit/aggregate, sent to /repcredit/sign.
      [HEADER_AUTH]: expectedHmac(secret, ts, raw, '/repcredit/aggregate'),
    });
    expect(result.status).toBe(403);
    expect(String(result.body?.message)).toMatch(/HMAC verification failed/i);
  }, 20_000);

  it('rejects a wrong secret', async ctx => {
    requireLive(ctx);
    const raw = proposal();
    const ts = Date.now();
    const result = await post(raw, {
      [HEADER_TIMESTAMP]: String(ts),
      [HEADER_AUTH]: expectedHmac(randomBytes(32).toString('hex'), ts, raw, requestTargetOf(endpoint)),
    });
    expect(result.status).toBe(403);
    expect(String(result.body?.message)).toMatch(/HMAC verification failed/i);
  }, 20_000);

    it('rejects a stale timestamp', async ctx => {
    requireLive(ctx);
    const raw = proposal();
    const ts = Date.now() - 10 * 60_000;
    const result = await post(raw, {
      [HEADER_TIMESTAMP]: String(ts),
      [HEADER_AUTH]: expectedHmac(secret, ts, raw, requestTargetOf(endpoint)),
    });
    expect(result.status).toBe(401);
    expect(String(result.body?.message)).toMatch(/timestamp outside/i);
  }, 20_000);

    it('rejects a body mutated after signing', async ctx => {
    requireLive(ctx);
    const raw = proposal();
    const ts = Date.now();
    const headers = {
      [HEADER_TIMESTAMP]: String(ts),
      [HEADER_AUTH]: expectedHmac(secret, ts, raw, requestTargetOf(endpoint)),
    };
    const result = await post(`${raw} `, headers); // one byte of trailing whitespace
    expect(result.status).toBe(403);
    expect(String(result.body?.message)).toMatch(/HMAC verification failed/i);
  }, 20_000);

    it('accepts a correctly signed request and rejects its replay', async ctx => {
    requireLive(ctx);
    const raw = proposal();
    const ts = Date.now();
    const headers = {
      [HEADER_TIMESTAMP]: String(ts),
      [HEADER_AUTH]: expectedHmac(secret, ts, raw, requestTargetOf(endpoint)),
    };

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
    const args = execFileSync('ps', ['-o', 'command=', '-p', String(node!.pid)], { encoding: 'utf8' });
    expect(args).not.toContain(secret);
  }, 20_000);

  /**
   * The structured error envelope, verified against the REAL node rather than a fixture.
   *
   * YAAA `e0b5efe` ships a versioned, append-only error-code table so the SDK can stop branching on
   * English prose. This asserts three things the SDK now depends on, end to end over HTTP:
   *
   *   1. the node really emits `{ errorCodeVersion, errorCode, category }` on a service refusal;
   *   2. the SDK's classifier reads it and lands on SERVICE_VALIDATION (the evidence-bearing class);
   *   3. REQUIRE MODE bites — the SAME response with the envelope removed FAILS the control instead
   *      of silently degrading to prose matching (CC-50 round-4 LOW-1).
   *
   * A `chainId` mismatch is used because `validateRepCreditProposal` runs before any on-chain read,
   * so the case is reachable on a bare anvil with nothing deployed.
   */
  it('emits the versioned structured error envelope the SDK now requires', async ctx => {
    requireLive(ctx);
    const localChainId = 31337;
    const result = await postSignedJson<any>(endpoint, secret, {
      schemaVersion: 'repcredit-reputation-v1',
      proposalId: '3',
      operator: '0x0000000000000000000000000000000000000000',
      slashLevel: 0,
      users: ['0x0000000000000000000000000000000000000001'],
      scores: ['100'],
      epoch: '1',
      chainId: String(localChainId + 1),
      messageHash: `0x${'11'.repeat(32)}`,
    });

    console.info(`[envelope] HTTP ${result.status} ${JSON.stringify(result.body)}`);
    expect(result.status).toBe(400);
    expect(result.body?.errorCodeVersion).toBe(1);
    expect(result.body?.errorCode).toBe('REPCREDIT_PROPOSAL_INVALID');
    expect(result.body?.category).toBe('validation');

    const control = {
      demonstrates: 'the node rebinds chainId to its own RPC and refuses a foreign one',
      upstreamCode: 'REPCREDIT_PROPOSAL_INVALID',
      reason: /chainId mismatch: request=/i,
    };
    expect(() => assertHttpRejections({ wrongChain: result }, { wrongChain: control })).not.toThrow();
    expect(classifyHttpRejection(result.status, result.body).code).toBe(REJECTION_CODES.SERVICE_VALIDATION);

    // Same real response, envelope stripped: require mode must refuse to fall back to prose.
    const stripped = { ...(result.body as Record<string, unknown>) };
    delete stripped.errorCode;
    delete stripped.category;
    expect(() =>
      assertHttpRejections(
        { wrongChain: { ok: false, status: result.status, body: stripped } },
        { wrongChain: control },
      ),
    ).toThrow(/requires the structured error code REPCREDIT_PROPOSAL_INVALID/);
  }, 20_000);
});
