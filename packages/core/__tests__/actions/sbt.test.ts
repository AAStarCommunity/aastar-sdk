/**
 * Unit Tests for SBT Actions
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { sbtActions } from '../../src/actions/sbt';
import { createMockPublicClient, createMockWalletClient, resetMocks } from '../mocks/client';

const SBT_ADDRESS = '0x1111111111111111111111111111111111111111' as `0x${string}`;
const USER_ADDRESS = '0x2222222222222222222222222222222222222222' as `0x${string}`;

describe('SBTActions', () => {
  let publicClient: ReturnType<typeof createMockPublicClient>;
  let walletClient: ReturnType<typeof createMockWalletClient>;

  beforeEach(() => {
    resetMocks();
    publicClient = createMockPublicClient();
    walletClient = createMockWalletClient();
  });

  describe('airdropMint', () => {
    it('should mint SBT via airdrop', async () => {
      walletClient.writeContract.mockResolvedValue('0xhash' as `0x${string}`);
      const actions = sbtActions(SBT_ADDRESS)(walletClient);
      await actions.airdropMint({ roleId: 1n, to: USER_ADDRESS, tokenURI: 'ipfs://...', account: walletClient.account });
      expect(walletClient.writeContract).toHaveBeenCalled();
    });
  });

  describe('getUserSBT', () => {
    it('should get user SBT', async () => {
      publicClient.readContract.mockResolvedValue(123n);
      const actions = sbtActions(SBT_ADDRESS)(publicClient);
      const result = await actions.getUserSBT({ user: USER_ADDRESS, roleId: 1n });
      expect(result).toBe(123n);
    });
  });

  describe('balanceOf', () => {
    it('should get SBT balance', async () => {
      publicClient.readContract.mockResolvedValue(5n);
      const actions = sbtActions(SBT_ADDRESS)(publicClient);
      const result = await actions.balanceOf({ owner: USER_ADDRESS });
      expect(result).toBe(5n);
    });
  });

  describe('transferFrom', () => {
    it('should transfer SBT', async () => {
      walletClient.writeContract.mockResolvedValue('0xhash' as `0x${string}`);
      const actions = sbtActions(SBT_ADDRESS)(walletClient);
      await actions.transferFrom({ from: USER_ADDRESS, to: walletClient.account.address, tokenId: 1n, account: walletClient.account });
      expect(walletClient.writeContract).toHaveBeenCalled();
    });
  });

  describe('name', () => {
    it('should get SBT name', async () => {
      publicClient.readContract.mockResolvedValue('MySBT');
      const actions = sbtActions(SBT_ADDRESS)(publicClient);
      const result = await actions.name();
      expect(result).toBe('MySBT');
    });
  });
});
