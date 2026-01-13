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
            const hasRole = await actions.hasRole({ user: MOCK_USER, roleId: MOCK_ROLE_ID });

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
            const hasRole = await actions.hasRole({ user: MOCK_USER, roleId: MOCK_ROLE_ID });

            expect(hasRole).toBe(false);
        });

        it('should get role config', async () => {
            const mockConfig = { owner: MOCK_USER, fee: 100n };
            (mockPublicClient.readContract as any).mockResolvedValue(mockConfig);

            const actions = registryActions(mockRegistryAddress)(mockPublicClient as PublicClient);
            const config = await actions.getRoleConfig({ roleId: MOCK_ROLE_ID });

            expect(config).toEqual(mockConfig);
        });
    });

    describe('Role management', () => {
        it('should register role', async () => {
            const txHash = '0xabc...';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);

            const actions = registryActions(mockRegistryAddress)(mockWalletClient as WalletClient);
            const result = await actions.registerRole({
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
            const result = await actions.unRegisterRole({
                user: MOCK_USER,
                roleId: MOCK_ROLE_ID,
                account: mockAccount
            });

            expect(result).toBe(txHash);
        });
    });

    describe('Community queries', () => {
        it('should get community token', async () => {
            const mockToken: Address = '0x4444444444444444444444444444444444444444';
            (mockPublicClient.readContract as any).mockResolvedValue(mockToken);

            const actions = registryActions(mockRegistryAddress)(mockPublicClient as PublicClient);
            const token = await actions.communityToToken({ community: MOCK_COMMUNITY });

            expect(token).toBe(mockToken);
        });

        it('should get community role data', async () => {
            const mockData = { roleId: MOCK_ROLE_ID, active: true };
            (mockPublicClient.readContract as any).mockResolvedValue(mockData);

            const actions = registryActions(mockRegistryAddress)(mockPublicClient as PublicClient);
            const data = await actions.getCommunityRoleData({ community: MOCK_COMMUNITY });

            expect(data).toEqual(mockData);
        });
    });

    describe('Credit & Reputation', () => {
        it('should get credit limit', async () => {
            (mockPublicClient.readContract as any).mockResolvedValue(parseEther('100'));
            const actions = registryActions(mockRegistryAddress)(mockPublicClient as PublicClient);
            const limit = await actions.getCreditLimit({ user: MOCK_USER });
            expect(limit).toBe(parseEther('100'));
        });

        it('should get global reputation', async () => {
            (mockPublicClient.readContract as any).mockResolvedValue(500n);
            const actions = registryActions(mockRegistryAddress)(mockPublicClient as PublicClient);
            const rep = await actions.getGlobalReputation({ user: MOCK_USER });
            expect(rep).toBe(500n);
        });

        it('should set credit tier', async () => {
            const txHash = '0xhash';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);
            const actions = registryActions(mockRegistryAddress)(mockWalletClient as WalletClient);
            const result = await actions.setCreditTier({ tier: 1n, params: '0x', account: mockAccount });
            expect(result).toBe(txHash);
        });

        it('should batch update global reputation', async () => {
            const txHash = '0xhash';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);
            const actions = registryActions(mockRegistryAddress)(mockWalletClient as WalletClient);
            const result = await actions.batchUpdateGlobalReputation({
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
            const tx = await actions.updateOperatorBlacklist({ operator: MOCK_USER, isBlacklisted: true, account: mockAccount });
            const isBlacklisted = await actions.isOperatorBlacklisted({ operator: MOCK_USER });

            expect(tx).toBe(txHash);
            expect(isBlacklisted).toBe(true);
        });
    });

    describe('Contract References', () => {
        it('should set all contract references', async () => {
            const txHash = '0xhash';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);
            const actions = registryActions(mockRegistryAddress)(mockWalletClient as WalletClient);

            const results = await Promise.all([
                actions.setBLSValidator({ validator: MOCK_USER, account: mockAccount }),
                actions.setBLSAggregator({ aggregator: MOCK_USER, account: mockAccount }),
                actions.setMySBT({ sbt: MOCK_USER, account: mockAccount }),
                actions.setSuperPaymaster({ paymaster: MOCK_USER, account: mockAccount }),
                actions.setStaking({ staking: MOCK_USER, account: mockAccount }),
                actions.setReputationSource({ source: MOCK_USER, account: mockAccount })
            ]);

            results.forEach(res => expect(res).toBe(txHash));
        });

        it('should query all contract references', async () => {
            (mockPublicClient.readContract as any).mockResolvedValue(MOCK_USER);
            const actions = registryActions(mockRegistryAddress)(mockPublicClient as PublicClient);

            const results = await Promise.all([
                actions.blsValidator(),
                actions.blsAggregator(),
                actions.mySBT(),
                actions.superPaymaster(),
                actions.staking(),
                actions.reputationSource()
            ]);

            results.forEach(res => expect(res).toBe(MOCK_USER));
        });
    });

    describe('Admin & Role Advanced Operations', () => {
        it('should admin configure role', async () => {
            const txHash = '0xhash';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);
            const actions = registryActions(mockRegistryAddress)(mockWalletClient as WalletClient);
            const result = await actions.adminConfigureRole({ roleId: '0xROLE', config: {} as any, account: mockAccount });
            expect(result).toBe(txHash);
        });

        it('should create new role', async () => {
            const txHash = '0xhash';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);
            const actions = registryActions(mockRegistryAddress)(mockWalletClient as WalletClient);
            const result = await actions.createNewRole({ name: 'NewRole', config: {} as any, account: mockAccount });
            expect(result).toBe(txHash);
        });

        it('should safe mint for role', async () => {
            const txHash = '0xhash';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);
            const actions = registryActions(mockRegistryAddress)(mockWalletClient as WalletClient);
            const result = await actions.safeMintForRole({ roleId: '0xROLE', to: MOCK_USER, tokenURI: 'ipfs://...', account: mockAccount });
            expect(result).toBe(txHash);
        });

        it('should exit role and calculate fee', async () => {
            const txHash = '0xhash';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);
            (mockWalletClient.readContract as any).mockResolvedValue(parseEther('1'));

            const actions = registryActions(mockRegistryAddress)(mockWalletClient as WalletClient);
            const fee = await actions.calculateExitFee({ user: MOCK_USER, roleId: '0xROLE' });
            const tx = await actions.exitRole({ roleId: '0xROLE', account: mockAccount });

            expect(fee).toBe(parseEther('1'));
            expect(tx).toBe(txHash);
        });
    });

    describe('Community Management', () => {
        it('should lookup community by name and ENS', async () => {
            (mockPublicClient.readContract as any).mockResolvedValue(MOCK_COMMUNITY);
            const actions = registryActions(mockRegistryAddress)(mockPublicClient as PublicClient);
            const addr1 = await actions.communityByNameV3({ name: 'Test' });
            const addr2 = await actions.communityByENSV3({ ensName: 'test.eth' });
            expect(addr1).toBe(MOCK_COMMUNITY);
            expect(addr2).toBe(MOCK_COMMUNITY);
        });

        it('should get community role data', async () => {
            const mockData = { some: 'data' };
            (mockPublicClient.readContract as any).mockResolvedValue(mockData);
            const actions = registryActions(mockRegistryAddress)(mockPublicClient as PublicClient);
            const data = await actions.getCommunityRoleData({ community: MOCK_COMMUNITY });
            expect(data).toEqual(mockData);
        });

        it('should check if user is community member', async () => {
            // isCommunityMember uses ROLE_ENDUSER check internally
            (mockPublicClient.readContract as any).mockResolvedValue('0xROLE'); // ROLE_ENDUSER
            (mockPublicClient.readContract as any).mockResolvedValueOnce('0xROLE').mockResolvedValueOnce(true);
            const actions = registryActions(mockRegistryAddress)(mockPublicClient as PublicClient);
            const isMember = await actions.isCommunityMember({ community: MOCK_COMMUNITY, user: MOCK_USER });
            expect(isMember).toBe(true);
        });
    });

    describe('View & Metadata Functions', () => {
        it('should query role metadata and count', async () => {
            (mockPublicClient.readContract as any)
                .mockResolvedValueOnce(10n) // count
                .mockResolvedValueOnce({ meta: 'data' }) // metadata
                .mockResolvedValueOnce(3600n); // lock duration

            const actions = registryActions(mockRegistryAddress)(mockPublicClient as PublicClient);
            const count = await actions.getRoleUserCount({ roleId: MOCK_ROLE_ID });
            const meta = await actions.roleMetadata({ roleId: MOCK_ROLE_ID });
            const lock = await actions.roleLockDurations({ roleId: MOCK_ROLE_ID });

            expect(count).toBe(10n);
            expect(meta).toEqual({ meta: 'data' });
            expect(lock).toBe(3600n);
        });

        it('should query user-specific role data', async () => {
            (mockPublicClient.readContract as any)
                .mockResolvedValueOnce(100n) // stake
                .mockResolvedValueOnce(1n); // sbt id

            const actions = registryActions(mockRegistryAddress)(mockPublicClient as PublicClient);
            const stake = await actions.roleStakes({ roleId: MOCK_ROLE_ID, user: MOCK_USER });
            const sbtId = await actions.roleSBTTokenIds({ roleId: MOCK_ROLE_ID, user: MOCK_USER });

            expect(stake).toBe(100n);
            expect(sbtId).toBe(1n);
        });

        it('should query list functions', async () => {
            (mockPublicClient.readContract as any)
                .mockResolvedValueOnce([MOCK_USER]) // members
                .mockResolvedValueOnce(['0xROLE']); // user roles

            const actions = registryActions(mockRegistryAddress)(mockPublicClient as PublicClient);
            const members = await actions.getRoleMembers({ roleId: MOCK_ROLE_ID });
            const roles = await actions.getUserRoles({ user: MOCK_USER });

            expect(members).toEqual([MOCK_USER]);
            expect(roles).toEqual(['0xROLE']);
        });

        it('should get version', async () => {
            (mockPublicClient.readContract as any).mockResolvedValue('v0.16.4');
            const actions = registryActions(mockRegistryAddress)(mockPublicClient as PublicClient);
            const v = await actions.version();
            expect(v).toBe('v0.16.4');
        });
    describe('Advanced View & Utility Functions', () => {
        it('should query role counts and specific members', async () => {
            (mockPublicClient.readContract as any)
                .mockResolvedValueOnce(5n) // roleCounts
                .mockResolvedValueOnce(MOCK_USER) // roleMembers
                .mockResolvedValueOnce('0xROLE') // userRoles
                .mockResolvedValueOnce(2n); // userRoleCount

            const actions = registryActions(mockRegistryAddress)(mockPublicClient as PublicClient);
            const count = await actions.roleCounts({ roleId: MOCK_ROLE_ID });
            const member = await actions.roleMembers({ roleId: MOCK_ROLE_ID, index: 0n });
            const userRole = await actions.userRoles({ user: MOCK_USER, index: 0n });
            const userRoleCount = await actions.userRoleCount({ user: MOCK_USER });

            expect(count).toBe(5n);
            expect(member).toBe(MOCK_USER);
            expect(userRole).toBe('0xROLE');
            expect(userRoleCount).toBe(2n);
        });

        it('should query credit tiers and level thresholds', async () => {
            (mockPublicClient.readContract as any)
                .mockResolvedValueOnce({ active: true }) // creditTiers
                .mockResolvedValueOnce(1000n); // levelThresholds

            const actions = registryActions(mockRegistryAddress)(mockPublicClient as PublicClient);
            const tier = await actions.creditTiers({ tier: 1n });
            const threshold = await actions.levelThresholds({ level: 5n });

            expect(tier).toEqual({ active: true });
            expect(threshold).toBe(1000n);
        });

        it('should lookup accounts and communities', async () => {
            (mockPublicClient.readContract as any)
                .mockResolvedValueOnce(MOCK_USER) // accountToUser
                .mockResolvedValueOnce(MOCK_COMMUNITY); // getAccountCommunity

            const actions = registryActions(mockRegistryAddress)(mockPublicClient as PublicClient);
            const user = await actions.accountToUser({ account: MOCK_USER });
            const community = await actions.getAccountCommunity({ account: MOCK_USER });

            expect(user).toBe(MOCK_USER);
            expect(community).toBe(MOCK_COMMUNITY);
        });

        it('should query role metadata specifics', async () => {
            (mockPublicClient.readContract as any)
                .mockResolvedValueOnce(MOCK_USER) // roleOwners
                .mockResolvedValueOnce(0n) // roleMemberIndex
                .mockResolvedValueOnce('ProposedName'); // proposedRoleNames

            const actions = registryActions(mockRegistryAddress)(mockPublicClient as PublicClient);
            const owner = await actions.roleOwners({ roleId: MOCK_ROLE_ID });
            const index = await actions.roleMemberIndex({ roleId: MOCK_ROLE_ID, user: MOCK_USER });
            const name = await actions.proposedRoleNames({ roleId: MOCK_ROLE_ID });

            expect(owner).toBe(MOCK_USER);
            expect(index).toBe(0n);
            expect(name).toBe('ProposedName');
        });

        it('should manage role settings (admin)', async () => {
            const txHash = '0xhash';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);
            const actions = registryActions(mockRegistryAddress)(mockWalletClient as WalletClient);

            const tx1 = await actions.setRoleLockDuration({ roleId: MOCK_ROLE_ID, duration: 86400n, account: mockAccount });
            const tx2 = await actions.setRoleOwner({ roleId: MOCK_ROLE_ID, newOwner: MOCK_USER, account: mockAccount });
            const tx3 = await actions.addLevelThreshold({ level: 1n, threshold: 100n, account: mockAccount });
            const tx4 = await actions.setLevelThreshold({ level: 1n, threshold: 100n, account: mockAccount });

            expect(tx1).toBe(txHash);
            expect(tx2).toBe(txHash);
            expect(tx3).toBe(txHash);
            expect(tx4).toBe(txHash);
        });
    });
});
});
