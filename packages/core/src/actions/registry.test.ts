import { describe, it, expect, vi, beforeEach } from 'vitest';
import { type Address, type PublicClient, type WalletClient, type Hex, type Account, parseEther } from 'viem';
import { registryActions } from './registry.js';

describe('Registry Actions', () => {
    const mockRegistryAddress: Address = '0x1234567890123456789012345678901234567890';
    let mockPublicClient: Partial<PublicClient>;
    let mockWalletClient: any;
    let mockAccount: Account;

    const MOCK_ROLE_ID = '0xabcd1234567890123456789012345678901234567890abcd1234567890123456' as `0x${string}`;
    const MOCK_USER: Address = '0x2222222222222222222222222222222222222222';
    const MOCK_COMMUNITY: Address = '0x3333333333333333333333333333333333333333';

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
            readContract: vi.fn(),
            account: mockAccount,
        } as any;
    });

    describe('Role queries', () => {
        it('should check if user has role', async () => {
            (mockPublicClient.readContract as any).mockResolvedValue(true);

            const actions = registryActions(mockRegistryAddress)(mockPublicClient as PublicClient);
            const hasRole = await actions.registryHasRole({ user: MOCK_USER, roleId: MOCK_ROLE_ID });

            expect(hasRole).toBe(true);
            expect(mockPublicClient.readContract).toHaveBeenCalledWith(
                expect.objectContaining({
                    functionName: 'hasRole',
                    args: [MOCK_ROLE_ID, MOCK_USER],
                })
            );
        });

        it('should return false for user without role', async () => {
            (mockPublicClient.readContract as any).mockResolvedValue(false);

            const actions = registryActions(mockRegistryAddress)(mockPublicClient as PublicClient);
            const hasRole = await actions.registryHasRole({ user: MOCK_USER, roleId: MOCK_ROLE_ID });

            expect(hasRole).toBe(false);
        });

        it('should get role config', async () => {
            const mockConfig = { owner: MOCK_USER, fee: 100n };
            (mockPublicClient.readContract as any).mockResolvedValue(mockConfig);

            const actions = registryActions(mockRegistryAddress)(mockPublicClient as PublicClient);
            const config = await actions.registryGetRoleConfig({ roleId: MOCK_ROLE_ID });

            expect(config).toEqual(mockConfig);
        });
    });

    describe('Role management', () => {
        it('should register role', async () => {
            const txHash = '0xabc...';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);

            const actions = registryActions(mockRegistryAddress)(mockWalletClient as WalletClient);
            const result = await actions.registryRegisterRole({
                roleId: MOCK_ROLE_ID,
                user: MOCK_USER,
                data: '0x',
                account: mockAccount
            });

            expect(result).toBe(txHash);
            expect(mockWalletClient.writeContract).toHaveBeenCalledWith(
                expect.objectContaining({
                    functionName: 'registerRole',
                })
            );
        });

        it('should unregister role', async () => {
            const txHash = '0xdef...';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);

            const actions = registryActions(mockRegistryAddress)(mockWalletClient as WalletClient);
            const result = await actions.registryUnRegisterRole({
                user: MOCK_USER,
                roleId: MOCK_ROLE_ID,
                account: mockAccount
            });

            expect(result).toBe(txHash);
        });

        it('should register role self', async () => {
            const txHash = '0xghi...';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);

            const actions = registryActions(mockRegistryAddress)(mockWalletClient as any);
            const result = await actions.registryRegisterRoleSelf({
                roleId: MOCK_ROLE_ID,
                data: '0x',
                account: mockAccount
            });

            expect(result).toBe(txHash);
        });
    });

    describe('Community queries', () => {
        it('should check community membership', async () => {
            (mockPublicClient.readContract as any).mockResolvedValue(true);

            const actions = registryActions(mockRegistryAddress)(mockPublicClient as PublicClient);
            const isMember = await actions.registryIsCommunityMember({
                community: MOCK_COMMUNITY,
                user: MOCK_USER
            });

            expect(isMember).toBe(true);
        });

        it('should lookup community by name', async () => {
            (mockPublicClient.readContract as any).mockResolvedValue(MOCK_COMMUNITY);

            const actions = registryActions(mockRegistryAddress)(mockPublicClient as PublicClient);
            const addr = await actions.registryCommunityByName({ name: 'test' });

            expect(addr).toBe(MOCK_COMMUNITY);
        });
    });

    describe('Reputation', () => {
        it('should get global reputation', async () => {
            (mockPublicClient.readContract as any).mockResolvedValue(500n);
            const actions = registryActions(mockRegistryAddress)(mockPublicClient as PublicClient);
            const rep = await actions.registryGlobalReputation({ user: MOCK_USER });
            expect(rep).toBe(500n);
        });

        it('should batch update global reputation', async () => {
            const txHash = '0xhash';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);
            const actions = registryActions(mockRegistryAddress)(mockWalletClient as WalletClient);
            const result = await actions.registryBatchUpdateGlobalReputation({
                users: [MOCK_USER],
                scores: [1000n],
                epoch: 1n,
                proof: '0x',
                account: mockAccount
            });
            expect(result).toBe(txHash);
        });
    });

    describe('Blacklist Management', () => {
        it('should update and check operator blacklist', async () => {
            const txHash = '0xhash';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);
            (mockWalletClient.readContract as any).mockResolvedValue(true);

            const actions = registryActions(mockRegistryAddress)(mockWalletClient as WalletClient);
            const tx = await actions.registryUpdateOperatorBlacklist({ 
                operator: MOCK_USER, 
                users: [MOCK_USER],
                statuses: [true],
                proof: '0x',
                account: mockAccount 
            });
            const isBlacklisted = await actions.registryIsOperatorBlacklisted({ operator: MOCK_USER });

            expect(tx).toBe(txHash);
            expect(isBlacklisted).toBe(true);
            expect(mockWalletClient.writeContract).toHaveBeenCalledWith(
                expect.objectContaining({
                    functionName: 'updateOperatorBlacklist',
                    args: [MOCK_USER, [MOCK_USER], [true], '0x'],
                })
            );
        });
    });

    describe('Contract References', () => {
        it('should query all contract references', async () => {
            (mockPublicClient.readContract as any).mockResolvedValue(MOCK_USER);
            const actions = registryActions(mockRegistryAddress)(mockPublicClient as PublicClient);

            const results = await Promise.all([
                actions.registryBlsValidator(),
                actions.registryBlsAggregator(),
                actions.registryMySBT(),
                actions.registrySuperPaymaster(),
                actions.registryStaking(),
                actions.registryReputationSource(),
                actions.registryLevelThresholds({ level: 0n }),
                actions.registryIsReputationSource({ source: MOCK_USER }),
                actions.registryCreditTierConfig({ level: 1n }),
                actions.registryRoleConfigs({ roleId: MOCK_ROLE_ID }),
                actions.registryRoleLockDurations({ roleId: MOCK_ROLE_ID }),
                actions.registryRoleOwners({ roleId: MOCK_ROLE_ID }),
                actions.registryRoleSBTTokenIds({ roleId: MOCK_ROLE_ID, user: MOCK_USER }),
                actions.registryRoleStakes({ roleId: MOCK_ROLE_ID, user: MOCK_USER }),
                actions.registryUserRoles({ user: MOCK_USER, index: 0n }),
                actions.registryUserRoleCount({ user: MOCK_USER }),
                actions.registryRoleMetadata({ roleId: MOCK_ROLE_ID }),
                actions.registryRoleMemberIndex({ roleId: MOCK_ROLE_ID, user: MOCK_USER }),
                actions.registryRoleMembers({ roleId: MOCK_ROLE_ID, index: 0n }),
                actions.registryRoleCounts({ roleId: MOCK_ROLE_ID })
            ]);

            results.forEach(res => expect(res).toBeDefined());
        });
    });

    describe('Role Operations', () => {
        it('should exit role and calculate fee', async () => {
            const txHash = '0xhash';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);
            (mockPublicClient.readContract as any).mockResolvedValue(parseEther('1'));

            const actions = registryActions(mockRegistryAddress)(mockWalletClient as any);
            const actionsRead = registryActions(mockRegistryAddress)(mockPublicClient as any);
            
            const fee = await actionsRead.registryCalculateExitFee({ roleId: MOCK_ROLE_ID, amount: 1000n });
            const tx = await actions.registryExitRole({ roleId: MOCK_ROLE_ID, account: mockAccount });

            expect(fee).toBe(parseEther('1'));
            expect(tx).toBe(txHash);
            expect(mockPublicClient.readContract).toHaveBeenCalledWith(
                expect.objectContaining({
                    functionName: 'calculateExitFee',
                    args: [MOCK_ROLE_ID, 1000n],
                })
            );
        });

        it('should check if user is community member', async () => {
            // isCommunityMember uses ROLE_ENDUSER check internally
            (mockPublicClient.readContract as any).mockResolvedValue('0xROLE'); // ROLE_ENDUSER
            (mockPublicClient.readContract as any).mockResolvedValueOnce('0xROLE').mockResolvedValueOnce(true);
            const actions = registryActions(mockRegistryAddress)(mockPublicClient as PublicClient);
            const isMember = await actions.registryIsCommunityMember({ community: MOCK_COMMUNITY, user: MOCK_USER });
            expect(isMember).toBe(true);
        });
    });

    describe('Constants (Role IDs)', () => {
        it('should return all role ID constants', async () => {
            (mockPublicClient.readContract as any).mockResolvedValue('0xROLE');
            const actions = registryActions(mockRegistryAddress)(mockPublicClient as PublicClient);

            expect(await actions.registryROLE_COMMUNITY()).toBe('0xROLE');
            expect(await actions.registryROLE_ENDUSER()).toBe('0xROLE');
            expect(await actions.registryROLE_PAYMASTER_AOA()).toBe('0xROLE');
            expect(await actions.registryROLE_PAYMASTER_SUPER()).toBe('0xROLE');
            expect(await actions.registryROLE_DVT()).toBe('0xROLE');
            expect(await actions.registryROLE_ANODE()).toBe('0xROLE');
            expect(await actions.registryROLE_KMS()).toBe('0xROLE');
            expect(await actions.registryGTOKEN_STAKING()).toBe('0xROLE');
            expect(await actions.registryMYSBT()).toBe('0xROLE');
            expect(await actions.registrySUPER_PAYMASTER()).toBe('0xROLE');
        });
    });

    describe('View & Metadata Functions', () => {
        it('should query role metadata and count', async () => {
            (mockPublicClient.readContract as any)
                .mockResolvedValueOnce(10n) // count
                .mockResolvedValueOnce({ meta: 'data' }) // metadata
                .mockResolvedValueOnce(3600n); // lock duration

            const actions = registryActions(mockRegistryAddress)(mockPublicClient as PublicClient);
            const count = await actions.registryGetRoleUserCount({ roleId: MOCK_ROLE_ID });
            const meta = await actions.registryRoleMetadata({ roleId: MOCK_ROLE_ID });
            const lock = await actions.registryRoleLockDurations({ roleId: MOCK_ROLE_ID });

            expect(count).toBe(10n);
            expect(meta).toEqual({ meta: 'data' });
            expect(lock).toBe(3600n);
        });

        it('should query user-specific role data', async () => {
            (mockPublicClient.readContract as any)
                .mockResolvedValueOnce(100n) // stake
                .mockResolvedValueOnce(1n); // sbt id

            const actions = registryActions(mockRegistryAddress)(mockPublicClient as PublicClient);
            const stake = await actions.registryRoleStakes({ roleId: MOCK_ROLE_ID, user: MOCK_USER });
            const sbtId = await actions.registryRoleSBTTokenIds({ roleId: MOCK_ROLE_ID, user: MOCK_USER });

            expect(stake).toBe(100n);
            expect(sbtId).toBe(1n);
        });

        it('should query list functions', async () => {
            (mockPublicClient.readContract as any)
                .mockResolvedValueOnce([MOCK_USER]) // members
                .mockResolvedValueOnce(['0xROLE']); // user roles

            const actions = registryActions(mockRegistryAddress)(mockPublicClient as PublicClient);
            const members = await actions.registryGetRoleMembers({ roleId: MOCK_ROLE_ID });
            const roles = await actions.registryGetUserRoles({ user: MOCK_USER });

            expect(members).toEqual([MOCK_USER]);
            expect(roles).toEqual(['0xROLE']);
        });

        it('should get version', async () => {
            (mockPublicClient.readContract as any).mockResolvedValue('1.0.0');
            const actions = registryActions(mockRegistryAddress)(mockPublicClient as PublicClient);
            expect(await actions.registryVersion()).toBe('1.0.0');
        });
    });

    describe('Advanced View & Utility Functions', () => {
        it('should query role metadata specifics', async () => {
            (mockPublicClient.readContract as any)
                .mockResolvedValueOnce(MOCK_USER) // roleOwners
                .mockResolvedValueOnce(0n) // roleMemberIndex
                .mockResolvedValueOnce('ProposedName'); // proposedRoleNames

            const actions = registryActions(mockRegistryAddress)(mockPublicClient as PublicClient);
            const owner = await actions.registryRoleOwners({ roleId: MOCK_ROLE_ID });
            const index = await actions.registryRoleMemberIndex({ roleId: MOCK_ROLE_ID, user: MOCK_USER });
            const name = await actions.registryProposedRoleNames({ roleId: MOCK_ROLE_ID });

            expect(owner).toBe(MOCK_USER);
            expect(index).toBe(0n);
            expect(name).toBe('ProposedName');
        });

        it('should query reputation source and epoch', async () => {
            (mockPublicClient.readContract as any)
                .mockResolvedValueOnce(true) // isReputationSource
                .mockResolvedValueOnce(10n); // lastReputationEpoch

            const actions = registryActions(mockRegistryAddress)(mockPublicClient as PublicClient);
            expect(await actions.registryIsReputationSource({ source: MOCK_USER })).toBe(true);
            expect(await actions.registryLastReputationEpoch()).toBe(10n);
        });

        it('should lookup accounts and executed proposals', async () => {
            (mockPublicClient.readContract as any)
                .mockResolvedValueOnce(MOCK_USER) // accountToUser
                .mockResolvedValueOnce(true); // executedProposals

            const actions = registryActions(mockRegistryAddress)(mockPublicClient as PublicClient);
            const user = await actions.registryAccountToUser({ account: MOCK_USER });
            const executed = await actions.registryExecutedProposals({ proposalId: 1n });

            expect(user).toBe(MOCK_USER);
            expect(executed).toBe(true);
        });

        it('should lookup communities', async () => {
            (mockPublicClient.readContract as any).mockResolvedValue(MOCK_COMMUNITY);
            const actions = registryActions(mockRegistryAddress)(mockPublicClient as PublicClient);

            expect(await actions.registryCommunityByName({ name: 'test' })).toBe(MOCK_COMMUNITY);
            expect(await actions.registryCommunityByENS({ ensName: 'test.eth' })).toBe(MOCK_COMMUNITY);
            expect(await actions.registryCommunityByNameV3({ name: 'test' })).toBe(MOCK_COMMUNITY);
            expect(await actions.registryCommunityByENSV3({ ensName: 'test.eth' })).toBe(MOCK_COMMUNITY);
        });

        it('should manage role settings (admin)', async () => {
            const txHash = '0xhash';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);
            const actions = registryActions(mockRegistryAddress)(mockWalletClient as WalletClient);

            expect(await actions.registrySetRoleLockDuration({ roleId: MOCK_ROLE_ID, duration: 86400n, account: mockAccount })).toBe(txHash);
            expect(await actions.registrySetRoleOwner({ roleId: MOCK_ROLE_ID, newOwner: MOCK_USER, account: mockAccount })).toBe(txHash);
            expect(await actions.registryAddLevelThreshold({ threshold: 100n, account: mockAccount })).toBe(txHash);
            expect(await actions.registrySetLevelThreshold({ index: 0n, threshold: 50n, account: mockAccount })).toBe(txHash);
            expect(await actions.registrySetCreditTier({ level: 1n, limit: 1000n, account: mockAccount })).toBe(txHash);
        });

        it('should perform advanced admin operations', async () => {
            const txHash = '0xhash';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);
            const actions = registryActions(mockRegistryAddress)(mockWalletClient as WalletClient);

            expect(await actions.registryAdminConfigureRole({ 
                roleId: MOCK_ROLE_ID, 
                minStake: 1n, 
                entryBurn: 1n, 
                exitFeePercent: 100, 
                minExitFee: 1n, 
                account: mockAccount 
            })).toBe(txHash);

            expect(await actions.registryCreateNewRole({ 
                roleId: MOCK_ROLE_ID, 
                config: { minStake: 1n } as any, 
                roleOwner: MOCK_USER, 
                account: mockAccount 
            })).toBe(txHash);

            expect(await actions.registrySafeMintForRole({ 
                roleId: MOCK_ROLE_ID, 
                user: MOCK_USER, 
                data: '0x', 
                account: mockAccount 
            })).toBe(txHash);
        });

        it('should query credit and tiers', async () => {
            (mockPublicClient.readContract as any).mockResolvedValue(1000n);
            const actions = registryActions(mockRegistryAddress)(mockPublicClient as PublicClient);

            expect(await actions.registryGetCreditLimit({ user: MOCK_USER })).toBe(1000n);
            expect(await actions.registryCreditTierConfig({ level: 1n })).toBe(1000n);
        });

        it('should manage administrative setters', async () => {
            const txHash = '0xhash';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);
            const actions = registryActions(mockRegistryAddress)(mockWalletClient as WalletClient);

            expect(await actions.registrySetBLSValidator({ validator: MOCK_USER, account: mockAccount })).toBe(txHash);
            expect(await actions.registrySetBLSAggregator({ aggregator: MOCK_USER, account: mockAccount })).toBe(txHash);
            expect(await actions.registrySetMySBT({ sbt: MOCK_USER, account: mockAccount })).toBe(txHash);
            expect(await actions.registrySetSuperPaymaster({ paymaster: MOCK_USER, account: mockAccount })).toBe(txHash);
            expect(await actions.registrySetStaking({ staking: MOCK_USER, account: mockAccount })).toBe(txHash);
            expect(await actions.registrySetReputationSource({ source: MOCK_USER, account: mockAccount })).toBe(txHash);
            expect(await actions.registryTransferOwnership({ newOwner: MOCK_USER, account: mockAccount })).toBe(txHash);
            expect(await actions.registryRenounceOwnership({ account: mockAccount })).toBe(txHash);
        });

        it('should query simple properties', async () => {
            (mockPublicClient.readContract as any).mockResolvedValue(MOCK_USER);
            const actions = registryActions(mockRegistryAddress)(mockPublicClient as PublicClient);
            expect(await actions.registryOwner()).toBe(MOCK_USER);
        });
    });
});
