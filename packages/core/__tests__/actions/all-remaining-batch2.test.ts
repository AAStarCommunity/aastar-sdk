import { describe, it, expect, beforeEach } from 'vitest';
import { paymasterActions } from '../../src/actions/paymaster';
import { reputationActions } from '../../src/actions/reputation';
import { superPaymasterActions } from '../../src/actions/superPaymaster';
import { createMockPublicClient, createMockWalletClient, resetMocks } from '../mocks/client';

const A = '0x1111111111111111111111111111111111111111' as `0x${string}`;  
const U = '0x2222222222222222222222222222222222222222' as `0x${string}`;

describe('All Remaining Functions Batch 2', () => {
  let p: ReturnType<typeof createMockPublicClient>;
  let w: ReturnType<typeof createMockWalletClient>;
  beforeEach(() => { resetMocks(); p = createMockPublicClient(); w = createMockWalletClient(); });

  describe('Paymaster All', () => {
    it('removeGasToken', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await paymasterActions(A)(w).removeGasToken({ token: U, account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
    it('isGasTokenSupported', async () => { p.readContract.mockResolvedValue(true); expect(await paymasterActions(A)(p).isGasTokenSupported({ token: U })).toBe(true); });
    it('removeSBT', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await paymasterActions(A)(w).removeSBT({ sbt: U, account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
    it('isSBTSupported', async () => { p.readContract.mockResolvedValue(true); expect(await paymasterActions(A)(p).isSBTSupported({ sbt: U })).toBe(true); });
    it('deposit', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await paymasterActions(A)(w).deposit({ account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
    it('withdrawTo', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await paymasterActions(A)(w).withdrawTo({ to: U, amount: 100n, account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
    it('setTokenPrice', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await paymasterActions(A)(w).setTokenPrice({ token: U, price: 1000000n, account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
    it('tokenPrices', async () => { p.readContract.mockResolvedValue(1000000n); expect(await paymasterActions(A)(p).tokenPrices({ token: U })).toBe(1000000n); });
    it('transferOwnership', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await paymasterActions(A)(w).transferOwnership({ newOwner: U, account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
    it('renounceOwnership', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await paymasterActions(A)(w).renounceOwnership({ account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
    it('version', async () => { p.readContract.mockResolvedValue('1.0'); expect(await paymasterActions(A)(p).version()).toBe('1.0'); });
  });

  describe('Reputation All', () => {
    it('getReputationRule', async () => { p.readContract.mockResolvedValue({}); await reputationActions(A)(p).getReputationRule({ ruleId: '0x01' }); expect(p.readContract).toHaveBeenCalled(); });
    it('isRuleActive', async () => { p.readContract.mockResolvedValue(true); expect(await reputationActions(A)(p).isRuleActive({ ruleId: '0x01' })).toBe(true); });
    it('getActiveRules', async () => { p.readContract.mockResolvedValue(['0x01']); expect(await reputationActions(A)(p).getActiveRules({ community: U })).toEqual(['0x01']); });
    it('computeScore', async () => { p.readContract.mockResolvedValue(500n); expect(await reputationActions(A)(p).computeScore({ user: U, communities: [U], ruleIds: ['0x01'], activities: [[1n, 1n, 1n]] })).toBe(500n); });
    it('getReputationBreakdown', async () => { p.readContract.mockResolvedValue({}); await reputationActions(A)(p).getReputationBreakdown({ user: U, community: U, timestamp: 0n }); expect(p.readContract).toHaveBeenCalled(); });
    it('setCommunityReputation', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await reputationActions(A)(w).setCommunityReputation({ community: U, user: U, score: 100n, account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
    it('setRule', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await reputationActions(A)(w).setRule({ ruleId: '0x01', base: 10n, bonus: 5n, max: 100n, desc: 'test', account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
    it('communityRules', async () => { p.readContract.mockResolvedValue({}); await reputationActions(A)(p).communityRules({ community: U, ruleId: '0x01' }); expect(p.readContract).toHaveBeenCalled(); });
    it('transferOwnership', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await reputationActions(A)(w).transferOwnership({ newOwner: U, account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
  });

  describe('SuperPaymaster All', () => {
    it('registerOperator', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await superPaymasterActions(A)(w).registerOperator({ operator: U, collateralAmount: 1000n, account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
    it('unregisterOperator', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await superPaymasterActions(A)(w).unregisterOperator({ operator: U, account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
    it('updateCollateral', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await superPaymasterActions(A)(w).updateCollateral({ operator: U, newAmount: 2000n, account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
    it('getOperatorInfo', async () => { p.readContract.mockResolvedValue({}); await superPaymasterActions(A)(p).getOperatorInfo({ operator: U }); expect(p.readContract).toHaveBeenCalled(); });
    it('isOperator', async () => { p.readContract.mockResolvedValue(true); expect(await superPaymasterActions(A)(p).isOperator({ operator: U })).toBe(true); });
    it('pause', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await superPaymasterActions(A)(w).pause({ account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
    it('unpause', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await superPaymasterActions(A)(w).unpause({ account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
    it('paused', async () => { p.readContract.mockResolvedValue(false); expect(await superPaymasterActions(A)(p).paused()).toBe(false); });
    it('transferOwnership', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await superPaymasterActions(A)(w).transferOwnership({ newOwner: U, account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
  });
});
