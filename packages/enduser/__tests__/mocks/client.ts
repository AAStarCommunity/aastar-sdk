import { vi } from 'vitest';
import type { PublicClient, WalletClient } from 'viem';

export const createMockPublicClient = (): PublicClient => {
  return {
    readContract: vi.fn(),
    chain: { id: 11155111 },
    waitForTransactionReceipt: vi.fn().mockResolvedValue({ status: 'success' }),
  } as any;
};

export const createMockWalletClient = (): WalletClient => {
  return {
    writeContract: vi.fn(),
    account: { address: '0x1234567890123456789012345678901234567890' },
    chain: { id: 11155111 },
  } as any;
};

export const resetMocks = () => {
  vi.clearAllMocks();
};
