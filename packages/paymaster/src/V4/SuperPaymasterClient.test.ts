import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SuperPaymasterClient } from './SuperPaymasterClient.js';
import { PaymasterClient } from './PaymasterClient.js';
import { type Address } from 'viem';

// Mock PaymasterClient
vi.mock('./PaymasterClient.js', () => ({
    PaymasterClient: {
        estimateUserOperationGas: vi.fn(),
        submitGaslessUserOperation: vi.fn()
    }
}));

describe('SuperPaymasterClient', () => {
    const MOCK_PM = '0x1111111111111111111111111111111111111111' as Address;
    const MOCK_USER = '0x2222222222222222222222222222222222222222' as Address;
    const MOCK_TOKEN = '0x3333333333333333333333333333333333333333' as Address;
    const MOCK_RECIPIENT = '0x4444444444444444444444444444444444444444' as Address;
    const MOCK_OPERATOR = '0x5555555555555555555555555555555555555555' as Address;
    const MOCK_EP = '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789' as Address;

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should submit gasless transaction with tuned limits', async () => {
        (PaymasterClient.estimateUserOperationGas as any).mockResolvedValue({
            verificationGasLimit: 100000n,
            callGasLimit: 200000n,
            preVerificationGas: 50000n,
            paymasterPostOpGasLimit: 100000n
        });
        (PaymasterClient.submitGaslessUserOperation as any).mockResolvedValue('0xuserOpHash');

        const hash = await SuperPaymasterClient.submitGaslessTransaction(
            {}, // client
            {}, // wallet
            MOCK_USER,
            MOCK_EP,
            'http://bundler',
            {
                token: MOCK_TOKEN,
                recipient: MOCK_RECIPIENT,
                amount: 100n,
                operator: MOCK_OPERATOR,
                paymasterAddress: MOCK_PM
            }
        );

        expect(hash).toBe('0xuserOpHash');
        expect(PaymasterClient.submitGaslessUserOperation).toHaveBeenCalledWith(
            expect.anything(),
            expect.anything(),
            expect.anything(),
            expect.anything(),
            expect.anything(),
            expect.anything(),
            expect.anything(),
            expect.anything(),
            expect.objectContaining({
                verificationGasLimit: 120000n, // 100k + 20k buffer
                autoEstimate: false
            })
        );
    });

    it('should throw on invalid configuration', async () => {
        await expect(SuperPaymasterClient.submitGaslessTransaction(
            {}, {}, MOCK_USER, MOCK_EP, 'http://bundler',
            {
                token: 'invalid' as any,
                recipient: MOCK_RECIPIENT,
                amount: 100n,
                operator: MOCK_OPERATOR,
                paymasterAddress: MOCK_PM
            }
        )).rejects.toThrow();
    });
});
