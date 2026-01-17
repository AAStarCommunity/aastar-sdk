/**
 * Unit Tests for SuperPaymaster Actions
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { superPaymasterActions } from '../../src/actions/superPaymaster';
import { createMockPublicClient, createMockWalletClient, resetMocks } from '../mocks/client';

const SPM_ADDRESS = '0x1111111111111111111111111111111111111111' as `0x${string}`;

describe('SuperPaymasterActions', () => {
  let publicClient: ReturnType<typeof createMockPublicClient>;
  let walletClient: ReturnType<typeof createMockWalletClient>;

  beforeEach(() => {
    resetMocks();
    publicClient = createMockPublicClient();
    walletClient = createMockWalletClient();
  });

  describe('owner', () => {
    it('should get owner', async () => {
      publicClient.readContract.mockResolvedValue('0xOwner' as `0x${string}`);
      const actions = superPaymasterActions(SPM_ADDRESS)(publicClient);
      const result = await actions.owner();
      expect(result).toBeDefined();
    });
  });

  describe('version', () => {
    it('should get version', async () => {
      publicClient.readContract.mockResolvedValue('3.0.0');
      const actions = superPaymasterActions(SPM_ADDRESS)(publicClient);
      const result = await actions.version();
      expect(result).toBe('3.0.0');
    });
  });

  describe('treasury', () => {
    it('should get treasury', async () => {
      publicClient.readContract.mockResolvedValue('0xTreasury' as `0x${string}`);
      const actions = superPaymasterActions(SPM_ADDRESS)(publicClient);
      const result = await actions.treasury();
      expect(result).toBeDefined();
    });
  });
});
