import { describe, it, expect, vi, beforeEach } from 'vitest';
import { type Address, type PublicClient, type WalletClient, type Hex, type Account, parseEther } from 'viem';
import { superPaymasterActions } from './superPaymaster.js';

describe('SuperPaymaster Actions', () => {
    const mockPaymasterAddress: Address = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb';
    const MOCK_OPERATOR: Address = '0x1234567890123456789012345678901234567890';
    const MOCK_USER: Address = '0x2222222222222222222222222222222222222222';
    
    let mockPublicClient: Partial<PublicClient>;
    let mockWalletClient: any;
    let mockAccount: Account;

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
            readContract: vi.fn(),
            account: mockAccount,
        } as any;
    });

    describe('Deposit operations', () => {
        it('should deposit aPNTs', async () => {
            const txHash = '0xabc...';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);

            const actions = superPaymasterActions(mockPaymasterAddress)(mockWalletClient as WalletClient);
            const result = await actions.superPaymasterDeposit({ amount: 1000n, account: mockAccount });

            expect(result).toBe(txHash);
        });

        it('should deposit ETH', async () => {
            const txHash = '0xdef...';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);

            const actions = superPaymasterActions(mockPaymasterAddress)(mockWalletClient as WalletClient);
            const result = await actions.superPaymasterDepositETH({ value: 1000000000000000000n, account: mockAccount });

            expect(result).toBe(txHash);
        });

        it('should deposit for operator', async () => {
            const txHash = '0xghi...';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);

            const actions = superPaymasterActions(mockPaymasterAddress)(mockWalletClient as WalletClient);
            const result = await actions.superPaymasterDepositFor({ // Changed from depositForOperator to superPaymasterDepositFor
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
            const result = await actions.superPaymasterWithdrawTo({ to, amount: 2000n, account: mockAccount });

            expect(result).toBe(txHash);
        });
    });

    describe('Stake operations', () => {
        it('should add super stake', async () => {
            const txHash = '0xmno...';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);

            const actions = superPaymasterActions(mockPaymasterAddress)(mockWalletClient as WalletClient);
            const result = await actions.superPaymasterAddSuperStake({ amount: 10000n, account: mockAccount });

            expect(result).toBe(txHash);
        });

        it('should unlock super stake', async () => {
            const txHash = '0xpqr...';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);

            const actions = superPaymasterActions(mockPaymasterAddress)(mockWalletClient as WalletClient);
            const result = await actions.superPaymasterUnlockSuperStake({ account: mockAccount });

            expect(result).toBe(txHash);
        });

        it('should withdraw stake', async () => {
            const txHash = '0xstu...';
            const to: Address = '0x8888888888888888888888888888888888888888';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);

            const actions = superPaymasterActions(mockPaymasterAddress)(mockWalletClient as WalletClient);
            const result = await actions.superPaymasterWithdrawStake({ to, account: mockAccount });

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
            const result = await actions.superPaymasterConfigureOperator({
                xPNTsToken,
                treasury,
                exchangeRate: 1000000n,
                account: mockAccount
            });

            expect(result).toBe(txHash);
        });

        it('should pause operator', async () => {
            const txHash = '0xdef...';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);

            const actions = superPaymasterActions(mockPaymasterAddress)(mockWalletClient as WalletClient);
            const result = await actions.superPaymasterSetOperatorPaused({
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
            const result = await actions.superPaymasterUpdateReputation({
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
            const result = await actions.superPaymasterSetAPNTsPrice({
                priceUSD: 1000000n, // $1.00
                account: mockAccount
            });

            expect(result).toBe(txHash);
        });

        it('should set cached price', async () => {
            const txHash = '0x789...';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);

            const actions = superPaymasterActions(mockPaymasterAddress)(mockWalletClient as WalletClient);
            const result = await actions.superPaymasterSetCachedPrice({
                price: 2000000000n,
                account: mockAccount
            });

            expect(result).toBe(txHash);
        });
    });

    describe('Advanced Operator & User Management', () => {
        it('should perform slashing operations', async () => {
            const txHash = '0xhash';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);
            const actions = superPaymasterActions(mockPaymasterAddress)(mockWalletClient as WalletClient);

            const res1 = await actions.superPaymasterSlashOperator({ operator: MOCK_OPERATOR, amount: 100n, reason: 'Test', account: mockAccount });
            const res2 = await actions.superPaymasterExecuteSlashWithBLS({
                operator: MOCK_OPERATOR,
                roleId: '0xROLE',
                amount: 100n,
                reason: 'Test',
                blsSignature: '0xSIG',
                account: mockAccount
            });

            expect(res1).toBe(txHash);
            expect(res2).toBe(txHash);
        });

        it('should manage blocked users', async () => {
            const txHash = '0xhash';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);
            (mockWalletClient.readContract as any).mockResolvedValue(true);
            const actions = superPaymasterActions(mockPaymasterAddress)(mockWalletClient as WalletClient);

            const tx1 = await actions.superPaymasterBlockUser({ user: MOCK_USER, blocked: true, account: mockAccount });
            const tx2 = await actions.superPaymasterUpdateBlockedStatus({ user: MOCK_USER, blocked: true, account: mockAccount });
            const isBlocked = await actions.superPaymasterBlockedUsers({ user: MOCK_USER });

            expect(tx1).toBe(txHash);
            expect(tx2).toBe(txHash);
            expect(isBlocked).toBe(true);
        });
    });

    describe('System Config & Price Management', () => {
        it('should manage protocol fees', async () => {
            const txHash = '0xhash';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);
            (mockWalletClient.readContract as any).mockResolvedValueOnce(100n).mockResolvedValueOnce(500n);

            const actions = superPaymasterActions(mockPaymasterAddress)(mockWalletClient as WalletClient);
            const tx = await actions.superPaymasterSetProtocolFee({ feeRecipient: MOCK_USER, feeBps: 100n, account: mockAccount });
            const bps = await actions.superPaymasterProtocolFeeBPS();
            const revenue = await actions.superPaymasterProtocolRevenue();

            expect(tx).toBe(txHash);
            expect(bps).toBe(100n);
            expect(revenue).toBe(500n);
        });

        it('should manage price updates', async () => {
            const txHash = '0xhash';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);
            (mockWalletClient.readContract as any).mockResolvedValue(2000n);

            const actions = superPaymasterActions(mockPaymasterAddress)(mockWalletClient as WalletClient);
            const tx1 = await actions.superPaymasterUpdatePrice({ account: mockAccount });
            const tx2 = await actions.superPaymasterUpdatePriceDVT({ price: 2000n, proof: '0x', account: mockAccount });
            const price = await actions.superPaymasterAPNTsPriceUSD();

            expect(tx1).toBe(txHash);
            expect(tx2).toBe(txHash);
            expect(price).toBe(2000n);
        });

        it('should manage treasury and factory settings', async () => {
            const txHash = '0xhash';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);
            const actions = superPaymasterActions(mockPaymasterAddress)(mockWalletClient as WalletClient);

            const tx1 = await actions.superPaymasterSetTreasury({ treasury: MOCK_USER, account: mockAccount });
            const tx2 = await actions.superPaymasterSetXPNTsFactory({ factory: MOCK_USER, account: mockAccount });
            const tx3 = await actions.superPaymasterSetAPNTsToken({ token: MOCK_USER, account: mockAccount });
            const tx4 = await actions.superPaymasterSetBLSAggregator({ aggregator: MOCK_USER, account: mockAccount });

            expect(tx1).toBe(txHash);
            expect(tx2).toBe(txHash);
            expect(tx3).toBe(txHash);
            expect(tx4).toBe(txHash);
        });
    });

    describe('Slash History & Views', () => {
        it('should query slash history', async () => {
            (mockPublicClient.readContract as any)
                .mockResolvedValueOnce(5n) // count
                .mockResolvedValueOnce([]) // history
                .mockResolvedValueOnce({ amount: 100n }); // latest

            const actions = superPaymasterActions(mockPaymasterAddress)(mockPublicClient as PublicClient);
            const count = await actions.superPaymasterGetSlashCount({ operator: MOCK_OPERATOR });
            const history = await actions.superPaymasterGetSlashHistory({ operator: MOCK_OPERATOR });
            const latest = await actions.superPaymasterGetLatestSlash({ operator: MOCK_OPERATOR });

            expect(count).toBe(5n);
            expect(Array.isArray(history)).toBe(true);
            expect(latest.amount).toBe(100n);
        });

        it('should query various balance and status views', async () => {
            (mockPublicClient.readContract as any)
                .mockResolvedValueOnce(parseEther('10')) // getDeposit
                .mockResolvedValueOnce(parseEther('1')) // getAvailableCredit
                .mockResolvedValueOnce(123456n) // totalTrackedBalance
                .mockResolvedValueOnce(999999n); // lastUserOpTimestamp

            const actions = superPaymasterActions(mockPaymasterAddress)(mockPublicClient as PublicClient);
            const deposit = await actions.superPaymasterGetDeposit();
            const credit = await actions.superPaymasterGetAvailableCredit({ operator: MOCK_OPERATOR, user: MOCK_USER });
            const tracked = await actions.superPaymasterTotalTrackedBalance();
            const ts = await actions.superPaymasterLastUserOpTimestamp({ user: MOCK_USER });

            expect(deposit).toBe(parseEther('10'));
            expect(credit).toBe(parseEther('1'));
            expect(tracked).toBe(123456n);
            expect(ts).toBe(999999n);
        });

        it('should get operator balance using convenience function', async () => {
            (mockPublicClient.readContract as any).mockResolvedValue([parseEther('5'), '0x...']); // operators returns struct
            const actions = superPaymasterActions(mockPaymasterAddress)(mockPublicClient as PublicClient);
            const balance = await actions.superPaymasterBalanceOfOperator({ operator: MOCK_OPERATOR });
            expect(balance).toBe(parseEther('5'));
        });

        it('should query slashes specifically', async () => {
            const mockSlash = { amount: 100n, reason: 'Test' };
            (mockPublicClient.readContract as any).mockResolvedValue(mockSlash);
            const actions = superPaymasterActions(mockPaymasterAddress)(mockPublicClient as PublicClient);
            const slash = await actions.superPaymasterSlashHistory({ operator: MOCK_OPERATOR, index: 0n });
            expect(slash.amount).toBe(100n);
        });

        it('should query price feed and parameters', async () => {
            (mockPublicClient.readContract as any).mockResolvedValue(100n);
            const actions = superPaymasterActions(mockPaymasterAddress)(mockPublicClient as PublicClient);
            const bps = await actions.superPaymasterBPS_DENOMINATOR();
            const rate = await actions.superPaymasterRATE_OFFSET();
            expect(bps).toBe(100n);
            expect(rate).toBe(100n);
        });
    });

    describe('Constants & System References', () => {
        it('should query all system constants', async () => {
            (mockPublicClient.readContract as any).mockResolvedValue(MOCK_USER);
            const actions = superPaymasterActions(mockPaymasterAddress)(mockPublicClient as PublicClient);

            const results = await Promise.all([
                actions.superPaymasterAPNTS_TOKEN(),
                actions.superPaymasterBLS_AGGREGATOR(),
                actions.superPaymasterETH_USD_PRICE_FEED(),
                actions.superPaymasterXpntsFactory(),
                actions.superPaymasterTreasury(),
                actions.superPaymasterEntryPoint(),
                actions.superPaymasterOwner()
            ]);

            results.forEach(res => expect(res).toBe(MOCK_USER));
        });

        it('should get version', async () => {
            (mockPublicClient.readContract as any).mockResolvedValue('v0.16.4');
            const actions = superPaymasterActions(mockPaymasterAddress)(mockPublicClient as PublicClient);
            const v = await actions.superPaymasterVersion();
            expect(v).toBe('v0.16.4');
        });
    });
});
