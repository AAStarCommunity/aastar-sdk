import { describe, it, expect, vi } from 'vitest';
import { DVT_CONFIG, getDvtConfig, getDvtRelayerUrls, checkDvtConnectivity } from './dvt.js';

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
