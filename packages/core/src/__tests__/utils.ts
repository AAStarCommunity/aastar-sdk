import { vi } from 'vitest';
import { type PublicClient, type WalletClient, type Address } from 'viem';

export const mockPublicClient = {
    readContract: vi.fn(),
    multicall: vi.fn(),
    getBalance: vi.fn(),
    getBytecode: vi.fn(),
    chain: { id: 12345 }
} as unknown as PublicClient;

export const mockWalletClient = {
    writeContract: vi.fn(),
    deployContract: vi.fn(),
    sendTransaction: vi.fn(),
    chain: { id: 12345 }
} as unknown as WalletClient;

export const mockClient = {
    ...mockPublicClient,
    ...mockWalletClient,
    chain: { id: 12345 }
} as unknown as PublicClient & WalletClient;

export function resetMocks() {
    vi.clearAllMocks();
}

export const TEST_ADDRESSES = {
    token: '0x1000000000000000000000000000000000000001' as Address,
    user: '0x2000000000000000000000000000000000000002' as Address,
    spender: '0x3000000000000000000000000000000000000003' as Address,
    owner: '0x4000000000000000000000000000000000000004' as Address,
    superPaymaster: '0x5000000000000000000000000000000000000005' as Address,
};
