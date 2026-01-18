import { describe, it, expect, beforeEach } from 'vitest';
import { aggregatorActions } from '../../src/actions/aggregator';
import { createMockPublicClient, createMockWalletClient, resetMocks } from '../mocks/client';

const AGG_ADDRESS = '0x1111111111111111111111111111111111111111' as `0x${string}`;
const VALIDATOR_ADDRESS = '0x2222222222222222222222222222222222222222' as `0x${string}`;

describe('AggregatorActions', () => {
  let publicClient: any;
  let walletClient: any;

  beforeEach(() => {
    resetMocks();
    publicClient = createMockPublicClient();
    walletClient = createMockWalletClient();
  });

  describe('registerBLSPublicKey', () => {
    it('should register BLS key', async () => {
      walletClient.writeContract.mockResolvedValue('0xhash');
      const actions = aggregatorActions(AGG_ADDRESS)(walletClient);
      await actions.registerBLSPublicKey({
        validator: VALIDATOR_ADDRESS,
        publicKey: '0x1234',
        account: walletClient.account
      });
      expect(walletClient.writeContract).toHaveBeenCalled();
    });
  });

  describe('Thresholds', () => {
    it('should get default threshold', async () => {
      publicClient.readContract.mockResolvedValue(2n);
      const actions = aggregatorActions(AGG_ADDRESS)(publicClient);
      const result = await actions.defaultThreshold();
      expect(result).toBe(2n);
    });

    it('should set default threshold', async () => {
      walletClient.writeContract.mockResolvedValue('0xhash');
      const actions = aggregatorActions(AGG_ADDRESS)(walletClient);
      await actions.setDefaultThreshold({ newThreshold: 3n, account: walletClient.account });
      expect(walletClient.writeContract).toHaveBeenCalled();
    });
  });

  describe('executeProposal', () => {
    it('should execute proposal', async () => {
      walletClient.writeContract.mockResolvedValue('0xhash');
      const actions = aggregatorActions(AGG_ADDRESS)(walletClient);
      await actions.executeProposal({
        proposalId: '0x01',
        target: VALIDATOR_ADDRESS,
        callData: '0x',
        requiredThreshold: 2n,
        proof: '0x',
        account: walletClient.account
      });
      expect(walletClient.writeContract).toHaveBeenCalled();
    });
  });
});
