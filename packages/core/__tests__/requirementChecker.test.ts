import { describe, it, expect, beforeEach } from 'vitest';
import { parseEther } from 'viem';
import { RequirementChecker } from '../src/requirementChecker';
import { ROLE_PAYMASTER_AOA, ROLE_PAYMASTER_SUPER } from '../src/roles';
import { createMockPublicClient, resetMocks } from './mocks/client';

const WALLET = '0x2222222222222222222222222222222222222222' as `0x${string}`;

const ADDRESSES = {
    registry: '0xR000000000000000000000000000000000000001' as `0x${string}`,
    gtoken: '0x9000000000000000000000000000000000000002' as `0x${string}`,
    apnts: '0xa000000000000000000000000000000000000003' as `0x${string}`,
    mysbt: '0x5000000000000000000000000000000000000004' as `0x${string}`,
};

/**
 * Wire publicClient.readContract to return values keyed by functionName.
 * `hasRole` / `roleStakes` are keyed additionally by the roleId argument so the
 * test can assert checkResources queries the CORRECT role per mode.
 */
function mockReads(p: any, opts: {
    rolesHeld?: `0x${string}`[];
    stakes?: Record<string, bigint>;
    sbtBalance?: bigint;
}) {
    p.readContract.mockImplementation(async ({ functionName, args }: any) => {
        if (functionName === 'hasRole') {
            const [roleId] = args;
            return (opts.rolesHeld ?? []).includes(roleId);
        }
        // Must be the REAL Registry getter `getRoleStake` — the mock rejects any
        // other name, so a regression back to a non-existent fn (e.g. `roleStakes`)
        // fails here instead of slipping through to an on-chain revert.
        if (functionName === 'getRoleStake') {
            const [roleId] = args;
            return opts.stakes?.[roleId] ?? 0n;
        }
        if (functionName === 'balanceOf') return opts.sbtBalance ?? 0n;
        throw new Error(`unexpected read: ${functionName}`);
    });
}

describe('RequirementChecker.checkResources', () => {
    let p: any;
    let checker: RequirementChecker;

    beforeEach(() => {
        resetMocks();
        p = createMockPublicClient();
        checker = new RequirementChecker(p, ADDRESSES);
    });

    describe('AOA mode (independent paymaster operator)', () => {
        it('ready=true when PAYMASTER_AOA role + stake are present, and never checks SBT', async () => {
            mockReads(p, {
                rolesHeld: [ROLE_PAYMASTER_AOA],
                stakes: { [ROLE_PAYMASTER_AOA]: parseEther('30') },
            });
            const report = await checker.checkResources(WALLET, 'AOA');

            expect(report.ready).toBe(true);
            expect(report.mode).toBe('AOA');
            expect(report.issues).toEqual([]);
            expect(report.checks.role?.roleId).toBe(ROLE_PAYMASTER_AOA);
            expect(report.checks.role?.ok).toBe(true);
            expect(report.checks.stake?.ok).toBe(true);
            // AOA tier does not require an SBT.
            expect(report.checks.sbt).toBeUndefined();
            // The stake read MUST use the real Registry getter `getRoleStake`
            // (regression guard for the `roleStakes` DOA bug — that fn is absent
            // from the deployed Registry ABI and reverts on-chain).
            const stakeCall = p.readContract.mock.calls.find((c: any) => c[0].functionName === 'getRoleStake');
            expect(stakeCall).toBeDefined();
            expect(stakeCall[0].args).toEqual([ROLE_PAYMASTER_AOA, WALLET]);
        });

        it('ready=false with a role issue when PAYMASTER_AOA role is missing', async () => {
            mockReads(p, { stakes: { [ROLE_PAYMASTER_AOA]: parseEther('30') } });
            const report = await checker.checkResources(WALLET, 'AOA');

            expect(report.ready).toBe(false);
            expect(report.checks.role?.ok).toBe(false);
            expect(report.issues).toHaveLength(1);
            expect(report.issues[0]).toContain('Missing PAYMASTER_AOA role');
        });

        it('ready=false with a stake issue when role stake is below threshold', async () => {
            mockReads(p, {
                rolesHeld: [ROLE_PAYMASTER_AOA],
                stakes: { [ROLE_PAYMASTER_AOA]: parseEther('10') },
            });
            const report = await checker.checkResources(WALLET, 'AOA');

            expect(report.ready).toBe(false);
            expect(report.checks.stake?.ok).toBe(false);
            expect(report.issues).toHaveLength(1);
            expect(report.issues[0]).toContain('Insufficient role stake');
            expect(report.issues[0]).toContain('need 30 GT');
            expect(report.issues[0]).toContain('have 10 GT');
        });
    });

    describe('AOA+ mode (shared SuperPaymaster operator)', () => {
        it('ready=true when PAYMASTER_SUPER role + stake + SBT are all present', async () => {
            mockReads(p, {
                rolesHeld: [ROLE_PAYMASTER_SUPER],
                stakes: { [ROLE_PAYMASTER_SUPER]: parseEther('50') },
                sbtBalance: 1n,
            });
            const report = await checker.checkResources(WALLET, 'AOA+');

            expect(report.ready).toBe(true);
            expect(report.mode).toBe('AOA+');
            expect(report.issues).toEqual([]);
            expect(report.checks.role?.roleId).toBe(ROLE_PAYMASTER_SUPER);
            expect(report.checks.role?.ok).toBe(true);
            expect(report.checks.stake?.ok).toBe(true);
            expect(report.checks.sbt?.ok).toBe(true);
        });

        it('ready=false listing every unmet requirement', async () => {
            mockReads(p, { stakes: { [ROLE_PAYMASTER_SUPER]: parseEther('10') }, sbtBalance: 0n });
            const report = await checker.checkResources(WALLET, 'AOA+');

            expect(report.ready).toBe(false);
            expect(report.issues).toHaveLength(3);
            expect(report.issues.some((i) => i.includes('PAYMASTER_SUPER role'))).toBe(true);
            expect(report.issues.some((i) => i.includes('Insufficient role stake'))).toBe(true);
            expect(report.issues.some((i) => i.includes('Missing MySBT'))).toBe(true);
        });

        it('reports only the SBT issue when role + stake pass but SBT is missing', async () => {
            mockReads(p, {
                rolesHeld: [ROLE_PAYMASTER_SUPER],
                stakes: { [ROLE_PAYMASTER_SUPER]: parseEther('50') },
                sbtBalance: 0n,
            });
            const report = await checker.checkResources(WALLET, 'AOA+');

            expect(report.ready).toBe(false);
            expect(report.issues).toHaveLength(1);
            expect(report.issues[0]).toContain('Missing MySBT');
        });
    });

    it('honours a custom stake threshold override', async () => {
        mockReads(p, {
            rolesHeld: [ROLE_PAYMASTER_AOA],
            stakes: { [ROLE_PAYMASTER_AOA]: parseEther('5') },
        });
        const report = await checker.checkResources(WALLET, 'AOA', {
            requiredStake: parseEther('5'),
        });
        expect(report.ready).toBe(true);
    });
});
