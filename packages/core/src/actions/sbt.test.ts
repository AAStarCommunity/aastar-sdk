import { describe, it, expect, vi, beforeEach } from 'vitest';
import { type Address, type PublicClient } from 'viem';
import { sbtActions } from './sbt.js';

describe('SBT Actions', () => {
    const mockSBTAddress: Address = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb';
    let mockPublicClient: Partial<PublicClient>;

    beforeEach(() => {
        mockPublicClient = {
            readContract: vi.fn(),
        };
    });

    describe('getUserSBT', () => {
        it('should get user SBT token ID', async () => {
            const expectedTokenId = 123n;
            (mockPublicClient.readContract as any).mockResolvedValue(expectedTokenId);

            const user: Address = '0x1234567890123456789012345678901234567890';
            const actions = sbtActions(mockSBTAddress)(mockPublicClient as PublicClient);
            const tokenId = await actions.userToSBT({ user });

            expect(tokenId).toBe(expectedTokenId);
            expect(mockPublicClient.readContract).toHaveBeenCalledWith(
                expect.objectContaining({
                    functionName: 'userToSBT',
                    args: [user],
                })
            );
        });

        it('should return 0 for user without SBT', async () => {
            (mockPublicClient.readContract as any).mockResolvedValue(0n);

            const user: Address = '0xabcd1234567890123456789012345678901234ab';
            const actions = sbtActions(mockSBTAddress)(mockPublicClient as PublicClient);
            const tokenId = await actions.userToSBT({ user });

            expect(tokenId).toBe(0n);
        });
    });

    describe('getMemberships', () => {
        it('should get user memberships', async () => {
            const mockMemberships = [
                { community: '0x1111...' as Address, isActive: true },
                { community: '0x2222...' as Address, isActive: true },
            ];
            (mockPublicClient.readContract as any).mockResolvedValue(mockMemberships);

            const user: Address = '0x3333333333333333333333333333333333333333';
            const actions = sbtActions(mockSBTAddress)(mockPublicClient as PublicClient);
            const memberships = await actions.getMemberships({ user });

            expect(memberships).toHaveLength(2);
            expect(mockPublicClient.readContract).toHaveBeenCalledWith(
                expect.objectContaining({
                    functionName: 'getMemberships',
                })
            );
        });

        it('should handle empty memberships', async () => {
            (mockPublicClient.readContract as any).mockResolvedValue([]);

            const user: Address = '0x4444444444444444444444444444444444444444';
            const actions = sbtActions(mockSBTAddress)(mockPublicClient as PublicClient);
            const memberships = await actions.getMemberships({ user });

            expect(memberships).toHaveLength(0);
        });
    });

    describe('getActiveMemberships', () => {
        it('should get only active memberships', async () => {
            const mockActiveCommunities = [
                '0x5555555555555555555555555555555555555555' as Address,
                '0x6666666666666666666666666666666666666666' as Address,
            ];
            (mockPublicClient.readContract as any).mockResolvedValue(mockActiveCommunities);

            const user: Address = '0x7777777777777777777777777777777777777777';
            const actions = sbtActions(mockSBTAddress)(mockPublicClient as PublicClient);
            const activeMemberships = await actions.getActiveMemberships({ user });

            expect(activeMemberships).toHaveLength(2);
        });
    });

    describe('verifyCommunityMembership', () => {
        it('should verify active membership', async () => {
            (mockPublicClient.readContract as any).mockResolvedValue(true);

            const user: Address = '0x8888888888888888888888888888888888888888';
            const community: Address = '0x9999999999999999999999999999999999999999';
            const actions = sbtActions(mockSBTAddress)(mockPublicClient as PublicClient);
            const isMember = await actions.verifyCommunityMembership({ user, community });

            expect(isMember).toBe(true);
            expect(mockPublicClient.readContract).toHaveBeenCalledWith(
                expect.objectContaining({
                    functionName: 'verifyCommunityMembership',
                    args: [user, community],
                })
            );
        });

        it('should return false for non-member', async () => {
            (mockPublicClient.readContract as any).mockResolvedValue(false);

            const user: Address = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
            const community: Address = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
            const actions = sbtActions(mockSBTAddress)(mockPublicClient as PublicClient);
            const isMember = await actions.verifyCommunityMembership({ user, community });

            expect(isMember).toBe(false);
        });
    });

    describe('ERC721 Standard Methods', () => {
        it('should get balance of owner', async () => {
            const expectedBalance = 1n;
            (mockPublicClient.readContract as any).mockResolvedValue(expectedBalance);

            const owner: Address = '0xcccccccccccccccccccccccccccccccccccccccc';
            const actions = sbtActions(mockSBTAddress)(mockPublicClient as PublicClient);
            const balance = await actions.balanceOf({ owner });

            expect(balance).toBe(expectedBalance);
        });

        it('should get owner of token', async () => {
            const expectedOwner: Address = '0xdddddddddddddddddddddddddddddddddddddddd';
            (mockPublicClient.readContract as any).mockResolvedValue(expectedOwner);

            const tokenId = 456n;
            const actions = sbtActions(mockSBTAddress)(mockPublicClient as PublicClient);
            const owner = await actions.ownerOf({ tokenId });

            expect(owner).toBe(expectedOwner);
        });

        it('should get total supply', async () => {
            const expectedSupply = 1000n;
            (mockPublicClient.readContract as any).mockResolvedValue(expectedSupply);

            const actions = sbtActions(mockSBTAddress)(mockPublicClient as PublicClient);
            const supply = await actions.totalSupply();

            expect(supply).toBe(expectedSupply);
        });

        it('should get name and symbol', async () => {
            (mockPublicClient.readContract as any)
                .mockResolvedValueOnce('MySBT')
                .mockResolvedValueOnce('mSBT');

            const actions = sbtActions(mockSBTAddress)(mockPublicClient as PublicClient);
            const name = await actions.name();
            const symbol = await actions.symbol();

            expect(name).toBe('MySBT');
            expect(symbol).toBe('mSBT');
        });
    });
});
