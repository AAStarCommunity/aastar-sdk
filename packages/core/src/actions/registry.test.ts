import { describe, it, expect, vi, beforeEach } from 'vitest';
import { type Address, type PublicClient, type WalletClient, type Account } from 'viem';
import { registryActions } from './registry.js';

describe('Registry Actions', () => {
    const mockRegistryAddress: Address = '0x1234567890123456789012345678901234567890';
    let mockPublicClient: Partial<PublicClient>;
    let mockWalletClient: Partial<WalletClient>;
    let mockAccount: Account;

    const MOCK_ROLE_ID = '0xabcd1234567890123456789012345678901234567890abcd1234567890123456' as `0x${string}`;
    const MOCK_USER: Address = '0x2222222222222222222222222222222222222222';
    const MOCK_COMMUNITY: Address = '0x3333333333333333333333333333333333333333';

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

    describe('Credit and reputation', () => {
        it('should get credit limit', async () => {
            const mockLimit = 1000000000000000000n;
            (mockPublicClient.readContract as any).mockResolvedValue(mockLimit);

            const actions = registryActions(mockRegistryAddress)(mockPublicClient as PublicClient);
            const limit = await actions.getCreditLimit({ user: MOCK_USER });

            expect(limit).toBe(mockLimit);
        });

        it('should get global reputation', async () => {
            const mockReputation = 500n;
            (mockPublicClient.readContract as any).mockResolvedValue(mockReputation);

            const actions = registryActions(mockRegistryAddress)(mockPublicClient as PublicClient);
            const reputation = await actions.getGlobalReputation({ user: MOCK_USER });

            expect(reputation).toBe(mockReputation);
        });
    });

    describe('Role constants', () => {
        it('should read role constants', async () => {
            const mockRoleId = '0x1234...';
            (mockPublicClient.readContract as any).mockResolvedValue(mockRoleId);

            const actions = registryActions(mockRegistryAddress)(mockPublicClient as PublicClient);
            
            // Test accessing constant methods
            await actions.ROLE_COMMUNITY();
            expect(mockPublicClient.readContract).toHaveBeenCalled();
        });
    });

    describe('Contract references', () => {
        it('should get MySBT address', async () => {
            const mockAddress: Address = '0x5555555555555555555555555555555555555555';
            (mockPublicClient.readContract as any).mockResolvedValue(mockAddress);

            const actions = registryActions(mockRegistryAddress)(mockPublicClient as PublicClient);
            const address = await actions.mySBT();

            expect(address).toBe(mockAddress);
        });

        it('should get SuperPaymaster address', async () => {
            const mockAddress: Address = '0x6666666666666666666666666666666666666666';
            (mockPublicClient.readContract as any).mockResolvedValue(mockAddress);

            const actions = registryActions(mockRegistryAddress)(mockPublicClient as PublicClient);
            const address = await actions.superPaymaster();

            expect(address).toBe(mockAddress);
        });
    });
});
