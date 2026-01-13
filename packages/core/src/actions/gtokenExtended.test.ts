import { describe, it, expect, vi, beforeEach } from 'vitest';
import { type Address, type PublicClient, type WalletClient, type Account } from 'viem';
import { gTokenExtendedActions } from './gtokenExtended.js';

describe('GTokenExtended Actions', () => {
    const mockGTokenAddress: Address = '0x1234567890123456789012345678901234567890';
    let mockPublicClient: Partial<PublicClient>;
    let mockWalletClient: Partial<WalletClient>;
    let mockAccount: Account;

    const MOCK_USER: Address = '0x2222222222222222222222222222222222222222';

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

    describe('Minting & Burning', () => {
        it('should mint tokens', async () => {
            const txHash = '0xabc...';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);

            const actions = gTokenExtendedActions(mockGTokenAddress)(mockWalletClient as WalletClient);
            const result = await actions.mint({ to: MOCK_USER, amount: 1000n, account: mockAccount });

            expect(result).toBe(txHash);
            expect(mockWalletClient.writeContract).toHaveBeenCalledWith(
                expect.objectContaining({
                    functionName: 'mint',
                    args: [MOCK_USER, 1000n],
                })
            );
        });

        it('should burn tokens', async () => {
            const txHash = '0xdef...';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);

            const actions = gTokenExtendedActions(mockGTokenAddress)(mockWalletClient as WalletClient);
            const result = await actions.burn({ amount: 500n, account: mockAccount });

            expect(result).toBe(txHash);
        });

        it('should burn tokens from address', async () => {
            const txHash = '0xghi...';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);

            const actions = gTokenExtendedActions(mockGTokenAddress)(mockWalletClient as WalletClient);
            const result = await actions.burnFrom({ from: MOCK_USER, amount: 500n, account: mockAccount });

            expect(result).toBe(txHash);
        });
    });

    describe('Cap & Minter', () => {
        it('should get cap', async () => {
            (mockPublicClient.readContract as any).mockResolvedValue(1000000n);

            const actions = gTokenExtendedActions(mockGTokenAddress)(mockPublicClient as PublicClient);
            const cap = await actions.cap();

            expect(cap).toBe(1000000n);
        });

        it('should get minter', async () => {
            const mockMinter: Address = '0x3333333333333333333333333333333333333333';
            (mockPublicClient.readContract as any).mockResolvedValue(mockMinter);

            const actions = gTokenExtendedActions(mockGTokenAddress)(mockPublicClient as PublicClient);
            const minter = await actions.minter();

            expect(minter).toBe(mockMinter);
        });

        it('should set minter', async () => {
            const txHash = '0xjkl...';
            const newMinter: Address = '0x4444444444444444444444444444444444444444';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);

            const actions = gTokenExtendedActions(mockGTokenAddress)(mockWalletClient as WalletClient);
            const result = await actions.setMinter({ minter: newMinter, account: mockAccount });

            expect(result).toBe(txHash);
        });
    });

    describe('Pause', () => {
        it('should pause', async () => {
            const txHash = '0xmno...';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);

            const actions = gTokenExtendedActions(mockGTokenAddress)(mockWalletClient as WalletClient);
            const result = await actions.pause({ account: mockAccount });

            expect(result).toBe(txHash);
        });

        it('should unpause', async () => {
            const txHash = '0xpqr...';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);

            const actions = gTokenExtendedActions(mockGTokenAddress)(mockWalletClient as WalletClient);
            const result = await actions.unpause({ account: mockAccount });

            expect(result).toBe(txHash);
        });

        it('should check if paused', async () => {
            (mockPublicClient.readContract as any).mockResolvedValue(true);

            const actions = gTokenExtendedActions(mockGTokenAddress)(mockPublicClient as PublicClient);
            const isPaused = await actions.paused();

            expect(isPaused).toBe(true);
        });
    });

    describe('Ownership', () => {
        it('should get owner', async () => {
            const mockOwner: Address = '0x5555555555555555555555555555555555555555';
            (mockPublicClient.readContract as any).mockResolvedValue(mockOwner);

            const actions = gTokenExtendedActions(mockGTokenAddress)(mockPublicClient as PublicClient);
            const owner = await actions.owner();

            expect(owner).toBe(mockOwner);
        });

        it('should transfer ownership', async () => {
            const txHash = '0xstu...';
            const newOwner: Address = '0x6666666666666666666666666666666666666666';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);

            const actions = gTokenExtendedActions(mockGTokenAddress)(mockWalletClient as WalletClient);
            const result = await actions.transferOwnership({ newOwner, account: mockAccount });

            expect(result).toBe(txHash);
        });

        it('should renounce ownership', async () => {
            const txHash = '0xvwx...';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);

            const actions = gTokenExtendedActions(mockGTokenAddress)(mockWalletClient as WalletClient);
            const result = await actions.renounceOwnership({ account: mockAccount });

            expect(result).toBe(txHash);
        });
    });
});
