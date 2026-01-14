import { describe, it, expect, vi, beforeEach } from 'vitest';
import { tokenActions } from './tokens.js';
import { type PublicClient, type WalletClient, type Address } from 'viem';

describe('TokenActions', () => {
    const MOCK_ADDR: Address = '0x1111111111111111111111111111111111111111';
    let mockPublicClient: any;
    let mockWalletClient: any;
    let actions: any;

    beforeEach(() => {
        mockPublicClient = {
            readContract: vi.fn(),
            simulateContract: vi.fn().mockResolvedValue({ request: {} }),
            writeContract: vi.fn().mockResolvedValue('0xhash'),
            sendTransaction: vi.fn().mockResolvedValue('0xhash')
        };
        mockWalletClient = {
            writeContract: vi.fn().mockResolvedValue('0xhash'),
            chain: { id: 1 }
        };
        actions = tokenActions()(mockPublicClient as any);
    });

    it('should read name', async () => {
        mockPublicClient.readContract.mockResolvedValue('Test Token');
        const name = await actions.tokenName({ token: MOCK_ADDR });
        expect(name).toBe('Test Token');
        expect(mockPublicClient.readContract).toHaveBeenCalledWith(expect.objectContaining({
            functionName: 'name'
        }));
    });

    it('should read symbol', async () => {
        mockPublicClient.readContract.mockResolvedValue('TT');
        const symbol = await actions.tokenSymbol({ token: MOCK_ADDR });
        expect(symbol).toBe('TT');
    });

    it('should transfer tokens', async () => {
        const tx = await actions.tokenTransfer({
            token: MOCK_ADDR,
            to: MOCK_ADDR,
            amount: 100n,
            account: { address: MOCK_ADDR } as any
        });
        expect(tx).toBe('0xhash');
    });

    it('should handle transferFrom', async () => {
        const tx = await actions.tokenTransferFrom({
            token: MOCK_ADDR,
            from: MOCK_ADDR,
            to: MOCK_ADDR,
            amount: 100n,
            account: { address: MOCK_ADDR } as any
        });
        expect(tx).toBe('0xhash');
    });
});
