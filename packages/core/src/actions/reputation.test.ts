import { describe, it, expect, vi, beforeEach } from 'vitest';
import { type Address, type PublicClient, type WalletClient, type Account, type Hex } from 'viem';
import { reputationActions } from './reputation.js';

describe('Reputation Actions', () => {
    const mockReputationAddress: Address = '0x1234567890123456789012345678901234567890';
    let mockPublicClient: Partial<PublicClient>;
    let mockWalletClient: Partial<WalletClient>;
    let mockAccount: Account;

    const MOCK_USER: Address = '0x2222222222222222222222222222222222222222';
    const MOCK_COMMUNITY: Address = '0x3333333333333333333333333333333333333333';
    const MOCK_RULE_ID = '0xabcd1234567890123456789012345678901234567890abcd1234567890123456' as `0x${string}`;

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

    describe('Rule Configuration', () => {
        it('should get reputation rule', async () => {
            const mockRule = { weight: 50, active: true };
            (mockPublicClient.readContract as any).mockResolvedValue(mockRule);

            const actions = reputationActions(mockReputationAddress)(mockPublicClient as PublicClient);
            const rule = await actions.getReputationRule({ ruleId: MOCK_RULE_ID });

            expect(rule).toEqual(mockRule);
            expect(mockPublicClient.readContract).toHaveBeenCalledWith(
                expect.objectContaining({
                    functionName: 'getReputationRule',
                    args: [MOCK_RULE_ID],
                })
            );
        });

        it('should check if rule is active', async () => {
            (mockPublicClient.readContract as any).mockResolvedValue(true);

            const actions = reputationActions(mockReputationAddress)(mockPublicClient as PublicClient);
            const active = await actions.isRuleActive({ ruleId: MOCK_RULE_ID });

            expect(active).toBe(true);
        });

        it('should get active rules for community', async () => {
            const mockRules = [MOCK_RULE_ID];
            (mockPublicClient.readContract as any).mockResolvedValue(mockRules);

            const actions = reputationActions(mockReputationAddress)(mockPublicClient as PublicClient);
            const rules = await actions.getActiveRules({ community: MOCK_COMMUNITY });

            expect(rules).toEqual(mockRules);
        });

        it('should get rule count', async () => {
            (mockPublicClient.readContract as any).mockResolvedValue(10n);

            const actions = reputationActions(mockReputationAddress)(mockPublicClient as PublicClient);
            const count = await actions.getRuleCount();

            expect(count).toBe(10n);
        });
    });

    describe('Score Computation', () => {
        it('should compute score', async () => {
            (mockPublicClient.readContract as any).mockResolvedValue(850n);

            const actions = reputationActions(mockReputationAddress)(mockPublicClient as PublicClient);
            const score = await actions.computeScore({ user: MOCK_USER, community: MOCK_COMMUNITY });

            expect(score).toBe(850n);
        });

        it('should get user score', async () => {
            (mockPublicClient.readContract as any).mockResolvedValue(900n);

            const actions = reputationActions(mockReputationAddress)(mockPublicClient as PublicClient);
            const score = await actions.getUserScore({ user: MOCK_USER });

            expect(score).toBe(900n);
        });

        it('should get community score', async () => {
            (mockPublicClient.readContract as any).mockResolvedValue(750n);

            const actions = reputationActions(mockReputationAddress)(mockPublicClient as PublicClient);
            const score = await actions.getCommunityScore({ community: MOCK_COMMUNITY });

            expect(score).toBe(750n);
        });

        it('should get community reputations mapping', async () => {
            (mockPublicClient.readContract as any).mockResolvedValue(800n);

            const actions = reputationActions(mockReputationAddress)(mockPublicClient as PublicClient);
            const reputation = await actions.communityReputations({ community: MOCK_COMMUNITY, user: MOCK_USER });

            expect(reputation).toBe(800n);
        });
    });

    describe('Write Operations', () => {
        it('should set reputation rule', async () => {
            const txHash = '0xabc...';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);

            const actions = reputationActions(mockReputationAddress)(mockWalletClient as WalletClient);
            const result = await actions.setReputationRule({
                ruleId: MOCK_RULE_ID,
                rule: { weight: 50, active: true } as any,
                account: mockAccount
            });

            expect(result).toBe(txHash);
        });

        it('should enable rule', async () => {
            const txHash = '0xdef...';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);

            const actions = reputationActions(mockReputationAddress)(mockWalletClient as WalletClient);
            const result = await actions.enableRule({ ruleId: MOCK_RULE_ID, account: mockAccount });

            expect(result).toBe(txHash);
        });

        it('should disable rule', async () => {
            const txHash = '0xghi...';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);

            const actions = reputationActions(mockReputationAddress)(mockWalletClient as WalletClient);
            const result = await actions.disableRule({ ruleId: MOCK_RULE_ID, account: mockAccount });

            expect(result).toBe(txHash);
        });

        it('should batch update scores', async () => {
            const txHash = '0xjkl...';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);

            const actions = reputationActions(mockReputationAddress)(mockWalletClient as WalletClient);
            const result = await actions.batchUpdateScores({
                users: [MOCK_USER],
                scores: [100n],
                account: mockAccount
            });

            expect(result).toBe(txHash);
        });
    });

    describe('Sync Operations', () => {
        it('should batch sync to registry', async () => {
            const txHash = '0xmno...';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);

            const actions = reputationActions(mockReputationAddress)(mockWalletClient as WalletClient);
            const result = await actions.batchSyncToRegistry({
                users: [MOCK_USER],
                account: mockAccount
            });

            expect(result).toBe(txHash);
        });

        it('should sync to registry with proof', async () => {
            const txHash = '0xpqr...';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);

            const actions = reputationActions(mockReputationAddress)(mockWalletClient as WalletClient);
            const result = await actions.syncToRegistry({
                user: MOCK_USER,
                communities: [MOCK_COMMUNITY],
                ruleIds: [[MOCK_RULE_ID]],
                activities: [[100n]],
                epoch: 1n,
                proof: '0x' as `0x${string}`,
                account: mockAccount
            });

            expect(result).toBe(txHash);
        });
    });

    describe('Admin Functions', () => {
        it('should set registry', async () => {
            const txHash = '0xstu...';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);

            const actions = reputationActions(mockReputationAddress)(mockWalletClient as WalletClient);
            const result = await actions.setRegistry({
                registry: '0x8888888888888888888888888888888888888888' as Address,
                account: mockAccount
            });

            expect(result).toBe(txHash);
        });

        it('should set entropy factor', async () => {
            const txHash = '0xvwx...';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);

            const actions = reputationActions(mockReputationAddress)(mockWalletClient as WalletClient);
            const result = await actions.setEntropyFactor({
                factor: 100n,
                account: mockAccount
            });

            expect(result).toBe(txHash);
        });
    });
});
