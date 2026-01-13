import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FundingManager } from './funding.js';
import { type Address, type Hex, parseEther } from 'viem';

// Mock viem clients
vi.mock('viem', async () => {
    const actual = await vi.importActual('viem');
    return {
        ...actual,
        createPublicClient: vi.fn(() => ({
            getBalance: vi.fn().mockResolvedValue(parseEther('1')),
            readContract: vi.fn().mockResolvedValue(parseEther('100')),
            simulateContract: vi.fn().mockResolvedValue({ request: {} }),
            waitForTransactionReceipt: vi.fn().mockResolvedValue({ status: 'success' })
        })),
        createWalletClient: vi.fn(() => ({
            sendTransaction: vi.fn().mockResolvedValue('0xhash'),
            writeContract: vi.fn().mockResolvedValue('0xhash'),
            account: { address: '0xsupplier' }
        })),
        http: vi.fn()
    };
});

describe('FundingManager', () => {
    const params = {
        rpcUrl: 'http://localhost:8545',
        chain: { id: 1 } as any,
        supplierKey: '0x1234567890123456789012345678901234567890123456789012345678901234' as Hex,
        targetAddress: '0x1111111111111111111111111111111111111111' as Address
    };

    it('should fund with ETH', async () => {
        const result = await FundingManager.fundWithETH({ ...params, amount: '0.1' });
        expect(result.success).toBe(true);
        expect(result.txHash).toBe('0xhash');
    });

    it('should fund with Token', async () => {
        const result = await FundingManager.fundWithToken({ 
            ...params, 
            tokenAddress: '0xTOKEN' as Address, 
            amount: '100' 
        });
        expect(result.success).toBe(true);
    });

    it('should ensure funding when below threshold', async () => {
        const results = await FundingManager.ensureFunding({
            ...params,
            minETH: '2.0', // Current is 1.0
            targetETH: '1.0'
        });
        expect(results[0].txHash).toBe('0xhash');
    });

    it('should batch fund ETH', async () => {
        const results = await FundingManager.batchFundETH(params, [
            { address: '0xA' as Address, amount: '0.1' },
            { address: '0xB' as Address, amount: '0.2' }
        ]);
        expect(results).toHaveLength(2);
        expect(results[0].success).toBe(true);
    });
});
