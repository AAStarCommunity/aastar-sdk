import { describe, it, expect } from 'vitest';
import { spawnSync } from 'child_process';
const SPAWN_VERDICT_TIMEOUT_MS = 60_000;

// Daybreak #469 re-run: the CLI accepts exactly the bare --strict; anything else is refused, never read as lenient.
const run = (args: string[]) => spawnSync('pnpm', ['exec', 'tsx', 'scripts/check-sp550-abis.ts', ...args], {
    encoding: 'utf8', env: { ...process.env, SP_REPO: '/nonexistent/sp550-upstream', SP550_OUT: '', REQUIRE_UPSTREAM: '' },
});

describe('check-sp550-abis CLI arguments (exit codes without an upstream checkout)', { timeout: SPAWN_VERDICT_TIMEOUT_MS }, () => {
    it('no argument: SKIP, exit 0 (a local run without the SP checkout)', () => {
        const r = run([]);
        expect(r.status).toBe(0);
        expect(r.stdout + r.stderr).toMatch(/SKIP/);
    }, 60_000);
    it('--strict without the upstream / compiled out/: exit 1', () => {
        expect(run(['--strict']).status).toBe(1);
    }, 60_000);
    it.each([['--strict=false'], ['--stric'], ['--STRICT'], ['strict'], ['--strict', '--strict'], ['--verbose']])('%s: refused, exit 2', (...a) => {
        const r = run(a as string[]);
        expect(r.status).toBe(2);
        expect(r.stderr).toMatch(/unknown argument/);
    }, 60_000);
});
