import { describe, it, expect } from 'vitest';
import { parseDiagnostics, countLooseDiagnostics, verdict, BASELINE, BASELINE_TOTAL } from './evidence-types.js';

// Real tsc output, abbreviated. Both shapes matter: an absolute path (what tsc prints from the repo
// root) and the `(line,col)` suffix that the key deliberately discards.
const TSC = `tests/regression/onchain-evidence/dvt3-register.ts(120,5): error TS2322: Type 'x' is not assignable.
tests/regression/onchain-evidence/dvt3-register.ts(180,9): error TS2322: Type 'y' is not assignable.
tests/regression/onchain-evidence/kms-account-e2e.ts(44,1): error TS2345: Argument of type 'a'.
Found 3 errors in 2 files.`;

describe('parseDiagnostics', () => {
    const d = parseDiagnostics(TSC, 'tests/regression/onchain-evidence/');

    it('keys on (file, code) and DROPS the line number', () => {
        // Line numbers move whenever anything above them is edited. A baseline keyed on them
        // churns on unrelated edits, and a baseline people regenerate without reading is not one.
        expect(d).toEqual([
            { file: 'dvt3-register.ts', code: 'TS2322' },
            { file: 'dvt3-register.ts', code: 'TS2322' },
            { file: 'kms-account-e2e.ts', code: 'TS2345' },
        ]);
    });

    it('ignores tsc\'s summary line', () => {
        expect(d.some((x) => x.file.includes('Found'))).toBe(false);
    });
});

describe('verdict', () => {
    const loose = countLooseDiagnostics(TSC);

    it('counts loose diagnostics without parsing them', () => {
        expect(loose).toBe(3);
    });

    it('fails when a (file, code) pair exceeds its baseline entry', () => {
        const over = [...Array(99)].map(() => ({ file: 'dvt3-register.ts', code: 'TS2322' }));
        const v = verdict(over, over.length);
        expect(v.ok).toBe(false);
        expect(v.lines.join('\n')).toContain('baseline allows');
    });

    it('fails on a pair that is not in the baseline at all', () => {
        const fresh = [{ file: 'brand-new-runner.ts', code: 'TS9999' }];
        const v = verdict(fresh, 1);
        expect(v.ok).toBe(false);
        expect(v.lines.join('\n')).toContain('brand-new-runner.ts');
    });

    // The anti-vacuous guard is a RATIO, not a floor, and this is the test that pins why.
    //
    // The first version used `diags.length < 30`. Measured: silencing one debt-heavy file took the
    // directory 48 -> 28 and the gate went RED — for cleaning up. A guard whose failure mode fires
    // on the action you want is a guard people route around.
    it('stays green when the directory genuinely gets cleaner', () => {
        const fewer = parseDiagnostics(TSC, 'tests/regression/onchain-evidence/');
        const v = verdict(fewer, fewer.length); // strict == loose: nothing was missed
        expect(v.ok).toBe(true);
    });

    it('fails when the parser understands far less than tsc emitted', () => {
        const v = verdict([], 48); // tsc said 48, we understood none
        expect(v.ok).toBe(false);
        expect(v.lines.join('\n')).toContain('went blind');
        expect(v.lines.join('\n')).toContain('do NOT lower the baseline');
    });
});

describe('the baseline itself', () => {
    // Same shape as verification-doc's registry floor: written out, never derived from BASELINE.
    // A threshold expressed in terms of the thing it guards pins the direction of the comparison
    // and nothing about its magnitude (#405 r3/r4).
    it('accounts for exactly the 48 diagnostics recorded when this gate landed', () => {
        expect(BASELINE.reduce((n, [, , c]) => n + c, 0)).toBe(BASELINE_TOTAL);
        expect(BASELINE_TOTAL).toBe(48);
    });

    it('has no duplicate (file, code) keys — a duplicate would silently raise the cap', () => {
        const keys = BASELINE.map(([f, c]) => `${f}|${c}`);
        expect(new Set(keys).size).toBe(keys.length);
    });
});
