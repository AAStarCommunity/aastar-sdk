import { describe, it, expect } from 'vitest';
import { decodeAbiParameters, encodeAbiParameters, getAddress, type Hex } from 'viem';
import { encodeEndUserRoleData, decodeEndUserRoleData } from './roleData.js';

const COMMUNITY = '0xb5600060e6de5E11D3636731964218E53caadf0E';
// What Registry decodes: abi.decode(roleData, (EndUserRoleData)), struct { address community; uint256 stakeAmount; }.
// A static struct is encoded in place: two words, community first.
const registryDecode = (d: Hex) => decodeAbiParameters([{ type: 'tuple', components: [{ name: 'community', type: 'address' }, { name: 'stakeAmount', type: 'uint256' }] }], d)[0];

describe('encodeEndUserRoleData — the bytes Registry decodes as EndUserRoleData', () => {
    it('is two words: the community, then the stake', () => {
        const d = encodeEndUserRoleData({ community: COMMUNITY, stakeAmount: 3n * 10n ** 17n });
        expect((d.length - 2) / 64).toBe(2);
        expect(getAddress('0x' + d.slice(26, 66))).toBe(COMMUNITY);
        expect(BigInt('0x' + d.slice(66))).toBe(3n * 10n ** 17n);
        expect(registryDecode(d)).toEqual({ community: COMMUNITY, stakeAmount: 3n * 10n ** 17n });
    });

    it('stake defaults to 0 (Registry then uses the role\'s minStake)', () => {
        expect(registryDecode(encodeEndUserRoleData({ community: COMMUNITY })).stakeAmount).toBe(0n);
    });

    it('the old five-field encoding puts something other than the community in the first word', () => {
        const account = '0x000000000000000000000000000000000000fa11';
        const flat = encodeAbiParameters([{ type: 'address' }, { type: 'address' }, { type: 'string' }, { type: 'string' }, { type: 'uint256' }], [account, COMMUNITY, '', '', 0n]);
        expect(registryDecode(flat).community).not.toBe(COMMUNITY);
    });

    it('decoding refuses the old five-field payloads instead of returning a wrong community', () => {
        const account = '0x000000000000000000000000000000000000fa11';
        const flat = encodeAbiParameters([{ type: 'address' }, { type: 'address' }, { type: 'string' }, { type: 'string' }, { type: 'uint256' }], [account, COMMUNITY, '', '', 0n]);
        const tuple = encodeAbiParameters([{ type: 'tuple', components: [{ name: 'account', type: 'address' }, { name: 'community', type: 'address' }, { name: 'avatarURI', type: 'string' }, { name: 'ensName', type: 'string' }, { name: 'stakeAmount', type: 'uint256' }] }], [{ account, community: COMMUNITY, avatarURI: '', ensName: '', stakeAmount: 0n }]);
        expect(() => decodeEndUserRoleData(flat)).toThrow('expected 64 bytes');
        expect(() => decodeEndUserRoleData(tuple)).toThrow('expected 64 bytes');
        expect(() => decodeEndUserRoleData(('0x' + 'ff'.repeat(32) + '00'.repeat(32)) as Hex)).toThrow('not an address');
    });

    it('decodes back to the same fields and rejects a non-address community', () => {
        expect(decodeEndUserRoleData(encodeEndUserRoleData({ community: COMMUNITY, stakeAmount: 7n }))).toEqual({ community: COMMUNITY, stakeAmount: 7n });
        expect(() => encodeEndUserRoleData({ community: '0x1234' as any })).toThrow();
    });
});
