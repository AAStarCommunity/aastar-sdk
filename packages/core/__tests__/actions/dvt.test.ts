/**
 * Unit Tests for DVT Actions
 */

import { describe, it, expect, beforeEach } from 'vitest';  
import { dvtActions } from '../../src/actions/dvt';
import { createMockPublicClient, createMockWalletClient, resetMocks } from '../mocks/client';

const DVT_ADDRESS = '0x1111111111111111111111111111111111111111' as `0x${string}`;

describe('DVTActions', () => {
  let publicClient: ReturnType<typeof createMockPublicClient>;
  let walletClient: ReturnType<typeof createMockWalletClient>;

  beforeEach(() => {
    resetMocks();
    publicClient = createMockPublicClient();
    walletClient = createMockWalletClient();
  });

  describe('createSlashProposal', () => {
    it('should create slash proposal', async () => {
      walletClient.writeContract.mockResolvedValue('0xhash' as `0x${string}`);
      const actions = dvtActions(DVT_ADDRESS)(walletClient);
      await actions.createSlashProposal({ address: DVT_ADDRESS, operator: '0xOp', level: 1, reason: 'test', account: walletClient.account });
      expect(walletClient.writeContract).toHaveBeenCalled();
    });
  });

  describe('isValidator', () => {
    it('should check if is validator', async () => {
      publicClient.readContract.mockResolvedValue(true);
      const actions = dvtActions(DVT_ADDRESS)(publicClient);
      const result = await actions.isValidator({ address: DVT_ADDRESS, user: '0xUser' });
      expect(result).toBe(true);
    });
  });
});
