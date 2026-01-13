import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RequirementChecker } from './requirementChecker.js';
import { type PublicClient, type Address } from 'viem';

describe('RequirementChecker', () => {
    const MOCK_ADDR: Address = '0x1111111111111111111111111111111111111111';
    let mockPublicClient: any;
    let checker: RequirementChecker;

    beforeEach(() => {
        mockPublicClient = {
            readContract: vi.fn(),
        };
        checker = new RequirementChecker(mockPublicClient as any);
    });

    it('should check full requirements successfully', async () => {
        mockPublicClient.readContract
            .mockResolvedValueOnce(true)    // hasRole
            .mockResolvedValueOnce(1000n)   // GToken balance
            .mockResolvedValueOnce(500n)    // aPNTs balance
            .mockResolvedValueOnce(1n);     // SBT balance

        const result = await checker.checkRequirements({
            address: MOCK_ADDR,
            roleId: '0x1',
            requiredGToken: 500n,
            requiredAPNTs: 200n,
            requireSBT: true
        });

        expect(result.hasRole).toBe(true);
        expect(result.hasEnoughGToken).toBe(true);
        expect(result.hasEnoughAPNTs).toBe(true);
        expect(result.hasSBT).toBe(true);
        expect(result.missingRequirements.length).toBe(0);
    });

    it('should identify missing requirements', async () => {
        mockPublicClient.readContract
            .mockResolvedValueOnce(false)   // hasRole
            .mockResolvedValueOnce(10n)     // GToken balance
            .mockResolvedValueOnce(0n)      // aPNTs balance
            .mockResolvedValueOnce(0n);     // SBT balance

        const result = await checker.checkRequirements({
            address: MOCK_ADDR,
            roleId: '0x1',
            requiredGToken: 500n,
            requiredAPNTs: 200n,
            requireSBT: true
        });

        expect(result.hasRole).toBe(false);
        expect(result.hasEnoughGToken).toBe(false);
        expect(result.missingRequirements.length).toBe(4);
    });

    it('should check GToken balance shortcut', async () => {
        mockPublicClient.readContract.mockResolvedValue(100n);
        const result = await checker.checkGTokenBalance(MOCK_ADDR, 50n);
        expect(result.hasEnough).toBe(true);
        expect(result.balance).toBe(100n);
    });

    it('should check hasSBT shortcut', async () => {
        mockPublicClient.readContract.mockResolvedValue(1n);
        const hasSBT = await checker.checkHasSBT(MOCK_ADDR);
        expect(hasSBT).toBe(true);
    });
});
