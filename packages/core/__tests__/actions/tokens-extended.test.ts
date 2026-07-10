import { describe, it, expect, beforeEach } from 'vitest';
import { tokenActions } from '../../src/actions/tokens';
import { createMockPublicClient, createMockWalletClient, resetMocks } from '../mocks/client';

const T = '0x1111111111111111111111111111111111111111' as `0x${string}`;
const U = '0x2222222222222222222222222222222222222222' as `0x${string}`;

describe('Token All Functions', () => {
  let p: ReturnType<typeof createMockPublicClient>;
  let w: ReturnType<typeof createMockWalletClient>;
  beforeEach(() => { resetMocks(); p = createMockPublicClient(); w = createMockWalletClient(); });

  it('transferFrom', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await tokenActions()(w).transferFrom({ token: T, from: U, to: U, amount: 1n, account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
  it('name', async () => { p.readContract.mockResolvedValue('T'); expect(await tokenActions()(p).name({ token: T })).toBe('T'); });
  it('symbol', async () => { p.readContract.mockResolvedValue('TKN'); expect(await tokenActions()(p).symbol({ token: T })).toBe('TKN'); });
  it('decimals', async () => { p.readContract.mockResolvedValue(18); expect(await tokenActions()(p).decimals({ token: T })).toBe(18); });
  it('needsApproval', async () => { p.readContract.mockResolvedValue(true); expect(await tokenActions()(p).needsApproval({ token: T, owner: U, spender: U, amount: 100n })).toBe(true); });

  // CC-33: economic-credibility disclosure reads
  it('credibilityScore', async () => { p.readContract.mockResolvedValue(87); expect(await tokenActions()(p).credibilityScore({ token: T })).toBe(87); });
  it('isOverIssued', async () => { p.readContract.mockResolvedValue(true); expect(await tokenActions()(p).isOverIssued({ token: T })).toBe(true); });
  it('getCredibility batches the five views into one snapshot pinned to a single block', async () => {
    // Order matches the Promise.all in getCredibility: score, isOverIssued, issued, backing, cap
    p.readContract
      .mockResolvedValueOnce(42)      // credibilityScore
      .mockResolvedValueOnce(true)    // isOverIssued
      .mockResolvedValueOnce(1000n)   // issuedValueUSD
      .mockResolvedValueOnce(500n)    // backingValueUSD
      .mockResolvedValueOnce(750n);   // effectiveCapUSD
    const c = await tokenActions()(p).getCredibility({ token: T });
    expect(c).toEqual({ credibilityScore: 42, isOverIssued: true, issuedValueUSD: 1000n, backingValueUSD: 500n, effectiveCapUSD: 750n });
    expect(p.readContract).toHaveBeenCalledTimes(5);
    // No block pinned by caller → resolve current block once and pin all five reads to it (self-consistent snapshot).
    expect(p.getBlockNumber).toHaveBeenCalledTimes(1);
    for (const call of p.readContract.mock.calls) {
      expect(call[0].blockNumber).toBe(100n);
    }
  });
  it('getCredibility respects an explicit block pin and does not resolve a new block', async () => {
    p.readContract.mockResolvedValueOnce(7).mockResolvedValueOnce(false).mockResolvedValueOnce(1n).mockResolvedValueOnce(2n).mockResolvedValueOnce(3n);
    await tokenActions()(p).getCredibility({ token: T, blockNumber: 55n });
    expect(p.getBlockNumber).not.toHaveBeenCalled();
    for (const call of p.readContract.mock.calls) {
      expect(call[0].blockNumber).toBe(55n);
    }
  });
});
