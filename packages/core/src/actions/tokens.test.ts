import { describe, it, expect, vi, beforeEach } from 'vitest';
import { type Address, type PublicClient, type WalletClient, type Account } from 'viem';
import { tokenActions, gTokenActions } from './tokens.js';

describe('Token Actions', () => {
    const mockTokenAddress: Address = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb';
    const MOCK_USER: Address = '0xabcd1234567890123456789012345678901234ab';
    const MOCK_SPENDER: Address = '0x2222222222222222222222222222222222222222';
    let mockPublicClient: Partial<PublicClient>;
    let mockWalletClient: any;
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
            readContract: vi.fn(),
            account: mockAccount,
        } as any;
    });

    describe('Metadata & Ownership', () => {
        it('should get name, symbol, and decimals', async () => {
            (mockPublicClient.readContract as any)
                .mockResolvedValueOnce('Test Token')
                .mockResolvedValueOnce('TST')
                .mockResolvedValueOnce(18);

            const actions = tokenActions()(mockPublicClient as PublicClient);
            const name = await actions.name({ token: mockTokenAddress });
            const symbol = await actions.symbol({ token: mockTokenAddress });
            const decimals = await actions.decimals({ token: mockTokenAddress });

            expect(name).toBe('Test Token');
            expect(symbol).toBe('TST');
            expect(decimals).toBe(18);
        });

        it('should manage ownership', async () => {
            const txHash = '0xhash';
            (mockWalletClient.readContract as any).mockResolvedValue(MOCK_USER);
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);

            const actions = tokenActions()(mockWalletClient as WalletClient);
            const owner = await actions.owner({ token: mockTokenAddress });
            const tx1 = await actions.transferOwnership({ token: mockTokenAddress, newOwner: MOCK_SPENDER, account: mockAccount });
            const tx2 = await actions.renounceOwnership({ token: mockTokenAddress, account: mockAccount });

            expect(owner).toBe(MOCK_USER);
            expect(tx1).toBe(txHash);
            expect(tx2).toBe(txHash);
        });
    });

    describe('xPNTs / aPNTs Specific Features', () => {
        it('should update exchange rate', async () => {
            const txHash = '0xhash';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);

            const actions = tokenActions()(mockWalletClient as WalletClient);
            const result = await actions.updateExchangeRate({
                token: mockTokenAddress,
                newRate: 1500000000000000000n,
                account: mockAccount
            });

            expect(result).toBe(txHash);
        });

        it('should manage debt', async () => {
            const txHash = '0xhash';
            (mockWalletClient.readContract as any).mockResolvedValue(500n);
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);

            const actions = tokenActions()(mockWalletClient as WalletClient);
            const debt = await actions.getDebt({ token: mockTokenAddress, user: MOCK_USER });
            const result = await actions.repayDebt({ token: mockTokenAddress, amount: 200n, account: mockAccount });

            expect(debt).toBe(500n);
            expect(result).toBe(txHash);
        });

        it('should transfer and call', async () => {
            const txHash = '0xhash';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);

            const actions = tokenActions()(mockWalletClient as WalletClient);
            const result = await actions.transferAndCall({
                token: mockTokenAddress,
                to: MOCK_SPENDER,
                amount: 100n,
                data: '0x1234',
                account: mockAccount
            });

            expect(result).toBe(txHash);
        });

        it('should manage auto-approved spenders', async () => {
            const txHash = '0xhash';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);
            (mockWalletClient.readContract as any).mockResolvedValue(true);

            const actions = tokenActions()(mockWalletClient as WalletClient);
            const tx1 = await actions.addAutoApprovedSpender({ token: mockTokenAddress, spender: MOCK_SPENDER, account: mockAccount });
            const tx2 = await actions.removeAutoApprovedSpender({ token: mockTokenAddress, spender: MOCK_SPENDER, account: mockAccount });
            const isApproved = await actions.isAutoApprovedSpender({ token: mockTokenAddress, spender: MOCK_SPENDER });

            expect(tx1).toBe(txHash);
            expect(tx2).toBe(txHash);
            expect(isApproved).toBe(true);
        });

        it('should query constants', async () => {
            const mockAddr: Address = '0xConstAddr';
            (mockPublicClient.readContract as any).mockResolvedValue(mockAddr);

            const actions = tokenActions()(mockPublicClient as PublicClient);
            const pm = await actions.SUPERPAYMASTER_ADDRESS({ token: mockTokenAddress });
            const factory = await actions.FACTORY({ token: mockTokenAddress });

            expect(pm).toBe(mockAddr);
            expect(factory).toBe(mockAddr);
        });
    });

    describe('gTokenActions', () => {
        it('should use GTokenABI for standard methods', async () => {
            (mockPublicClient.readContract as any).mockResolvedValue(1000n);
            
            const actions = gTokenActions()(mockPublicClient as PublicClient);
            const balance = await actions.balanceOf({ token: mockTokenAddress, account: MOCK_USER });
            
            expect(balance).toBe(1000n);
            expect(mockPublicClient.readContract).toHaveBeenCalledWith(
                expect.objectContaining({
                    abi: expect.arrayContaining([expect.objectContaining({ name: 'balanceOf' })]),
                })
            );
        });

        it('should support mint and burn in gTokenActions', async () => {
            const txHash = '0xhash';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);

            const actions = gTokenActions()(mockWalletClient as WalletClient);
            const tx1 = await actions.mint({ token: mockTokenAddress, to: MOCK_USER, amount: 1000n, account: mockAccount });
            const tx2 = await actions.burn({ token: mockTokenAddress, amount: 500n, account: mockAccount });

            expect(tx1).toBe(txHash);
            expect(tx2).toBe(txHash);
        });
    });

    describe('Read Operations', () => {
        it('should read total supply', async () => {
            const expectedSupply = 1000000000000000000000n;
            (mockPublicClient.readContract as any).mockResolvedValue(expectedSupply);

            const actions = tokenActions()(mockPublicClient as PublicClient);
            const supply = await actions.totalSupply({ token: mockTokenAddress });

            expect(supply).toBe(expectedSupply);
        });

        it('should read balance of address', async () => {
            const expectedBalance = 100000000000000000000n;
            (mockPublicClient.readContract as any).mockResolvedValue(expectedBalance);

            const userAddress: Address = '0xabcd1234567890123456789012345678901234ab';
            const actions = tokenActions()(mockPublicClient as PublicClient);
            const balance = await actions.balanceOf({ token: mockTokenAddress, account: userAddress });

            expect(balance).toBe(expectedBalance);
            expect(mockPublicClient.readContract).toHaveBeenCalledWith(
                expect.objectContaining({
                    functionName: 'balanceOf',
                    args: [userAddress],
                })
            );
        });

        it('should read allowance', async () => {
            const expectedAllowance = 50000000000000000000n;
            (mockPublicClient.readContract as any).mockResolvedValue(expectedAllowance);

            const owner: Address = '0x1111111111111111111111111111111111111111';
            const spender: Address = '0x2222222222222222222222222222222222222222';
            const actions = tokenActions()(mockPublicClient as PublicClient);
            const allowance = await actions.allowance({ token: mockTokenAddress, owner, spender });

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
            const amount = 1000000000000000000n;

            const actions = tokenActions()(mockWalletClient as WalletClient);
            const result = await actions.transfer({ token: mockTokenAddress, to, amount, account: mockAccount });

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
            const amount = 2000000000000000000000n;

            const actions = tokenActions()(mockWalletClient as WalletClient);
            const result = await actions.approve({ token: mockTokenAddress, spender, amount, account: mockAccount });

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
            const amount = 500000000000000000n;

            const actions = tokenActions()(mockWalletClient as WalletClient);
            const result = await actions.transferFrom({ token: mockTokenAddress, from, to, amount, account: mockAccount });

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

            const actions = tokenActions()(mockPublicClient as PublicClient);
            await actions.name({ token: customAddress });

            expect(mockPublicClient.readContract).toHaveBeenCalledWith(
                expect.objectContaining({
                    address: customAddress,
                })
            );
        });
    });
});
