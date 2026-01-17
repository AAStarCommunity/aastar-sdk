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
  let p: ReturnType<typeof createMockPublicClient>;
  let w: ReturnType<typeof createMockWalletClient>;
  beforeEach(() => { resetMocks(); p = createMockPublicClient(); w = createMockWalletClient(); });

  describe('Contract Revert Scenarios', () => {
    it('token transfer reverts with insufficient balance', async () => {
      w.writeContract.mockRejectedValue(new Error('revert: insufficient balance'));
      await expect(tokenActions()(w).transfer({ token: T, to: U, amount: 1000n, account: w.account! })).rejects.toThrow();
    });

    it('approve reverts with invalid spender', async () => {
      w.writeContract.mockRejectedValue(new Error('revert: invalid spender'));
      await expect(tokenActions()(w).approve({ token: T, spender: U, amount: 100n, account: w.account! })).rejects.toThrow();
    });

    it('registry register reverts - role not configured', async () => {
      w.writeContract.mockRejectedValue(new Error('revert: role not configured'));
      await expect(registryActions(T)(w).registerRoleSelf({ roleId: 999n, data: '0x', account: w.account! })).rejects.toThrow();
    });

    it('staking lockStake reverts - insufficient tokens', async () => {
      w.writeContract.mockRejectedValue(new Error('revert: insufficient balance'));
      await expect(stakingActions(T)(w).lockStake({ user: U, roleId: 1n, stakeAmount: 9999n, entryBurn: 0n, payer: U, account: w.account! })).rejects.toThrow();
    });

    it('paymaster depositFor reverts - paused', async () => {
      w.writeContract.mockRejectedValue(new Error('revert: paused'));
      await expect(paymasterActions(T)(w).depositFor({ user: U, token: T, amount: 100n, account: w.account! })).rejects.toThrow();
    });
  });

  describe('Network Error Scenarios', () => {
    it('handles network timeout on read', async () => {
      p.readContract.mockRejectedValue(new Error('network timeout'));
      await expect(tokenActions()(p).balanceOf({ token: T, account: U })).rejects.toThrow('time');
    });

    it('handles network timeout on write', async () => {
      w.writeContract.mockRejectedValue(new Error('ETIMEDOUT'));
      await expect(tokenActions()(w).mint({ token: T, to: U, amount: 100n, account: w.account! })).rejects.toThrow();
    });

    it('handles connection refused', async () => {
      p.readContract.mockRejectedValue(new Error('ECONNREFUSED'));
      await expect(registryActions(T)(p).hasRole({ user: U, roleId: 1n })).rejects.toThrow();
    });
  });

  describe('Invalid Return Data', () => {
    it('handles null return from balanceOf', async () => {
      p.readContract.mockResolvedValue(null as any);
      const result = await tokenActions()(p).balanceOf({ token: T, account: U });
      expect(result).toBeNull();
    });

    it('handles undefined return from owner', async () => {
      p.readContract.mockResolvedValue(undefined as any);
      const result = await registryActions(T)(p).owner();
      expect(result).toBeUndefined();
    });

    it('handles malformed struct return', async () => {
      p.readContract.mockResolvedValue({ wrong: 'fields' } as any);
      const result = await stakingActions(T)(p).getStakeInfo({ operator: U, roleId: 1n });
      expect(result).toBeDefined();
    });
  });

  describe('Empty/Null Input Handling', () => {
    it('handles empty data bytes', async () => {
      w.writeContract.mockResolvedValue('0x' as `0x${string}`);
      await tokenActions()(w).transfer({ token: T, to: U, amount: 0n, account: w.account! });
      expect(w.writeContract).toHaveBeenCalled();
    });

    it('handles zero address', async () => {
      p.readContract.mockResolvedValue(0n);
      const result = await tokenActions()(p).balanceOf({ token: T, account: '0x0000000000000000000000000000000000000000' });
      expect(result).toBe(0n);
    });
  });

  describe('Client Type Branches', () => {
    it('uses PublicClient for read operations', async () => {
      p.readContract.mockResolvedValue(100n);
      await tokenActions()(p).totalSupply({ token: T });
      expect(p.readContract).toHaveBeenCalled();
    });

    it('uses WalletClient for write operations', async () => {
      w.writeContract.mockResolvedValue('0xhash' as `0x${string}`);
      await tokenActions()(w).burn({ token: T, amount: 10n, account: w.account! });
      expect(w.writeContract).toHaveBeenCalled();
    });

    it('handles missing account in write', async () => {
      w.writeContract.mockResolvedValue('0xhash' as `0x${string}`);
      const clientWithoutAccount = { ...w, account: undefined };
      await tokenActions()(clientWithoutAccount as any).mint({ token: T, to: U, amount: 1n, account: undefined });
      expect(w.writeContract).toHaveBeenCalled();
    });
  });

  describe('Optional Parameter Coverage', () => {
    it('calls with account parameter provided', async () => {
      w.writeContract.mockResolvedValue('0x' as `0x${string}`);
      await tokenActions()(w).transfer({ token: T, to: U, amount: 1n, account: w.account! });
      expect(w.writeContract).toHaveBeenCalled();
    });

    it('calls with account parameter undefined', async () => {
      w.writeContract.mockResolvedValue('0x' as `0x${string}`);
      await tokenActions()(w).transfer({ token: T, to: U, amount: 1n, account: undefined });
      expect(w.writeContract).toHaveBeenCalled();
    });

    it('validatePaymasterUserOp with minimal params', async () => {
      p.readContract.mockResolvedValue(0n);
      await paymasterActions(T)(p).validatePaymasterUserOp({ userOp: {}, userOpHash: '0x', maxCost: 1000n });
      expect(p.readContract).toHaveBeenCalled();
    });
  });

  describe('Type Conversion Coverage', () => {
    it('converts number to bigint in parameters', async () => {
      w.writeContract.mockResolvedValue('0x' as `0x${string}`);
      await stakingActions(T)(w).topUpStake({ user: U, roleId: 1n, topUpAmount: 100n, payer: U, account: w.account! });
      expect(w.writeContract).toHaveBeenCalled();
    });

    it('handles tuple return conversion', async () => {
      p.readContract.mockResolvedValue([1000000n, 1699999999n]);
      const result = await paymasterActions(T)(p).cachedPrice();
      expect(result).toHaveProperty('price');
      expect(result).toHaveProperty('lastUpdate');
    });

    it('handles struct return with transformation', async () => {
      p.readContract.mockResolvedValue({ field1: 1n, field2: '0xdata' });
      const result = await stakingActions(T)(p).getStakeInfo({ operator: U, roleId: 1n });
      expect(result).toBeDefined();
    });
  });

  describe('SBT Specific Error Paths', () => {
    it('airdropMint reverts - already minted', async () => {
      w.writeContract.mockRejectedValue(new Error('revert: token already exists'));
      await expect(sbtActions(T)(w).airdropMint({ roleId: 1n, to: U, tokenURI: 'uri', account: w.account! })).rejects.toThrow();
    });

    it('transferFrom reverts - soulbound', async () => {
      w.writeContract.mockRejectedValue(new Error('revert: soulbound'));
      await expect(sbtActions(T)(w).transferFrom({ from: U, to: U, tokenId: 1n, account: w.account! })).rejects.toThrow();
    });

    it('getUserSBT returns no token', async () => {
      p.readContract.mockResolvedValue(0n);
      const result = await sbtActions(T)(p).getUserSBT({ user: U, roleId: 1n });
      expect(result).toBe(0n);
    });
  });
});
