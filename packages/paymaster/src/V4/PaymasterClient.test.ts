import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PaymasterClient } from './PaymasterClient.js';
import { type Address } from 'viem';

// Mock fetch
global.fetch = vi.fn();

describe('PaymasterClient', () => {
    const MOCK_PM = '0x1111111111111111111111111111111111111111' as Address;
    const MOCK_USER = '0x2222222222222222222222222222222222222222' as Address;
    const MOCK_TOKEN = '0x3333333333333333333333333333333333333333' as Address;

    let mockPublicClient: any;
    let mockWallet: any;

    beforeEach(() => {
        vi.clearAllMocks();
        mockPublicClient = {
            readContract: vi.fn(),
            estimateFeesPerGas: vi.fn().mockResolvedValue({ maxFeePerGas: 30n, maxPriorityFeePerGas: 1n }),
            chain: { id: 31337 }
        };
        mockWallet = {
            writeContract: vi.fn().mockResolvedValue('0xhash'),
            account: {
                signMessage: vi.fn().mockResolvedValue('0xsignature')
            },
            chain: { id: 31337 }
        };
    });

    it('should get deposited balance', async () => {
        mockPublicClient.readContract.mockResolvedValue(1000n);
        const balance = await PaymasterClient.getDepositedBalance(mockPublicClient, MOCK_PM, MOCK_USER, MOCK_TOKEN);
        expect(balance).toBe(1000n);
    });

    it('should deposit for user', async () => {
        const hash = await PaymasterClient.depositFor(mockWallet, MOCK_PM, MOCK_USER, MOCK_TOKEN, 100n);
        expect(hash).toBe('0xhash');
    });

    it('should estimate user operation gas', async () => {
        (global.fetch as any).mockResolvedValue({
            json: async () => ({
                result: {
                    preVerificationGas: '0x100',
                    verificationGasLimit: '0x200',
                    callGasLimit: '0x300'
                }
            })
        });

        const est = await PaymasterClient.estimateUserOperationGas(
            mockPublicClient,
            mockWallet,
            MOCK_USER,
            MOCK_PM,
            MOCK_PM,
            MOCK_TOKEN,
            'http://bundler',
            '0x'
        );

        expect(est.preVerificationGas).toBe(256n);
        expect(global.fetch).toHaveBeenCalled();
    });

    it('should submit gasless user operation', async () => {
        mockPublicClient.readContract.mockResolvedValue(0n); // nonce
        (global.fetch as any).mockResolvedValue({
            json: async () => ({ result: '0xuserOpHash' })
        });

        const hash = await PaymasterClient.submitGaslessUserOperation(
            mockPublicClient,
            mockWallet,
            MOCK_USER,
            MOCK_PM,
            MOCK_PM,
            MOCK_TOKEN,
            'http://bundler',
            '0x',
            { autoEstimate: false }
        );

        expect(hash).toBe('0xuserOpHash');
    });

    it('should get fee from receipt', () => {
        const receipt = {
            logs: [{
                address: MOCK_PM,
                topics: ['0x62544d7f48b11c32334310ebd306b47224fca220163218d4a7264322c52ae073'],
                data: '0x' + '1'.repeat(64) + '2'.repeat(64) + '3'.repeat(64)
            }]
        };
        const fee = PaymasterClient.getFeeFromReceipt(receipt, MOCK_PM);
        expect(fee?.actualGasCostWei).toBeDefined();
        expect(fee?.tokenCost).toBeDefined();
    });

    it('should get transaction fee', async () => {
        mockPublicClient.getTransactionReceipt = vi.fn().mockResolvedValue({
            logs: [{
                address: MOCK_PM,
                topics: ['0x62544d7f48b11c32334310ebd306b47224fca220163218d4a7264322c52ae073'],
                data: '0x' + '1'.repeat(64) + '2'.repeat(64) + '3'.repeat(64)
            }]
        });
        const fee = await PaymasterClient.getTransactionFee(mockPublicClient, '0xhash', MOCK_PM);
        expect(fee?.actualGasCostWei).toBeDefined();
    });
});
