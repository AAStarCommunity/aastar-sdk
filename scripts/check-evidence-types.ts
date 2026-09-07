#!/usr/bin/env tsx
/**
 * CLI entry for the evidence-runner typecheck gate. **Deliberately holds no logic** — see
 * `./evidence-types.ts`, which the test imports too, so the tested code is the running code.
 *
 * Run: `pnpm run check:evidence-types`
 */
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { countLooseDiagnostics, parseDiagnostics, verdict } from './evidence-types.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PROJECT = 'tests/regression/onchain-evidence/tsconfig.json';

let out = '';
try {
    out = execFileSync('pnpm', ['exec', 'tsc', '--noEmit', '-p', PROJECT], {
        cwd: repoRoot,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
    });
} catch (e: any) {
    // tsc exits non-zero whenever there are diagnostics, which is the normal case here.
    out = `${e.stdout ?? ''}${e.stderr ?? ''}`;
}

const { ok, lines } = verdict(parseDiagnostics(out, 'tests/regression/onchain-evidence/'), countLooseDiagnostics(out));
for (const l of lines) (ok ? console.log : console.error)(l);
if (!ok) process.exit(1);
