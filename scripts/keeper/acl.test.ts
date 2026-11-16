/**
 * ACL listings from `ls -led`. The live check is metadata only.
 */
import { spawnSync } from 'node:child_process';
import { chmodSync, rmSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { aclAllowsOthers, aclListingAllowsOthers } from './acl.js';
import { trustedScratch } from './trustScratch.js';

const SPAWN_VERDICT_TIMEOUT_MS = 30_000;
const dirs: string[] = [];

afterEach(() => {
    for (const dir of dirs.splice(0)) {
        try { chmodSync(dir, 0o700); } catch { /* already gone */ }
        rmSync(dir, { recursive: true, force: true });
    }
}, SPAWN_VERDICT_TIMEOUT_MS);

const LISTING = 'drwx------  2 jane staff 64 Nov 14 12:00 scratch';

describe('acl listings', { timeout: SPAWN_VERDICT_TIMEOUT_MS }, () => {
    it('passes a deny-only home entry and fails allow, inherited allow, and garbage', () => {
        expect(aclListingAllowsOthers(`${LISTING}\n 0: group:everyone deny delete\n`)).toBe(false);
        expect(aclListingAllowsOthers(`${LISTING}\n`)).toBe(false);
        expect(aclListingAllowsOthers(`${LISTING}\n 0: user:bob allow read\n`)).toBe(true);
        expect(aclListingAllowsOthers(`${LISTING}\n 1: group:staff inherited allow write,append\n`)).toBe(true);
        expect(aclListingAllowsOthers('not an ls listing\n')).toBe(true);
        expect(aclListingAllowsOthers('')).toBe(true);
    });

    it('parses ls -led of a trusted scratch directory', () => {
        if (process.platform !== 'darwin') {
            console.log('SKIP acl live ls');
            expect(aclAllowsOthers('/tmp/keeper-acl-non-darwin')).toBe(false);
            return;
        }
        const dir = trustedScratch('acl');
        dirs.push(dir);
        const listed = spawnSync('/bin/ls', ['-led', dir], { encoding: 'utf8', shell: false });
        expect(listed.status, listed.stderr).toBe(0);
        expect(aclListingAllowsOthers(listed.stdout)).toBe(false);
        expect(aclAllowsOthers(dir)).toBe(false);
    });
});
