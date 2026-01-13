import { describe, it, expect, vi, beforeEach } from 'vitest';
import { type Address, type PublicClient, type WalletClient, type Account } from 'viem';
import { superPaymasterActions } from './superPaymaster.js';

describe('SuperPaymaster Actions', () => {
    const mockPaymasterAddress: Address = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb';
    let mockPublicClient: Partial<PublicClient>;
    let mockWalletClient: Partial<WalletClient>;
    let mockAccount: Account;

    const MOCK_OPERATOR: Address = '0x1234567890123456789012345678901234567890';

    beforeEach(() => {
        mockAccount = {
            address: MOCK_OPERATOR,
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

    describe('Deposit operations', () => {
        it('should deposit aPNTs', async () => {
            const txHash = '0xabc...';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);

            const actions = superPaymasterActions(mockPaymasterAddress)(mockWalletClient as WalletClient);
            const result = await actions.depositAPNTs({ amount: 1000n, account: mockAccount });

            expect(result).toBe(txHash);
        });

        it('should deposit ETH', async () => {
            const txHash = '0xdef...';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);

            const actions = superPaymasterActions(mockPaymasterAddress)(mockWalletClient as WalletClient);
            const result = await actions.depositETH({ value: 1000000000000000000n, account: mockAccount });

            expect(result).toBe(txHash);
        });

        it('should deposit for operator', async () => {
            const txHash = '0xghi...';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);

            const actions = superPaymasterActions(mockPaymasterAddress)(mockWalletClient as WalletClient);
            const result = await actions.depositForOperator({
                operator: MOCK_OPERATOR,
                amount: 5000n,
                account: mockAccount
            });

            expect(result).toBe(txHash);
        });

        it('should withdraw to address', async () => {
            const txHash = '0xjkl...';
            const to: Address = '0x9999999999999999999999999999999999999999';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);

            const actions = superPaymasterActions(mockPaymasterAddress)(mockWalletClient as WalletClient);
            const result = await actions.withdrawTo({ to, amount: 2000n, account: mockAccount });

            expect(result).toBe(txHash);
        });
    });

    describe('Stake operations', () => {
        it('should add super stake', async () => {
            const txHash = '0xmno...';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);

            const actions = superPaymasterActions(mockPaymasterAddress)(mockWalletClient as WalletClient);
            const result = await actions.addSuperStake({ amount: 10000n, account: mockAccount });

            expect(result).toBe(txHash);
        });

        it('should unlock super stake', async () => {
            const txHash = '0xpqr...';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);

            const actions = superPaymasterActions(mockPaymasterAddress)(mockWalletClient as WalletClient);
            const result = await actions.unlockSuperStake({ account: mockAccount });

            expect(result).toBe(txHash);
        });

        it('should withdraw stake', async () => {
            const txHash = '0xstu...';
            const to: Address = '0x8888888888888888888888888888888888888888';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);

            const actions = superPaymasterActions(mockPaymasterAddress)(mockWalletClient as WalletClient);
            const result = await actions.withdrawStake({ to, account: mockAccount });

            expect(result).toBe(txHash);
        });
    });

    describe('Operator management', () => {
        it('should configure operator', async () => {
            const txHash = '0xvwx...';
            const xPNTsToken: Address = '0x7777777777777777777777777777777777777777';
            const treasury: Address = '0x6666666666666666666666666666666666666666';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);

            const actions = superPaymasterActions(mockPaymasterAddress)(mockWalletClient as WalletClient);
            const result = await actions.configureOperator({
                xPNTsToken,
                treasury,
                exchangeRate: 1000000n,
                account: mockAccount
            });

            expect(result).toBe(txHash);
        });

        it('should pause operator', async () => {
            const txHash = '0xyz...';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);

            const actions = superPaymasterActions(mockPaymasterAddress)(mockWalletClient as WalletClient);
            const result = await actions.setOperatorPaused({
               operator: MOCK_OPERATOR,
                paused: true,
                account: mockAccount
            });

            expect(result).toBe(txHash);
        });

        it('should update reputation', async () => {
            const txHash = '0x123...';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);

            const actions = superPaymasterActions(mockPaymasterAddress)(mockWalletClient as WalletClient);
            const result = await actions.updateReputation({
                operator: MOCK_OPERATOR,
                newReputation: 850n,
                account: mockAccount
            });

            expect(result).toBe(txHash);
        });
    });

    describe('Price and configuration', () => {
        it('should set aPNTs price', async () => {
            const txHash = '0x456...';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);

            const actions = superPaymasterActions(mockPaymasterAddress)(mockWalletClient as WalletClient);
            const result = await actions.setAPNTsPrice({
                priceUSD: 1000000n, // $1.00
                account: mockAccount
            });

            expect(result).toBe(txHash);
        });

        it('should set cached price', async () => {
            const txHash = '0x789...';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);

            const actions = superPaymasterActions(mockPaymasterAddress)(mockWalletClient as WalletClient);
            const result = await actions.setCachedPrice({
                price: 2000000000n,
                account: mockAccount
            });

            expect(result).toBe(txHash);
        });
    });

    describe('Query operations', () => {
        it('should get operator config', async () => {
            const mockConfig = { aPNTsBalance: 1000n, exchangeRate: 100000n };
            (mockPublicClient.readContract as any).mockResolvedValue(mockConfig);

            const actions = superPaymasterActions(mockPaymasterAddress)(mockPublicClient as PublicClient);
            const config = await actions.operators({ operator: MOCK_OPERATOR });

            expect(config).toEqual(mockConfig);
        });

        it('should check if operator is paused', async () => {
            (mockPublicClient.readContract as any).mockResolvedValue(false);

            const actions = superPaymasterActions(mockPaymasterAddress)(mockPublicClient as PublicClient);
            const isPaused = await actions.isOperatorPaused({ operator: MOCK_OPERATOR });

            expect(isPaused).toBe(false);
        });

        it('should get contract references', async () => {
            const mockRegistry: Address = '0x5555555555555555555555555555555555555555';
            (mockPublicClient.readContract as any).mockResolvedValue(mockRegistry);

            const actions = superPaymasterActions(mockPaymasterAddress)(mockPublicClient as PublicClient);
            const registry = await actions.REGISTRY();

            expect(registry).toBe(mockRegistry);
        });
    });
});
