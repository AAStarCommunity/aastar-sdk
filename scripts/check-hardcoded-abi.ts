/**
 * A hand-written ABI in shipped source must carry a justification on the line above it.
 *
 * ## The defect, and the two covers that hid it
 *
 * `packages/dapp/src/ui/index.ts` shipped a `parseAbi` literal declaring three functions. Measured
 * against every ABI under `packages/core/src/abis/`:
 *
 * ```
 * registerValidator(bytes)               → exists on no contract in this repo (0/52 ABIs)
 * signProposal(uint256,bytes)            → exists on no contract in this repo (0/52 ABIs)
 * createProposal(address,uint8,string)   → EXISTS (DVTValidator declares both the 3-param
 *                                          0x8e24bc9a and the 4-param 0x2dcc352b overloads)
 * ```
 *
 * **Correction, #381 review.** This said all three were wrong. My audit script kept one signature
 * per name, so it compared against the four-parameter overload and called the three-parameter one
 * a mismatch — **an extractor that collapses overloads is blind to the one case where a single
 * name carries two selectors**, which is precisely the hazard #362 was about. Two of the three
 * were invented; the third was real and never called.
 *
 * `DVTClient.registerValidator` was publicly exported and could only ever revert.
 *
 * It survived two covers, **and neither was carelessness**:
 *
 * 1. `.eslintrc.js` already forbids importing `parseAbi` from viem. But **no package in this
 *    monorepo defines a `lint` script**, so `pnpm -r lint` is a repo-wide no-op — the ban was
 *    never enforced anywhere it was not written by hand.
 * 2. Its only caller caught the revert and printed "DVT Call Reached (Reverted as expected for
 *    dummy key)" — **the same line whether or not the function existed**.
 *
 * ## Why THIS rule, rather than "no hardcoded ABIs"
 *
 * Because hand-written ABIs are sometimes correct and necessary, and a gate that forbids them
 * outright would fire on the files in `packages/airaccount` that need one (a factory ABI that
 * genuinely is not in `@aastar/core`). Those already do the right thing: an
 * `eslint-disable-next-line no-restricted-imports` with a reason: **16 shipped files there IMPORT
 * `parseAbi`, and every one of those 16 carries a justification.** Three more merely mention the
 * word — two in prose, one using `parseAbiParameters` — and they need no justification because
 * they hand-write nothing.
 *
 * That distinction is the correction itself, twice over. The first version said "four", a number I
 * never measured. The second said "19 … and every one of them carries a justification" — **19 is
 * the MENTION count and the property only holds of the 16 that import**, so I had fixed a wrong
 * number by measuring and then attached the result to the wrong denominator. #381 review caught
 * both. The narrow reading is also the stronger one: `import parseAbi` is exactly what the lint
 * rule bans, so it is the population the rule is about.
 *
 * So the rule is the one the repo already follows: **if you hand-write an ABI, say why on the line
 * above.** That is mechanical, it fires on exactly the file that had no answer, and complying with
 * it costs one sentence — which is also the sentence a reviewer needs.
 *
 * What this does NOT do, stated so nobody reads more into a green run: it does not verify that a
 * justified ABI is CORRECT. `packages/dapp`'s was wrong in every one of three signatures, and a
 * justification comment would not have made it right. It makes the hand-writing visible; a human
 * still has to check the contract.
 *
 * Usage:  pnpm exec tsx scripts/check-hardcoded-abi.ts
 * Exit 0 when every hand-written ABI is justified; 1 otherwise.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Files that hand-write an ABI today with no justification, recorded as a floor.
 *
 * ## Why a baseline instead of failing on all eight
 *
 * Because a gate that reports eight non-problems on its first run gets switched off before it
 * catches its first real one — this repo has written that down twice already (#354, #357). These
 * eight predate the rule. Fixing them is real work with real risk, and bundling it into the PR that
 * found ONE broken export would bury the finding.
 *
 * The list may only SHRINK. New unjustified files red; removing an entry is a deliberate edit, and
 * that edit is where a reviewer gets to ask what changed.
 *
 * ## What the audit found, and why it is a QUESTION and not a verdict
 *
 * Extracting the 48 hand-written signatures in these files and checking each name against every
 * ABI under `packages/core/src/abis/`, **six names appear in no ABI this repo tracks**:
 *
 * ```
 * analytics    totalLifetimeBurned
 * identity     submitProof
 * paymaster    addGasToken · removeGasToken · withdrawPNT
 * tokens       stake
 * ```
 *
 * That is not proof they are broken. A contract whose ABI legitimately lives outside
 * `@aastar/core` would look identical, and the extractor is crude — it reported `handleOps` as a
 * mismatch by splitting a tuple on its internal commas, which is a false positive.
 *
 * So this records facts and leaves the judgement (FU-76). The one case that IS settled is the one
 * that prompted the rule: `packages/dapp` declared `registerValidator(bytes)` and
 * `signProposal(uint256,bytes)`, which exist nowhere, and `createProposal` with three parameters
 * where the real one takes four. Its only caller then swallowed the revert and printed
 * "DVT Call Reached" — **the same line whether or not the function existed.**
 *
 * `packages/dapp/src/ui/index.ts` is deliberately NOT on this list: it was fixed in the same PR,
 * and a test pins its absence.
 */
export const KNOWN_UNJUSTIFIED: readonly string[] = [
    'packages/analytics/src/index.ts',
    'packages/core/src/requirementChecker.ts',
    'packages/identity/src/index.ts',
    'packages/paymaster/src/V4/PaymasterClient.ts',
    'packages/paymaster/src/V4/PaymasterOperator.ts',
    'packages/paymaster/src/V4/SuperPaymasterClient.ts',
    'packages/sdk/src/clients/endUser.ts',
    'packages/tokens/src/index.ts',
];

/** Shipped source only: tests may hand-write whatever they need to construct a fixture. */
const ROOT = 'packages';
const IS_SHIPPED = (p: string) => /\/src\//.test(p) && /\.tsx?$/.test(p) && !/\.test\.tsx?$/.test(p);

export interface Unjustified {
    file: string;
    line: number;
    text: string;
}

/** The marker the repo already uses. Checked on the preceding non-empty line. */
const JUSTIFIED = /eslint-disable(-next-line)?[^\n]*no-restricted-imports/;

export function findUnjustified(file: string, text: string): Unjustified[] {
    const lines = text.split('\n');
    const out: Unjustified[] = [];
    lines.forEach((line, i) => {
        // The import is the thing the lint rule bans, and the thing a justification sits above.
        // Matching the CALL site instead would fire on the doc comment in this very file.
        if (!/^\s*import\s[^\n]*\bparseAbi\b[^\n]*from\s+['"]viem['"]/.test(line)) return;
        // A fixed three-line lookback. The first draft ALSO walked back over blank lines to the
        // nearest non-empty one — mutation showed that loop reds nothing, because a window this
        // size already spans a justification separated by a blank line. **Third piece of dead code
        // with a justifying comment found in one day**, and like the other two it came from
        // reasoning about what the check "should" need rather than about its actual inputs.
        //
        // Three is not arbitrary: `eslint-disable` markers in this repo sit either directly above
        // the import or one comment line above it. Widening it further would start accepting an
        // unrelated disable comment elsewhere in a header block as cover for this import.
        const context = lines.slice(Math.max(0, i - 3), i).join('\n');
        if (!JUSTIFIED.test(context)) out.push({ file, line: i + 1, text: line.trim() });
    });
    return out;
}

function walk(dir: string, acc: string[] = []): string[] {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name);
        if (e.name === 'node_modules' || e.name === 'dist') continue;
        if (e.isDirectory()) walk(p, acc);
        else if (statSync(p).isFile() && IS_SHIPPED(p)) acc.push(p);
    }
    return acc;
}

if (process.argv[1]?.endsWith('check-hardcoded-abi.ts')) {
    const files = walk(ROOT);
    const all = files.flatMap((f) => findUnjustified(f, readFileSync(f, 'utf8')));
    const hits = all.filter((h) => !KNOWN_UNJUSTIFIED.includes(h.file));
    const baselineSeen = new Set(all.map((h) => h.file).filter((f) => KNOWN_UNJUSTIFIED.includes(f)));
    const withAbi = files.filter((f) => /\bparseAbi\b/.test(readFileSync(f, 'utf8')));

    // Both counts, because "scanned nothing" and "found nothing" are the same green otherwise —
    // a lesson this repo paid for five separate times in one day.
    console.log(
        `check-hardcoded-abi: scanned ${files.length} shipped source file(s); ` +
            `${withAbi.length} mention parseAbi; ${all.length} unjustified ` +
            `(${baselineSeen.size}/${KNOWN_UNJUSTIFIED.length} on the baseline, ${hits.length} new)`,
    );
    // A baseline entry that no longer fires is an entry that should be deleted. Reported, not
    // enforced: someone may be mid-fix, and a gate that punishes progress gets routed around.
    for (const f of KNOWN_UNJUSTIFIED) {
        if (!baselineSeen.has(f)) console.log(`  · baseline entry no longer needed, please remove: ${f}`);
    }
    if (files.length === 0) {
        console.error('check-hardcoded-abi: scanned 0 files. The layout changed and this check went blind.');
        process.exit(1);
    }
    for (const h of hits) console.error(`  ❌ ${h.file}:${h.line} — hand-written ABI with no justification: ${h.text}`);
    if (hits.length) {
        console.error(
            '\ncheck-hardcoded-abi: import the ABI from `@aastar/core` instead, or state on the line\n' +
                'above WHY this contract needs a hand-written one (the form `packages/airaccount` uses).\n' +
                'Note this check does not verify the ABI is CORRECT — dapp\'s was wrong in all three\n' +
                'signatures. It only makes the hand-writing visible to a reviewer.',
        );
        process.exit(1);
    }
    // Wording matters here and the first draft got it wrong: it said "every hand-written ABI
    // carries a justification", which is FALSE while eight sit on the baseline. A verdict that
    // overstates its own scope is the exact defect this repo spent a day chasing.
    console.log(
        `check-hardcoded-abi: ✅ no NEW unjustified hand-written ABI. ` +
            `${baselineSeen.size} pre-existing one(s) remain on the baseline and are NOT vouched for.`,
    );
}
