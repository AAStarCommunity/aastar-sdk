import { describe, it, expect, vi, beforeEach } from 'vitest';
import { type Address, type PublicClient, type WalletClient, type Hex, type Account } from 'viem';
import { sbtActions } from './sbt.js';

describe('SBT Actions', () => {
    const mockSBTAddress: Address = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb';
    const MOCK_USER: Address = '0x1234567890123456789012345678901234567890';
    const MOCK_COMMUNITY: Address = '0x3333333333333333333333333333333333333333';
    let mockPublicClient: Partial<PublicClient>;
    let mockWalletClient: any;
    let mockAccount: Account;

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

    describe('Minting & Admin', () => {
        it('should perform various minting operations', async () => {
            const txHash = '0xhash';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);
            const actions = sbtActions(mockSBTAddress)(mockWalletClient as WalletClient);

            const results = await Promise.all([
                actions.safeMintForRole({ roleId: '0xROLE', to: MOCK_USER, tokenURI: 'uri', account: mockAccount }),
                actions.airdropMint({ roleId: '0xROLE', to: MOCK_USER, tokenURI: 'uri', account: mockAccount }),
                actions.mintForRole({ roleId: '0xROLE', to: MOCK_USER, account: mockAccount }),
                actions.mint({ to: MOCK_USER, tokenURI: 'uri', account: mockAccount })
            ]);

            results.forEach(res => expect(res).toBe(txHash));
        });

        it('should burn SBT', async () => {
            const txHash = '0xhash';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);
            const actions = sbtActions(mockSBTAddress)(mockWalletClient as WalletClient);

            const res1 = await actions.burn({ tokenId: 1n, account: mockAccount });
            const res2 = await actions.burnSBT({ tokenId: 1n, account: mockAccount });

            expect(res1).toBe(txHash);
            expect(res2).toBe(txHash);
        });

        it('should leave community and deactivate membership', async () => {
            const txHash = '0xhash';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);
            const actions = sbtActions(mockSBTAddress)(mockWalletClient as WalletClient);

            const res1 = await actions.leaveCommunity({ community: MOCK_COMMUNITY, account: mockAccount });
            const res2 = await actions.deactivateMembership({ tokenId: 1n, account: mockAccount });

            expect(res1).toBe(txHash);
            expect(res2).toBe(txHash);
        });
    });

    describe('Activity & Reputation', () => {
        it('should record activity and check times', async () => {
            const txHash = '0xhash';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);
            (mockWalletClient.readContract as any).mockResolvedValue(12345678n);

            const actions = sbtActions(mockSBTAddress)(mockWalletClient as WalletClient);
            const tx = await actions.recordActivity({ user: MOCK_USER, account: mockAccount });
            const lastTime = await actions.lastActivityTime({ user: MOCK_USER });
            const weekly = await actions.weeklyActivity({ user: MOCK_USER });

            expect(tx).toBe(txHash);
            expect(lastTime).toBe(12345678n);
            expect(weekly).toBe(12345678n);
        });

        it('should manage reputation calculator', async () => {
            const txHash = '0xhash';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);
            (mockWalletClient.readContract as any).mockResolvedValue(MOCK_USER);

            const actions = sbtActions(mockSBTAddress)(mockWalletClient as WalletClient);
            const tx = await actions.setReputationCalculator({ calculator: MOCK_USER, account: mockAccount });
            const calculator = await actions.reputationCalculator();

            expect(tx).toBe(txHash);
            expect(calculator).toBe(MOCK_USER);
        });
    });

    describe('Config & Constants', () => {
        it('should manage fees and lock amounts', async () => {
            const txHash = '0xhash';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);
            (mockWalletClient.readContract as any).mockResolvedValue(100n);

            const actions = sbtActions(mockSBTAddress)(mockWalletClient as WalletClient);
            const tx1 = await actions.setMintFee({ fee: 100n, account: mockAccount });
            const tx2 = await actions.setMinLockAmount({ amount: 100n, account: mockAccount });
            const fee = await actions.mintFee();
            const lock = await actions.minLockAmount();

            expect(tx1).toBe(txHash);
            expect(tx2).toBe(txHash);
            expect(fee).toBe(100n);
            expect(lock).toBe(100n);
        });

        it('should query all constants', async () => {
            (mockPublicClient.readContract as any).mockResolvedValue(MOCK_USER);
            const actions = sbtActions(mockSBTAddress)(mockPublicClient as PublicClient);

            const results = await Promise.all([
                actions.REGISTRY(),
                actions.GTOKEN_STAKING(),
                actions.GTOKEN(),
                actions.SUPER_PAYMASTER(),
                actions.owner()
            ]);

            results.forEach(res => expect(res).toBe(MOCK_USER));
        });

        it('should get version and pause status', async () => {
            (mockPublicClient.readContract as any).mockResolvedValueOnce('v1').mockResolvedValueOnce(true);
            const actions = sbtActions(mockSBTAddress)(mockPublicClient as PublicClient);
            const v = await actions.version();
            const p = await actions.paused();
            expect(v).toBe('v1');
            expect(p).toBe(true);
        });

    describe('ERC721 Operations', () => {
        it('should perform transfers and approvals', async () => {
            const txHash = '0xhash';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);
            const actions = sbtActions(mockSBTAddress)(mockWalletClient as WalletClient);

            const tx1 = await actions.safeTransferFrom({ from: MOCK_USER, to: MOCK_COMMUNITY, tokenId: 1n, account: mockAccount });
            const tx2 = await actions.approve({ to: MOCK_COMMUNITY, tokenId: 1n, account: mockAccount });
            const tx3 = await actions.setApprovalForAll({ operator: MOCK_COMMUNITY, approved: true, account: mockAccount });

            expect(tx1).toBe(txHash);
            expect(tx2).toBe(txHash);
            expect(tx3).toBe(txHash);
        });

        it('should query transfer permissions', async () => {
            (mockPublicClient.readContract as any)
                .mockResolvedValueOnce(MOCK_USER)
                .mockResolvedValueOnce(true);
            const actions = sbtActions(mockSBTAddress)(mockPublicClient as PublicClient);
            const approved = await actions.getApproved({ tokenId: 1n });
            const isAllApproved = await actions.isApprovedForAll({ owner: MOCK_USER, operator: MOCK_COMMUNITY });

            expect(approved).toBe(MOCK_USER);
            expect(isAllApproved).toBe(true);
        });
    });

    describe('Metadata & Enumeration', () => {
        it('should query token metadata and indices', async () => {
            (mockPublicClient.readContract as any)
                .mockResolvedValueOnce('ipfs://uri') // tokenURI
                .mockResolvedValueOnce(1n) // tokenByIndex
                .mockResolvedValueOnce(2n) // tokenOfOwnerByIndex
                .mockResolvedValueOnce(10n); // nextTokenId

            const actions = sbtActions(mockSBTAddress)(mockPublicClient as PublicClient);
            const uri = await actions.tokenURI({ tokenId: 1n });
            const indexToken = await actions.tokenByIndex({ index: 0n });
            const ownerToken = await actions.tokenOfOwnerByIndex({ owner: MOCK_USER, index: 0n });
            const nextId = await actions.nextTokenId();

            expect(uri).toBe('ipfs://uri');
            expect(indexToken).toBe(1n);
            expect(ownerToken).toBe(2n);
            expect(nextId).toBe(10n);
        });
    });

    describe('System Configuration', () => {
        it('should set all system proxies', async () => {
            const txHash = '0xhash';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);
            const actions = sbtActions(mockSBTAddress)(mockWalletClient as WalletClient);

            const results = await Promise.all([
                actions.setRegistry({ registry: MOCK_COMMUNITY, account: mockAccount }),
                actions.setSuperPaymaster({ paymaster: MOCK_COMMUNITY, account: mockAccount }),
                actions.setDAOMultisig({ multisig: MOCK_COMMUNITY, account: mockAccount }),
                actions.setBaseURI({ baseURI: 'https://...', account: mockAccount })
            ]);

            results.forEach(res => expect(res).toBe(txHash));
        });

        it('should query system config', async () => {
            (mockPublicClient.readContract as any).mockResolvedValue(MOCK_COMMUNITY);
            const actions = sbtActions(mockSBTAddress)(mockPublicClient as PublicClient);
            const multisig = await actions.daoMultisig();
            expect(multisig).toBe(MOCK_COMMUNITY);
        });
    });
});
});
