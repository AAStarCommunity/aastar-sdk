#!/usr/bin/env tsx
/**
 * CLI entry for the dependency-dedupe gate. **Deliberately holds no logic.**
 *
 * The logic lives in `./dep-dedupe.ts` and is imported by this entry AND by
 * `check-dep-dedupe.test.ts`, so the tested code and the running code are the same code. The
 * previous revision did not have that property: `main()` carried its own inlined copy of the
 * counting loop, and mutating only that copy made the gate print ✅ on a lockfile containing a real
 * duplicate while the test suite reported 5 passed.
 *
 * Run: `pnpm run check:dep-dedupe`
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeLockfile, verdict } from './dep-dedupe.js';

const LOCKFILE = join(resolve(dirname(fileURLToPath(import.meta.url)), '..'), 'pnpm-lock.yaml');

const { ok, lines } = verdict(analyzeLockfile(readFileSync(LOCKFILE, 'utf8')), LOCKFILE);
for (const l of lines) (ok ? console.log : console.error)(l);
if (!ok) process.exit(1);
