import { describe, it, expect } from 'vitest';
import { 
    ROLE_COMMUNITY, 
    ROLE_ENDUSER, 
    getRoleName, 
    ROLE_PERMISSION_LEVELS, 
    RolePermissionLevel,
    ALL_ROLES
} from './roles.js';

describe('Roles', () => {
    it('should have consistent role hashes', () => {
        expect(ROLE_COMMUNITY).toBeDefined();
        expect(ROLE_ENDUSER).toBeDefined();
        expect(ROLE_COMMUNITY.startsWith('0x')).toBe(true);
    });

    it('should return correct role names', () => {
        expect(getRoleName(ROLE_COMMUNITY)).toBe('Community Admin');
        expect(getRoleName(ROLE_ENDUSER)).toBe('End User');
        expect(getRoleName('0x123' as `0x${string}`)).toBe('Unknown Role');
    });

    it('should have correct permission levels', () => {
        expect(ROLE_PERMISSION_LEVELS[ROLE_COMMUNITY]).toBe(RolePermissionLevel.COMMUNITY);
        expect(ROLE_PERMISSION_LEVELS[ROLE_ENDUSER]).toBe(RolePermissionLevel.USER);
    });

    it('should include all roles in ALL_ROLES', () => {
        expect(ALL_ROLES.length).toBeGreaterThan(0);
        expect(ALL_ROLES).toContain(ROLE_COMMUNITY);
        expect(ALL_ROLES).toContain(ROLE_ENDUSER);
    });
});
