import { describe, it, expect } from 'vitest';
import { getCommunityEndUserStatus, isActiveCommunityEndUser } from './membership.js';
import { ROLE_ENDUSER } from '../roles.js';

const REG = '0x' + '11'.repeat(20) as `0x${string}`;
const SBT = '0x' + '22'.repeat(20) as `0x${string}`;
const USER = '0x' + '33'.repeat(20) as `0x${string}`;
const COMM = '0x' + '44'.repeat(20) as `0x${string}`;

function client(role: boolean, sbt: boolean) {
    const calls: any[] = [];
    return {
        calls,
        c: {
            getBlockNumber: async () => 77n,
            readContract: async (p: any) => { calls.push(p); return p.address === REG ? role : sbt; },
        } as any,
    };
}

describe('getCommunityEndUserStatus (R-1: both the Registry role and the SBT membership)', () => {
    it.each([
        [true, true, true],
        [true, false, false],
        [false, true, false], // an SBT membership alone is not membership
        [false, false, false],
    ])('role=%s sbt=%s -> active=%s', async (role, sbt, active) => {
        const { c } = client(role, sbt);
        const r = await getCommunityEndUserStatus(c, { registry: REG, sbt: SBT, user: USER, community: COMM });
        expect(r).toEqual({ active, hasEndUserRole: role, sbtMembershipActive: sbt, blockNumber: 77n });
        expect(await isActiveCommunityEndUser(c, { registry: REG, sbt: SBT, user: USER, community: COMM })).toBe(active);
    });
    it('reads Registry.hasRole(ROLE_ENDUSER, user) and MySBT.verifyCommunityMembership(user, community) at ONE block', async () => {
        const { c, calls } = client(true, true);
        await getCommunityEndUserStatus(c, { registry: REG, sbt: SBT, user: USER, community: COMM });
        const reg = calls.find((x) => x.address === REG), sbt = calls.find((x) => x.address === SBT);
        expect(reg).toMatchObject({ functionName: 'hasRole', args: [ROLE_ENDUSER, USER], blockNumber: 77n });
        expect(sbt).toMatchObject({ functionName: 'verifyCommunityMembership', args: [USER, COMM], blockNumber: 77n });
    });
    it('a non-boolean truthy answer is not membership', async () => {
        const c = { getBlockNumber: async () => 1n, readContract: async () => 1 } as any;
        expect(await isActiveCommunityEndUser(c, { registry: REG, sbt: SBT, user: USER, community: COMM })).toBe(false);
    });
});
