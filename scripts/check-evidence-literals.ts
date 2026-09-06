#!/usr/bin/env tsx
/**
 * An address written into a PASS line is a claim that nothing checks.
 *
 * ## The defect
 *
 * `tests/regression/onchain-evidence/dvt-onboard-e2e.ts` ended every successful run with:
 *
 * ```
 * ✅✅ CC-36 E2E PASS — onboardDvtNode proven on live Sepolia 0x539B (idempotent + full 代付 flow).
 * ```
 *
 * `0x539B` was a string literal. The contract the run actually used came from
 * `CANONICAL_ADDRESSES[11155111].aaStarBLSAlgorithm`, which moved twice — v0.31.0 `0x1A8Db639…`,
 * then v0.33.0 `0x7ac7E9d4…`. So for two upstream bumps this runner registered nodes on the
 * canonical committee validator and reported success **on a contract it had not touched**. The
 * file header carried the same stale address, stated as an equality that had become false.
 *
 * ## Why this is not cosmetic here specifically
 *
 * A wrong DVT validator does not revert. The superseded one still has code and still answers
 * `isRegistered = true` (this is written down in `onboardDvtNode`'s own doc comment). The printed
 * line is therefore the *only* thing a reader has to tell which contract a run proved something
 * about — and it lied, on the green path, silently.
 *
 * ## The rule
 *
 * In an evidence runner, a hex literal of 4+ digits may not sit inside a `log(...)` /
 * `console.log(...)` argument. Interpolate the value (`${VALIDATOR}`) so the message cannot
 * outlive what it names. `${...}` spans are exempt — the point is the hardcoding, not the hex.
 *
 * Escape hatch, for a hex constant that genuinely is fixed (a selector, an EIP magic value):
 * put `// evidence-literal-ok: <why>` on the line above.
 *
 * ## What this does NOT check
 *
 * It does not verify that the interpolated address is the RIGHT one, and it does not look at
 * comments or headers — a stale address in prose still gets past it. It only removes the case
 * where a machine-generated result line asserts an address that no code path produced.
 *
 * Run: `pnpm run check:evidence-literals`
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SCAN_DIR = join(repoRoot, 'tests/regression/onchain-evidence');

const LOG_CALL = /(?:^|[^\w.])(?:console\.)?log\s*\(/;
const HEX_LITERAL = /0x[0-9a-fA-F]{4,}/g;
const INTERPOLATION = /\$\{[^}]*\}/g;
const OK_MARKER = /\/\/\s*evidence-literal-ok:/;
const COMMENT_START = /^(?:\/\/|\*|\/\*|\*\/)/;

type Hit = { file: string; line: number; literal: string; text: string };

function main(): void {
    let files: string[];
    try {
        files = readdirSync(SCAN_DIR).filter((f) => f.endsWith('.ts')).sort();
    } catch {
        files = [];
    }
    // Anti-vacuous: a check that scans nothing prints the same ✅ as a check that passed.
    if (files.length === 0) {
        console.error(
            `check-evidence-literals: scanned 0 files under ${relative(repoRoot, SCAN_DIR)}. ` +
                'The layout changed and this check went blind.',
        );
        process.exit(1);
    }

    const hits: Hit[] = [];
    for (const f of files) {
        const lines = readFileSync(join(SCAN_DIR, f), 'utf8').split('\n');
        for (let i = 0; i < lines.length; i++) {
            const raw = lines[i];
            const trimmed = raw.trim();
            if (COMMENT_START.test(trimmed)) continue;
            if (!LOG_CALL.test(raw)) continue;
            if (i > 0 && OK_MARKER.test(lines[i - 1])) continue;
            const withoutInterpolations = raw.replace(INTERPOLATION, '');
            for (const m of withoutInterpolations.matchAll(HEX_LITERAL)) {
                hits.push({
                    file: `tests/regression/onchain-evidence/${f}`,
                    line: i + 1,
                    literal: m[0],
                    text: trimmed.slice(0, 120),
                });
            }
        }
    }

    for (const h of hits) {
        console.error(`  ❌ ${h.file}:${h.line} — hardcoded ${h.literal} in a printed line: ${h.text}`);
    }
    if (hits.length) {
        console.error(
            '\ncheck-evidence-literals: interpolate the value instead of writing it out, so the message\n' +
                'cannot outlive what it names. If the constant genuinely is fixed (a selector, an EIP magic\n' +
                'value), put `// evidence-literal-ok: <why>` on the line above.',
        );
        process.exit(1);
    }
    console.log(
        `check-evidence-literals: ✅ ${files.length} evidence runner(s) scanned, no hardcoded hex in a ` +
            'printed line. (This does NOT verify the interpolated addresses are correct, and does not ' +
            'read comments or headers.)',
    );
}

main();
