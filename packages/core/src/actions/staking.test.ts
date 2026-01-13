import { describe, it, expect, vi, beforeEach } from 'vitest';
import { type Address, type PublicClient, type WalletClient, type Account } from 'viem';
import { stakingActions } from './staking.js';

describe('Staking Actions', () => {
    const mockStakingAddress: Address = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb';
    let mockPublicClient: Partial<PublicClient>;
    let mockWalletClient: Partial<WalletClient>;
    let mockAccount: Account;

    const MOCK_USER: Address = '0x1234567890123456789012345678901234567890';
    const MOCK_ROLE_ID = '0xabcd...' as `0x${string}`;

    beforeEach(() => {
        mockAccount = {
            address: MOCK_USER,
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

    describe('Query functions', () => {
        it('should get staking balance', async () => {
            const mockBalance = 1000000000000000000000n;
            (mockPublicClient.readContract as any).mockResolvedValue(mockBalance);

            const actions = stakingActions(mockStakingAddress)(mockPublicClient as PublicClient);
            const balance = await actions.getStakingBalance({ user: MOCK_USER });

            expect(balance).toBe(mockBalance);
        });

        it('should get locked stake', async () => {
            const mockLocked = 500000000000000000000n;
            (mockPublicClient.readContract as any).mockResolvedValue(mockLocked);

            const actions = stakingActions(mockStakingAddress)(mockPublicClient as PublicClient);
            const locked = await actions.getLockedStake({ user: MOCK_USER, roleId: MOCK_ROLE_ID });

            expect(locked).toBe(mockLocked);
        });

        it('should get available balance', async () => {
            const mockAvailable = 500000000000000000000n;
            (mockPublicClient.readContract as any).mockResolvedValue(mockAvailable);

            const actions = stakingActions(mockStakingAddress)(mockPublicClient as PublicClient);
            const available = await actions.availableBalance({ user: MOCK_USER });

            expect(available).toBe(mockAvailable);
        });

        it('should check if user has role lock', async () => {
            (mockPublicClient.readContract as any).mockResolvedValue(true);

            const actions = stakingActions(mockStakingAddress)(mockPublicClient as PublicClient);
            const hasLock = await actions.hasRoleLock({ user: MOCK_USER, roleId: MOCK_ROLE_ID });

            expect(hasLock).toBe(true);
        });

        it('should get user role locks', async () => {
            const mockLocks = [{ roleId: MOCK_ROLE_ID, amount: 1000n }];
            (mockPublicClient.readContract as any).mockResolvedValue(mockLocks);

            const actions = stakingActions(mockStakingAddress)(mockPublicClient as PublicClient);
            const locks = await actions.getUserRoleLocks({ user: MOCK_USER });

            expect(locks).toEqual(mockLocks);
        });

        it('should preview exit fee', async () => {
            const mockFee = 10000000000000000n; // 0.01 ETH
            (mockPublicClient.readContract as any).mockResolvedValue(mockFee);

            const actions = stakingActions(mockStakingAddress)(mockPublicClient as PublicClient);
            const fee = await actions.previewExitFee({ user: MOCK_USER, roleId: MOCK_ROLE_ID });

            expect(fee).toBe(mockFee);
        });
    });

    describe('Staking operations', () => {
        it('should lock stake', async () => {
            const txHash = '0xabc...';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);

            const actions = stakingActions(mockStakingAddress)(mockWalletClient as WalletClient);
            const result = await actions.lockStake({
                user: MOCK_USER,
                roleId: MOCK_ROLE_ID,
                stakeAmount: 1000n,
                entryBurn: 10n,
                payer: MOCK_USER,
                account: mockAccount
            });

            expect(result).toBe(txHash);
        });

        it('should unlock stake', async () => {
            const txHash = '0xdef...';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);

            const actions = stakingActions(mockStakingAddress)(mockWalletClient as WalletClient);
            const result = await actions.unlockStake({
                user: MOCK_USER,
                roleId: MOCK_ROLE_ID,
                account: mockAccount
            });

            expect(result).toBe(txHash);
        });

        it('should unlock and transfer', async () => {
            const txHash = '0xghi...';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);

            const actions = stakingActions(mockStakingAddress)(mockWalletClient as WalletClient);
            const result = await actions.unlockAndTransfer({
                user: MOCK_USER,
                roleId: MOCK_ROLE_ID,
                account: mockAccount
            });

            expect(result).toBe(txHash);
        });
    });

    describe('Slashing operations', () => {
        it('should slash user stake', async () => {
            const txHash = '0xjkl...';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);

            const actions = stakingActions(mockStakingAddress)(mockWalletClient as WalletClient);
            const result = await actions.slash({
                user: MOCK_USER,
                roleId: MOCK_ROLE_ID,
                amount: 100n,
                reason: 'Violation',
                account: mockAccount
            });

            expect(result).toBe(txHash);
        });

        it('should slash by DVT', async () => {
            const txHash = '0xmno...';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);

            const actions = stakingActions(mockStakingAddress)(mockWalletClient as WalletClient);
            const result = await actions.slashByDVT({
                user: MOCK_USER,
                roleId: MOCK_ROLE_ID,
                amount: 50n,
                reason: 'DVT slash',
                account: mockAccount
            });

            expect(result).toBe(txHash);
        });

        it('should set authorized slasher', async () => {
            const txHash = '0xpqr...';
            const slasher: Address = '0x99999999999999999999999999999999999999';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);

            const actions = stakingActions(mockStakingAddress)(mockWalletClient as WalletClient);
            const result = await actions.setAuthorizedSlasher({
                slasher,
                authorized: true,
                account: mockAccount
            });

            expect(result).toBe(txHash);
        });
    });

    describe('Advanced Query Functions', () => {
        it('should get stake info', async () => {
            (mockPublicClient.readContract as any).mockResolvedValue({ amount: 100n });
            const actions = stakingActions(mockStakingAddress)(mockPublicClient as PublicClient);
            const info = await actions.getStakeInfo({ operator: MOCK_USER, roleId: MOCK_ROLE_ID });
            expect(info.amount).toBe(100n);
        });

        it('should query stakes and role locks', async () => {
            (mockPublicClient.readContract as any)
                .mockResolvedValueOnce({ amount: 100n }) // stakes
                .mockResolvedValueOnce({ amount: 50n }); // roleLocks
            const actions = stakingActions(mockStakingAddress)(mockPublicClient as PublicClient);
            const stake = await actions.stakes({ user: MOCK_USER });
            const lock = await actions.roleLocks({ user: MOCK_USER, roleId: MOCK_ROLE_ID });
            expect(stake.amount).toBe(100n);
            expect(lock.amount).toBe(50n);
        });

        it('should query exit configs and active roles', async () => {
            (mockPublicClient.readContract as any)
                .mockResolvedValueOnce({ feePercent: 10n }) // roleExitConfigs
                .mockResolvedValueOnce(MOCK_ROLE_ID); // userActiveRoles
            const actions = stakingActions(mockStakingAddress)(mockPublicClient as PublicClient);
            const config = await actions.roleExitConfigs({ roleId: MOCK_ROLE_ID });
            const role = await actions.userActiveRoles({ user: MOCK_USER, index: 0n });
            expect(config.feePercent).toBe(10n);
            expect(role).toBe(MOCK_ROLE_ID);
        });

        it('should query total staked and system status', async () => {
            (mockPublicClient.readContract as any)
                .mockResolvedValueOnce(1000n) // totalStaked
                .mockResolvedValueOnce(1000n) // totalStaked (via getTotalStaked)
                .mockResolvedValueOnce(true); // authorizedSlashers
            const actions = stakingActions(mockStakingAddress)(mockPublicClient as PublicClient);
            const total = await actions.totalStaked();
            const total2 = await actions.getTotalStaked();
            const authorized = await actions.authorizedSlashers({ slasher: MOCK_USER });
            expect(total).toBe(1000n);
            expect(total2).toBe(1000n);
            expect(authorized).toBe(true);
        });
    });

    describe('System Configuration & Ownership', () => {
        it('should manage treasury and registry', async () => {
            const txHash = '0xhash';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);
            const actions = stakingActions(mockStakingAddress)(mockWalletClient as WalletClient);
            const tx1 = await actions.setTreasury({ treasury: MOCK_USER, account: mockAccount });
            const tx2 = await actions.setRegistry({ registry: MOCK_USER, account: mockAccount });
            expect(tx1).toBe(txHash);
            expect(tx2).toBe(txHash);
        });

        it('should handle ownership transfers', async () => {
            const txHash = '0xhash';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);
            const actions = stakingActions(mockStakingAddress)(mockWalletClient as WalletClient);
            const tx1 = await actions.transferOwnership({ newOwner: MOCK_USER, account: mockAccount });
            const tx2 = await actions.renounceOwnership({ account: mockAccount });
            expect(tx1).toBe(txHash);
            expect(tx2).toBe(txHash);
        });

        it('should query system references', async () => {
            (mockPublicClient.readContract as any).mockResolvedValue(MOCK_USER);
            const actions = stakingActions(mockStakingAddress)(mockPublicClient as PublicClient);
            const r = await actions.REGISTRY();
            const g = await actions.GTOKEN();
            const t = await actions.treasury();
            const o = await actions.owner();
            expect(r).toBe(MOCK_USER);
            expect(g).toBe(MOCK_USER);
            expect(t).toBe(MOCK_USER);
            expect(o).toBe(MOCK_USER);
        });

        it('should get version', async () => {
            (mockPublicClient.readContract as any).mockResolvedValue('v1');
            const actions = stakingActions(mockStakingAddress)(mockPublicClient as PublicClient);
            const v = await actions.version();
            expect(v).toBe('v1');
        });
    });
});
