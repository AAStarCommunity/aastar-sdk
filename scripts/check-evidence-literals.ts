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
 * ## What it cannot see, and why that is printed on every run
 *
 * It matches on the CALL SHAPE, not on what reaches stdout. The first revision's verdict said
 * "no hardcoded hex in a printed line" — and on the very tree it had just scanned,
 * `cc103-committee-probe.ts` passed `'OLD router 0xA6bd (SDK canonical)'` to the print helper `rd`,
 * which console.logs its label. Hardcoded hex was reaching stdout while the gate printed a summary
 * denying it: this gate's own defect class, in this gate's own output. A gate is trusted most
 * exactly when it is green, because green is when nobody opens the script.
 *
 * That instance is fixed at the source (the labels interpolate their constants now), but the BLIND
 * SPOT is structural and stays. So the limitation is printed on every run rather than left for a
 * reader to find in this comment — and it is phrased as a SHAPE, not as a file:line, because
 * naming an instance that later gets fixed is how the first version went wrong.
 *
 * Escape hatch, for a hex constant that genuinely is fixed (a selector, an EIP magic value, a
 * zero-address sentinel): put `// evidence-literal-ok: <why>` on the line **immediately above the
 * flagged line** — matching is per-line, so that is the line the report names, unambiguously.
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

/**
 * Printing calls this gate can see. `console.error`/`warn`/`info` are included because they were
 * the two largest holes: measured on this tree, `console.error` appears 54 times in these runners
 * and `console.warn` 27 — and widening cost ZERO new hits, so it was free.
 * It still sees only calls written on the SAME LINE as the hex. A print helper is invisible to it;
 * that is stated in the verdict rather than papered over.
 */
const LOG_CALL = /(?:^|[^\w.])(?:console\.(?:log|error|warn|info)|log)\s*\(/;
const HEX_LITERAL = /0x[0-9a-fA-F]{4,}/g;
const INTERPOLATION = /\$\{[^}]*\}/g;
/**
 * A hex literal that is QUOTED inside an interpolation. `${...}` is exempt because interpolating a
 * value is the fix this gate asks for — but `${"0x539B…"}` interpolates a literal, which is the
 * original defect wearing the fix's clothes. It is also the cheapest possible way to turn this gate
 * green after it fires: one edit, defect intact. Review found it; it is now the second net.
 */
const QUOTED_HEX_IN_INTERPOLATION = /['"`]\s*0x[0-9a-fA-F]{4,}/;
/** A `//` comment at end of line — not part of the printed string, so not this gate's business. */
const TRAILING_COMMENT = /\/\/.*$/;
const OK_MARKER = /\/\/\s*evidence-literal-ok:/;
const COMMENT_START = /^(?:\/\/|\*|\/\*|\*\/)/;

type Hit = { file: string; line: number; literal: string; text: string };

/**
 * Lowest plausible runner count. Set below today's total (34) on purpose: this floor exists to
 * catch the scan going blind, not to freeze the directory. Raise it deliberately, never to make a
 * red go away.
 */
const MIN_RUNNERS = 25;

/**
 * Is there an `evidence-literal-ok:` marker in the contiguous comment block directly above line `i`?
 *
 * The first version looked only at `lines[i - 1]`, and that broke the first time it was used for
 * real: the reason took two lines, so the marker landed on `i - 2` and the gate fired anyway. A
 * gate whose escape hatch only accepts a one-line justification is a gate that pushes people toward
 * one-line justifications — the opposite of what an escape hatch requiring a reason is for.
 */
function hasOkMarkerAbove(lines: string[], i: number): boolean {
    for (let j = i - 1; j >= 0; j--) {
        const t = lines[j].trim();
        if (t === '') continue;
        if (!COMMENT_START.test(t)) return false;
        if (OK_MARKER.test(t)) return true;
    }
    return false;
}

/** Every `.ts` under `dir`, recursively, as paths relative to SCAN_DIR. */
function listRunners(dir: string, prefix = ''): string[] {
    let entries;
    try {
        entries = readdirSync(dir, { withFileTypes: true });
    } catch {
        return [];
    }
    const out: string[] = [];
    for (const e of entries) {
        if (e.isDirectory()) out.push(...listRunners(join(dir, e.name), `${prefix}${e.name}/`));
        else if (e.name.endsWith('.ts')) out.push(`${prefix}${e.name}`);
    }
    return out;
}

function main(): void {
    const files = listRunners(SCAN_DIR).sort();
    // Anti-vacuous, in TWO directions — the first version only had the first, and review named the
    // gap: a `readdirSync` that is not recursive plus a guard that only fires at exactly 0 means
    // moving half the runners into a subdirectory yields a LOUDLY GREEN partial blindness. So the
    // scan recurses, and the floor is a count, not zero. `MIN_RUNNERS` is deliberately below
    // today's total: it catches a collapse, not a deletion of one file.
    if (files.length < MIN_RUNNERS) {
        console.error(
            `check-evidence-literals: found only ${files.length} runner(s) under ` +
                `${relative(repoRoot, SCAN_DIR)}, expected at least ${MIN_RUNNERS}. Either the layout ` +
                'changed and this check went partly blind, or runners were removed — say which, and ' +
                'move the floor deliberately.',
        );
        process.exit(1);
    }

    const hits: Hit[] = [];
    for (const f of files) {
        const lines = readFileSync(join(SCAN_DIR, f), 'utf8').split('\n');
        for (let i = 0; i < lines.length; i++) {
            const raw = lines[i].replace(TRAILING_COMMENT, '');
            const trimmed = lines[i].trim();
            if (COMMENT_START.test(trimmed)) continue;
            if (!LOG_CALL.test(raw)) continue;
            if (hasOkMarkerAbove(lines, i)) continue;
            const push = (literal: string) =>
                hits.push({
                    file: `tests/regression/onchain-evidence/${f}`,
                    line: i + 1,
                    literal,
                    text: trimmed.slice(0, 120),
                });
            // Net 1: hex written directly into the call, outside any interpolation.
            for (const m of raw.replace(INTERPOLATION, '').matchAll(HEX_LITERAL)) push(m[0]);
            // Net 2: hex written INSIDE an interpolation but still as a quoted literal.
            for (const span of raw.matchAll(INTERPOLATION)) {
                const q = QUOTED_HEX_IN_INTERPOLATION.exec(span[0]);
                if (q) push(`\${…${q[0].trim()}…}`);
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
    // The verdict states what was CHECKED, not what one might hope was checked. The first version
    // said "no hardcoded hex in a printed line" — and on the very tree it had just scanned,
    // `cc103-committee-probe.ts:60-61` passes hardcoded hex to the print helper `rd()`, which
    // console.logs it. That summary was false about scanned code, which is the exact defect this
    // gate exists to prevent, occurring in the gate's own output. A gate's whole value is "green
    // means the reader need not check" — and when it is green, nobody opens the script.
    console.log(
        `check-evidence-literals: ✅ ${files.length} evidence runner(s) scanned, no 4+-digit hex ` +
            'written directly into a log()/console.log|error|warn|info(...) call ON THE SAME LINE ' +
            '(quoted hex inside ${…} counts too).',
    );
    console.log(
        '  NOT covered, by construction: a hex passed to a print HELPER and logged inside it ' +
            "(`rd('… 0xA6bd …', addr)` where rd console.logs its label), a call split across lines, " +
            'comments, file headers, and whether an interpolated address is the RIGHT one.',
    );
}

main();
