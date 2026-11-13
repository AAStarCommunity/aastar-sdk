/**
 * Offline provenance for the vendored pause-duty pin.
 * git hash-object of each local file must equal pin.json blobSha.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { keccak256, toBytes } from 'viem';
import {
    PINNED_ROLES,
    REGISTRY_PAUSE_ABI,
    ROLE_PAYMASTER_SUPER,
    SUPER_PAYMASTER_PAUSE_ABI,
    parsePinnedRoles,
    stripSolidityComments,
} from './spPausePin';

const PIN_DIR = join(dirname(fileURLToPath(import.meta.url)), 'sp-pause-pin');
const pin = JSON.parse(readFileSync(join(PIN_DIR, 'pin.json'), 'utf8')) as {
    files: { path: string; blobSha: string; local: string }[];
};

const SPAWN_VERDICT_TIMEOUT_MS = 30_000;

const names = (abi: readonly { type?: string; name?: string }[], type: string) =>
    abi.filter((e) => e.type === type).map((e) => e.name);

describe('sp pause pin', { timeout: SPAWN_VERDICT_TIMEOUT_MS }, () => {
    it('git hash-object of each vendored file equals pin.json blobSha', () => {
        expect(pin.files.length).toBeGreaterThan(0);
        for (const file of pin.files) {
            const local = join(PIN_DIR, file.local);
            const sha = execFileSync('git', ['hash-object', '--no-filters', local], { encoding: 'utf8' }).trim();
            expect(sha, file.local).toBe(file.blobSha);
        }
    });

    it('every keeper fragment resolves from the vendored JSON', () => {
        expect(names(SUPER_PAYMASTER_PAUSE_ABI, 'function')).toEqual([
            'pauseUnderstakedOperator',
            'operators',
            'REGISTRY',
            'owner',
            'pendingOwner',
            'guardian',
            'BLS_AGGREGATOR',
        ]);
        expect(names(SUPER_PAYMASTER_PAUSE_ABI, 'event')).toEqual(['OperatorConfigured']);
        expect(names(SUPER_PAYMASTER_PAUSE_ABI, 'error')).toEqual(['OperatorNotConfigured', 'OperatorMeetsMinimumStake']);
        expect(names(REGISTRY_PAUSE_ABI, 'function')).toEqual([
            'hasRole',
            'getRoleConfig',
            'getEffectiveStake',
            'owner',
            'pendingOwner',
            'blsAggregator',
            'isReputationSource',
        ]);
        expect(names(REGISTRY_PAUSE_ABI, 'event')).toEqual(['RoleConfigured']);
    });

    it('ROLE_PAYMASTER_SUPER is keccak256("PAYMASTER_SUPER")', () => {
        expect(ROLE_PAYMASTER_SUPER).toBe('0x2024516755f401845808190bb830b0e4523d0df0845503cab52130a794699a0f');
        expect(ROLE_PAYMASTER_SUPER).toBe(keccak256(toBytes('PAYMASTER_SUPER')));
        expect(PINNED_ROLES.ROLE_PAYMASTER_SUPER).toBe(ROLE_PAYMASTER_SUPER);
        expect(Object.keys(PINNED_ROLES).length).toBeGreaterThan(1);
        expect(Object.isFrozen(PINNED_ROLES)).toBe(true);
    });

    it('a role whose name is not ROLE_ plus the hashed literal throws', () => {
        expect(() => parsePinnedRoles('bytes32 constant ROLE_FOO = keccak256("BAR");')).toThrow(/ROLE_ plus the hashed literal/);
    });

    it('any other ROLE_* shape throws, and an empty set throws', () => {
        expect(() => parsePinnedRoles('bytes32 ROLE_FOO = keccak256("FOO");')).toThrow(/unparsed ROLE_/);
        expect(() => parsePinnedRoles('uint256 constant ROLE_FOO = uint256(1);')).toThrow(/unparsed ROLE_/);
        expect(() => parsePinnedRoles('contract C {}')).toThrow(/no pinned roles/);
    });

    it('comments are stripped before the leftover ROLE_* check', () => {
        const source = [
            'bytes32 constant ROLE_A = keccak256("A");',
            '// bytes32 constant ROLE_HIDDEN = keccak256("HIDDEN");',
            '/* ROLE_BLOCK */',
        ].join('\n');
        expect(stripSolidityComments(source)).not.toContain('ROLE_HIDDEN');
        const roles = parsePinnedRoles(source);
        expect(roles.ROLE_A).toBe(keccak256(toBytes('A')));
        expect(roles.ROLE_HIDDEN).toBeUndefined();
    });
});
