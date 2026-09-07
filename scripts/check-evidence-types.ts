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
let tscFailed = false;
try {
    out = execFileSync('pnpm', ['exec', 'tsc', '--noEmit', '-p', PROJECT], {
        cwd: repoRoot,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        // Node's default is 1 MiB, and overflowing it TRUNCATES stdout while raising ENOBUFS.
        // Truncation cuts the strict parse and the loose count together, so the ratio guard is
        // structurally blind to it — and the failure direction is inverted: the worse the breakage,
        // the more output, the more likely a green. Measured by review: 60 diagnostics -> red; the
        // same output truncated to 3 -> green. ~9,892 diagnostics would be needed to reach 1 MiB
        // today, hence the generous ceiling rather than a tight one.
        maxBuffer: 64 * 1024 * 1024,
    });
} catch (e: any) {
    // tsc exits non-zero whenever there are diagnostics, which is the NORMAL case here — so a
    // non-zero exit alone says nothing. What does say something is the process not finishing:
    // killed by a signal, or the buffer overflowing. Either way the output is not a measurement.
    out = `${e.stdout ?? ''}${e.stderr ?? ''}`;
    tscFailed = Boolean(e.signal) || e.code === 'ENOBUFS' || typeof e.status !== 'number';
}

const { ok, lines } = verdict(
    parseDiagnostics(out, 'tests/regression/onchain-evidence/'),
    countLooseDiagnostics(out),
    tscFailed,
);
for (const l of lines) (ok ? console.log : console.error)(l);
if (!ok) process.exit(1);
