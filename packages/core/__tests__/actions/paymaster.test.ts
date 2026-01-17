/**
 * Unit Tests for Paymaster Actions (Core Functions)
 * Based on actual API signatures
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { paymasterActions } from '../../src/actions/paymaster';
import { createMockPublicClient, createMockWalletClient, resetMocks } from '../mocks/client';

const PAYMASTER_ADDRESS = '0x1111111111111111111111111111111111111111' as `0x${string}`;
const USER_ADDRESS = '0x2222222222222222222222222222222222222222' as `0x${string}`;
const TOKEN_ADDRESS = '0x3333333333333333333333333333333333333333' as `0x${string}`;

describe('PaymasterActions - Core Functions', () => {
  let publicClient: ReturnType<typeof createMockPublicClient>;
  let walletClient: ReturnType<typeof createMockWalletClient>;

  beforeEach(() => {
    resetMocks();
    publicClient = createMockPublicClient();
    walletClient = createMockWalletClient();
  });

  describe('depositFor', () => {
    it('should deposit tokens for user', async () => {
      const mockTxHash = '0xabc123' as `0x${string}`;
      walletClient.writeContract.mockResolvedValue(mockTxHash);

      const actions = paymasterActions(PAYMASTER_ADDRESS)(walletClient);
      const result = await actions.depositFor({
        user: USER_ADDRESS,
        token: TOKEN_ADDRESS,
        amount: 1000n,
        account: walletClient.account
      });

      expect(walletClient.writeContract).toHaveBeenCalledWith({
        address: PAYMASTER_ADDRESS,
        abi: expect.any(Array),
        functionName: 'depositFor',
        args: [USER_ADDRESS, TOKEN_ADDRESS, 1000n],
        account: walletClient.account,
        chain: walletClient.chain
      });
      expect(result).toBe(mockTxHash);
    });
  });

  describe('withdraw', () => {
    it('should withdraw tokens', async () => {
      const mockTxHash = '0xdef456' as `0x${string}`;
      walletClient.writeContract.mockResolvedValue(mockTxHash);

      const actions = paymasterActions(PAYMASTER_ADDRESS)(walletClient);
      const result = await actions.withdraw({
        token: TOKEN_ADDRESS,
        amount: 500n,
        account: walletClient.account
      });

      expect(walletClient.writeContract).toHaveBeenCalledWith({
        address: PAYMASTER_ADDRESS,
        abi: expect.any(Array),
        functionName: 'withdraw',
        args: [TOKEN_ADDRESS, 500n],
        account: walletClient.account,
        chain: walletClient.chain
      });
      expect(result).toBe(mockTxHash);
    });
  });

  describe('balances', () => {
    it('should get user token balance', async () => {
      publicClient.readContract.mockResolvedValue(2000n);

      const actions = paymasterActions(PAYMASTER_ADDRESS)(publicClient);
      const result = await actions.balances({
        user: USER_ADDRESS,
        token: TOKEN_ADDRESS
      });

      expect(publicClient.readContract).toHaveBeenCalledWith({
        address: PAYMASTER_ADDRESS,
        abi: expect.any(Array),
        functionName: 'balances',
        args: [USER_ADDRESS, TOKEN_ADDRESS]
      });
      expect(result).toBe(2000n);
    });
  });

  describe('validatePaymasterUserOp', () => {
    it('should validate paymaster user operation', async () => {
      const mockUserOp = {} as any;
      const mockUserOpHash = '0x123' as `0x${string}`;
      const mockValidation = [0n, 0n];
      publicClient.readContract.mockResolvedValue(mockValidation);

      const actions = paymasterActions(PAYMASTER_ADDRESS)(publicClient);
      const result = await actions.validatePaymasterUserOp({
        userOp: mockUserOp,
        userOpHash: mockUserOpHash,
        maxCost: 1000n
      });

      expect(publicClient.readContract).toHaveBeenCalledWith({
        address: PAYMASTER_ADDRESS,
        abi: expect.any(Array),
        functionName: 'validatePaymasterUserOp',
        args: [mockUserOp, mockUserOpHash, 1000n]
      });
      expect(result).toEqual(mockValidation);
    });
  });

  describe('cachedPrice', () => {
    it('should get cached price', async () => {
      const mockPrice = [2000000000n, 1700000000n];
      publicClient.readContract.mockResolvedValue(mockPrice);

      const actions = paymasterActions(PAYMASTER_ADDRESS)(publicClient);
      const result = await actions.cachedPrice();

      expect(publicClient.readContract).toHaveBeenCalledWith({
        address: PAYMASTER_ADDRESS,
        abi: expect.any(Array),
        functionName: 'cachedPrice',
        args: []
      });
      // cachedPrice returns structured object with price and lastUpdate
      expect(result).toHaveProperty('price');
      expect(result).toHaveProperty('lastUpdate');
    });
  });

  describe('updatePrice', () => {
    it('should update price', async () => {
      const mockTxHash = '0x789abc' as `0x${string}`;
      walletClient.writeContract.mockResolvedValue(mockTxHash);

      const actions = paymasterActions(PAYMASTER_ADDRESS)(walletClient);
      const result = await actions.updatePrice({
        account: walletClient.account
      });

      expect(walletClient.writeContract).toHaveBeenCalledWith({
        address: PAYMASTER_ADDRESS,
        abi: expect.any(Array),
        functionName: 'updatePrice',
        args: [],
        account: walletClient.account,
        chain: walletClient.chain
      });
      expect(result).toBe(mockTxHash);
    });
  });

  describe('paused', () => {
    it('should check if paused', async () => {
      publicClient.readContract.mockResolvedValue(false);

      const actions = paymasterActions(PAYMASTER_ADDRESS)(publicClient);
      const result = await actions.paused();

      expect(publicClient.readContract).toHaveBeenCalledWith({
        address: PAYMASTER_ADDRESS,
        abi: expect.any(Array),
        functionName: 'paused',
        args: []
      });
      expect(result).toBe(false);
    });
  });
});
