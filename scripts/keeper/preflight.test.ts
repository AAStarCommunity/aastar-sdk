/**
 * Operator preflight. It stats paths and bind-tests ports. It does not read secrets.
 */
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';

const io = vi.hoisted(() => ({ opens: [] as string[], reads: [] as string[] }));

vi.mock('node:fs', async (importOriginal) => {
    const actual = await importOriginal<typeof import('node:fs')>();
    return {
        ...actual,
        openSync(path: Parameters<typeof actual.openSync>[0], flags: Parameters<typeof actual.openSync>[1]) {
            io.opens.push(String(path));
            return actual.openSync(path, flags);
        },
        readFileSync(...args: Parameters<typeof actual.readFileSync>) {
            io.reads.push(String(args[0]));
            return actual.readFileSync(...args);
        },
    };
});

vi.mock('node:fs/promises', async (importOriginal) => {
    const actual = await importOriginal<typeof import('node:fs/promises')>();
    return {
        ...actual,
        async open(path: Parameters<typeof actual.open>[0], flags?: Parameters<typeof actual.open>[1]) {
            io.opens.push(String(path));
            return actual.open(path, flags);
        },
        async readFile(...args: Parameters<typeof actual.readFile>) {
            io.reads.push(String(args[0]));
            return actual.readFile(...args);
        },
    };
});
import { journalFileLockPort, keeperLockPort } from './journal.js';
import { PREFLIGHT_BANNER, parsePreflightArgs, runPreflight, type PreflightConfig } from './preflight.js';
import { trustedScratch } from './trustScratch.js';

const SPAWN_VERDICT_TIMEOUT_MS = 30_000;
// Not the anvil default. sender and live tests bind that signer lock in parallel.
const SIGNER = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd';
const dirs: string[] = [];

afterEach(() => {
    for (const dir of dirs.splice(0)) {
        try { chmodSync(dir, 0o700); } catch { /* already gone */ }
        rmSync(dir, { recursive: true, force: true });
    }
}, SPAWN_VERDICT_TIMEOUT_MS);

function file(path: string, mode: number, body = 'x\n'): void {
    writeFileSync(path, body);
    chmodSync(path, mode);
}

function layout(): { root: string; config: PreflightConfig } {
    const root = trustedScratch('preflight');
    dirs.push(root);
    mkdirSync(join(root, 'scripts', 'keeper'), { recursive: true, mode: 0o755 });
    mkdirSync(join(root, 'packages', 'core', 'src'), { recursive: true, mode: 0o755 });
    mkdirSync(join(root, 'node_modules', 'pkg', 'nested'), { recursive: true, mode: 0o755 });
    mkdirSync(join(root, 'secrets'), { mode: 0o700 });
    mkdirSync(join(root, 'journal'), { mode: 0o700 });
    mkdirSync(join(root, 'bin'), { mode: 0o755 });
    file(join(root, 'package.json'), 0o644, '{}\n');
    file(join(root, 'pnpm-lock.yaml'), 0o644, 'lockfileVersion: 9\n');
    file(join(root, 'tsconfig.json'), 0o644, '{}\n');
    file(join(root, 'config.sepolia.json'), 0o644, '{}\n');
    file(join(root, 'scripts', 'keeper.ts'), 0o644);
    file(join(root, 'scripts', 'keeper', 'note.ts'), 0o644);
    file(join(root, 'packages', 'core', 'src', 'index.ts'), 0o644);
    file(join(root, 'node_modules', 'pkg', 'nested', 'ok.js'), 0o644);
    file(join(root, 'secrets', 'env'), 0o600);
    file(join(root, 'secrets', 'keystore'), 0o600, '{}\n');
    file(join(root, 'secrets', 'password'), 0o600);
    file(join(root, 'bin', 'node'), 0o755, '#!/bin/sh\nexit 0\n');
    file(join(root, 'bin', 'cast'), 0o755, '#!/bin/sh\nexit 0\n');
    chmodSync(join(root, 'secrets'), 0o700);
    const config = parsePreflightArgs([
        '--repo', root,
        '--node', join(root, 'bin', 'node'),
        '--cast-bin', join(root, 'bin', 'cast'),
        '--journal-dir', join(root, 'journal'),
        '--env-file', join(root, 'secrets', 'env'),
        '--keystore', join(root, 'secrets', 'keystore'),
        '--password-file', join(root, 'secrets', 'password'),
        '--network', 'sepolia',
        '--signer', SIGNER,
    ]);
    if (!config || config === 'help') throw new Error('fixture args rejected');
    return { root, config };
}

function listen(port: number): Promise<Server> {
    const server = createServer();
    return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen({ port, host: '127.0.0.1', exclusive: true }, () => resolve(server));
    });
}

describe('preflight', { timeout: SPAWN_VERDICT_TIMEOUT_MS }, () => {
    it('passes a clean layout and prints the banner from --help', async () => {
        const { config } = layout();
        const report = await runPreflight(config);
        expect(report.code, report.lines.join('\n')).toBe(0);
        expect(report.lines.every((line) => line.startsWith('PASS '))).toBe(true);
        const help = spawnSync(process.execPath, [
            '--import', pathToFileURL(join(process.cwd(), 'node_modules', 'tsx', 'dist', 'loader.mjs')).href,
            join(process.cwd(), 'scripts', 'keeper', 'preflight.ts'),
            '--help',
        ], { encoding: 'utf8' });
        expect(help.status, help.stderr).toBe(0);
        expect(help.stdout.split('\n')[0]).toBe(PREFLIGHT_BANNER);
    });

    it('fails a group-writable file deep in node_modules', async () => {
        const { root, config } = layout();
        const bad = join(root, 'node_modules', 'pkg', 'nested', 'bad.js');
        file(bad, 0o664);
        const report = await runPreflight(config);
        expect(report.code).toBe(1);
        expect(report.lines.some((line) => line.includes('node_modules/pkg/nested/bad.js') && line.includes('writable'))).toBe(true);
    });

    it('follows a directory symlink and fails a group-writable file in the target', async () => {
        const { root, config } = layout();
        const outside = join(root, 'outside');
        mkdirSync(outside, { mode: 0o755 });
        file(join(outside, 'bad.js'), 0o664);
        symlinkSync(outside, join(root, 'node_modules', 'ext'));
        const report = await runPreflight(config);
        expect(report.code).toBe(1);
        expect(report.lines.some((line) => line.includes('bad.js') && line.includes('writable'))).toBe(true);
    });

    it('fails a writable ancestor and does not report success', async () => {
        const { root, config } = layout();
        chmodSync(root, 0o777);
        try {
            const report = await runPreflight(config);
            expect(report.code).toBe(1);
            expect(report.lines.some((line) => line.startsWith('FAIL ') && line.includes('ancestor'))).toBe(true);
            expect(report.lines.some((line) => line === 'PASS node_modules' && report.code === 0)).toBe(false);
        } finally {
            chmodSync(root, 0o700);
        }
    });

    it('fails a 0644 password file', async () => {
        const { root, config } = layout();
        chmodSync(join(root, 'secrets', 'password'), 0o644);
        const report = await runPreflight(config);
        expect(report.code).toBe(1);
        expect(report.lines.some((line) => line.includes('password') && line.includes('mode'))).toBe(true);
    });

    it('fails when the signer lock port is busy and then releases it', async () => {
        const { config } = layout();
        const port = keeperLockPort(config.chainId, SIGNER);
        const server = await listen(port);
        try {
            const report = await runPreflight(config);
            expect(report.code).toBe(1);
            expect(report.lines.some((line) => line.startsWith('FAIL signer-lock busy'))).toBe(true);
        } finally {
            await new Promise<void>((resolve) => server.close(() => resolve()));
        }
        const again = await runPreflight(config);
        expect(again.lines.some((line) => line === 'PASS signer-lock')).toBe(true);
    });

    it('fails the journal lock when that port is busy', async () => {
        const { root, config } = layout();
        const journalFile = join(realpathSync(join(root, 'journal')), 'sepolia.journal.json');
        const server = await listen(journalFileLockPort(journalFile));
        try {
            const report = await runPreflight(config);
            expect(report.code).toBe(1);
            expect(report.lines.some((line) => line.startsWith('FAIL journal-lock busy'))).toBe(true);
        } finally {
            await new Promise<void>((resolve) => server.close(() => resolve()));
        }
    });

    it('does not open keystore, password, or env contents', async () => {
        const { root, config } = layout();
        const secrets = ['env', 'keystore', 'password'].map((name) => join(root, 'secrets', name));
        io.opens.length = 0;
        io.reads.length = 0;
        const report = await runPreflight(config);
        expect(report.code, report.lines.join('\n')).toBe(0);
        const touched = [...io.opens, ...io.reads];
        for (const secret of secrets) expect(touched).not.toContain(secret);
    });

    it('fails when the walk exceeds the entry cap', async () => {
        const { root } = layout();
        const parsed = parsePreflightArgs([
            '--repo', root,
            '--node', join(root, 'bin', 'node'),
            '--cast-bin', join(root, 'bin', 'cast'),
            '--journal-dir', join(root, 'journal'),
            '--env-file', join(root, 'secrets', 'env'),
            '--keystore', join(root, 'secrets', 'keystore'),
            '--password-file', join(root, 'secrets', 'password'),
            '--network', 'sepolia',
            '--signer', SIGNER,
        ], 2);
        if (!parsed || parsed === 'help') throw new Error('fixture args rejected');
        const report = await runPreflight(parsed);
        expect(report.code).toBe(1);
        expect(report.lines.some((line) => line.startsWith('FAIL entry-cap too many'))).toBe(true);
    });

    it('rejects a non-absolute path and a bad signer before any walk, without echoing the value', () => {
        const sentinel = 'password-sentinel';
        expect(parsePreflightArgs(['--repo', sentinel])).toBeNull();
        expect(parsePreflightArgs([
            '--repo', '/repo', '--node', '/node', '--cast-bin', '/cast', '--journal-dir', '/journal',
            '--env-file', '/env', '--keystore', '/ks', '--password-file', '/pw',
            '--network', 'sepolia', '--signer', sentinel,
        ])).toBeNull();
        const home = mkdtempSync(join(tmpdir(), 'preflight-args-'));
        dirs.push(home);
        const bad = spawnSync(process.execPath, [
            '--import', pathToFileURL(join(process.cwd(), 'node_modules', 'tsx', 'dist', 'loader.mjs')).href,
            join(process.cwd(), 'scripts', 'keeper', 'preflight.ts'),
            '--signer', sentinel,
        ], { encoding: 'utf8' });
        expect(bad.status).toBe(1);
        expect(bad.stdout.split('\n')[0]).toBe(PREFLIGHT_BANNER);
        expect(bad.stdout).toContain('FAIL arguments');
        expect(bad.stdout).not.toContain(sentinel);
    });
});
