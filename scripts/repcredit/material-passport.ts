/**
 * The RepCredit evidence bundle's **material passport** — the manifest that says which files ARE the
 * evidence, and what each one hashed to (CC-115 B4b).
 *
 * Extracted from `scripts/repcredit-e2e.ts`, which had both halves inline and therefore untestable:
 * that runner has zero exports and executes at import time, so nothing could exercise the redaction
 * or the passport builder without standing up an entire chain.
 *
 * ## The field list (what a passport entry carries, and why each field is there)
 *
 * | field    | type   | why |
 * |----------|--------|-----|
 * | `path`   | string | **relative to the bundle root**, so a passport stays valid when the bundle is moved or archived. An absolute path would also leak the producing machine's directory layout. |
 * | `bytes`  | number | cheap tamper tripwire — a reader can check it without hashing, and a size change is visible in a directory listing |
 * | `sha256` | string | the actual attestation |
 *
 * ## The ordering property this file exists to protect
 *
 * **Redaction must happen BEFORE hashing.** If the order flips, the passport attests to bytes that no
 * longer exist on disk: every hash describes the pre-redaction file, so a verifier re-hashing the
 * shipped bundle gets a mismatch on every entry — and the natural reading of "all hashes are wrong"
 * is "the bundle was tampered with", not "we hashed the wrong version". A tamper alarm that fires on
 * every honest run is worse than none, because it trains the reader to ignore it.
 *
 * {@link buildMaterialPassport} therefore refuses to build a passport for a file outside the redacted
 * root — see below.
 *
 * ## What the redaction covers, and what it does NOT (state the boundary, do not imply more)
 *
 * `redactSecrets` replaces **exact substring matches** of the secrets it is handed. That is all.
 * It does not, and this is deliberate rather than an omission:
 *
 * - **normalise case** — a key echoed back by a tool in a different case is not matched;
 * - **normalise `0x`** — the same key printed without its prefix is a different string;
 * - **decode encodings** — a URL-encoded or JSON-escaped secret is a different string;
 * - **detect secrets it was not told about** — it is a redactor, not a scanner.
 *
 * The reason to write this down rather than to widen it: every one of those widenings turns redaction
 * into guessing, and a redactor that guesses will eventually mangle evidence (an over-eager `0x`-less
 * match would hit ordinary hex). The narrow contract is honest and testable; the breadth is supposed
 * to come from not putting secrets in the evidence in the first place (`safety.secretsWritten:false`
 * in the manifest, and `parameters.rpcUrl` being written as `[REDACTED]` at construction rather than
 * relying on this pass to find it).
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

/** One line of the passport. See the module doc for why these three fields and no others. */
export interface MaterialPassportEntry {
    /** Path relative to the bundle root. Never absolute. */
    path: string;
    bytes: number;
    sha256: string;
}

export function sha256File(path: string): string {
    return createHash('sha256').update(new Uint8Array(readFileSync(path))).digest('hex');
}

/**
 * Replace every exact occurrence of each secret with `[REDACTED]`, everywhere under `root`, then
 * VERIFY none survives — the verify pass is the point, because a redactor that silently fails is
 * indistinguishable from one that had nothing to do.
 *
 * Empty strings are dropped: an unset secret would otherwise match at every position.
 */
export function redactSecrets(root: string, secrets: readonly string[]): void {
    const active = secrets.filter((s) => s.length > 0);
    if (active.length === 0) return;

    const visit = (dir: string): void => {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
            const child = join(dir, entry.name);
            if (entry.isDirectory()) {
                visit(child);
                continue;
            }
            const original = readFileSync(child, 'utf8');
            let redacted = original;
            for (const secret of active) redacted = redacted.split(secret).join('[REDACTED]');
            if (redacted !== original) writeFileSync(child, redacted);

            // Re-read from disk rather than trusting `redacted`: the assertion is about what the
            // bundle now CONTAINS, not about what we believe we wrote.
            const onDisk = readFileSync(child, 'utf8');
            for (const secret of active) {
                if (onDisk.includes(secret)) throw new Error(`secret remained in evidence file ${child}`);
            }
        }
    };
    visit(root);
}

/**
 * Build the passport for `files`, hashing each as it currently sits on disk.
 *
 * REFUSES any file outside `root`. That is the structural half of the ordering property: redaction
 * walks `root`, so a passport entry from outside it would be attested but never redacted — and it
 * would look exactly like every other entry. This check makes "was it redacted?" answerable from the
 * passport alone.
 */
export function buildMaterialPassport(root: string, files: readonly string[]): MaterialPassportEntry[] {
    const base = resolve(root);
    return files.map((file) => {
        const abs = resolve(file);
        const rel = relative(base, abs);
        if (rel === '' || rel.startsWith('..') || rel.startsWith(`..${sep}`)) {
            throw new Error(
                `material passport: ${abs} is outside the bundle root ${base}. Redaction only walks the ` +
                'root, so this file would be attested without ever having been redacted.',
            );
        }
        return { path: rel.split(sep).join('/'), bytes: statSync(abs).size, sha256: sha256File(abs) };
    });
}

/**
 * The files that ARE the evidence, as bundle-relative paths.
 *
 * Lives here rather than inline in the runner so it has exactly one definition: a second copy in
 * prose (`docs/repcredit-material-passport.md`) is checked against this one by
 * `material-passport.test.ts`. A documented list with no check is the shape FU-45 records — a fact
 * that only survives in someone's memory, and quietly stops matching the code.
 */
export function materialFileList(opts: { isSepolia: boolean; skipMeasurements: boolean }): string[] {
    return [
        'raw/superpaymaster-deployment.json',
        ...(opts.isSepolia ? ['raw/superpaymaster-broadcast.json'] : []),
        'raw/airaccount-deployment.json',
        'raw/network-preflight.json',
        'raw/validator-setup.json',
        'raw/e2e.json',
        'raw/overissue-verifier-broadcast.json',
        'raw/security-controls.json',
        ...(opts.isSepolia ? ['raw/validator-refunds.json'] : []),
        ...(opts.skipMeasurements ? [] : ['raw/measurements.jsonl', 'derived/measurement-summary.json']),
    ];
}
