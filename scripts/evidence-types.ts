/**
 * The evidence runners' type diagnostics, as data. Pure over tsc's OUTPUT — nothing here spawns a
 * compiler, reads a file, prints, or exits, so the fixtures in `check-evidence-types.test.ts` can
 * exercise it. (Same split as `dep-dedupe.ts`, and for the same reason: #405 shipped a CLI that
 * carried its own inlined copy of the logic, so CI ran code no test had ever called.)
 *
 * ## Why this gate exists
 *
 * Twice in two days a file under `tests/regression/onchain-evidence/` did not compile while all
 * three CI checks were green — #401 (`refused` referenced outside the block that declared it) and
 * #403 (`coSignDvt` used a parameter it did not have). Both would have thrown at runtime. Measured:
 * `ci.yml` contains the literal `tsc` **zero** times; these files do belong to the ROOT tsc project
 * (`tsc --showConfig -p tsconfig.json` lists them among its 765 files), but nothing in CI runs that
 * project. The tooling was there; the step was not.
 *
 * ## Why a per-(file, code) baseline and not a count
 *
 * The directory carries 48 pre-existing diagnostics that are not this gate's business to fix. A
 * bare count would be satisfied by fixing one and introducing another. The key deliberately omits
 * the LINE: line numbers move whenever anything above them is edited, and a baseline that churns on
 * every unrelated edit is a baseline people regenerate without reading.
 */
export type Diag = { file: string; code: string };

/**
 * Baseline: what the directory carried when this gate landed. **It may only shrink.**
 * Regenerate deliberately, never to make a red go away — the whole point is that a NEW diagnostic
 * is loud even while these 48 stay.
 */
export const BASELINE: readonly (readonly [string, string, number])[] = [
    ['cc103-committee-e2e.ts', 'TS2345', 1],
    ['dvt-onboard-e2e.ts', 'TS2345', 1],
    ['dvt3-register.ts', 'TS2322', 4],
    ['dvt3-register.ts', 'TS2339', 1],
    ['dvt3-register.ts', 'TS2345', 5],
    ['dvt3-register.ts', 'TS2769', 1],
    ['kms-account-e2e.ts', 'TS2345', 1],
    ['p256-guardian-e2e.ts', 'TS2322', 2],
    ['p256-guardian-e2e.ts', 'TS2345', 2],
    ['p256-guardian-e2e.ts', 'TS2353', 1],
    ['tier-loosen-guardians-e2e.ts', 'TS2532', 1],
    ['v0.23.0-row10-handleops.ts', 'TS18046', 5],
    ['v0.23.0-strengthen.ts', 'TS18046', 20],
    ['v0202-module-install-e2e.ts', 'TS5097', 1],
    ['x402-live-roundtrip.ts', 'TS5097', 2],
];

/** Total diagnostics the baseline accounts for — written out so a truncated baseline is visible. */
export const BASELINE_TOTAL = 48;

const DIAG_LINE = /^(?<file>[^(]+)\((?<line>\d+),(?<col>\d+)\): error (?<code>TS\d+):/;

/** Parse `tsc --noEmit` output into (file, code) pairs, dropping the line/column. */
export function parseDiagnostics(tscOutput: string, stripPrefix = ''): Diag[] {
    const out: Diag[] = [];
    for (const line of tscOutput.split('\n')) {
        const m = DIAG_LINE.exec(line);
        if (!m?.groups) continue;
        out.push({ file: m.groups.file.replace(stripPrefix, ''), code: m.groups.code });
    }
    return out;
}

export type TypeVerdict = { ok: boolean; lines: string[] };

/** Loose, structure-free: does this line mention a TS diagnostic at all? */
const LOOSE_DIAG = /error TS\d+/;

/** How many lines of tsc output look like diagnostics, without parsing them. */
export function countLooseDiagnostics(tscOutput: string): number {
    return tscOutput.split('\n').filter((l) => LOOSE_DIAG.test(l)).length;
}

export function verdict(diags: Diag[], looseCount: number): TypeVerdict {
    // Anti-vacuous, expressed as a PARSE RATIO rather than an absolute floor.
    //
    // The first version used `diags.length < 30`. Measured, it punished the correct action:
    // silencing one debt-heavy file took the directory from 48 diagnostics to 28, and the gate went
    // RED — for cleaning up. A guard whose failure mode fires on the thing you want people to do is
    // a guard people route around.
    //
    // The two states it needs to tell apart are not "many vs few". They are:
    //   · tsc emitted N diagnostics and this parser understood N     -> healthy, whatever N is
    //   · tsc emitted N diagnostics and this parser understood ~0    -> the format moved, we are blind
    // so the discriminator is the ratio between a STRICT parse and a deliberately LOOSE count of
    // the same output. Cleanup moves both together; blindness moves only one.
    if (looseCount > 0 && diags.length < looseCount * 0.9) {
        return {
            ok: false,
            lines: [
                `check-evidence-types: tsc emitted ${looseCount} diagnostic line(s) but this parser ` +
                    `understood only ${diags.length}. The output format moved and the check went ` +
                    'blind — fix the parser; do NOT lower the baseline.',
            ],
        };
    }

    const seen = new Map<string, number>();
    for (const d of diags) seen.set(`${d.file}|${d.code}`, (seen.get(`${d.file}|${d.code}`) ?? 0) + 1);
    const allowed = new Map(BASELINE.map(([f, c, n]) => [`${f}|${c}`, n]));

    const added: string[] = [];
    for (const [key, n] of seen) {
        const cap = allowed.get(key) ?? 0;
        if (n > cap) added.push(`  ❌ ${key.replace('|', '  ')} — ${n} occurrence(s), baseline allows ${cap}`);
    }
    const shrunk: string[] = [];
    for (const [key, n] of allowed) {
        const now = seen.get(key) ?? 0;
        if (now < n) shrunk.push(`  · ${key.replace('|', '  ')} — now ${now}, baseline says ${n}: lower it`);
    }

    if (added.length) {
        return {
            ok: false,
            lines: [
                ...added,
                '',
                `check-evidence-types: ${added.length} new type diagnostic(s) in the evidence runners.`,
                'These files are executed against live contracts and are NOT typechecked anywhere else',
                'in CI — two of them shipped uncompilable while all three checks were green (#401, #403).',
                'Fix the diagnostic. Adding it to BASELINE is for pre-existing debt only.',
            ],
        };
    }
    return {
        ok: true,
        lines: [
            `check-evidence-types: ✅ ${diags.length} diagnostic(s), all within the ${BASELINE_TOTAL}-entry ` +
                'baseline; no new ones.',
            ...(shrunk.length
                ? ['', `${shrunk.length} baseline entr(ies) are now smaller than recorded — shrink them:`, ...shrunk]
                : []),
        ],
    };
}
