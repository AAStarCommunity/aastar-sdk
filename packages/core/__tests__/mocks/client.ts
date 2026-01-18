/**
 * Mock Viem Clients for Unit Testing
 * 
 * Provides mock PublicClient and WalletClient for testing SDK actions
 * without requiring actual blockchain connections.
 */

import { vi } from 'vitest';
import type { PublicClient, WalletClient } from 'viem';

/**
 * Mock PublicClient for read operations
 */
export const createMockPublicClient = (): PublicClient => {
  return {
    readContract: vi.fn(),
    getBalance: vi.fn(),
    waitForTransactionReceipt: vi.fn(),
    chain: { id: 11155111 }, // Sepolia
  } as any;
};

/**
 * Mock WalletClient for write operations
 */
export const createMockWalletClient = (): WalletClient => {
  return {
    writeContract: vi.fn(),
    sendTransaction: vi.fn(),
    account: { address: '0x1234567890123456789012345678901234567890' },
    chain: { id: 11155111 }, // Sepolia
  } as any;
};

/**
 * Reset all mocks between tests
 */
export const resetMocks = () => {
  vi.clearAllMocks();
};
