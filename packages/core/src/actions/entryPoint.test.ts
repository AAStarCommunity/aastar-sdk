import { describe, it, expect, vi, beforeEach } from 'vitest';
import { type Address, type PublicClient, parseEther } from 'viem';
import { entryPointActions, EntryPointVersion } from './entryPoint.js';

describe('EntryPoint Actions', () => {
    const mockEntryPointAddress: Address = '0x0000000071727De22E5E9d8BAf0edAc6f37da032';
    const MOCK_USER: Address = '0x1234567890123456789012345678901234567890';
    let mockPublicClient: Partial<PublicClient>;

    beforeEach(() => {
        mockPublicClient = {
            readContract: vi.fn(),
        };
    });

    describe('getDepositInfo', () => {
        it('should get deposit info for account', async () => {
            // EntryPoint returns array that gets destructured into object
            const mockDepositArray: [bigint, boolean, bigint, number, number] = [
                1000000000000000000n,  // deposit
                true,                   // staked
                500000000000000000n,   // stake
                86400,                  // unstakeDelaySec
                0                       // withdrawTime
            ];
            (mockPublicClient.readContract as any).mockResolvedValue(mockDepositArray);

            const account: Address = '0x1234567890123456789012345678901234567890';
            const actions = entryPointActions(mockEntryPointAddress)(mockPublicClient as PublicClient);
            const depositInfo = await actions.getDepositInfo({ account });

            expect(depositInfo.deposit).toBe(1000000000000000000n);
            expect(depositInfo.staked).toBe(true);
            expect(depositInfo.stake).toBe(500000000000000000n);
            expect(depositInfo.unstakeDelaySec).toBe(86400);
            expect(depositInfo.withdrawTime).toBe(0);
            expect(mockPublicClient.readContract).toHaveBeenCalledWith(
                expect.objectContaining({
                    functionName: 'getDepositInfo',
                    args: [account],
                })
            );
        });

        it('should handle zero deposit', async () => {
            const mockDepositArray: [bigint, boolean, bigint, number, number] = [0n, false, 0n, 0, 0];
            (mockPublicClient.readContract as any).mockResolvedValue(mockDepositArray);

            const account: Address = '0xabcd1234567890123456789012345678901234ab';
            const actions = entryPointActions(mockEntryPointAddress)(mockPublicClient as PublicClient);
            const depositInfo = await actions.getDepositInfo({ account });

            expect(depositInfo.deposit).toBe(0n);
            expect(depositInfo.staked).toBe(false);
        });
    });

    describe('getNonce', () => {
        it('should get nonce for sender with key', async () => {
            const expectedNonce = 5n;
            (mockPublicClient.readContract as any).mockResolvedValue(expectedNonce);

            const sender: Address = '0x2222222222222222222222222222222222222222';
            const key = 0n;
            const actions = entryPointActions(mockEntryPointAddress)(mockPublicClient as PublicClient);
            const nonce = await actions.getNonce({ sender, key });

            expect(nonce).toBe(expectedNonce);
            expect(mockPublicClient.readContract).toHaveBeenCalledWith(
                expect.objectContaining({
                    functionName: 'getNonce',
                    args: [sender, key],
                })
            );
        });

        it('should handle different key spaces', async () => {
            const expectedNonce = 0n;
            (mockPublicClient.readContract as any).mockResolvedValue(expectedNonce);

            const sender: Address = '0x3333333333333333333333333333333333333333';
            const key = 123n;
            const actions = entryPointActions(mockEntryPointAddress)(mockPublicClient as PublicClient);
            const nonce = await actions.getNonce({ sender, key });

            expect(nonce).toBe(expectedNonce);
            expect(mockPublicClient.readContract).toHaveBeenCalledWith(
                expect.objectContaining({
                    args: [sender, key],
                })
            );
        });
    });

    describe('balanceOf', () => {
        it('should get balance of account', async () => {
            const expectedBalance = 2000000000000000000n; // 2 ETH
            (mockPublicClient.readContract as any).mockResolvedValue(expectedBalance);

            const account: Address = '0x4444444444444444444444444444444444444444';
            const actions = entryPointActions(mockEntryPointAddress)(mockPublicClient as PublicClient);
            const balance = await actions.balanceOf({ account });

            expect(balance).toBe(expectedBalance);
            expect(mockPublicClient.readContract).toHaveBeenCalledWith(
                expect.objectContaining({
                    functionName: 'balanceOf',
                    args: [account],
                })
            );
        });

        it('should handle zero balance', async () => {
            const expectedBalance = 0n;
            (mockPublicClient.readContract as any).mockResolvedValue(expectedBalance);

            const account: Address = '0x5555555555555555555555555555555555555555';
            const actions = entryPointActions(mockEntryPointAddress)(mockPublicClient as PublicClient);
            const balance = await actions.balanceOf({ account });

            expect(balance).toBe(0n);
        });
    });

    describe('Version Handling', () => {
        it('should include version in actions', () => {
            const actions = entryPointActions(mockEntryPointAddress, EntryPointVersion.V07)(mockPublicClient as PublicClient);
            expect(actions.version).toBe(EntryPointVersion.V07);
        });

        it('should default to V07', () => {
            const actions = entryPointActions(mockEntryPointAddress)(mockPublicClient as PublicClient);
            expect(actions.version).toBe(EntryPointVersion.V07);
        });
    });

    describe('Contract Address', () => {
        it('should use provided contract address', async () => {
            const customAddress: Address = '0x6666666666666666666666666666666666666666';
            (mockPublicClient.readContract as any).mockResolvedValue(1n);

            const account: Address = '0x7777777777777777777777777777777777777777';
            const actions = entryPointActions(customAddress)(mockPublicClient as PublicClient);
            await actions.balanceOf({ account });

            expect(mockPublicClient.readContract).toHaveBeenCalledWith(
                expect.objectContaining({
                    address: customAddress,
                })
            );
        });
    });

    describe('depositTo', () => {
        it('should deposit to account', async () => {
            const txHash = '0xhash';
            (mockPublicClient as any).writeContract = vi.fn().mockResolvedValue(txHash);
            const actions = entryPointActions(mockEntryPointAddress)(mockPublicClient as any);
            const result = await actions.depositTo({
                account: MOCK_USER,
                amount: parseEther('1'),
                txAccount: MOCK_USER
            });
            expect(result).toBe(txHash);
        });
    });

    describe('getNonce V06', () => {
        it('should get nonce for V06', async () => {
            (mockPublicClient.readContract as any).mockResolvedValue(10n);
            const actions = entryPointActions(mockEntryPointAddress, EntryPointVersion.V06)(mockPublicClient as PublicClient);
            const nonce = await actions.getNonce({ sender: MOCK_USER, key: 0n });
            expect(nonce).toBe(10n);
        });
    });
});
