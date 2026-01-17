/**
 * Unit Tests for Token Actions (Core Functions)
 * 
 * Tests the 8 most critical token functions:
 * - totalSupply, balanceOf
 * - transfer, approve, allowance
 * - mint, burn
 * - exchangeRate (xPNTs/aPNTs specific)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { tokenActions } from '../../src/actions/tokens';
import { createMockPublicClient, createMockWalletClient, resetMocks } from '../mocks/client';

const TOKEN_ADDRESS = '0x1111111111111111111111111111111111111111' as `0x${string}`;
const USER_ADDRESS = '0x2222222222222222222222222222222222222222' as `0x${string}`;
const SPENDER_ADDRESS = '0x3333333333333333333333333333333333333333' as `0x${string}`;

describe('TokenActions - Core Functions', () => {
  let publicClient: ReturnType<typeof createMockPublicClient>;
  let walletClient: ReturnType<typeof createMockWalletClient>;

  beforeEach(() => {
    resetMocks();
    publicClient = createMockPublicClient();
    walletClient = createMockWalletClient();
  });

  describe('totalSupply', () => {
    it('should call readContract with correct parameters', async () => {
      const mockSupply = 1000000n;
      publicClient.readContract.mockResolvedValue(mockSupply);

      const actions = tokenActions()(publicClient);
      const result = await actions.totalSupply({ token: TOKEN_ADDRESS });

      expect(publicClient.readContract).toHaveBeenCalledWith({
        address: TOKEN_ADDRESS,
        abi: expect.any(Array),
        functionName: 'totalSupply',
        args: []
      });
      expect(result).toBe(mockSupply);
    });
  });

  describe('balanceOf', () => {
    it('should get balance for an address', async () => {
      const mockBalance = 5000n;
      publicClient.readContract.mockResolvedValue(mockBalance);

      const actions = tokenActions()(publicClient);
      const result = await actions.balanceOf({ token: TOKEN_ADDRESS, account: USER_ADDRESS });

      expect(publicClient.readContract).toHaveBeenCalledWith({
        address: TOKEN_ADDRESS,
        abi: expect.any(Array),
        functionName: 'balanceOf',
        args: [USER_ADDRESS]
      });
      expect(result).toBe(mockBalance);
    });
  });

  describe('transfer', () => {
    it('should call writeContract with correct parameters', async () => {
      const mockTxHash = '0xabcd' as `0x${string}`;
      walletClient.writeContract.mockResolvedValue(mockTxHash);

      const actions = tokenActions()(walletClient);
      const result = await actions.transfer({
        token: TOKEN_ADDRESS,
        to: USER_ADDRESS,
        amount: 100n,
        account: walletClient.account
      });

      expect(walletClient.writeContract).toHaveBeenCalledWith({
        address: TOKEN_ADDRESS,
        abi: expect.any(Array),
        functionName: 'transfer',
        args: [USER_ADDRESS, 100n],
        account: walletClient.account,
        chain: walletClient.chain
      });
      expect(result).toBe(mockTxHash);
    });
  });

  describe('approve', () => {
    it('should approve spender with amount', async () => {
      const mockTxHash = '0xdef0' as `0x${string}`;
      walletClient.writeContract.mockResolvedValue(mockTxHash);

      const actions = tokenActions()(walletClient);
      const result = await actions.approve({
        token: TOKEN_ADDRESS,
        spender: SPENDER_ADDRESS,
        amount: 200n,
        account: walletClient.account
      });

      expect(walletClient.writeContract).toHaveBeenCalledWith({
        address: TOKEN_ADDRESS,
        abi: expect.any(Array),
        functionName: 'approve',
        args: [SPENDER_ADDRESS, 200n],
        account: walletClient.account,
        chain: walletClient.chain
      });
      expect(result).toBe(mockTxHash);
    });
  });

  describe('allowance', () => {
    it('should get allowance for owner and spender', async () => {
      const mockAllowance = 300n;
      publicClient.readContract.mockResolvedValue(mockAllowance);

      const actions = tokenActions()(publicClient);
      const result = await actions.allowance({
        token: TOKEN_ADDRESS,
        owner: USER_ADDRESS,
        spender: SPENDER_ADDRESS
      });

      expect(publicClient.readContract).toHaveBeenCalledWith({
        address: TOKEN_ADDRESS,
        abi: expect.any(Array),
        functionName: 'allowance',
        args: [USER_ADDRESS, SPENDER_ADDRESS]
      });
      expect(result).toBe(mockAllowance);
    });
  });

  describe('mint', () => {
    it('should mint tokens to address', async () => {
      const mockTxHash = '0x1234' as `0x${string}`;
      walletClient.writeContract.mockResolvedValue(mockTxHash);

      const actions = tokenActions()(walletClient);
      const result = await actions.mint({
        token: TOKEN_ADDRESS,
        to: USER_ADDRESS,
        amount: 1000n,
        account: walletClient.account
      });

      expect(walletClient.writeContract).toHaveBeenCalledWith({
        address: TOKEN_ADDRESS,
        abi: expect.any(Array),
        functionName: 'mint',
        args: [USER_ADDRESS, 1000n],
        account: walletClient.account,
        chain: walletClient.chain
      });
      expect(result).toBe(mockTxHash);
    });
  });

  describe('burn', () => {
    it('should burn tokens', async () => {
      const mockTxHash = '0x5678' as `0x${string}`;
      walletClient.writeContract.mockResolvedValue(mockTxHash);

      const actions = tokenActions()(walletClient);
      const result = await actions.burn({
        token: TOKEN_ADDRESS,
        amount: 500n,
        account: walletClient.account
      });

      expect(walletClient.writeContract).toHaveBeenCalledWith({
        address: TOKEN_ADDRESS,
        abi: expect.any(Array),
        functionName: 'burn',
        args: [500n],
        account: walletClient.account,
        chain: walletClient.chain
      });
      expect(result).toBe(mockTxHash);
    });
  });

  describe('exchangeRate', () => {
    it('should get xPNTs/aPNTs exchange rate', async () => {
      const mockRate = 1050000n; // 1.05 with 6 decimals
      publicClient.readContract.mockResolvedValue(mockRate);

      const actions = tokenActions()(publicClient);
      const result = await actions.exchangeRate({ token: TOKEN_ADDRESS });

      expect(publicClient.readContract).toHaveBeenCalledWith({
        address: TOKEN_ADDRESS,
        abi: expect.any(Array),
        functionName: 'exchangeRate',
        args: []
      });
      expect(result).toBe(mockRate);
    });
  });
});

