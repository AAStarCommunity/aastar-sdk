/**
 * The code a live keeper loads must sit inside the same trust check as the binaries.
 * Fixtures stay in trustedScratch: /tmp is sticky and cannot be an ancestor.
 */
import { chmodSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { verifyModuleTree } from './moduleTree.js';
import { trustedScratch } from './trustScratch.js';

const dirs: string[] = [];
afterEach(() => {
    for (const dir of dirs.splice(0)) {
        try { chmodSync(dir, 0o700); } catch { /* already gone */ }
        rmSync(dir, { recursive: true, force: true });
    }
});

function scratch(prefix: string): string {
    const dir = trustedScratch(prefix);
    dirs.push(dir);
    return dir;
}

/** mkdir and force 0755. Node's recursive mkdir applies the mode to the leaf only. */
function ensureDir(dir: string, stop: string): void {
    mkdirSync(dir, { recursive: true });
    let cursor = dir;
    while (cursor.startsWith(stop) && cursor.length >= stop.length) {
        chmodSync(cursor, 0o755);
        if (cursor === stop) break;
        const parent = dirname(cursor);
        if (parent === cursor) break;
        cursor = parent;
    }
}

function repo(): string {
    const root = scratch('modules');
    writeFileSync(join(root, 'package.json'), '{}\n', { mode: 0o644 });
    writeFileSync(join(root, 'pnpm-lock.yaml'), 'lockfileVersion: 9\n', { mode: 0o644 });
    ensureDir(join(root, 'node_modules'), root);
    return root;
}

function file(root: string, rel: string, mode: number): string {
    const full = join(root, rel);
    ensureDir(dirname(full), root);
    writeFileSync(full, 'export {}\n', { mode });
    chmodSync(full, mode);
    return full;
}

describe('module tree', () => {
    it('refuses a group-writable file deep in node_modules', () => {
        const root = repo();
        file(root, 'node_modules/pkg/nested/bad.js', 0o664);
        expect(() => verifyModuleTree(root)).toThrow(
            'keeper: modules refused: writable: node_modules/pkg/nested/bad.js',
        );
        try {
            verifyModuleTree(root);
        } catch (error) {
            const message = error instanceof Error ? error.message : '';
            expect(message).not.toContain(root);
        }
    });

    it('refuses a symlink whose target outside the repo is group-writable', () => {
        const root = repo();
        const outside = scratch('outside');
        const hidden = join(outside, 'password-sentinel');
        ensureDir(hidden, outside);
        chmodSync(hidden, 0o700);
        const payload = join(hidden, 'payload.js');
        writeFileSync(payload, 'export {}\n', { mode: 0o666 });
        chmodSync(payload, 0o666);
        symlinkSync(payload, join(root, 'node_modules', 'escape.js'));
        let message = '';
        try {
            verifyModuleTree(root);
        } catch (error) {
            message = error instanceof Error ? error.message : '';
        }
        expect(message).toBe('keeper: modules refused: writable: node_modules/escape.js');
        expect(message).not.toContain('password-sentinel');
        expect(message).not.toContain(outside);
        expect(message).not.toContain(payload);
    });

    it('passes a clean tree including a symlink to a trusted file outside the repo', () => {
        const root = repo();
        file(root, 'node_modules/pkg/nested/ok.js', 0o644);
        const outside = scratch('outside');
        const payload = join(outside, 'ok.js');
        writeFileSync(payload, 'export {}\n', { mode: 0o644 });
        chmodSync(payload, 0o644);
        symlinkSync(payload, join(root, 'node_modules', 'linked.js'));
        expect(() => verifyModuleTree(root)).not.toThrow();
    });

    it('refuses when the walk exceeds the entry cap', () => {
        const root = repo();
        file(root, 'node_modules/a.js', 0o644);
        file(root, 'node_modules/b.js', 0o644);
        expect(() => verifyModuleTree(root, { maxEntries: 2 })).toThrow(
            'keeper: modules refused: module tree too large to verify',
        );
        try {
            verifyModuleTree(root, { maxEntries: 2 });
        } catch (error) {
            const message = error instanceof Error ? error.message : '';
            expect(message).toBe('keeper: modules refused: module tree too large to verify');
            expect(message).not.toContain(root);
        }
    });

    it('live startup verifies the module tree before the env file, keystore, or cast', () => {
        const src = readFileSync(new URL('../keeper.ts', import.meta.url), 'utf8');
        const call = src.indexOf('if (!dryRun) verifyModuleTree(');
        const secrets = src.indexOf('secretEnvNames(process.env)');
        const envFile = src.indexOf('await readKeeperEnvFile(envFile)');
        const cast = src.indexOf('resolveCastBin(castChosen, castSource)');
        const signer = src.indexOf('createCastSigner(');
        expect(call).toBeGreaterThan(-1);
        expect(secrets).toBeGreaterThan(call);
        expect(envFile).toBeGreaterThan(call);
        expect(cast).toBeGreaterThan(call);
        expect(signer).toBeGreaterThan(call);
    });
});
