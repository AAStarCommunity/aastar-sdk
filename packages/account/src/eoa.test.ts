import { describe, it, expect, vi } from 'vitest';
import { createEOAWalletClient } from './eoa.js';
import * as viem from 'viem';
import { mainnet } from 'viem/chains';

vi.mock('viem', async () => {
    const actual = await vi.importActual('viem');
    return {
        ...actual,
        createWalletClient: vi.fn(),
    };
});

describe('EOAWalletClient', () => {
    const MOCK_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
    const MOCK_ADDR = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';

    it('should create and use EOA wallet client', async () => {
        const sendTransactionSpy = vi.fn().mockResolvedValue('0xhash');
        const mockViemClient = {
            sendTransaction: sendTransactionSpy,
            account: { address: MOCK_ADDR }
        };
        (viem.createWalletClient as any).mockReturnValue(mockViemClient);

        const client = createEOAWalletClient(MOCK_KEY, mainnet);
        
        expect(client.getAddress()).toBe(MOCK_ADDR);
        
        const hash = await client.sendTransaction({ to: MOCK_ADDR, value: 100n });
        expect(hash).toBe('0xhash');
        expect(sendTransactionSpy).toHaveBeenCalledWith(expect.objectContaining({
            to: MOCK_ADDR,
            value: 100n
        }));
    });
});
