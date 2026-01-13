import { describe, it, expect, vi, beforeEach } from 'vitest';
import { type Address, type PublicClient, type WalletClient, type Account, parseEther } from 'viem';
import { SepoliaFaucetAPI } from './faucet.js';

describe('SepoliaFaucetAPI', () => {
    let mockAdminWallet: Partial<WalletClient>;
    let mockPublicClient: Partial<PublicClient>;
    let mockAccount: Account;

    const MOCK_ADMIN: Address = '0x1111111111111111111111111111111111111111';
    const MOCK_TARGET: Address = '0x2222222222222222222222222222222222222222';
    const MOCK_TOKEN: Address = '0x3333333333333333333333333333333333333333';
    const MOCK_REGISTRY: Address = '0x4444444444444444444444444444444444444444';
    const MOCK_PM_V4: Address = '0x5555555555555555555555555555555555555555';

    beforeEach(() => {
        mockAccount = {
            address: MOCK_ADMIN,
            type: 'json-rpc'
        } as Account;

        mockAdminWallet = {
            account: mockAccount,
            sendTransaction: vi.fn(),
            writeContract: vi.fn(),
        };

        mockPublicClient = {
            getBalance: vi.fn(),
            readContract: vi.fn(),
            waitForTransactionReceipt: vi.fn(),
        };
    });

    describe('fundETH', () => {
        it('should fund ETH if balance is low', async () => {
            (mockPublicClient.getBalance as any).mockResolvedValue(parseEther('0.01'));
            (mockAdminWallet.sendTransaction as any).mockResolvedValue('0xhash');
            (mockPublicClient.waitForTransactionReceipt as any).mockResolvedValue({});

            const funded = await SepoliaFaucetAPI.fundETH(
                mockAdminWallet as WalletClient,
                mockPublicClient as PublicClient,
                MOCK_TARGET,
                parseEther('0.1')
            );

            expect(funded).toBe(true);
            expect(mockAdminWallet.sendTransaction).toHaveBeenCalled();
        });

        it('should not fund ETH if balance is sufficient', async () => {
            (mockPublicClient.getBalance as any).mockResolvedValue(parseEther('0.1'));

            const funded = await SepoliaFaucetAPI.fundETH(
                mockAdminWallet as WalletClient,
                mockPublicClient as PublicClient,
                MOCK_TARGET,
                parseEther('0.1')
            );

            expect(funded).toBe(false);
            expect(mockAdminWallet.sendTransaction).not.toHaveBeenCalled();
        });
    });

    describe('registerEndUser', () => {
        it('should register end user if role not held', async () => {
            (mockPublicClient.readContract as any)
                .mockResolvedValueOnce(false) // hasRole
                .mockResolvedValueOnce('0xstaking') // GTOKEN_STAKING
                .mockResolvedValueOnce(parseEther('1000')); // allowance

            (mockAdminWallet.writeContract as any).mockResolvedValue('0xhash');
            (mockPublicClient.waitForTransactionReceipt as any).mockResolvedValue({});

            const registered = await SepoliaFaucetAPI.registerEndUser(
                mockAdminWallet as WalletClient,
                mockPublicClient as PublicClient,
                MOCK_REGISTRY,
                MOCK_TARGET,
                MOCK_TOKEN
            );

            expect(registered).toBe(true);
            expect(mockAdminWallet.writeContract).toHaveBeenCalledWith(
                expect.objectContaining({
                    functionName: 'safeMintForRole',
                })
            );
        });

        it('should skip registration if role already held', async () => {
            (mockPublicClient.readContract as any).mockResolvedValue(true);

            const registered = await SepoliaFaucetAPI.registerEndUser(
                mockAdminWallet as WalletClient,
                mockPublicClient as PublicClient,
                MOCK_REGISTRY,
                MOCK_TARGET,
                MOCK_TOKEN
            );

            expect(registered).toBe(false);
        });
    });

    describe('mintTestTokens', () => {
        it('should mint tokens if balance is low', async () => {
            (mockPublicClient.readContract as any).mockResolvedValue(0n);
            (mockAdminWallet.writeContract as any).mockResolvedValue('0xhash');
            (mockPublicClient.waitForTransactionReceipt as any).mockResolvedValue({});

            const minted = await SepoliaFaucetAPI.mintTestTokens(
                mockAdminWallet as WalletClient,
                mockPublicClient as PublicClient,
                MOCK_TOKEN,
                MOCK_TARGET,
                parseEther('1000')
            );

            expect(minted).toBe(true);
            expect(mockAdminWallet.writeContract).toHaveBeenCalledWith(
                expect.objectContaining({
                    functionName: 'mint',
                    args: [MOCK_TARGET, parseEther('1000')],
                })
            );
        });

        it('should skip minting if balance is sufficient', async () => {
            (mockPublicClient.readContract as any).mockResolvedValue(parseEther('1000'));

            const minted = await SepoliaFaucetAPI.mintTestTokens(
                mockAdminWallet as WalletClient,
                mockPublicClient as PublicClient,
                MOCK_TOKEN,
                MOCK_TARGET,
                parseEther('1000')
            );

            expect(minted).toBe(false);
        });
    });

    describe('adminDepositForUser', () => {
        it('should perform admin deposit flow', async () => {
            (mockPublicClient.readContract as any)
                .mockResolvedValueOnce(parseEther('100')) // admin balance
                .mockResolvedValueOnce(parseEther('10000')); // allowance

            (mockAdminWallet.writeContract as any).mockResolvedValue('0xhash');
            (mockPublicClient.waitForTransactionReceipt as any).mockResolvedValue({});

            const deposited = await SepoliaFaucetAPI.adminDepositForUser(
                mockAdminWallet as WalletClient,
                mockPublicClient as PublicClient,
                MOCK_PM_V4,
                MOCK_TARGET,
                MOCK_TOKEN,
                parseEther('10')
            );

            expect(deposited).toBe(true);
            expect(mockAdminWallet.writeContract).toHaveBeenCalledWith(
                expect.objectContaining({
                    functionName: 'depositFor',
                    args: [MOCK_TARGET, parseEther('10')],
                })
            );
        });
    });

    describe('prepareTestAccount', () => {
        it('should orchestrate complete setup', async () => {
            // Mock fundETH
            vi.spyOn(SepoliaFaucetAPI, 'fundETH').mockResolvedValue(true);
            // Mock registerEndUser
            vi.spyOn(SepoliaFaucetAPI, 'registerEndUser').mockResolvedValue(true);
            // Mock mintTestTokens
            vi.spyOn(SepoliaFaucetAPI, 'mintTestTokens').mockResolvedValue(true);
            // Mock adminDepositForUser
            vi.spyOn(SepoliaFaucetAPI, 'adminDepositForUser').mockResolvedValue(true);

            const result = await SepoliaFaucetAPI.prepareTestAccount(
                mockAdminWallet as WalletClient,
                mockPublicClient as PublicClient,
                {
                    targetAA: MOCK_TARGET,
                    token: MOCK_TOKEN,
                    registry: MOCK_REGISTRY,
                    paymasterV4: MOCK_PM_V4
                }
            );

            expect(result.ethFunded).toBe(true);
            expect(result.roleRegistered).toBe(true);
            expect(result.tokenMinted).toBe(true);
            expect(result.paymasterDeposited).toBe(true);
        });
    });
});
