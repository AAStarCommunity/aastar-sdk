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
        url.endsWith('/health') ? { status: 'ok', capabilities: [{ name: 'relay', enabled: true }, { name: 'keeper', enabled: true }] }
        : url.endsWith('/node/info') ? { nodeId: node.nodeId }
        : url.endsWith('/relay/health') ? { status: 'ok', operator: '0xabc' }
        : {};
      return { json: async () => ({ ...body, ...(overrides[url.split('/').pop()!] ?? {}) }) } as any;
    });

  it('reports ok when health/node-info/relay all pass and nodeId matches', async () => {
    const [r] = await checkDvtConnectivity(
      { ...DVT_CONFIG.environments.sepolia!, dvtNodes: [node] },
      okFetch() as any,
    );
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
    expect(r.capabilities).toMatchObject({ relay: true, keeper: true });
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
