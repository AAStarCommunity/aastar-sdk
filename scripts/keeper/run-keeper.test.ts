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
writeFileSync(join(bin, 'pnpm'), '#!/bin/sh\nfor a in "$@"; do printf "%s\\n" "$a"; done\n');
chmodSync(join(bin, 'pnpm'), 0o755);
afterAll(() => rmSync(dir, { recursive: true, force: true }));

function run(args: string[], key = 'dummy-not-a-key') {
    const r = spawnSync('bash', [join(dir, 'run-keeper.sh'), ...args], {
        cwd: dir,
        encoding: 'utf8',
        env: { PATH: `${bin}:${process.env.PATH}`, HOME: dir, KEEPER_PRIVATE_KEY: key },
    });
    const argv = r.stdout.split('\n').filter((l) => l && !l.startsWith('keeper: '));
    return { status: r.status, stderr: r.stderr, argv };
}

/** Every value passed for `flag`, in order. */
const valuesOf = (argv: string[], flag: string) => argv.flatMap((a, i) => (a === flag ? [argv[i + 1]] : []));

describe('run-keeper.sh argument assembly', () => {
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

    it('no key: refuses unless --dry-run is passed exactly', () => {
        expect(run(['sepolia', '--once'], '').status).toBe(1);
        expect(run(['sepolia', '--once', '--dry-run-lookalike'], '').status).toBe(1);
        expect(run(['sepolia', '--once', '--dry-run'], '').status).toBe(0);
    });
});
