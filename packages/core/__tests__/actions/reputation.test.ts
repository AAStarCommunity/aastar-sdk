/**
 * Unit Tests for Reputation Actions
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { reputationActions } from '../../src/actions/reputation';
import { createMockPublicClient, createMockWalletClient, resetMocks } from '../mocks/client';

const REPUTATION_ADDRESS = '0x1111111111111111111111111111111111111111' as `0x${string}`;
const USER_ADDRESS = '0x2222222222222222222222222222222222222222' as `0x${string}`;

describe('ReputationActions', () => {
  let publicClient: ReturnType<typeof createMockPublicClient>;
  let walletClient: ReturnType<typeof createMockWalletClient>;

  beforeEach(() => {
    resetMocks();
    publicClient = createMockPublicClient();
    walletClient = createMockWalletClient();
  });

  describe('getUserScore', () => {
    it('should get user score', async () => {
      publicClient.readContract.mockResolvedValue(1000n);
      const actions = reputationActions(REPUTATION_ADDRESS)(publicClient);
      const result = await actions.getUserScore({ user: USER_ADDRESS });
      expect(result).toBe(1000n);
    });
  });

  describe('setReputationRule', () => {
    it('should set reputation rule', async () => {
      walletClient.writeContract.mockResolvedValue('0xhash' as `0x${string}`);
      const actions = reputationActions(REPUTATION_ADDRESS)(walletClient);
      await actions.setReputationRule({ ruleId: '0x01', rule: {}, account: walletClient.account });
      expect(walletClient.writeContract).toHaveBeenCalled();
    });
  });

  describe('calculateReputation', () => {
    it('should calculate reputation', async () => {
      publicClient.readContract.mockResolvedValue([500n, 1000n]);
      const actions = reputationActions(REPUTATION_ADDRESS)(publicClient);
      const result = await actions.calculateReputation({ user: USER_ADDRESS, community: '0xC0', timestamp: 0n });
      expect(result).toHaveProperty('communityScore');
      expect(result).toHaveProperty('globalScore');
    });
  });
});
