import { describe, it, expect, vi } from 'vitest';
import { FundingManager } from './funding.js';
import { type Address, type Hex, parseEther } from 'viem';

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
            tokenAddress: '0x2222222222222222222222222222222222222222' as Address, 
            amount: '100' 
        });
        expect(result.success).toBe(true);
    });

    it('should ensure funding when below threshold', async () => {
        const results = await FundingManager.ensureFunding({
            ...params,
            minETH: '2.0',
            targetETH: '1.0'
        });
        expect(results[0].txHash).toBe('0xhash');
    });

    it('should batch fund ETH', async () => {
        const results = await FundingManager.batchFundETH(params, [
            { address: '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' as Address, amount: '0.1' },
            { address: '0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB' as Address, amount: '0.2' }
        ]);
        expect(results).toHaveLength(2);
        expect(results[0].success).toBe(true);
    });

    it('should get ETH balance', async () => {
        const balance = await FundingManager.getETHBalance(params);
        expect(balance).toBe(parseEther('1'));
    });

    it('should get Token balance', async () => {
        const balance = await FundingManager.getTokenBalance(params, '0x2222222222222222222222222222222222222222' as Address);
        expect(balance).toBe(parseEther('100'));
    });

    it('should batch fund Token', async () => {
        const results = await FundingManager.batchFundToken(params, '0x2222222222222222222222222222222222222222' as Address, [
            { address: '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' as Address, amount: '100' },
            { address: '0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB' as Address, amount: '200' }
        ]);
        expect(results).toHaveLength(2);
    });

    it('should handle ensure funding with token', async () => {
        const results = await FundingManager.ensureFunding({
            ...params,
            minETH: '0.5',
            targetETH: '1.0',
            token: {
                address: '0x2222222222222222222222222222222222222222' as Address,
                minBalance: '50',
                targetAmount: '100'
            }
        });
        expect(results.length).toBeGreaterThan(0);
    });

    it('should handle ETH funding errors', async () => {
        vi.spyOn(FundingManager as any, 'createClients').mockReturnValueOnce({
            publicClient: {},
            walletClient: { sendTransaction: vi.fn().mockRejectedValue(new Error('Network error')) },
            account: {}
        });
        const result = await FundingManager.fundWithETH({ ...params, amount: '0.1' });
        expect(result.success).toBe(false);
        expect(result.error).toContain('Network error');
    });

    it('should handle Token funding errors', async () => {
        vi.spyOn(FundingManager as any, 'createClients').mockReturnValueOnce({
            publicClient: { simulateContract: vi.fn().mockRejectedValue(new Error('Insufficient balance')) },
            walletClient: {},
            account: {}
        });
        const result = await FundingManager.fundWithToken({ ...params, tokenAddress: '0x2222222222222222222222222222222222222222' as Address, amount: '100' });
        expect(result.success).toBe(false);
    });
});
