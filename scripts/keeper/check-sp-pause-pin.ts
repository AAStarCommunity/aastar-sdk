#!/usr/bin/env tsx
/**
 * Online provenance for the pause-duty ABI pin.
 * Re-pin to the rc.8 tag before deploy (DSR B3).
 *
 * SKIP only when `gh` is missing or not authenticated before the first blob check.
 * A later `gh` failure, or a byte mismatch, prints FAIL and exits 1.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pinCheckDecision, type PinOutcome } from './pinCheck.js';

const PIN = join(dirname(fileURLToPath(import.meta.url)), 'sp-pause-pin', 'pin.json');

interface PinFile {
    path: string;
    blobSha: string;
    local: string;
}
interface Pin {
    repo: string;
    commit: string;
    files: PinFile[];
}

const pin = JSON.parse(readFileSync(PIN, 'utf8')) as Pin;

function ghReady(): boolean {
    try {
        execFileSync('gh', ['auth', 'status'], { stdio: 'ignore', timeout: 20_000 });
        return true;
    } catch {
        return false;
    }
}

const outcomes: PinOutcome[] = [];
const ready = ghReady();
if (ready) {
    for (const file of pin.files) {
        try {
            const raw = execFileSync(
                'gh',
                ['api', `repos/${pin.repo}/contents/${file.path}?ref=${pin.commit}`, '--jq', '.sha'],
                { encoding: 'utf8', timeout: 30_000, stdio: ['ignore', 'pipe', 'pipe'] },
            ).trim();
            outcomes.push(raw === file.blobSha ? 'match' : 'mismatch');
            if (raw === file.blobSha) console.log(`CHECKED ${file.path}`);
        } catch {
            outcomes.push('error');
        }
    }
}

const decision = pinCheckDecision(ready ? 'ready' : 'unready', outcomes);
for (const line of decision.lines) {
    if (decision.exitCode === 0) console.log(line);
    else console.error(line);
}
process.exit(decision.exitCode);
