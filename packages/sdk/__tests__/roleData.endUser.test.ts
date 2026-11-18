import { describe, it, expect } from 'vitest';
import { encodeEndUserRoleData } from '@aastar/core';
import { RoleDataFactory } from '../src/utils/roleData';

const COMMUNITY = '0xb5600060e6de5E11D3636731964218E53caadf0E';

describe('RoleDataFactory.endUser — Registry EndUserRoleData { community, stakeAmount }', () => {
    it('is the core encoding; account / avatarURI / ensName do not change the bytes', () => {
        const plain = RoleDataFactory.endUser({ community: COMMUNITY, stakeAmount: 5n });
        expect(plain).toBe(encodeEndUserRoleData({ community: COMMUNITY, stakeAmount: 5n }));
        expect(RoleDataFactory.endUser({ community: COMMUNITY, stakeAmount: 5n, account: '0x000000000000000000000000000000000000fa11', avatarURI: 'ipfs://x', ensName: 'x.eth' })).toBe(plain);
    });

    it('throws without a community instead of encoding the zero address (the type requires it; JS callers may not)', () => {
        expect(() => (RoleDataFactory.endUser as any)()).toThrow('community is required');
        expect(() => (RoleDataFactory.endUser as any)({ stakeAmount: 1n })).toThrow('community is required');
    });

    it('decodeEndUser inverts it', () => {
        expect(RoleDataFactory.decodeEndUser(RoleDataFactory.endUser({ community: COMMUNITY }))).toEqual({ community: COMMUNITY, stakeAmount: 0n });
    });
});
