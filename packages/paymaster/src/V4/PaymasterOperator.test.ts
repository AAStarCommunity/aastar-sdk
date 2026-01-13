import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PaymasterOperator } from './PaymasterOperator.js';
import { type Address } from 'viem';

describe('PaymasterOperator', () => {
    const MOCK_PM = '0x1111111111111111111111111111111111111111' as Address;
    const MOCK_USER = '0x2222222222222222222222222222222222222222' as Address;
    const MOCK_TOKEN = '0x3333333333333333333333333333333333333333' as Address;
    const MOCK_EP = '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789' as Address;

    let mockPublicClient: any;
    let mockWallet: any;

    beforeEach(() => {
        vi.clearAllMocks();
        mockPublicClient = {
            readContract: vi.fn(),
            waitForTransactionReceipt: vi.fn().mockResolvedValue({ status: 'success' })
        };
        mockWallet = {
            writeContract: vi.fn().mockResolvedValue('0xhash'),
            account: { address: MOCK_USER },
            chain: { id: 31337 }
        };
    });

    it('should update price', async () => {
        const hash = await PaymasterOperator.updatePrice(mockWallet, MOCK_PM);
        expect(hash).toBe('0xhash');
    });

    it('should get cached price', async () => {
        mockPublicClient.readContract.mockResolvedValue([1000n, 123n]);
        const { price, updatedAt } = await PaymasterOperator.getCachedPrice(mockPublicClient, MOCK_PM);
        expect(price).toBe(1000n);
        expect(updatedAt).toBe(123n);
    });

    it('should check gasless readiness', async () => {
        mockPublicClient.readContract
            .mockResolvedValueOnce([10n ** 18n, true, 10n ** 18n, 100000, 0]) // EntryPoint depositInfo
            .mockResolvedValueOnce([2000n, 123n]) // cachedPrice
            .mockResolvedValueOnce(1n) // tokenPrice
            .mockResolvedValueOnce(1000n) // balance
            .mockResolvedValueOnce(500n); // deposit

        const report = await PaymasterOperator.checkGaslessReadiness(mockPublicClient, MOCK_EP, MOCK_PM, MOCK_USER, MOCK_TOKEN);
        expect(report.isReady).toBe(true);
        expect(report.issues.length).toBe(0);
    });

    it('should identify readiness issues', async () => {
        mockPublicClient.readContract
            .mockResolvedValueOnce([0n, false, 0n, 0, 0]) // EntryPoint depositInfo
            .mockResolvedValueOnce([0n, 0n]) // cachedPrice
            .mockResolvedValueOnce(0n) // tokenPrice
            .mockResolvedValueOnce(0n) // balance
            .mockResolvedValueOnce(0n); // deposit

        const report = await PaymasterOperator.checkGaslessReadiness(mockPublicClient, MOCK_EP, MOCK_PM, MOCK_USER, MOCK_TOKEN);
        expect(report.isReady).toBe(false);
        expect(report.issues.length).toBeGreaterThan(0);
    });

    it('should prepare gasless environment', async () => {
        // Mock readiness check to have issues
        mockPublicClient.readContract
            .mockResolvedValueOnce([0n, false, 0n, 0, 0]) // first check inside prepareGaslessEnvironment
            .mockResolvedValueOnce([0n, 0n])
            .mockResolvedValueOnce(0n)
            .mockResolvedValueOnce(0n)
            .mockResolvedValueOnce(0n);

        const results = await PaymasterOperator.prepareGaslessEnvironment(
            mockWallet, mockPublicClient, MOCK_EP, MOCK_PM, MOCK_TOKEN
        );
        expect(results.length).toBeGreaterThan(0);
        expect(mockWallet.writeContract).toHaveBeenCalled();
    });
});
