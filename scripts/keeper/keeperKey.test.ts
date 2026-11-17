import { afterAll, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { keeperKeyFrom, keeperKeyProblem } from './keeperKey.js';

// This file spawns keeper.ts below; every top-level block states its timeout (check:spawn-timeouts).
const SPAWN_VERDICT_TIMEOUT_MS = 60_000;

// anvil account #0: a public test key, never a real one.
const ANVIL0 = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

describe('keeper signing key: KEEPER_PRIVATE_KEY only', { timeout: SPAWN_VERDICT_TIMEOUT_MS }, () => {
    it('ignores PRIVATE_KEY_SUPPLIER and PRIVATE_KEY (the deployer on Sepolia)', () => {
        expect(keeperKeyFrom({ PRIVATE_KEY_SUPPLIER: ANVIL0 })).toBeUndefined();
        expect(keeperKeyFrom({ PRIVATE_KEY: ANVIL0, PRIVATE_KEY_JASON: ANVIL0 })).toBeUndefined();
        expect(keeperKeyFrom({ KEEPER_PRIVATE_KEY: '' , PRIVATE_KEY_SUPPLIER: ANVIL0 })).toBeUndefined();
        expect(keeperKeyFrom({ KEEPER_PRIVATE_KEY: ANVIL0, PRIVATE_KEY_SUPPLIER: '0x01' })).toBe(ANVIL0);
    });

    it('privateKey mode without KEEPER_PRIVATE_KEY refuses at startup unless it is a dry run', () => {
        expect(keeperKeyProblem({ mode: 'privateKey', dryRun: false, key: undefined })).toMatch(/requires KEEPER_PRIVATE_KEY/);
        expect(keeperKeyProblem({ mode: 'privateKey', dryRun: true, key: undefined })).toBeNull();
        expect(keeperKeyProblem({ mode: 'privateKey', dryRun: false, key: ANVIL0 })).toBeNull();
        expect(keeperKeyProblem({ mode: 'cast', dryRun: false, key: undefined })).toBeNull();
    });
});

// keeper.ts itself: spawned in an empty temp dir (its .env.<network> is read from the cwd, so the real
// repo files are out of reach), RPC on a closed local port. The refusal must come before any network read.
const dir = mkdtempSync(join(tmpdir(), 'keeper-key-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }), SPAWN_VERDICT_TIMEOUT_MS);

function keeper(args: string[], env: Record<string, string> = {}) {
    const r = spawnSync(join(process.cwd(), 'node_modules/.bin/tsx'), [join(process.cwd(), 'scripts/keeper.ts'), ...args], {
        cwd: dir, encoding: 'utf8', timeout: SPAWN_VERDICT_TIMEOUT_MS - 5_000,
        env: { PATH: process.env.PATH!, HOME: dir, RPC_URL: 'http://127.0.0.1:9', ...env },
    });
    return { status: r.status, out: `${r.stdout}${r.stderr}` };
}

describe('keeper.ts refuses without KEEPER_PRIVATE_KEY, even when .env.<network> has the deployer keys', { timeout: SPAWN_VERDICT_TIMEOUT_MS }, () => {
    it('a dotenv-loaded PRIVATE_KEY_SUPPLIER / PRIVATE_KEY is not used', () => {
        const key = ANVIL0.slice(2);
        writeFileSync(join(dir, '.env.anvil'), `PRIVATE_KEY=0x${key}\nPRIVATE_KEY_SUPPLIER=0x${key}\n`);
        const r = keeper(['--network', 'anvil', '--once']);
        expect(r.status).toBe(1);
        expect(r.out).toMatch(/privateKey mode requires KEEPER_PRIVATE_KEY/);
        expect(r.out).not.toContain(key);
        // A dry run gets past the key check (it then fails on the closed RPC port, which is fine).
        expect(keeper(['--network', 'anvil', '--once', '--dry-run']).out).not.toMatch(/requires KEEPER_PRIVATE_KEY/);
    });
});
