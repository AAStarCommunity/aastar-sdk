/**
 * Preflight and runtime share one metadata predicate. Neither reads secret bytes.
 */
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { validateSecretFiles } from './castSigner.js';
import { parsePreflightArgs, runPreflight, type PreflightConfig } from './preflight.js';
import { keystoreRefusal, passwordRefusal, type NodeMeta } from './secretMode.js';
import { trustedScratch } from './trustScratch.js';

const SPAWN_VERDICT_TIMEOUT_MS = 30_000;
const SIGNER = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const dirs: string[] = [];

afterEach(() => {
    for (const dir of dirs.splice(0)) {
        try { chmodSync(dir, 0o700); } catch { /* already gone */ }
        rmSync(dir, { recursive: true, force: true });
    }
}, SPAWN_VERDICT_TIMEOUT_MS);

function file(path: string, mode: number): void {
    writeFileSync(path, 'x\n');
    chmodSync(path, mode);
}

function layout(modes: { pwDir?: number; pw?: number; ksDir?: number; ks?: number; pwLink?: boolean } = {}): { root: string; config: PreflightConfig; pw: string; ks: string } {
    const root = trustedScratch('secret-mode');
    dirs.push(root);
    mkdirSync(join(root, 'scripts', 'keeper'), { recursive: true, mode: 0o755 });
    mkdirSync(join(root, 'bin'), { mode: 0o755 });
    mkdirSync(join(root, 'journal'), { mode: 0o700 });
    const pwDir = join(root, 'pw');
    const ksDir = join(root, 'ks');
    mkdirSync(pwDir, { mode: 0o700 });
    mkdirSync(ksDir, { mode: 0o700 });
    file(join(root, 'package.json'), 0o644);
    file(join(root, 'pnpm-lock.yaml'), 0o644);
    file(join(root, 'tsconfig.json'), 0o644);
    file(join(root, 'scripts', 'keeper.ts'), 0o644);
    file(join(root, 'bin', 'node'), 0o755);
    file(join(root, 'bin', 'cast'), 0o755);
    const env = join(root, 'env');
    file(env, 0o600);
    const pw = join(pwDir, 'password');
    const ks = join(ksDir, 'keystore');
    if (modes.pwLink) {
        const other = join(pwDir, 'other');
        file(other, 0o600);
        symlinkSync(other, pw);
    } else {
        file(pw, modes.pw ?? 0o600);
    }
    file(ks, modes.ks ?? 0o600);
    chmodSync(pwDir, modes.pwDir ?? 0o700);
    chmodSync(ksDir, modes.ksDir ?? 0o700);
    chmodSync(join(root, 'journal'), 0o700);
    const config = parsePreflightArgs([
        '--repo', root, '--node', join(root, 'bin', 'node'), '--cast-bin', join(root, 'bin', 'cast'),
        '--journal-dir', join(root, 'journal'), '--env-file', env, '--keystore', ks, '--password-file', pw,
        '--network', 'sepolia', '--signer', SIGNER,
    ]);
    if (!config || config === 'help') throw new Error('fixture args rejected');
    return { root, config, pw, ks };
}

async function agrees(modes: Parameters<typeof layout>[0]): Promise<void> {
    const lay = layout(modes);
    let runtime = true;
    try {
        validateSecretFiles(lay.ks, lay.pw);
    } catch {
        runtime = false;
    }
    const report = await runPreflight(lay.config);
    expect(report.code === 0, report.lines.join('\n')).toBe(runtime);
}

describe('shared secret metadata', { timeout: SPAWN_VERDICT_TIMEOUT_MS }, () => {
    it('preflight matches runtime for password, keystore, symlink, and parent modes', async () => {
        await agrees({});
        await agrees({ pwDir: 0o755 });
        await agrees({ ks: 0o644 });
        await agrees({ pwLink: true });
        await agrees({ ksDir: 0o775 });
    });

    it('rejects keystore modes 0644, 0640, and 0400', () => {
        const uid = process.getuid?.() ?? 1;
        const parent: NodeMeta = { isFile: false, isDirectory: true, isSymbolicLink: false, uid, mode: 0o40700 };
        for (const mode of [0o100644, 0o100640, 0o100400]) {
            const fileMeta: NodeMeta = { isFile: true, isDirectory: false, isSymbolicLink: false, uid, mode };
            expect(keystoreRefusal(fileMeta, parent, uid)).toBe('secret file: keystore mode is not 0600');
        }
        const exact: NodeMeta = { isFile: true, isDirectory: false, isSymbolicLink: false, uid, mode: 0o100600 };
        expect(keystoreRefusal(exact, parent, uid)).toBeNull();
    });

    it('refuses a root-owned secret parent the same way the runtime uid check does', () => {
        const uid = process.getuid?.() ?? 1;
        const fileMeta: NodeMeta = { isFile: true, isDirectory: false, isSymbolicLink: false, uid, mode: 0o100600 };
        const parent: NodeMeta = { isFile: false, isDirectory: true, isSymbolicLink: false, uid: 0, mode: 0o40700 };
        expect(passwordRefusal(fileMeta, parent, uid)).toContain('owner');
        expect(keystoreRefusal(fileMeta, parent, uid)).toContain('owner');
    });

    it('rejects an allow ACL on the password file at runtime', () => {
        if (process.platform !== 'darwin') {
            console.log('SKIP secret acl live');
            return;
        }
        const lay = layout();
        const chmod = spawnSync('/bin/chmod', ['+a', 'group:everyone allow read', lay.pw], { encoding: 'utf8' });
        expect(chmod.status, chmod.stderr).toBe(0);
        expect(() => validateSecretFiles(lay.ks, lay.pw)).toThrow('secret file: acl rejected');
        unlinkSync(lay.pw);
    });
});
