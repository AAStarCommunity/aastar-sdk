import { describe, it, expect, vi, beforeEach } from 'vitest';
import { type Address, type PublicClient, type WalletClient, type Account } from 'viem';
import { aggregatorActions } from './aggregator.js';

describe('Aggregator Actions', () => {
    const mockAggregatorAddress: Address = '0x1234567890123456789012345678901234567890';
    let mockPublicClient: Partial<PublicClient>;
    let mockWalletClient: Partial<WalletClient>;
    let mockAccount: Account;

    const MOCK_PUBLIC_KEY = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' as `0x${string}`;

    beforeEach(() => {
        mockAccount = {
            address: '0x1111111111111111111111111111111111111111' as Address,
            type: 'json-rpc'
        } as Account;

        mockPublicClient = {
            readContract: vi.fn(),
        };

        mockWalletClient = {
            writeContract: vi.fn(),
            account: mockAccount,
        };
    });

    describe('BLS Operations', () => {
        it('should register BLS public key', async () => {
            const txHash = '0xabc...';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);

            const actions = aggregatorActions()(mockWalletClient as WalletClient);
            const result = await actions.registerBLSPublicKey({
                address: mockAggregatorAddress,
                publicKey: MOCK_PUBLIC_KEY,
                account: mockAccount
            });

            expect(result).toBe(txHash);
            expect(mockWalletClient.writeContract).toHaveBeenCalledWith(
                expect.objectContaining({
                    address: mockAggregatorAddress,
                    functionName: 'registerBLSPublicKey',
                    args: [MOCK_PUBLIC_KEY],
                })
            );
        });

        it('should set BLS threshold', async () => {
            const txHash = '0xdef...';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);

            const actions = aggregatorActions()(mockWalletClient as WalletClient);
            const result = await actions.setBLSThreshold({
                address: mockAggregatorAddress,
                threshold: 5,
                account: mockAccount
            });

            expect(result).toBe(txHash);
            expect(mockWalletClient.writeContract).toHaveBeenCalledWith(
                expect.objectContaining({
                    functionName: 'setThreshold',
                    args: [5n],
                })
            );
        });

        it('should get BLS threshold', async () => {
            (mockPublicClient.readContract as any).mockResolvedValue(3n);

            const actions = aggregatorActions()(mockPublicClient as PublicClient);
            const result = await actions.getBLSThreshold({
                address: mockAggregatorAddress
            });

            expect(result).toBe(3n);
            expect(mockPublicClient.readContract).toHaveBeenCalledWith(
                expect.objectContaining({
                    address: mockAggregatorAddress,
                    functionName: 'threshold',
                })
            );
        });
    });
});
