import { describe, it, expect, vi, beforeEach } from 'vitest';
import { type Address, type PublicClient, type WalletClient, type Account } from 'viem';
import { tokenActions, type TokenActions } from './tokens.js';

describe('Token Actions', () => {
    const mockTokenAddress: Address = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb';
    let mockPublicClient: Partial<PublicClient>;
    let mockWalletClient: Partial<WalletClient>;
    let mockAccount: Account;

    beforeEach(() => {
        mockAccount = {
            address: '0x1234567890123456789012345678901234567890' as Address,
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

    describe('Read Operations', () => {
        it('should read token name', async () => {
            const expectedName = 'Test Token';
            (mockPublicClient.readContract as any).mockResolvedValue(expectedName);

            const actions = tokenActions(mockTokenAddress)(mockPublicClient as PublicClient);
            const name = await actions.name();

            expect(name).toBe(expectedName);
            expect(mockPublicClient.readContract).toHaveBeenCalledWith(
                expect.objectContaining({
                    address: mockTokenAddress,
                    functionName: 'name',
                })
            );
        });

        it('should read token symbol', async () => {
            const expectedSymbol = 'TST';
            (mockPublicClient.readContract as any).mockResolvedValue(expectedSymbol);

            const actions = tokenActions(mockTokenAddress)(mockPublicClient as PublicClient);
            const symbol = await actions.symbol();

            expect(symbol).toBe(expectedSymbol);
        });

        it('should read decimals', async () => {
            const expectedDecimals = 18;
            (mockPublicClient.readContract as any).mockResolvedValue(expectedDecimals);

            const actions = tokenActions(mockTokenAddress)(mockPublicClient as PublicClient);
            const decimals = await actions.decimals();

            expect(decimals).toBe(expectedDecimals);
        });

        it('should read total supply', async () => {
            const expectedSupply = 1000000000000000000000n; // 1000 tokens
            (mockPublicClient.readContract as any).mockResolvedValue(expectedSupply);

            const actions = tokenActions(mockTokenAddress)(mockPublicClient as PublicClient);
            const supply = await actions.totalSupply();

            expect(supply).toBe(expectedSupply);
        });

        it('should read balance of address', async () => {
            const expectedBalance = 100000000000000000000n; // 100 tokens
            (mockPublicClient.readContract as any).mockResolvedValue(expectedBalance);

            const userAddress: Address = '0xabcd1234567890123456789012345678901234ab';
            const actions = tokenActions(mockTokenAddress)(mockPublicClient as PublicClient);
            const balance = await actions.balanceOf({ account: userAddress });

            expect(balance).toBe(expectedBalance);
            expect(mockPublicClient.readContract).toHaveBeenCalledWith(
                expect.objectContaining({
                    functionName: 'balanceOf',
                    args: [userAddress],
                })
            );
        });

        it('should read allowance', async () => {
            const expectedAllowance = 50000000000000000000n; // 50 tokens
            (mockPublicClient.readContract as any).mockResolvedValue(expectedAllowance);

            const owner: Address = '0x1111111111111111111111111111111111111111';
            const spender: Address = '0x2222222222222222222222222222222222222222';
            const actions = tokenActions(mockTokenAddress)(mockPublicClient as PublicClient);
            const allowance = await actions.allowance({ owner, spender });

            expect(allowance).toBe(expectedAllowance);
            expect(mockPublicClient.readContract).toHaveBeenCalledWith(
                expect.objectContaining({
                    functionName: 'allowance',
                    args: [owner, spender],
                })
            );
        });
    });

    describe('Write Operations', () => {
        it('should transfer tokens', async () => {
            const txHash = '0xabcd...';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);

            const to: Address = '0x3333333333333333333333333333333333333333';
            const amount = 1000000000000000000n; // 1 token

            const actions = tokenActions(mockTokenAddress)(mockWalletClient as WalletClient);
            const result = await actions.transfer({ to, value: amount, account: mockAccount });

            expect(result).toBe(txHash);
            expect(mockWalletClient.writeContract).toHaveBeenCalledWith(
                expect.objectContaining({
                    functionName: 'transfer',
                    args: [to, amount],
                })
            );
        });

        it('should approve spender', async () => {
            const txHash = '0xdef...';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);

            const spender: Address = '0x4444444444444444444444444444444444444444';
            const amount = 2000000000000000000000n; // 2000 tokens

            const actions = tokenActions(mockTokenAddress)(mockWalletClient as WalletClient);
            const result = await actions.approve({ spender, value: amount, account: mockAccount });

            expect(result).toBe(txHash);
            expect(mockWalletClient.writeContract).toHaveBeenCalledWith(
                expect.objectContaining({
                    functionName: 'approve',
                    args: [spender, amount],
                })
            );
        });

        it('should transferFrom', async () => {
            const txHash = '0xghi...';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);

            const from: Address = '0x5555555555555555555555555555555555555555';
            const to: Address = '0x6666666666666666666666666666666666666666';
            const amount = 500000000000000000n; // 0.5 tokens

            const actions = tokenActions(mockTokenAddress)(mockWalletClient as WalletClient);
            const result = await actions.transferFrom({ from, to, value: amount, account: mockAccount });

            expect(result).toBe(txHash);
            expect(mockWalletClient.writeContract).toHaveBeenCalledWith(
                expect.objectContaining({
                    functionName: 'transferFrom',
                    args: [from, to, amount],
                })
            );
        });
    });

    describe('Contract Address Handling', () => {
        it('should use correct contract address for all operations', async () => {
            const customAddress: Address = '0x9999999999999999999999999999999999999999';
            (mockPublicClient.readContract as any).mockResolvedValue('Custom Token');

            const actions = tokenActions(customAddress)(mockPublicClient as PublicClient);
            await actions.name();

            expect(mockPublicClient.readContract).toHaveBeenCalledWith(
                expect.objectContaining({
                    address: customAddress,
                })
            );
        });
    });
});
