import { describe, it, expect, beforeEach } from 'vitest';
import { tokenActions } from '../../src/actions/tokens';
import { registryActions } from '../../src/actions/registry';
import { stakingActions } from '../../src/actions/staking';
import { paymasterActions } from '../../src/actions/paymaster';
import { sbtActions } from '../../src/actions/sbt';
import { createMockPublicClient, createMockWalletClient, resetMocks } from '../mocks/client';

const T = '0x1111111111111111111111111111111111111111' as `0x${string}`;
const U = '0x2222222222222222222222222222222222222222' as `0x${string}`;

describe('Error Path Coverage Tests', () => {
  let p: any;
  let w: any;
  beforeEach(() => { resetMocks(); p = createMockPublicClient(); w = createMockWalletClient(); });

  describe('Contract Revert Scenarios', () => {
    it('token transfer reverts', async () => {
      w.writeContract.mockRejectedValue(new Error('revert: balance'));
      await expect(tokenActions()(w).transfer({ token: T, to: U, amount: 1000n, account: w.account! })).rejects.toThrow();
    });

    it('staking lockStake reverts', async () => {
      w.writeContract.mockRejectedValue(new Error('revert: stake'));
      await expect(stakingActions(T)(w).lockStake({ roleId: 1n, stakeAmount: 9999n, account: w.account! })).rejects.toThrow();
    });

    it('paymaster depositFor reverts', async () => {
      w.writeContract.mockRejectedValue(new Error('revert: paused'));
      await expect(paymasterActions(T)(w).depositFor({ user: U, amount: 100n, account: w.account! })).rejects.toThrow();
    });
  });

  describe('Invalid Return Data', () => {
    it('handles null return', async () => {
      p.readContract.mockResolvedValue(null as any);
      const result = await tokenActions()(p).balanceOf({ token: T, account: U });
      expect(result).toBeNull();
    });

    it('handles malformed struct return in cachedPrice', async () => {
      p.readContract.mockResolvedValue([100n, 123n]);
      const result = await paymasterActions(T)(p).cachedPrice();
      expect(result.price).toBe(100n);
      expect(result.updatedAt).toBe(123);
    });
  });

  describe('Type Conversion & Optional Params', () => {
    it('uses PublicClient for read', async () => {
      p.readContract.mockResolvedValue(100n);
      await tokenActions()(p).totalSupply({ token: T });
      expect(p.readContract).toHaveBeenCalled();
    });

    it('handles missing account in write', async () => {
      w.writeContract.mockResolvedValue('0xhash' as `0x${string}`);
      await tokenActions()(w).mint({ token: T, to: U, amount: 1n, account: undefined });
      expect(w.writeContract).toHaveBeenCalled();
    });

    it('cachedPrice tuple conversion', async () => {
      p.readContract.mockResolvedValue([1000000n, 1699999999n]);
      const result = await paymasterActions(T)(p).cachedPrice();
      expect(result).toHaveProperty('price');
      expect(result).toHaveProperty('updatedAt');
    });
  });

  describe('SBT Specific Error Paths', () => {
    it('mintForRole reverts', async () => {
      w.writeContract.mockRejectedValue(new Error('revert: exist'));
      await expect(sbtActions(T)(w).mintForRole({ roleId: 1n, user: U, roleData: '0x', account: w.account! })).rejects.toThrow();
    });

    it('getUserSBT returns no token', async () => {
      p.readContract.mockResolvedValue(0n);
      const result = await sbtActions(T)(p).getUserSBT({ user: U });
      expect(result).toBe(0n);
    });
  });
});
