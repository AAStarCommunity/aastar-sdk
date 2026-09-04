/**
 * The cross-check, including the cases where it must NOT fire.
 *
 * A guard that rejects too much is not a safer guard — it is a guard that gets removed. So the
 * agreement cases are asserted as carefully as the disagreement ones, and the "one endpoint" case is
 * pinned because the tempting reading of it (treat a lone source as corroborated) is exactly the
 * silence this module exists to break.
 */
import { describe, expect, it } from 'vitest';
import type { PublicClient } from 'viem';

import { crossCheckedClient, crossCheckedClientFromUrls, CrossCheckDisagreement } from './crossCheckedClient.js';

/** A stub whose reads return fixed values, or throw. */
function stub(answers: Record<string, unknown>): PublicClient {
  return new Proxy({} as PublicClient, {
    get: (_t, prop) => async () => {
      const v = answers[String(prop)];
      if (v instanceof Error) throw v;
      return v;
    },
  });
}

describe('agreement', () => {
  it('returns the value when every endpoint agrees', async () => {
    const c = crossCheckedClient([stub({ getChainId: 11155111 }), stub({ getChainId: 11155111 })], ['a', 'b']);
    await expect(c.getChainId()).resolves.toBe(11155111);
  });

  it('compares by value, so bigints and objects agree when they should', async () => {
    // A naive `===` would report disagreement on every structured answer — the guard would fire on
    // healthy endpoints, and the first person to hit that would delete it.
    const a = stub({ getBlockNumber: 42n, call: { data: '0xabc' } });
    const b = stub({ getBlockNumber: 42n, call: { data: '0xabc' } });
    const c = crossCheckedClient([a, b], ['a', 'b']);
    await expect(c.getBlockNumber()).resolves.toBe(42n);
    await expect((c as unknown as { call(): Promise<unknown> }).call()).resolves.toEqual({ data: '0xabc' });
  });
});

describe('disagreement', () => {
  it('throws, and the message names which endpoint said what', async () => {
    const c = crossCheckedClient([stub({ getChainId: 11155111 }), stub({ getChainId: 1 })], ['alpha', 'beta']);
    await expect(c.getChainId()).rejects.toThrow(CrossCheckDisagreement);
    await expect(c.getChainId()).rejects.toThrow(/alpha → 11155111/);
    await expect(c.getChainId()).rejects.toThrow(/beta → 1/);
  });

  it('the flaky-empty case: 0 events vs 3 is a disagreement, not a reading', async () => {
    // The measured failure this was built for — the public Sepolia endpoint answered the same
    // getLogs with 0 and with 3. Without a second source, the 0 is indistinguishable from the truth.
    const c = crossCheckedClient(
      [stub({ getStorageAt: [] }), stub({ getStorageAt: [1, 2, 3] })],
      ['flaky', 'good'],
    );
    await expect((c as unknown as { getStorageAt(): Promise<unknown> }).getStorageAt()).rejects.toThrow(/disagree/);
  });

  it('an endpoint that ERRORS is a missing answer, not a matching one', async () => {
    // The failure mode a naive "collect what succeeded" would hide: with the default quorum, two
    // endpoints where one is down cannot corroborate anything.
    const c = crossCheckedClient([stub({ getChainId: 11155111 }), stub({ getChainId: new Error('boom') })], ['up', 'down']);
    await expect(c.getChainId()).rejects.toThrow(/ERROR boom/);
  });
});

describe('quorum', () => {
  it('a lowered quorum lets a down endpoint through', async () => {
    const c = crossCheckedClient(
      [stub({ getChainId: 11155111 }), stub({ getChainId: 11155111 }), stub({ getChainId: new Error('down') })],
      ['a', 'b', 'c'],
      { quorum: 2 },
    );
    await expect(c.getChainId()).resolves.toBe(11155111);
  });

  it('…but never lets a DISAGREEING endpoint through', async () => {
    // The property that keeps a lowered quorum from becoming a majority vote: any surviving
    // disagreement still refuses. Two truthful endpoints and one liar is a disagreement, not a 2-1 win.
    const c = crossCheckedClient(
      [stub({ getChainId: 11155111 }), stub({ getChainId: 11155111 }), stub({ getChainId: 999 })],
      ['a', 'b', 'liar'],
      { quorum: 2 },
    );
    await expect(c.getChainId()).rejects.toThrow(/liar → 999/);
  });

  it('rejects a quorum outside the endpoint count', () => {
    expect(() => crossCheckedClient([stub({}), stub({})], ['a', 'b'], { quorum: 3 })).toThrow(/outside 1\.\.2/);
    expect(() => crossCheckedClient([stub({}), stub({})], ['a', 'b'], { quorum: 0 })).toThrow(/outside 1\.\.2/);
  });
});

describe('degenerate configurations are explicit, not silently blessed', () => {
  it('one endpoint returns that endpoint unchanged — corroboration is not implied', async () => {
    const only = stub({ getChainId: 7 });
    expect(crossCheckedClient([only], ['solo'])).toBe(only);
  });

  it('zero endpoints is an error, not an empty success', () => {
    expect(() => crossCheckedClient([], [])).toThrow(/no clients/);
  });

  it('mismatched labels are rejected — a disagreement must be able to name its source', () => {
    expect(() => crossCheckedClient([stub({}), stub({})], ['only-one'])).toThrow(/2 clients but 1 source/);
  });

  it('an empty URL list is null, distinguishable from a one-URL list', () => {
    expect(crossCheckedClientFromUrls('')).toBeNull();
    expect(crossCheckedClientFromUrls('  ,  ')).toBeNull();
    expect(crossCheckedClientFromUrls('https://a.example')?.sources).toEqual(['a.example']);
  });

  it('sources are hosts, not full URLs — RPC paths are routinely API keys', () => {
    // These strings go into error messages and CI logs.
    const built = crossCheckedClientFromUrls('https://rpc.example/v2/SECRET_KEY,https://other.example/x');
    expect(built?.sources).toEqual(['rpc.example', 'other.example']);
    expect(JSON.stringify(built?.sources)).not.toContain('SECRET_KEY');
  });
});

describe('the boundary is in the type, not in a comment (review on #350)', () => {
  it('reaching for an uncorroborated method does not type-check', () => {
    // Measured in review: with two endpoints disagreeing, `getChainId` threw while `getBalance` and
    // `getLogs` silently returned the first endpoint's answer. Nothing was broken at the call sites
    // then — but this is exported API, and the next caller picks it by its type and its name.
    //
    // `@ts-expect-error` IS the assertion: it fails the build if the error stops happening, i.e. if
    // someone widens the return type back to PublicClient. A runtime check could not express this.
    const c = crossCheckedClient([stub({}), stub({})], ['a', 'b']);
    // @ts-expect-error getBalance is not corroborated, so it is not on this type
    void c.getBalance;
    // @ts-expect-error getLogs likewise
    void c.getLogs;
    expect(typeof c.getChainId).toBe('function');
  });

  it('flags endpoints that share a registrable domain', () => {
    // Half of the "three hats, one party" limit is mechanically visible. It does not stop anyone who
    // wants around it — a custom domain suffices — but it stops the accidental version.
    expect(crossCheckedClientFromUrls('https://a.alchemy.com,https://b.alchemy.com')?.sameProvider).toBe(true);
    expect(crossCheckedClientFromUrls('https://a.alchemy.com,https://x.publicnode.com')?.sameProvider).toBe(false);
  });

  it('does not flag a single endpoint as sharing a provider with itself', () => {
    expect(crossCheckedClientFromUrls('https://a.alchemy.com')?.sameProvider).toBe(false);
  });
});
