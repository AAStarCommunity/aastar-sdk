/**
 * Scratch directory for tests that must place an executable outside `/tmp`.
 * `/tmp` is sticky and world-writable, so it cannot be a trusted ancestor.
 */
import { chmodSync, mkdtempSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export function trustedScratch(prefix: string): string {
    const safe = prefix.replace(/[^a-z0-9-]/gi, '').slice(0, 24) || 'scratch';
    const dir = mkdtempSync(join(homedir(), `.aastar-keeper-${safe}-`));
    chmodSync(dir, 0o700);
    return dir;
}
