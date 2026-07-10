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
    getBlockNumber: vi.fn().mockResolvedValue(100n),
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
    readContract: vi.fn(),
    sendTransaction: vi.fn(),
    // Role-based SDK clients extend a wallet client with public actions, so
    // receipt-waits are available on the same client used for writes. Defaults
    // to a successful receipt; override per-test to simulate an on-chain revert.
    waitForTransactionReceipt: vi.fn().mockResolvedValue({ status: 'success' }),
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
