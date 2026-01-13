import { describe, it, expect } from 'vitest';
import { RoleDataFactory, RoleIds } from './roleData.js';
import { zeroAddress } from 'viem';

describe('RoleDataFactory', () => {
    it('should have correct role ids', () => {
        expect(RoleIds.COMMUNITY).toBeDefined();
        expect(RoleIds.ENDUSER).toBeDefined();
    });

    it('should encode and decode community data', () => {
        const params = {
            name: 'MyCommunity',
            ensName: 'my.eth',
            website: 'https://my.com',
            description: 'desc',
            logoURI: 'logo',
            stakeAmount: 100n
        };
        const encoded = RoleDataFactory.community(params);
        const decoded = RoleDataFactory.decodeCommunity(encoded);
        
        expect(decoded.name).toBe(params.name);
        expect(decoded.stakeAmount).toBe(params.stakeAmount);
    });

    it('should encode community with default values', () => {
        const encoded = RoleDataFactory.community();
        const decoded = RoleDataFactory.decodeCommunity(encoded);
        expect(decoded.name).toBe('TestCommunity');
        expect(decoded.stakeAmount).toBe(0n);
    });

    it('should encode and decode endUser data', () => {
        const params = {
            account: '0x1111111111111111111111111111111111111111' as `0x${string}`,
            community: '0x2222222222222222222222222222222222222222' as `0x${string}`,
            avatarURI: 'avatar',
            ensName: 'user.eth',
            stakeAmount: 50n
        };
        const encoded = RoleDataFactory.endUser(params);
        const decoded = RoleDataFactory.decodeEndUser(encoded);
        
        expect(decoded.account).toBe(params.account);
        expect(decoded.community).toBe(params.community);
        expect(decoded.stakeAmount).toBe(params.stakeAmount);
    });

    it('should encode endUser with default values', () => {
        const encoded = RoleDataFactory.endUser();
        const decoded = RoleDataFactory.decodeEndUser(encoded);
        expect(decoded.account).toBe(zeroAddress);
        expect(decoded.stakeAmount).toBe(0n);
    });

    it('should handle paymasterSuper and dvt (empty data)', () => {
        expect(RoleDataFactory.paymasterSuper()).toBe('0x');
        expect(RoleDataFactory.dvt()).toBe('0x');
    });
});
