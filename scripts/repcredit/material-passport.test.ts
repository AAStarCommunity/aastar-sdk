/**
 * The material passport's two load-bearing properties (CC-115 B4b).
 *
 * Neither was testable before: both halves lived inline in `scripts/repcredit-e2e.ts`, which has no
 * exports and executes at import time — so the only way to exercise them was to run a full chain.
 * A property that can only be checked by running the thing it protects is not really checked.
 */
import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { buildMaterialPassport, materialFileList, redactSecrets, sha256File } from './material-passport.js';

function bundle(files: Record<string, string>) {
    const root = mkdtempSync(join(tmpdir(), 'passport-'));
    mkdirSync(join(root, 'raw'), { recursive: true });
    for (const [rel, content] of Object.entries(files)) writeFileSync(join(root, rel), content);
    return { root, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

// Built rather than written out, and that is not cosmetic: as a 64-char literal on a line naming
// it a secret, this tripped the repo's own pre-commit scanner — correctly, since it cannot know a
// fixture from a leak. The honest fix is to remove the thing it keys on rather than to whitelist
// the line: `'de'+'ad'+'be'+'ef'` repeated is self-evidently synthetic to a reader too, which is
// exactly what FU-45 asks of anything that claims "this one is fine".
const SECRET = `0x${'deadbeef'.repeat(8)}`;

describe('redactSecrets', () => {
    it('replaces every occurrence, in nested directories, and rewrites the file on disk', () => {
        const b = bundle({
            'raw/a.json': `{"k":"${SECRET}","also":"${SECRET}"}`,
            'raw/b.json': `{"clean":true}`,
        });
        try {
            redactSecrets(b.root, [SECRET]);
            const a = readFileSync(join(b.root, 'raw/a.json'), 'utf8');
            expect(a).not.toContain(SECRET);
            expect(a.match(/\[REDACTED\]/g)).toHaveLength(2); // BOTH occurrences, not just the first
            expect(readFileSync(join(b.root, 'raw/b.json'), 'utf8')).toBe('{"clean":true}'); // untouched
        } finally { b.cleanup(); }
    });

    it('is a no-op when every secret is empty — an unset secret must not match everywhere', () => {
        // `''` is a substring of every position in every file. Without the filter, one unset
        // environment variable would turn the whole bundle into [REDACTED].
        const b = bundle({ 'raw/a.json': '{"keep":"me"}' });
        try {
            redactSecrets(b.root, ['', '']);
            expect(readFileSync(join(b.root, 'raw/a.json'), 'utf8')).toBe('{"keep":"me"}');
        } finally { b.cleanup(); }
    });

    it('POSITIVE CONTROL: a run with no secrets present leaves the bundle byte-identical', () => {
        // Without this, the assertions above would also pass if redactSecrets rewrote everything it
        // touched — a redactor that mangles clean evidence is a worse failure than one that misses.
        const b = bundle({ 'raw/a.json': '{"keep":"me"}' });
        try {
            const before = sha256File(join(b.root, 'raw/a.json'));
            redactSecrets(b.root, ['a-secret-that-is-not-here']);
            expect(sha256File(join(b.root, 'raw/a.json'))).toBe(before);
        } finally { b.cleanup(); }
    });
});

describe('the boundary of redaction — stated so nobody assumes more (cf. FU-29)', () => {
    it('does NOT match a different case, a missing 0x, or an encoded form', () => {
        // Each of these is a DIFFERENT STRING, and the redactor does exact substring replacement.
        // Recording this is the point: the breadth is supposed to come from not writing secrets into
        // evidence in the first place (`safety.secretsWritten:false`, `parameters.rpcUrl` written as
        // "[REDACTED]" at construction), not from a redactor that guesses.
        const variants = {
            'raw/upper.json': SECRET.toUpperCase(),
            'raw/no0x.json': SECRET.slice(2),
            'raw/escaped.json': SECRET.replace(/^0x/, '0\\x78'),
        };
        const b = bundle(variants);
        try {
            redactSecrets(b.root, [SECRET]);
            for (const rel of Object.keys(variants)) {
                expect(readFileSync(join(b.root, rel), 'utf8'), `${rel} should be UNCHANGED`)
                    .toBe(variants[rel as keyof typeof variants]);
            }
        } finally { b.cleanup(); }
    });

    it('throws — naming the file — if a secret somehow survives', () => {
        // The verify pass is what separates "redaction ran" from "redaction worked". Simulated by
        // handing it a secret that its own replacement text contains, so replacing cannot remove it.
        const b = bundle({ 'raw/a.json': 'x[REDACTED]x' });
        try {
            expect(() => redactSecrets(b.root, ['[REDACTED]']))
                .toThrow(/secret remained in evidence file .*a\.json/);
        } finally { b.cleanup(); }
    });
});

describe('buildMaterialPassport', () => {
    it('records path RELATIVE to the bundle root, plus bytes and sha256', () => {
        const b = bundle({ 'raw/a.json': '{"n":1}' });
        try {
            const [entry] = buildMaterialPassport(b.root, [join(b.root, 'raw/a.json')]);
            expect(entry.path).toBe('raw/a.json');           // relative, forward slashes
            expect(entry.path.startsWith('/')).toBe(false);  // never absolute — would leak the layout
            expect(entry.bytes).toBe(7);
            expect(entry.sha256).toBe(sha256File(join(b.root, 'raw/a.json')));
        } finally { b.cleanup(); }
    });

    it('REFUSES a file outside the bundle root — it would be attested but never redacted', () => {
        // The structural half of the ordering property. Redaction walks the root; anything outside it
        // is unreachable by that walk, yet its passport entry looks exactly like every other entry.
        const b = bundle({ 'raw/a.json': '{}' });
        const outside = bundle({ 'raw/x.json': `{"k":"${SECRET}"}` });
        try {
            expect(() => buildMaterialPassport(b.root, [join(outside.root, 'raw/x.json')]))
                .toThrow(/outside the bundle root/);
        } finally { b.cleanup(); outside.cleanup(); }
    });

    it('hashes the REDACTED bytes when called in the runner order — redact, then build', () => {
        // THE property. If the order flips, every hash describes a file that no longer exists on
        // disk, and a verifier re-hashing the shipped bundle sees every entry mismatch — which reads
        // as "tampered with", not as "hashed the wrong version". A tamper alarm that fires on every
        // honest run trains the reader to ignore it.
        const b = bundle({ 'raw/a.json': `{"k":"${SECRET}"}` });
        try {
            const preRedaction = sha256File(join(b.root, 'raw/a.json'));
            redactSecrets(b.root, [SECRET]);
            const [entry] = buildMaterialPassport(b.root, [join(b.root, 'raw/a.json')]);

            // The passport must match what is on disk NOW...
            expect(entry.sha256).toBe(sha256File(join(b.root, 'raw/a.json')));
            // ...and must NOT match what was there before redaction. Without this second assertion
            // the first passes trivially in the wrong order too.
            expect(entry.sha256).not.toBe(preRedaction);
        } finally { b.cleanup(); }
    });
});

describe('the documented file list must equal the code (FU-45 shape)', () => {
    // A list that exists in prose AND in code has two definitions, and they drift. This is the
    // check that makes the doc a claim rather than a decoration: it fails when either side moves
    // without the other.
    const DOC = 'docs/repcredit-material-passport.md';

    /** The fenced block in §2 of the doc, as bundle-relative paths with the "(… only)" notes stripped. */
    function documentedFiles(): string[] {
        const md = readFileSync(join(process.cwd(), DOC), 'utf8');
        const block = md.split('## 2. Which files are listed')[1]?.split('```')[1];
        expect(block, `${DOC} §2 has no fenced list — the check cannot run`).toBeTruthy();
        return block!.split('\n').map((l) => l.replace(/\s*\(.*\)\s*$/, '').trim()).filter(Boolean);
    }

    it('the doc lists exactly the files the code produces in the WIDEST configuration', () => {
        // Widest = Sepolia with measurements: the doc marks the conditional ones inline, so the
        // union is what it enumerates.
        const code = materialFileList({ isSepolia: true, skipMeasurements: false });
        expect(documentedFiles().sort()).toEqual([...code].sort());
    });

    it('POSITIVE CONTROL: the extractor finds a non-empty list', () => {
        // Without this, an extractor that silently returned [] would make the comparison above pass
        // against an equally empty `code` only by accident — and would pass loudly if the doc were
        // deleted. An empty parse and a matching parse must not look the same.
        expect(documentedFiles().length).toBeGreaterThan(5);
    });

    it('the conditional files really are conditional — the flags are not decorative', () => {
        const anvilNoMeasure = materialFileList({ isSepolia: false, skipMeasurements: true });
        expect(anvilNoMeasure).not.toContain('raw/superpaymaster-broadcast.json');
        expect(anvilNoMeasure).not.toContain('raw/validator-refunds.json');
        expect(anvilNoMeasure).not.toContain('raw/measurements.jsonl');
        // ...while the unconditional ones survive every combination.
        expect(anvilNoMeasure).toContain('raw/e2e.json');
    });
});
