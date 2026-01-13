import { describe, it, expect, vi, beforeEach } from 'vitest';
import { type Address, type PublicClient, type WalletClient, type Account, type Hex } from 'viem';
import { accountActions, accountFactoryActions } from './account.js';

describe('Account Actions', () => {
    let mockPublicClient: Partial<PublicClient>;
    let mockWalletClient: Partial<WalletClient>;
    let mockAccount: Account;

    const MOCK_ACCOUNT_ADDR: Address = '0x1111111111111111111111111111111111111111';
    const MOCK_DEST: Address = '0x2222222222222222222222222222222222222222';
    const MOCK_FACTORY_ADDR: Address = '0x3333333333333333333333333333333333333333';
    const MOCK_OWNER: Address = '0x4444444444444444444444444444444444444444';

    beforeEach(() => {
        mockAccount = {
            address: MOCK_OWNER,
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

    describe('accountActions', () => {
        it('should execute transaction', async () => {
            const txHash = '0xhash';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);

            const actions = accountActions(MOCK_ACCOUNT_ADDR)(mockWalletClient as WalletClient);
            const result = await actions.execute({
                dest: MOCK_DEST,
                value: 100n,
                func: '0x1234' as Hex,
                account: mockAccount
            });

            expect(result).toBe(txHash);
            expect(mockWalletClient.writeContract).toHaveBeenCalledWith(
                expect.objectContaining({
                    functionName: 'execute',
                    args: [MOCK_DEST, 100n, '0x1234'],
                })
            );
        });

        it('should execute batch transactions', async () => {
            const txHash = '0xhash';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);

            const actions = accountActions(MOCK_ACCOUNT_ADDR)(mockWalletClient as WalletClient);
            const result = await actions.executeBatch({
                dest: [MOCK_DEST, MOCK_DEST],
                value: [100n, 200n],
                func: ['0x12', '0x34'] as Hex[],
                account: mockAccount
            });

            expect(result).toBe(txHash);
            expect(mockWalletClient.writeContract).toHaveBeenCalledWith(
                expect.objectContaining({
                    functionName: 'executeBatch',
                    args: [[
                        { target: MOCK_DEST, value: 100n, data: '0x12' },
                        { target: MOCK_DEST, value: 200n, data: '0x34' }
                    ]],
                })
            );
        });

        it('should get nonce', async () => {
            (mockPublicClient.readContract as any).mockResolvedValue(5n);

            const actions = accountActions(MOCK_ACCOUNT_ADDR)(mockPublicClient as PublicClient);
            const result = await actions.getNonce();

            expect(result).toBe(5n);
        });

        it('should get entry point address', async () => {
            const mockEP: Address = '0xEP';
            (mockPublicClient.readContract as any).mockResolvedValue(mockEP);

            const actions = accountActions(MOCK_ACCOUNT_ADDR)(mockPublicClient as PublicClient);
            const result = await actions.entryPoint();

            expect(result).toBe(mockEP);
        });

        it('should add deposit', async () => {
            const txHash = '0xhash';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);

            const actions = accountActions(MOCK_ACCOUNT_ADDR)(mockWalletClient as WalletClient);
            const result = await actions.addDeposit({ account: mockAccount });

            expect(result).toBe(txHash);
        });

        it('should withdraw deposit to address', async () => {
            const txHash = '0xhash';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);

            const actions = accountActions(MOCK_ACCOUNT_ADDR)(mockWalletClient as WalletClient);
            const result = await actions.withdrawDepositTo({
                withdrawAddress: MOCK_DEST,
                amount: 100n,
                account: mockAccount
            });

            expect(result).toBe(txHash);
        });

        it('should get owner', async () => {
            (mockPublicClient.readContract as any).mockResolvedValue(MOCK_OWNER);

            const actions = accountActions(MOCK_ACCOUNT_ADDR)(mockPublicClient as PublicClient);
            const result = await actions.owner();

            expect(result).toBe(MOCK_OWNER);
        });
    });

    describe('accountFactoryActions', () => {
        it('should create account', async () => {
            const txHash = '0xhash';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);

            const actions = accountFactoryActions(MOCK_FACTORY_ADDR)(mockWalletClient as WalletClient);
            const result = await actions.createAccount({
                owner: MOCK_OWNER,
                salt: 0n,
                account: mockAccount
            });

            expect(result).toBe(txHash);
        });

        it('should predict account address', async () => {
            const mockAddr: Address = '0xPREDICTED';
            (mockPublicClient.readContract as any).mockResolvedValue(mockAddr);

            const actions = accountFactoryActions(MOCK_FACTORY_ADDR)(mockPublicClient as PublicClient);
            const result = await actions.getAddress({ owner: MOCK_OWNER, salt: 0n });

            expect(result).toBe(mockAddr);
        });
    });
});
