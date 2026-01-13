import { describe, it, expect, vi } from 'vitest';
import { packUserOpLimits, UserOpClient } from './index.js';

describe('Account Utils', () => {
    it('should pack user op limits', () => {
        const packed = packUserOpLimits(100n, 200n);
        expect(packed).toBeDefined();
        expect(packed.length).toBe(66); // 0x + 64 chars
    });

    describe('UserOpClient', () => {
        const mockBundler = {
            request: vi.fn()
        };

        it('should estimate gas', async () => {
            mockBundler.request.mockResolvedValue({ preVerificationGas: 1000n });
            const res = await UserOpClient.estimateGas(mockBundler, {}, '0x1' as any);
            expect(res.preVerificationGas).toBe(1000n);
        });

        it('should send user operation', async () => {
            mockBundler.request.mockResolvedValue('0xhash');
            const res = await UserOpClient.sendUserOp(mockBundler, {}, '0x1' as any);
            expect(res).toBe('0xhash');
        });

        it('should get receipt', async () => {
            mockBundler.request.mockResolvedValue({ success: true });
            const res = await UserOpClient.getReceipt(mockBundler, '0xhash');
            expect(res.success).toBe(true);
        });
    });
});
