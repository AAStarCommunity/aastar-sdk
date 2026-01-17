/**
 * Unit Tests for Registry Actions (Core Functions)
 * Based on L1 regression test API patterns
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { registryActions } from '../../src/actions/registry';
import { createMockPublicClient, createMockWalletClient, resetMocks } from '../mocks/client';

const REGISTRY_ADDRESS = '0x1111111111111111111111111111111111111111' as `0x${string}`;
const USER_ADDRESS = '0x2222222222222222222222222222222222222222' as `0x${string}`;

describe('RegistryActions - Core Functions', () => {
  let publicClient: ReturnType<typeof createMockPublicClient>;
  let walletClient: ReturnType<typeof createMockWalletClient>;

  beforeEach(() => {
    resetMocks();
    publicClient = createMockPublicClient();
    walletClient = createMockWalletClient();
  });

  describe('registerRoleSelf', () => {
    it('should register self with role', async () => {
      const mockTxHash = '0xabc123' as `0x${string}`;
      walletClient.writeContract.mockResolvedValue(mockTxHash);

      const actions = registryActions(REGISTRY_ADDRESS)(walletClient);
      const result = await actions.registerRoleSelf({
        roleId: 1n,
        data: '0x',
        account: walletClient.account
      });

      expect(walletClient.writeContract).toHaveBeenCalledWith({
        address: REGISTRY_ADDRESS,
        abi: expect.any(Array),
        functionName: 'registerRoleSelf',
        args: [1n, '0x'],
        account: walletClient.account,
        chain: walletClient.chain
      });
      expect(result).toBe(mockTxHash);
    });
  });

  describe('hasRole', () => {
    it('should check if user has role', async () => {
      publicClient.readContract.mockResolvedValue(true);

      const actions = registryActions(REGISTRY_ADDRESS)(publicClient);
      const result = await actions.hasRole({
        user: USER_ADDRESS,
        roleId: 1n
      });

      expect(publicClient.readContract).toHaveBeenCalledWith({
        address: REGISTRY_ADDRESS,
        abi: expect.any(Array),
        functionName: 'hasRole',
        args: [1n, USER_ADDRESS]
      });
      expect(result).toBe(true);
    });
  });

  describe('owner', () => {
    it('should get owner address', async () => {
      const mockOwner = '0x9999999999999999999999999999999999999999' as `0x${string}`;
      publicClient.readContract.mockResolvedValue(mockOwner);

      const actions = registryActions(REGISTRY_ADDRESS)(publicClient);
      const result = await actions.owner();

      expect(publicClient.readContract).toHaveBeenCalledWith({
        address: REGISTRY_ADDRESS,
        abi: expect.any(Array),
        functionName: 'owner',
        args: []
      });
      expect(result).toBe(mockOwner);
    });
  });

  describe('version', () => {
    it('should get contract version', async () => {
      publicClient.readContract.mockResolvedValue('1.0.0');

      const actions = registryActions(REGISTRY_ADDRESS)(publicClient);
      const result = await actions.version();

      expect(publicClient.readContract).toHaveBeenCalledWith({
        address: REGISTRY_ADDRESS,
        abi: expect.any(Array),
        functionName: 'version',
        args: []
      });
      expect(result).toBe('1.0.0');
    });
  });

  describe('ROLE_COMMUNITY', () => {
    it('should get community role ID', async () => {
      publicClient.readContract.mockResolvedValue(1n);

      const actions = registryActions(REGISTRY_ADDRESS)(publicClient);
      const result = await actions.ROLE_COMMUNITY();

      expect(publicClient.readContract).toHaveBeenCalledWith({
        address: REGISTRY_ADDRESS,
        abi: expect.any(Array),
        functionName: 'ROLE_COMMUNITY',
        args: []
      });
      expect(result).toBe(1n);
    });
  });

  describe('unRegisterRole', () => {
    it('should unregister user from role', async () => {
      const mockTxHash = '0xdef456' as `0x${string}`;
      walletClient.writeContract.mockResolvedValue(mockTxHash);

      const actions = registryActions(REGISTRY_ADDRESS)(walletClient);
      const result = await actions.unRegisterRole({
        user: USER_ADDRESS,
        roleId: 1n,
        account: walletClient.account
      });

      expect(walletClient.writeContract).toHaveBeenCalledWith({
        address: REGISTRY_ADDRESS,
        abi: expect.any(Array),
        functionName: 'unregisterRole',
        args: [USER_ADDRESS, 1n],
        account: walletClient.account,
        chain: walletClient.chain
      });
      expect(result).toBe(mockTxHash);
    });
  });
});
