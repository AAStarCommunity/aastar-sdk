import { describe, it, expect } from 'vitest';
import { 
    getPaymasterV4Middleware, 
    buildPaymasterData, 
    buildSuperPaymasterData, 
    formatUserOpV07 
} from './PaymasterUtils.js';
import { type Address } from 'viem';

describe('PaymasterUtils', () => {
    const MOCK_PM = '0x1111111111111111111111111111111111111111' as Address;
    const MOCK_TOKEN = '0x2222222222222222222222222222222222222222' as Address;
    const MOCK_OPERATOR = '0x3333333333333333333333333333333333333333' as Address;

    it('should get V4 middleware', async () => {
        const middleware = getPaymasterV4Middleware({
            paymasterAddress: MOCK_PM,
            gasToken: MOCK_TOKEN
        });
        const result = await middleware.sponsorUserOperation({
            userOperation: { preVerificationGas: 100n }
        });
        expect(result.paymasterAndData).toBeDefined();
        expect(result.paymasterAndData.toLowerCase()).toContain(MOCK_PM.toLowerCase().replace('0x', ''));
    });

    it('should build paymaster data for V4', () => {
        const data = buildPaymasterData(MOCK_PM, MOCK_TOKEN);
        expect(data.length).toBe(2 + 40 + 32 + 32 + 40 + 12 + 12); // Layout check
    });

    it('should build super paymaster data', () => {
        const data = buildSuperPaymasterData(MOCK_PM, MOCK_OPERATOR);
        expect(data.toLowerCase()).toContain(MOCK_OPERATOR.toLowerCase().replace('0x', ''));
    });

    it('should format UserOp for v0.7', () => {
        const userOp = {
            sender: MOCK_PM,
            nonce: 1n,
            callData: '0x123',
            preVerificationGas: 1000n,
            accountGasLimits: '0x' + '1'.repeat(32) + '2'.repeat(32),
            gasFees: '0x' + '3'.repeat(32) + '4'.repeat(32),
            paymasterAndData: '0x' + MOCK_PM.slice(2) + '5'.repeat(32) + '6'.repeat(32) + '7788',
            signature: '0x'
        };
        const formatted = formatUserOpV07(userOp);
        expect(formatted.sender).toBe(MOCK_PM);
        expect(formatted.verificationGasLimit).toBeDefined();
        expect(formatted.maxFeePerGas).toBeDefined();
        expect(formatted.paymaster).toBe(MOCK_PM);
    });
});
