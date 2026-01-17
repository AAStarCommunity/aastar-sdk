/**
 * Unit Tests for Factory Actions
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { xPNTsFactoryActions, paymasterFactoryActions } from '../../src/actions/factory';
import { createMockPublicClient, createMockWalletClient, resetMocks } from '../mocks/client';

const FACTORY_ADDRESS = '0x1111111111111111111111111111111111111111' as `0x${string}`;

describe('FactoryActions', () => {
  let publicClient: ReturnType<typeof createMockPublicClient>;
  let walletClient: ReturnType<typeof createMockWalletClient>;

  beforeEach(() => {
    resetMocks();
    publicClient = createMockPublicClient();
    walletClient = createMockWalletClient();
  });

  describe('xPNTsFactory', () => {
    it('should deploy xPNTs token', async () => {
      walletClient.writeContract.mockResolvedValue('0xhash' as `0x${string}`);
      const actions = xPNTsFactoryActions(FACTORY_ADDRESS)(walletClient);
      await actions.deployToken({ community: '0xC0', name: 'Test', symbol: 'TST', account: walletClient.account });
      expect(walletClient.writeContract).toHaveBeenCalled();
    });

    it('should get token count', async () => {
      publicClient.readContract.mockResolvedValue(5n);
      const actions = xPNTsFactoryActions(FACTORY_ADDRESS)(publicClient);
      const result = await actions.getTokenCount();
      expect(result).toBe(5n);
    });
  });

  describe('paymasterFactory', () => {
    it('should deploy paymaster', async () => {
      walletClient.writeContract.mockResolvedValue('0xhash' as `0x${string}`);
      const actions = paymasterFactoryActions(FACTORY_ADDRESS)(walletClient);
      await actions.deployPaymaster({ owner: walletClient.account.address, account: walletClient.account });
      expect(walletClient.writeContract).toHaveBeenCalled();
    });

    it('should get paymaster count', async () => {
      publicClient.readContract.mockResolvedValue(3n);
      const actions = paymasterFactoryActions(FACTORY_ADDRESS)(publicClient);
      const result = await actions.getPaymasterCount();
      expect(result).toBe(3n);
    });
  });
});
