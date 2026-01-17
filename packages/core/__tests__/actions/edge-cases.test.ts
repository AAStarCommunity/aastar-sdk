import { describe, it, expect, beforeEach } from 'vitest';
import { tokenActions } from '../../src/actions/tokens';
import { registryActions } from '../../src/actions/registry';
import { stakingActions } from '../../src/actions/staking';
import { paymasterActions } from '../../src/actions/paymaster';
import { createMockPublicClient, createMockWalletClient, resetMocks } from '../mocks/client';

const T = '0x1111111111111111111111111111111111111111' as `0x${string}`;
const U = '0x2222222222222222222222222222222222222222' as `0x${string}`;
const R = '0x3333333333333333333333333333333333333333' as `0x${string}`;

describe('Edge Cases & Error Handling Tests', () => {
  let p: ReturnType<typeof createMockPublicClient>;
  let w: ReturnType<typeof createMockWalletClient>;
  beforeEach(() => { resetMocks(); p = createMockPublicClient(); w = createMockWalletClient(); });

  describe('Token Edge Cases', () => {
    it('transfer with zero amount', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await tokenActions()(w).transfer({ token: T, to: U, amount: 0n, account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
    it('approve with max uint256', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await tokenActions()(w).approve({ token: T, spender: U, amount: 2n**256n-1n, account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
    it('balanceOf returns zero', async () => { p.readContract.mockResolvedValue(0n); expect(await tokenActions()(p).balanceOf({ token: T, account: U })).toBe(0n); });
    it('totalSupply returns large number', async () => { p.readContract.mockResolvedValue(1000000000000000000000000n); expect(await tokenActions()(p).totalSupply({ token: T })).toBe(1000000000000000000000000n); });
    it('mint to zero address should call contract', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await tokenActions()(w).mint({ token: T, to: '0x0000000000000000000000000000000000000000', amount: 100n, account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
    it('burn entire balance', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await tokenActions()(w).burn({ token: T, amount: 999999n, account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
  });

  describe('Registry Edge Cases', () => {
    it('register with role 0', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await registryActions(T)(w).registerRoleSelf({ roleId: 0n, data: '0x', account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
    it('unregister non-existent role', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await registryActions(R)(w).unRegisterRole({ user: U, roleId: '0x1111111111111111111111111111111111111111111111111111111111111111' as `0x${string}`, account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
    it('hasRole returns false', async () => { p.readContract.mockResolvedValue(false); expect(await registryActions(T)(p).hasRole({ user: U, roleId: 1n })).toBe(false); });
    it('configureRole with extreme values', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await registryActions(T)(w).configureRole({ roleId: 99n, config: {}, account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
  });

  describe('Staking Edge Cases', () => {
    it('lockStake with minimum amount', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await stakingActions(T)(w).lockStake({ user: U, roleId: 1n, stakeAmount: 1n, entryBurn: 0n, payer: U, account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
    it('unlockAndTransfer with zero amount', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await stakingActions(T)(w).unlockAndTransfer({ user: U, roleId: 1n, toUnlock: 0n, receiver: U, exitBurn: 0n, account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
    it('slash with max amount', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await stakingActions(T)(w).slash({ user: U, roleId: 1n, amount: 1000000n, reason: 'max slash', account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
    it('getStakeInfo returns empty', async () => { p.readContract.mockResolvedValue({ amount: 0n, timestamp: 0n }); const r = await stakingActions(T)(p).getStakeInfo({ operator: U, roleId: 1n }); expect(r).toBeDefined(); });
    it('topUpStake with large amount', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await stakingActions(T)(w).topUpStake({ user: U, roleId: 1n, topUpAmount: 99999999n, payer: U, account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
  });

  describe('Paymaster Edge Cases', () => {
    it('depositFor with zero amount', async () => {
      await expect(paymasterActions(T)(w).depositFor({ user: U, token: T, amount: 0n, account: w.account }))
        .rejects.toThrow();
    });
    it('withdraw entire balance', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await paymasterActions(T)(w).withdraw({ token: T, amount: 999999999999999999n, account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
    it('balances returns zero', async () => { p.readContract.mockResolvedValue(0n); expect(await paymasterActions(T)(p).balances({ user: U, token: T })).toBe(0n); });
    it('updatePrice with timestamp in future', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await paymasterActions(T)(w).updatePrice({ price: 1000000n, timestamp: 999999999999n, account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
    it('paused returns true', async () => { p.readContract.mockResolvedValue(true); expect(await paymasterActions(T)(p).paused()).toBe(true); });
  });

  describe('Error Conditions', () => {
    it('handles contract revert simulation', async () => { p.readContract.mockRejectedValue(new Error('revert')); await expect(tokenActions()(p).balanceOf({ token: T, account: U })).rejects.toThrow(); });
    it('handles transaction failure', async () => { w.writeContract.mockRejectedValue(new Error('tx failed')); await expect(tokenActions()(w).transfer({ token: T, to: U, amount: 100n, account: w.account })).rejects.toThrow(); });
    it('handles invalid address format', async () => { 
      await expect(tokenActions()(w).transfer({ token: T, to: '0xinvalid' as any, amount: 1n, account: w.account }))
        .rejects.toThrow(); 
    });
  });

  describe('Boundary Conditions', () => {
    it('max roleId value', async () => { p.readContract.mockResolvedValue(true); await registryActions(T)(p).hasRole({ user: U, roleId: 2n**64n-1n }); expect(p.readContract).toHaveBeenCalled(); });
    it('max stake amount', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await stakingActions(T)(w).lockStake({ user: U, roleId: 1n, stakeAmount: 2n**128n-1n, entryBurn: 0n, payer: U, account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
    it('empty data bytes', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await registryActions(T)(w).registerRoleSelf({ roleId: 1n, data: '0x', account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
    it('very long metadata string', async () => { p.readContract.mockResolvedValue('A'.repeat(1000)); const result = await tokenActions()(p).name({ token: T }); expect(result.length).toBe(1000); });
  });
});
