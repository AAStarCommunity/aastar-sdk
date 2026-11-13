/**
 * run-keeper.sh argument assembly: which baked addresses reach keeper.ts for a given command line.
 *
 * The REAL script runs under bash, copied into an empty temp dir (it cds to its own directory, so
 * no .env.<network> file is reachable) with a fake `pnpm` first on PATH that prints its argv and
 * exits. Nothing starts: keeper.ts is never executed.
 *
 * Regression locked down (PR #425 review): a substring grep took --paymaster-missing-alert for
 * --paymaster, so the baked Sepolia V4 was silently dropped and the keeper refreshed a different
 * V4 — the outage this PR fixes, without an alert.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BAKED_V4 = '0x2118e9a404C15F70B1D4f53b400c8a566A5ea4B6';
const dir = mkdtempSync(join(tmpdir(), 'run-keeper-'));
const bin = join(dir, 'bin');
mkdirSync(bin);
copyFileSync(join(process.cwd(), 'run-keeper.sh'), join(dir, 'run-keeper.sh'));
writeFileSync(
    join(bin, 'pnpm'),
    '#!/bin/sh\nenv | grep -E \'^(KEEPER_PRIVATE_KEY|PRIVATE_KEY|RPC_URL|UNLISTED)=\' | sed \'s/^/ENV_/\'\nfor a in "$@"; do printf "%s\\n" "$a"; done\n',
);
writeFileSync(
    join(bin, 'env'),
    '#!/bin/sh\nfor a in "$@"; do printf "ENVARG %s\\n" "$a"; done\nexec /usr/bin/env "$@"\n',
);
chmodSync(join(bin, 'pnpm'), 0o755);
chmodSync(join(bin, 'env'), 0o755);
afterAll(() => rmSync(dir, { recursive: true, force: true }), 30_000);

const SIGN = ['--keystore', '/tmp/ks', '--password-file', '/tmp/pw', '--signer', '0x0000000000000000000000000000000000000001'];

function run(args: string[], opts: { sign?: boolean; env?: NodeJS.ProcessEnv } = {}) {
    const full = opts.sign === false ? args : [...args, ...SIGN];
    const r = spawnSync('bash', [join(dir, 'run-keeper.sh'), ...full], {
        cwd: dir,
        encoding: 'utf8',
        env: { PATH: `${bin}:${process.env.PATH}`, HOME: dir, ...opts.env },
    });
    const lines = r.stdout.split('\n').filter((l) => l && !l.startsWith('keeper: '));
    const envLines = lines.filter((l) => l.startsWith('ENV_'));
    const envArgs = lines.filter((l) => l.startsWith('ENVARG ')).map((l) => l.slice('ENVARG '.length));
    const argv = lines.filter((l) => !l.startsWith('ENV_') && !l.startsWith('ENVARG '));
    return { status: r.status, stderr: r.stderr, stdout: r.stdout, argv, envLines, envArgs };
}

/** Every value passed for `flag`, in order. */
const valuesOf = (argv: string[], flag: string) => argv.flatMap((a, i) => (a === flag ? [argv[i + 1]] : []));

// run() is spawnSync. That blocks the verdict timer the same way execFileSync does. The script
// itself is a short bash run; 30s is the spawn-verdict budget, not a measurement of this file.
const SPAWN_VERDICT_TIMEOUT_MS = 30_000;

describe('run-keeper.sh argument assembly', { timeout: SPAWN_VERDICT_TIMEOUT_MS }, () => {
    it('--paymaster-missing-alert does not suppress the baked V4', () => {
        const r = run(['sepolia', '--paymaster-missing-alert', '600']);
        expect(r.status).toBe(0);
        expect(valuesOf(r.argv, '--paymaster')).toEqual([BAKED_V4]);
        expect(valuesOf(r.argv, '--paymaster-missing-alert')).toEqual(['600']);
    });

    it('--paymaster-operator does not suppress the baked V4', () => {
        const r = run(['sepolia', '--paymaster-operator', '0x00000000000000000000000000000000000000aa']);
        expect(valuesOf(r.argv, '--paymaster')).toEqual([BAKED_V4]);
    });

    it('an explicit --paymaster replaces the baked one', () => {
        const mine = '0x00000000000000000000000000000000000000bb';
        const r = run(['sepolia', '--paymaster', mine]);
        expect(valuesOf(r.argv, '--paymaster')).toEqual([mine]);
    });

    it('an explicit --superpaymaster replaces the baked one', () => {
        const mine = '0x00000000000000000000000000000000000000cc';
        const r = run(['sepolia', '--superpaymaster', mine]);
        expect(valuesOf(r.argv, '--superpaymaster')).toEqual([mine]);
    });

    it('a network with nothing baked starts with no address args (empty array under set -u)', () => {
        const r = run(['op-mainnet', '--once']);
        expect(r.stderr).not.toMatch(/unbound variable/);
        expect(r.status).toBe(0);
        // The fake pnpm really ran (not an early exit 0): it printed the keeper invocation.
        expect(r.argv.slice(0, 5)).toEqual(['exec', 'tsx', 'scripts/keeper.ts', '--network', 'op-mainnet']);
        expect(valuesOf(r.argv, '--paymaster')).toEqual([]);
        expect(valuesOf(r.argv, '--superpaymaster')).toEqual([]);
    });

    it('no keystore flags: refuses unless --dry-run is passed exactly', () => {
        const missing = run(['sepolia', '--once'], { sign: false });
        expect(missing.status).toBe(1);
        expect(missing.stderr).toMatch(/require --keystore/);
        expect(run(['sepolia', '--once', '--keystore', '/tmp/ks'], { sign: false }).status).toBe(1);
        expect(run(['sepolia', '--once', '--dry-run-lookalike'], { sign: false }).status).toBe(1);
        expect(run(['sepolia', '--once', '--dry-run'], { sign: false }).status).toBe(0);
    });

    it('PRIVATE_KEY in .env.sepolia is not read and KEEPER_PRIVATE_KEY is not exported', () => {
        const sentinel = 'not-a-real-key-sentinel';
        writeFileSync(join(dir, '.env.sepolia'), `PRIVATE_KEY=${sentinel}\n`);
        const r = run(['sepolia', '--once']);
        expect(r.status).toBe(0);
        expect(r.stdout).not.toContain(sentinel);
        expect(r.envLines.join('\n')).not.toMatch(/KEEPER_PRIVATE_KEY|PRIVATE_KEY/);
        expect(r.argv).not.toContain(sentinel);
    });

    it('no wrapper-spawned process has a secret on argv', () => {
        const token = 'telegram-token-sentinel';
        const url = 'http://rpc-sentinel.example/secret';
        const leaked = run(['sepolia', '--once', '--dry-run'], {
            sign: false,
            env: { RPC_URL: url, TELEGRAM_BOT_TOKEN: token, TELEGRAM_CHAT_ID: 'chat-sentinel' },
        });
        expect(leaked.status, leaked.stderr).toBe(1);
        expect(leaked.stderr).toMatch(/put it in --env-file/);
        expect(leaked.stdout).not.toContain(token);
        expect(leaked.stdout).not.toContain(url);
        expect(leaked.envArgs).toEqual([]);

        const file = join(dir, 'keeper.env');
        writeFileSync(file, `RPC_URL=${url}\nTELEGRAM_BOT_TOKEN=${token}\nTELEGRAM_CHAT_ID=chat-sentinel\n`);
        const clean = run(['sepolia', '--once', '--dry-run', '--env-file', file], { sign: false });
        expect(clean.status, clean.stderr).toBe(0);
        const spawned = [...clean.envArgs, ...clean.argv, ...clean.envLines].join('\n');
        expect(spawned).not.toContain(token);
        expect(spawned).not.toContain(url);
        expect(spawned).not.toContain('chat-sentinel');
        expect(clean.envArgs[0]).toBe('-i');
        expect(clean.argv.slice(0, 5)).toEqual(['exec', 'tsx', 'scripts/keeper.ts', '--network', 'sepolia']);
    });
});
