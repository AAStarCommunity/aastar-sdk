/**
 * Unit Tests for Staking Actions (Core Functions)
 * Based on actual API signatures
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { stakingActions } from '../../src/actions/staking';
import { createMockPublicClient, createMockWalletClient, resetMocks } from '../mocks/client';

const STAKING_ADDRESS = '0x1111111111111111111111111111111111111111' as `0x${string}`;
const USER_ADDRESS = '0x2222222222222222222222222222222222222222' as `0x${string}`;

describe('StakingActions - Core Functions', () => {
  let publicClient: ReturnType<typeof createMockPublicClient>;
  let walletClient: ReturnType<typeof createMockWalletClient>;

  beforeEach(() => {
    resetMocks();
    publicClient = createMockPublicClient();
    walletClient = createMockWalletClient();
  });

  describe('lockStake', () => {
    it('should lock stake for user', async () => {
      const mockTxHash = '0xabc123' as `0x${string}`;
      walletClient.writeContract.mockResolvedValue(mockTxHash);

      const actions = stakingActions(STAKING_ADDRESS)(walletClient);
      const result = await actions.lockStake({
        user: USER_ADDRESS,
        roleId: 1n,
        stakeAmount: 1000n,
        entryBurn: 10n,
        payer: walletClient.account.address,
        account: walletClient.account
      });

      expect(walletClient.writeContract).toHaveBeenCalledWith({
        address: STAKING_ADDRESS,
        abi: expect.any(Array),
        functionName: 'lockStake',
        args: [USER_ADDRESS, 1n, 1000n, 10n, walletClient.account.address],
        account: walletClient.account,
        chain: walletClient.chain
      });
      expect(result).toBe(mockTxHash);
    });
  });

  describe('unlockAndTransfer', () => {
    it('should unlock and transfer stake', async () => {
      const mockTxHash = '0xdef456' as `0x${string}`;
      walletClient.writeContract.mockResolvedValue(mockTxHash);

      const actions = stakingActions(STAKING_ADDRESS)(walletClient);
      const result = await actions.unlockAndTransfer({
        user: USER_ADDRESS,
        roleId: 1n,
        account: walletClient.account
      });

      expect(walletClient.writeContract).toHaveBeenCalledWith({
        address: STAKING_ADDRESS,
        abi: expect.any(Array),
        functionName: 'unlockAndTransfer',
        args: [USER_ADDRESS, 1n],
        account: walletClient.account,
        chain: walletClient.chain
      });
      expect(result).toBe(mockTxHash);
    });
  });

  describe('getStakeInfo', () => {
    it('should get stake info', async () => {
      const mockStakeInfo = [1000n, 10n, false];
      publicClient.readContract.mockResolvedValue(mockStakeInfo);

      const actions = stakingActions(STAKING_ADDRESS)(publicClient);
      const result = await actions.getStakeInfo({
        operator: USER_ADDRESS,
        roleId: 1n
      });

      expect(publicClient.readContract).toHaveBeenCalledWith({
        address: STAKING_ADDRESS,
        abi: expect.any(Array),
        functionName: 'getStakeInfo',
        args: [USER_ADDRESS, 1n]
      });
      expect(result).toEqual(mockStakeInfo);
    });
  });

  describe('slash', () => {
    it('should slash user stake', async () => {
      const mockTxHash = '0x789abc' as `0x${string}`;
      walletClient.writeContract.mockResolvedValue(mockTxHash);

      const actions = stakingActions(STAKING_ADDRESS)(walletClient);
      const result = await actions.slash({
        user: USER_ADDRESS,
        roleId: 1n,
        amount: 100n,
        reason: 'Misbehavior',
        account: walletClient.account
      });

      expect(walletClient.writeContract).toHaveBeenCalledWith({
        address: STAKING_ADDRESS,
        abi: expect.any(Array),
        functionName: 'slash',
        args: [USER_ADDRESS, 1n, 100n, 'Misbehavior'],
        account: walletClient.account,
        chain: walletClient.chain
      });
      expect(result).toBe(mockTxHash);
    });
  });

  describe('topUpStake', () => {
    it('should top up stake', async () => {
      const mockTxHash = '0x123def' as `0x${string}`;
      walletClient.writeContract.mockResolvedValue(mockTxHash);

      const actions = stakingActions(STAKING_ADDRESS)(walletClient);
      const result = await actions.topUpStake({
        user: USER_ADDRESS,
        roleId: 1n,
        stakeAmount: 500n,
        payer: walletClient.account.address,
        account: walletClient.account
      });

      expect(walletClient.writeContract).toHaveBeenCalledWith({
        address: STAKING_ADDRESS,
        abi: expect.any(Array),
        functionName: 'topUpStake',
        args: [USER_ADDRESS, 1n, 500n, walletClient.account.address],
        account: walletClient.account,
        chain: walletClient.chain
      });
      expect(result).toBe(mockTxHash);
    });
  });
});
