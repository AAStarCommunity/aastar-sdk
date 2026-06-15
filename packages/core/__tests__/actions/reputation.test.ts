import { describe, it, expect, beforeEach } from 'vitest';
import { reputationActions } from '../../src/actions/reputation';
import { createMockPublicClient, createMockWalletClient, resetMocks } from '../mocks/client';

const ADDR = '0x1111111111111111111111111111111111111111' as `0x${string}`;
const USER = '0x2222222222222222222222222222222222222222' as `0x${string}`;

describe('ReputationActions Bulk Coverage', () => {
  let p: any;
  let w: any;
  beforeEach(() => { resetMocks(); p = createMockPublicClient(); w = createMockWalletClient(); });

  describe('Rules & Scores', () => {
    it('setReputationRule', async () => { w.writeContract.mockResolvedValue('0x'); await reputationActions(ADDR)(w).setReputationRule({ ruleId: '0x01', rule: {} as any, account: USER }); expect(w.writeContract).toHaveBeenCalled(); });
    it('getReputationRule', async () => { p.readContract.mockResolvedValue([0n, 0n, 0n, 'desc', true]); const res = await reputationActions(ADDR)(p).getReputationRule({ ruleId: '0x01' }); expect(res).toBeDefined(); });
    it('enableRule', async () => { w.writeContract.mockResolvedValue('0x'); await reputationActions(ADDR)(w).enableRule({ ruleId: '0x01', account: USER }); expect(w.writeContract).toHaveBeenCalled(); });
    it('disableRule', async () => { w.writeContract.mockResolvedValue('0x'); await reputationActions(ADDR)(w).disableRule({ ruleId: '0x01', account: USER }); expect(w.writeContract).toHaveBeenCalled(); });
    it('isRuleActive', async () => { p.readContract.mockResolvedValue(true); expect(await reputationActions(ADDR)(p).isRuleActive({ ruleId: '0x01' })).toBe(true); });
    it('getActiveRules', async () => { p.readContract.mockResolvedValue(['0x01']); expect(await reputationActions(ADDR)(p).getActiveRules({ community: ADDR })).toEqual(['0x01']); });
    it('getRuleCount', async () => { p.readContract.mockResolvedValue(5n); expect(await reputationActions(ADDR)(p).getRuleCount()).toBe(5n); });
    // getUserScore / getCommunityScore do NOT exist in the deployed ReputationSystem ABI.
    // They must throw a descriptive error instead of issuing a call that reverts on-chain.
    it('getUserScore throws (not available on-chain) and never calls readContract', async () => {
      await expect(reputationActions(ADDR)(p).getUserScore({ user: USER })).rejects.toThrow('not available on-chain');
      expect(p.readContract).not.toHaveBeenCalled();
    });
    it('getCommunityScore throws (not available on-chain) and never calls readContract', async () => {
      await expect(reputationActions(ADDR)(p).getCommunityScore({ community: ADDR })).rejects.toThrow('not available on-chain');
      expect(p.readContract).not.toHaveBeenCalled();
    });
    it('calculateReputation maps the (communityScore, globalScore) tuple', async () => {
      p.readContract.mockResolvedValue([42n, 100n]);
      const res = await reputationActions(ADDR)(p).calculateReputation({ user: USER, community: ADDR, timestamp: 0n });
      expect(res).toEqual({ communityScore: 42n, globalScore: 100n });
      expect(p.readContract).toHaveBeenCalledWith(expect.objectContaining({
        functionName: 'calculateReputation',
        args: [USER, ADDR, 0n],
      }));
    });
    it('getReputationBreakdown maps the per-community (base, nftBonus, activityBonus, multiplier) tuple', async () => {
      p.readContract.mockResolvedValue([10n, 20n, 30n, 2n]);
      const res = await reputationActions(ADDR)(p).getReputationBreakdown({ user: USER, community: ADDR, timestamp: 123n });
      expect(res).toEqual({ baseScore: 10n, nftBonus: 20n, activityBonus: 30n, multiplier: 2n });
      expect(p.readContract).toHaveBeenCalledWith(expect.objectContaining({
        functionName: 'getReputationBreakdown',
        args: [USER, ADDR, 123n],
      }));
    });
    it('communityReputations reads the per-community score mapping', async () => {
      p.readContract.mockResolvedValue(77n);
      expect(await reputationActions(ADDR)(p).communityReputations({ community: ADDR, user: USER })).toBe(77n);
      expect(p.readContract).toHaveBeenCalledWith(expect.objectContaining({
        functionName: 'communityReputations',
        args: [ADDR, USER],
      }));
    });
  });

  describe('NFT Boosts', () => {
    it('setNFTBoost', async () => { w.writeContract.mockResolvedValue('0x'); await reputationActions(ADDR)(w).setNFTBoost({ collection: ADDR, boost: 10n, account: USER }); expect(w.writeContract).toHaveBeenCalled(); });
    it('nftCollectionBoost', async () => { p.readContract.mockResolvedValue(10n); expect(await reputationActions(ADDR)(p).nftCollectionBoost({ collection: ADDR })).toBe(10n); });
    it('updateNFTHoldStart', async () => { w.writeContract.mockResolvedValue('0x'); await reputationActions(ADDR)(w).updateNFTHoldStart({ collection: ADDR, account: USER }); expect(w.writeContract).toHaveBeenCalled(); });
  });

  describe('Batch Operations & Sync', () => {
    it('batchUpdateScores', async () => { w.writeContract.mockResolvedValue('0x'); await reputationActions(ADDR)(w).batchUpdateScores({ users: [USER], scores: [100n], account: USER }); expect(w.writeContract).toHaveBeenCalled(); });
    it('batchSyncToRegistry', async () => { w.writeContract.mockResolvedValue('0x'); await reputationActions(ADDR)(w).batchSyncToRegistry({ users: [USER], account: USER }); expect(w.writeContract).toHaveBeenCalled(); });
  });

  describe('Configuration & Meta', () => {
    it('setRegistry', async () => { w.writeContract.mockResolvedValue('0x'); await reputationActions(ADDR)(w).setRegistry({ registry: ADDR, account: USER }); expect(w.writeContract).toHaveBeenCalled(); });
    it('setEntropyFactor', async () => { w.writeContract.mockResolvedValue('0x'); await reputationActions(ADDR)(w).setEntropyFactor({ community: ADDR, factor: 10n, account: USER }); expect(w.writeContract).toHaveBeenCalled(); });
    it('getEntropyFactor', async () => { p.readContract.mockResolvedValue(10n); expect(await reputationActions(ADDR)(p).getEntropyFactor()).toBe(10n); });
    it('REGISTRY', async () => { p.readContract.mockResolvedValue(ADDR); expect(await reputationActions(ADDR)(p).REGISTRY()).toBe(ADDR); });
    it('version', async () => { p.readContract.mockResolvedValue('1.0'); expect(await reputationActions(ADDR)(p).version()).toBe('1.0'); });
  });
});
