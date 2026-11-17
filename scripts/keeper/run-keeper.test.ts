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
copyFileSync(join(process.cwd(), 'run-keeper-main.sh'), join(dir, 'run-keeper-main.sh'));
writeFileSync(join(bin, 'pnpm'), '#!/bin/sh\nfor a in "$@"; do printf "%s\\n" "$a"; done\nprintf "KEY_SET=%s\\n" "${KEEPER_PRIVATE_KEY:+yes}"\n');
chmodSync(join(bin, 'pnpm'), 0o755);
afterAll(() => rmSync(dir, { recursive: true, force: true }), 30_000);

function run(args: string[], key = 'dummy-not-a-key') {
    const r = spawnSync('bash', [join(dir, 'run-keeper.sh'), ...args], {
        cwd: dir,
        encoding: 'utf8',
        env: { PATH: `${bin}:${process.env.PATH}`, HOME: dir, KEEPER_PRIVATE_KEY: key },
    });
    const lines = r.stdout.split('\n');
    const argv = lines.filter((l) => l && !l.startsWith('keeper: ') && !l.startsWith('KEY_SET='));
    const keySet = lines.find((l) => l.startsWith('KEY_SET='))?.slice('KEY_SET='.length);
    return { status: r.status, stderr: r.stderr, stdout: r.stdout, argv, keySet };
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

    it('never reads PRIVATE_KEY from .env.<network> and never exports a key (keeper.ts decides)', () => {
        // anvil account #0: a public test key standing in for the deployer's.
        const deployerish = 'ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
        writeFileSync(join(dir, '.env.sepolia'), `PRIVATE_KEY=0x${deployerish}\nPRIVATE_KEY_SUPPLIER=0x${deployerish}\n`);
        try {
            for (const args of [['sepolia', '--once'], ['sepolia', '--once', '--dry-run'], ['sepolia', '--mode', 'cast', '--cast-account', 'keeper']]) {
                const r = run(args, '');
                expect(r.status).toBe(0);
                expect(r.argv.slice(0, 3)).toEqual(['exec', 'tsx', 'scripts/keeper.ts']);
                expect(r.keySet).toBe(''); // nothing put KEEPER_PRIVATE_KEY into the child's environment
                expect(`${r.stdout}${r.stderr}`).not.toContain(deployerish);
            }
            // A key the caller exports is passed through unchanged; it is the only way one gets in.
            expect(run(['sepolia', '--once']).keySet).toBe('yes');
        } finally {
            rmSync(join(dir, '.env.sepolia'), { force: true });
        }
    });

    it('run-keeper-main.sh has no default cast account (it used to be optimism-deployer)', () => {
        const main = (env: Record<string, string>) => spawnSync('bash', [join(dir, 'run-keeper-main.sh')], {
            cwd: dir, encoding: 'utf8', env: { PATH: `${bin}:${process.env.PATH}`, HOME: dir, ...env },
        });
        const refused = main({});
        expect(refused.status).toBe(1);
        expect(refused.stderr).toMatch(/KEEPER_CAST_ACCOUNT/);
        expect(refused.stdout).toBe(''); // keeper.ts never started
        const ok = main({ KEEPER_CAST_ACCOUNT: 'keeper' });
        expect(ok.status).toBe(0);
        const argv = ok.stdout.split('\n');
        expect(valuesOf(argv, '--cast-account')).toEqual(['keeper']);
        expect(ok.stdout).not.toContain('optimism-deployer');
    });

    it('a caller flag replaces the launcher default instead of repeating it (keeper.ts refuses repeats)', () => {
        const r = run(['sepolia', '--poll-interval', '60', '--volatility-cooldown', '5']);
        expect(r.status).toBe(0);
        expect(valuesOf(r.argv, '--poll-interval')).toEqual(['60']);
        expect(valuesOf(r.argv, '--volatility-cooldown')).toEqual(['5']);
        expect(valuesOf(r.argv, '--safety-margin')).toEqual(['600']); // untouched defaults still present once
        const flags = r.argv.filter((a) => a.startsWith('--'));
        expect(new Set(flags).size).toBe(flags.length);
        const main = spawnSync('bash', [join(dir, 'run-keeper-main.sh'), '--poll-interval', '60'], {
            cwd: dir, encoding: 'utf8', env: { PATH: `${bin}:${process.env.PATH}`, HOME: dir, KEEPER_CAST_ACCOUNT: 'keeper' },
        });
        expect(main.status).toBe(0);
        const mainArgv = main.stdout.split('\n');
        expect(valuesOf(mainArgv, '--poll-interval')).toEqual(['60']);
        const mainFlags = mainArgv.filter((a) => a.startsWith('--'));
        expect(new Set(mainFlags).size).toBe(mainFlags.length);
    });
});
