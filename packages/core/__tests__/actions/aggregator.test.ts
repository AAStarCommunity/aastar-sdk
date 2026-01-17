/**
 * Unit Tests for Aggregator Actions
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { aggregatorActions } from '../../src/actions/aggregator';
import { createMockPublicClient, createMockWalletClient, resetMocks } from '../mocks/client';

const AGG_ADDRESS = '0x1111111111111111111111111111111111111111' as `0x${string}`;

describe('AggregatorActions', () => {
  let publicClient: ReturnType<typeof createMockPublicClient>;
  let walletClient: ReturnType<typeof createMockWalletClient>;

  beforeEach(() => {
    resetMocks();
    publicClient = createMockPublicClient();
    walletClient = createMockWalletClient();
  });

  describe('registerBLSPublicKey', () => {
    it('should register BLS key', async () => {
      walletClient.writeContract.mockResolvedValue('0xhash' as `0x${string}`);
      const actions = aggregatorActions(AGG_ADDRESS)(walletClient);
      await actions.registerBLSPublicKey({ publicKey: '0xkey', account: walletClient.account });
      expect(walletClient.writeContract).toHaveBeenCalled();
    });
  });

  describe('getBLSThreshold', () => {
    it('should get threshold', async () => {
      publicClient.readContract.mockResolvedValue(2n);
      const actions = aggregatorActions(AGG_ADDRESS)(publicClient);
      const result = await actions.getBLSThreshold();
      expect(result).toBe(2n);
    });
  });
});
