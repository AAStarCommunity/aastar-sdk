import { describe, it, expect, beforeEach } from 'vitest';
import { registryActions } from '../../src/actions/registry';
import { stakingActions } from '../../src/actions/staking';
import { paymasterActions } from '../../src/actions/paymaster';
import { sbtActions } from '../../src/actions/sbt';
import { createMockPublicClient, createMockWalletClient, resetMocks } from '../mocks/client';

const T = '0x1111111111111111111111111111111111111111' as `0x${string}`;
const R = '0x2222222222222222222222222222222222222222' as `0x${string}`;
const U = '0x3333333333333333333333333333333333333333' as `0x${string}`;

describe('Edge Cases & Error Handling Tests', () => {
  let p: any;
  let w: any;

  beforeEach(() => { resetMocks(); p = createMockPublicClient(); w = createMockWalletClient(); });

  describe('Registry Edge Cases', () => {
    it('register with role 0', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await registryActions(T)(w).registerRoleSelf({ roleId: 0n as any, data: '0x', account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
    it('exit role', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await registryActions(R)(w).exitRole({ roleId: '0x01', account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
    it('hasRole returns false', async () => { p.readContract.mockResolvedValue(false); expect(await registryActions(T)(p).hasRole({ user: U, roleId: '0x01' })).toBe(false); });
  });

  describe('Staking Edge Cases', () => {
    it('slash with zero amount', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await stakingActions(T)(w).slash({ user: U, amount: 0n, reason: 'test', account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
    it('topUpStake with correct args', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await stakingActions(T)(w).topUpStake({ user: U, roleId: '0x01', stakeAmount: 100n, payer: U, account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
  });

  describe('Paymaster Edge Cases', () => {
    it('withdrawStake (Paymaster)', async () => { w.writeContract.mockResolvedValue('0x' as `0x${string}`); await paymasterActions(T)(w).withdrawStake({ to: U, account: w.account }); expect(w.writeContract).toHaveBeenCalled(); });
  });

  describe('Call Rejection Paths', () => {
    it('handles readContract rejection', async () => {
      p.readContract.mockRejectedValue(new Error('RPC Error'));
      await expect(registryActions(T)(p).owner()).rejects.toThrow();
    });
  });
});
