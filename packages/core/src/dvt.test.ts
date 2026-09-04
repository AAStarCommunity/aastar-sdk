import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { DVT_CONFIG, getDvtConfig, getDvtRelayerUrls, getDvtRelayerUrlsForChain, checkDvtConnectivity } from './dvt.js';

/**
 * `getDvtConfig()` / `getDvtRelayerUrls()` with no argument honour AASTAR_DVT_ENV, so any assertion
 * about the DEFAULT environment is only meaningful with that variable unset. CI never sets it, which
 * is why this was invisible — but `AASTAR_DVT_ENV=testnet-local` is now the documented way to run
 * DVT-dependent E2E against local nodes, so a developer with it exported in their shell would see
 * these fail for no reason. Clear it per-test and restore it.
 */
let savedDvtEnv: string | undefined;
beforeEach(() => {
  savedDvtEnv = process.env.AASTAR_DVT_ENV;
  delete process.env.AASTAR_DVT_ENV;
});
afterEach(() => {
  if (savedDvtEnv === undefined) delete process.env.AASTAR_DVT_ENV;
  else process.env.AASTAR_DVT_ENV = savedDvtEnv;
});

describe('DVT config', () => {
  it('defaults to the sepolia environment with 3 nodes', () => {
    const env = getDvtConfig();
    expect(DVT_CONFIG.active).toBe('sepolia');
    expect(env.chainId).toBe(11155111);
    expect(env.dvtNodes).toHaveLength(3);
    expect(env.capabilities).toEqual({ dvtSigning: true, relay: true, keeper: true });
  });

  it('throws for an unconfigured environment (mainnet placeholder)', () => {
    expect(() => getDvtConfig('mainnet')).toThrow(/not configured/);
  });

  it('getDvtRelayerUrls returns the node base URLs', () => {
    expect(getDvtRelayerUrls()).toEqual([
      'https://dvt1.aastar.io',
      'https://dvt2.aastar.io',
      'https://dvt3.aastar.io',
    ]);
  });

  it('getDvtRelayerUrlsForChain maps Sepolia → the 3 nodes, unknown chain → []', () => {
    expect(getDvtRelayerUrlsForChain(11155111)).toHaveLength(3);
    expect(getDvtRelayerUrlsForChain(999999)).toEqual([]);
  });

  it('AASTAR_DVT_ENV env var overrides the default active', () => {
    const prev = process.env.AASTAR_DVT_ENV;
    process.env.AASTAR_DVT_ENV = 'mainnet'; // configured as null placeholder
    try {
      expect(() => getDvtConfig()).toThrow(/mainnet.*not configured/);
    } finally {
      if (prev === undefined) delete process.env.AASTAR_DVT_ENV;
      else process.env.AASTAR_DVT_ENV = prev;
    }
  });
});

describe('checkDvtConnectivity', () => {
  const node = DVT_CONFIG.environments.sepolia!.dvtNodes[0];
  const okFetch = (overrides: Record<string, any> = {}) =>
    vi.fn(async (url: string) => {
      const body =
        // `dvtSigning` was missing from this fixture until FU-35, and nothing noticed — the config
        // declares it, but only `relay` was ever compared against what the node reports. A healthy
        // Sepolia node offers all three, so the fixture now says so.
        url.endsWith('/health') ? { status: 'ok', capabilities: [{ name: 'dvtSigning', enabled: true }, { name: 'relay', enabled: true }, { name: 'keeper', enabled: true }] }
        : url.endsWith('/node/info') ? { nodeId: node.nodeId }
        : url.endsWith('/relay/health') ? { status: 'ok', operator: '0xabc' }
        : {};
      return { json: async () => ({ ...body, ...(overrides[url.split('/').slice(-2).join('/')] ?? overrides[url.split('/').pop()!] ?? {}) }) } as any;
    });

  it('reports ok when health/node-info/relay all pass and nodeId matches', async () => {
    const [r] = await checkDvtConnectivity(
      { ...DVT_CONFIG.environments.sepolia!, dvtNodes: [node] },
      okFetch() as any,
    );
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
    expect(r.capabilities).toMatchObject({ dvtSigning: true, relay: true, keeper: true });
  });

  it.each(['dvtSigning', 'relay', 'keeper'] as const)(
    'a declared %s capability that the node reports as disabled is an error',
    async (cap) => {
      // Enumerated rather than exampled: before FU-35 only `relay` was compared, so a config
      // declaring dvtSigning against a node that had it off looked healthy, and the failure surfaced
      // later as a co-signature that never arrived. A new capability added without a comparison
      // fails here instead of quietly opening the same gap again.
      const disabled = [
        { name: 'dvtSigning', enabled: cap !== 'dvtSigning' },
        { name: 'relay', enabled: cap !== 'relay' },
        { name: 'keeper', enabled: cap !== 'keeper' },
      ];
      const [r] = await checkDvtConnectivity(
        { ...DVT_CONFIG.environments.sepolia!, dvtNodes: [node] },
        okFetch({ health: { status: 'ok', capabilities: disabled } }) as any,
      );
      expect(r.errors.join(' ')).toContain(`${cap} capability declared in config but disabled`);
      expect(r.ok).toBe(false);
    },
  );


  it('an environment that DOES declare relay is NOT ok when /relay/health fails', async () => {
    // The mirror of the case above, and the one that makes the exemption safe rather than merely
    // convenient. Everything the exemption buys rests on the word "only" in "only when the
    // environment does not declare relay" — and until this case existed, nothing held that word:
    // review measured that making relay failures never count left all 17 tests green, so a later
    // edit widening the exemption to every environment (to quiet relay flakiness, say) would pass.
    //
    // Same shape as the gap this PR fixes, one level up: I wrote the assertion for the acceptable
    // half and not for the unacceptable one.
    const env = { ...DVT_CONFIG.environments.sepolia!, dvtNodes: [node] };
    const [r] = await checkDvtConnectivity(env, okFetch({ 'relay/health': { status: 'down' } }) as any);

    expect(env.capabilities.relay, 'this environment must declare relay for the case to mean anything').toBe(true);
    expect(r.relayOk).toBe(false);
    expect(r.errors.join(' ')).toContain('/relay/health status=down');
    expect(r.ok).toBe(false);
  });

  it('a declared relay that is UNREACHABLE is also not ok', async () => {
    // The throwing path is a separate branch from the status-not-ok path, and the review mutation
    // had to disable both — so both are pinned.
    const env = { ...DVT_CONFIG.environments.sepolia!, dvtNodes: [node] };
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.endsWith('/relay/health')) throw new Error('ECONNREFUSED');
      const body = url.endsWith('/health')
        ? { status: 'ok', capabilities: [{ name: 'dvtSigning', enabled: true }, { name: 'relay', enabled: true }, { name: 'keeper', enabled: true }] }
        : url.endsWith('/node/info') ? { nodeId: node.nodeId } : {};
      return { json: async () => body } as any;
    });
    const [r] = await checkDvtConnectivity(env, fetchImpl as any);

    expect(r.errors.join(' ')).toContain('/relay/health: ECONNREFUSED');
    expect(r.ok).toBe(false);
  });

  it('an environment that does NOT declare relay is ok without /relay/health', async () => {
    // The mirror of the case above. `r.ok` used to require relayOk unconditionally, so an
    // environment legitimately running without relay could never be reported ok — the check demanded
    // a capability the config does not ask for. `testnet-local` is exactly that shape (relay:false,
    // so localhost cannot leak into the gasless relay pool).
    const env = { ...DVT_CONFIG.environments['testnet-local']!, dvtNodes: [node] };
    const [r] = await checkDvtConnectivity(
      env,
      // /relay/health is made to FAIL on purpose. A stub where it succeeds cannot tell the two
      // implementations apart — measured: with relay errors recorded unconditionally, that version
      // of this test stayed green. The distinction only exists when the undeclared capability is
      // actually broken, which is precisely the situation being claimed as acceptable.
      okFetch({
        health: { status: 'ok', capabilities: [{ name: 'dvtSigning', enabled: true }] },
        'relay/health': { status: 'down' },
      }) as any,
    );
    expect(env.capabilities.relay).toBe(false);
    expect(r.relayOk, 'the probe still ran and still reports the truth').toBe(false);
    expect(r.ok, `errors: ${r.errors.join(' | ')}`).toBe(true);
    expect(r.errors, 'an undeclared capability being down is not an error for this environment').toEqual([]);
  });

  it('flags a nodeId mismatch (fail closed, not ok)', async () => {
    const fetchImpl = okFetch({ info: { nodeId: '0xdeadbeef' } });
    const [r] = await checkDvtConnectivity({ ...DVT_CONFIG.environments.sepolia!, dvtNodes: [node] }, fetchImpl as any);
    expect(r.nodeIdMatch).toBe(false);
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toMatch(/nodeId mismatch/);
  });

  it('marks a node unreachable when /health throws', async () => {
    const fetchImpl = vi.fn(async () => { throw new Error('ECONNREFUSED'); });
    const [r] = await checkDvtConnectivity({ ...DVT_CONFIG.environments.sepolia!, dvtNodes: [node] }, fetchImpl as any);
    expect(r.reachable).toBe(false);
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toMatch(/unreachable/);
  });
});

describe('testnet-local environment (CC-103 / tunnel outage fallback)', () => {
  const sepolia = DVT_CONFIG.environments.sepolia!;
  const local = DVT_CONFIG.environments['testnet-local']!;

  it('is configured and points at the loopback co-sign ports', () => {
    expect(local.dvtNodes.map((n) => n.url)).toEqual([
      'http://127.0.0.1:3001',
      'http://127.0.0.1:3002',
      'http://127.0.0.1:3003',
    ]);
  });

  it('SAFETY: nodeIds are IDENTICAL to sepolia — a local node must sign with REGISTERED keys', () => {
    // On-chain verification pairs the aggregate against the public keys registered on the
    // validator. Minting fresh ids/keys for a local stack makes every aggregate unverifiable, and
    // registering them would enlarge the shared production validator's node set. This assertion
    // exists so that "fix" cannot be made silently.
    expect(local.dvtNodes.map((n) => n.nodeId)).toEqual(sepolia.dvtNodes.map((n) => n.nodeId));
  });

  it('targets the same validator + entryPoint as sepolia (only transport differs)', () => {
    expect(local.validator).toBe(sepolia.validator);
    expect(local.entryPoint).toBe(sepolia.entryPoint);
    expect(local.chainId).toBe(sepolia.chainId);
  });

  it('is relay:false so localhost cannot leak into the gasless relay pool', () => {
    expect(local.capabilities.relay).toBe(false);
    expect(local.capabilities.dvtSigning).toBe(true);
    // getDvtRelayerUrlsForChain picks the relay-capable env for the chain — it must still be sepolia.
    expect(getDvtRelayerUrlsForChain(11155111)).toEqual(sepolia.dvtNodes.map((n) => n.url));
  });

  it('AASTAR_DVT_ENV=testnet-local switches resolution without touching the default', () => {
    const prev = process.env.AASTAR_DVT_ENV;
    process.env.AASTAR_DVT_ENV = 'testnet-local';
    try {
      expect(getDvtConfig().dvtNodes[0].url).toBe('http://127.0.0.1:3001');
      expect(getDvtRelayerUrls()).toEqual(local.dvtNodes.map((n) => n.url));
      // An explicit argument still wins over the env var.
      expect(getDvtConfig('sepolia').dvtNodes[0].url).toBe('https://dvt1.aastar.io');
    } finally {
      if (prev === undefined) delete process.env.AASTAR_DVT_ENV;
      else process.env.AASTAR_DVT_ENV = prev;
    }
    expect(DVT_CONFIG.active).toBe('sepolia');
  });
});
