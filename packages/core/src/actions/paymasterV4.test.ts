import { describe, it, expect, vi, beforeEach } from 'vitest';
import { type Address, type PublicClient, type WalletClient, type Account } from 'viem';
import { paymasterV4Actions } from './paymasterV4.js';

describe('PaymasterV4 Actions', () => {
    const mockPaymasterAddress: Address = '0x1234567890123456789012345678901234567890';
    let mockPublicClient: Partial<PublicClient>;
    let mockWalletClient: Partial<WalletClient>;
    let mockAccount: Account;

    const MOCK_USER: Address = '0x2222222222222222222222222222222222222222';
    const MOCK_TOKEN: Address = '0x3333333333333333333333333333333333333333';
    const MOCK_SBT: Address = '0x4444444444444444444444444444444444444444';

    beforeEach(() => {
        mockAccount = {
            address: '0x1111111111111111111111111111111111111111' as Address,
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

    describe('Deposit-Only Model', () => {
        it('should deposit for user', async () => {
            const txHash = '0xabc...';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);

            const actions = paymasterV4Actions(mockPaymasterAddress)(mockWalletClient as WalletClient);
            const result = await actions.paymasterV4DepositFor({
                user: MOCK_USER,
                token: MOCK_TOKEN,
                amount: 1000n,
                account: mockAccount
            });

            expect(result).toBe(txHash);
            expect(mockWalletClient.writeContract).toHaveBeenCalledWith(
                expect.objectContaining({
                    functionName: 'depositFor',
                    args: [MOCK_USER, MOCK_TOKEN, 1000n],
                })
            );
        });

        it('should withdraw tokens', async () => {
            const txHash = '0xdef...';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);

            const actions = paymasterV4Actions(mockPaymasterAddress)(mockWalletClient as WalletClient);
            const result = await actions.paymasterV4Withdraw({
                token: MOCK_TOKEN,
                amount: 500n,
                account: mockAccount
            });

            expect(result).toBe(txHash);
        });

        it('should get balance', async () => {
            (mockPublicClient.readContract as any).mockResolvedValue(1000n);

            const actions = paymasterV4Actions(mockPaymasterAddress)(mockPublicClient as PublicClient);
            const balance = await actions.paymasterV4Balances({ user: MOCK_USER, token: MOCK_TOKEN });

            expect(balance).toBe(1000n);
        });
    });

    describe('Token Pricing', () => {
        it('should set token price', async () => {
            const txHash = '0xghi...';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);

            const actions = paymasterV4Actions(mockPaymasterAddress)(mockWalletClient as WalletClient);
            const result = await actions.paymasterV4SetTokenPrice({
                token: MOCK_TOKEN,
                price: 2000n,
                account: mockAccount
            });

            expect(result).toBe(txHash);
        });

        it('should get token price', async () => {
            (mockPublicClient.readContract as any).mockResolvedValue(2000n);

            const actions = paymasterV4Actions(mockPaymasterAddress)(mockPublicClient as PublicClient);
            const price = await actions.paymasterV4TokenPrices({ token: MOCK_TOKEN });

            expect(price).toBe(2000n);
        });
    });

    describe('Gas Token Management', () => {
        it('should add gas token', async () => {
            const txHash = '0xjkl...';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);

            const actions = paymasterV4Actions(mockPaymasterAddress)(mockWalletClient as WalletClient);
            const result = await actions.paymasterV4AddGasToken({
                token: MOCK_TOKEN,
                priceFeed: '0x5555555555555555555555555555555555555555' as Address,
                account: mockAccount
            });

            expect(result).toBe(txHash);
        });

        it('should get supported gas tokens', async () => {
            const mockTokens = [MOCK_TOKEN];
            (mockPublicClient.readContract as any).mockResolvedValue(mockTokens);

            const actions = paymasterV4Actions(mockPaymasterAddress)(mockPublicClient as PublicClient);
            const tokens = await actions.paymasterV4GetSupportedGasTokens();

            expect(tokens).toEqual(mockTokens);
        });

        it('should check if gas token is supported', async () => {
            (mockPublicClient.readContract as any).mockResolvedValue(true);

            const actions = paymasterV4Actions(mockPaymasterAddress)(mockPublicClient as PublicClient);
            const supported = await actions.paymasterV4IsGasTokenSupported({ token: MOCK_TOKEN });

            expect(supported).toBe(true);
        });
    });

    describe('SBT Management', () => {
        it('should add SBT', async () => {
            const txHash = '0xmno...';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);

            const actions = paymasterV4Actions(mockPaymasterAddress)(mockWalletClient as WalletClient);
            const result = await actions.paymasterV4AddSBT({ sbt: MOCK_SBT, account: mockAccount });

            expect(result).toBe(txHash);
        });

        it('should get supported SBTs', async () => {
            const mockSBTs = [MOCK_SBT];
            (mockPublicClient.readContract as any).mockResolvedValue(mockSBTs);

            const actions = paymasterV4Actions(mockPaymasterAddress)(mockPublicClient as PublicClient);
            const sbts = await actions.paymasterV4GetSupportedSBTs();

            expect(sbts).toEqual(mockSBTs);
        });

        it('should check if SBT is supported', async () => {
            (mockPublicClient.readContract as any).mockResolvedValue(true);

            const actions = paymasterV4Actions(mockPaymasterAddress)(mockPublicClient as PublicClient);
            const supported = await actions.paymasterV4IsSBTSupported({ sbt: MOCK_SBT });

            expect(supported).toBe(true);
        });
    });

    describe('Traditional Deposit/Withdraw', () => {
        it('should deposit directly', async () => {
            const txHash = '0xpqr...';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);

            const actions = paymasterV4Actions(mockPaymasterAddress)(mockWalletClient as WalletClient);
            const result = await actions.paymasterV4Deposit({ account: mockAccount });

            expect(result).toBe(txHash);
        });

        it('should withdraw to address', async () => {
            const txHash = '0xstu...';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);

            const actions = paymasterV4Actions(mockPaymasterAddress)(mockWalletClient as WalletClient);
            const result = await actions.paymasterV4WithdrawTo({
                to: MOCK_USER,
                amount: 100n,
                account: mockAccount
            });

            expect(result).toBe(txHash);
        });
    });

    describe('Validation', () => {
        it('should validate paymaster UserOp', async () => {
            const mockResult = '0x...';
            (mockPublicClient.readContract as any).mockResolvedValue(mockResult);

            const actions = paymasterV4Actions(mockPaymasterAddress)(mockPublicClient as PublicClient);
            const result = await actions.paymasterV4ValidatePaymasterUserOp({
                userOp: {} as any,
                userOpHash: '0xhash' as `0x${string}`,
                maxCost: 1000n
            });

            expect(result).toBe(mockResult);
        });
    });
});
