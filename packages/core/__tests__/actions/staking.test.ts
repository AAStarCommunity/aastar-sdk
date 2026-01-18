import { describe, it, expect, beforeEach } from 'vitest';
import { stakingActions } from '../../src/actions/staking';
import { createMockPublicClient, createMockWalletClient, resetMocks } from '../mocks/client';

const ADDR = '0x1111111111111111111111111111111111111111' as `0x${string}`;
const USER = '0x2222222222222222222222222222222222222222' as `0x${string}`;

describe('StakingActions Bulk Coverage', () => {
  let p: any;
  let w: any;
  beforeEach(() => { resetMocks(); p = createMockPublicClient(); w = createMockWalletClient(); });

  describe('Staking Operations', () => {
    it('lockStake', async () => { w.writeContract.mockResolvedValue('0x'); await stakingActions(ADDR)(w).lockStake({ user: USER, roleId: '0x01', stakeAmount: 100n, entryBurn: 10n, payer: USER, account: USER }); expect(w.writeContract).toHaveBeenCalled(); });
    it('topUpStake', async () => { w.writeContract.mockResolvedValue('0x'); await stakingActions(ADDR)(w).topUpStake({ user: USER, roleId: '0x01', stakeAmount: 100n, payer: USER, account: USER }); expect(w.writeContract).toHaveBeenCalled(); });
    it('unlockStake', async () => { w.writeContract.mockResolvedValue('0x'); await stakingActions(ADDR)(w).unlockStake({ user: USER, roleId: '0x01', account: USER }); expect(w.writeContract).toHaveBeenCalled(); });
    it('slash', async () => { w.writeContract.mockResolvedValue('0x'); await stakingActions(ADDR)(w).slash({ user: USER, amount: 100n, reason: 'test', account: USER }); expect(w.writeContract).toHaveBeenCalled(); });
  });

  describe('Views', () => {
    it('getStakeInfo', async () => { p.readContract.mockResolvedValue([100n, 100n, true]); const res = await stakingActions(ADDR)(p).getStakeInfo({ operator: USER, roleId: '0x01' }); expect(res).toBeDefined(); });
    it('previewExitFee', async () => { p.readContract.mockResolvedValue([5n, 95n]); const res = await stakingActions(ADDR)(p).previewExitFee({ user: USER, roleId: '0x01' }); expect(res.fee).toBe(5n); expect(res.netAmount).toBe(95n); });
    it('totalStaked', async () => { p.readContract.mockResolvedValue(1000n); expect(await stakingActions(ADDR)(p).totalStaked()).toBe(1000n); });
  });

  describe('Configuration', () => {
    it('setRegistry', async () => { w.writeContract.mockResolvedValue('0x'); await stakingActions(ADDR)(w).setRegistry({ registry: USER, account: USER }); expect(w.writeContract).toHaveBeenCalled(); });
    it('setRoleExitFee', async () => { w.writeContract.mockResolvedValue('0x'); await stakingActions(ADDR)(w).setRoleExitFee({ roleId: '0x01', feePercent: 1n, minFee: 1n, account: USER }); expect(w.writeContract).toHaveBeenCalled(); });
  });
});
