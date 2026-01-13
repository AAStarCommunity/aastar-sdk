import { describe, it, expect, vi, beforeEach } from 'vitest';
import { type Address, type PublicClient, type WalletClient, type Account } from 'viem';
import { dvtActions } from './dvt.js';

describe('DVT Actions', () => {
    const mockDVTAddress: Address = '0x1234567890123456789012345678901234567890';
    let mockPublicClient: Partial<PublicClient>;
    let mockWalletClient: Partial<WalletClient>;
    let mockAccount: Account;

    const MOCK_USER: Address = '0x2222222222222222222222222222222222222222';
    const MOCK_OPERATOR: Address = '0x3333333333333333333333333333333333333333';

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

    describe('Proposal Creation', () => {
        it('should create slash proposal', async () => {
            const txHash = '0xabc...';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);

            const actions = dvtActions()(mockWalletClient as WalletClient);
            const result = await actions.createSlashProposal({
                address: mockDVTAddress,
                operator: MOCK_OPERATOR,
                level: 1,
                reason: 'Test slash',
                account: mockAccount
            });

            expect(result).toBe(txHash);
            expect(mockWalletClient.writeContract).toHaveBeenCalledWith(
                expect.objectContaining({
                    address: mockDVTAddress,
                    functionName: 'createProposal',
                    args: [MOCK_OPERATOR, 1, 'Test slash'],
                })
            );
        });
    });

    describe('Proposal Signing', () => {
        it('should sign slash proposal', async () => {
            const txHash = '0xdef...';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);

            const actions = dvtActions()(mockWalletClient as WalletClient);
            const result = await actions.signSlashProposal({
                address: mockDVTAddress,
                proposalId: 1n,
                signature: '0xsignature' as `0x${string}`,
                account: mockAccount
            });

            expect(result).toBe(txHash);
            expect(mockWalletClient.writeContract).toHaveBeenCalledWith(
                expect.objectContaining({
                    functionName: 'signProposal',
                    args: [1n, '0xsignature'],
                })
            );
        });
    });

    describe('Proposal Execution', () => {
        it('should execute slash with proof', async () => {
            const txHash = '0xghi...';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);

            const actions = dvtActions()(mockWalletClient as WalletClient);
            const result = await actions.executeSlashWithProof({
                address: mockDVTAddress,
                proposalId: 1n,
                repUsers: [MOCK_USER],
                newScores: [100n],
                epoch: 1n,
                proof: '0xproof' as `0x${string}`,
                account: mockAccount
            });

            expect(result).toBe(txHash);
            expect(mockWalletClient.writeContract).toHaveBeenCalledWith(
                expect.objectContaining({
                    functionName: 'executeWithProof',
                    args: [1n, [MOCK_USER], [100n], 1n, '0xproof'],
                })
            );
        });
    });

    describe('Validator Status', () => {
        it('should check if user is validator', async () => {
            (mockPublicClient.readContract as any).mockResolvedValue(true);

            const actions = dvtActions()(mockPublicClient as PublicClient);
            const result = await actions.isValidator({
                address: mockDVTAddress,
                user: MOCK_USER
            });

            expect(result).toBe(true);
            expect(mockPublicClient.readContract).toHaveBeenCalledWith(
                expect.objectContaining({
                    address: mockDVTAddress,
                    functionName: 'isValidator',
                    args: [MOCK_USER],
                })
            );
        });
    });
});
