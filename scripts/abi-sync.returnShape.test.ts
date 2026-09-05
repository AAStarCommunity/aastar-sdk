/**
 * `abi:sync` must notice a function whose NAME and INPUTS are unchanged while its RETURN changed.
 *
 * WHY THIS TEST EXISTS
 * --------------------
 * `sigSet` keys on `name(inputs)`. Outputs never participated in the comparison, so the one shape of
 * upstream change that does NOT revert — same selector, different return — was invisible to the
 * repo's main ABI drift detector. It was not hypothetical: measured 2026-09-05 against the real
 * checked-out upstream, `BLSAggregator.guardianSlashCases(uint256)` had 7 outputs in the SDK and 8
 * upstream (`uint16 slashBps` inserted before `verifier`), and `abi:sync` reported five other drifts
 * on that same contract while mentioning this one zero times.
 *
 * The same lesson had already been learned once, on the other side of the function: the comment
 * above `renderType` records `InitConfig` growing 8 -> 10 fields while the comparison "stayed silent
 * while createAccount reverted on-chain". That fix expanded tuples in INPUTS. Outputs were never
 * carried across — local painkiller, no sweep for siblings (FU-47).
 *
 * WHAT THIS TEST DOES NOT USE: the real sibling upstreams. It builds a throwaway SDK root with a
 * synthetic upstream so the assertion holds on any machine, in CI, and after the real upstreams move
 * on. Using the live drift would make this test pass for a reason that disappears the day someone
 * re-vendors the ABI.
 */
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SYNC = join(process.cwd(), 'scripts/abi-sync.ts');
// FU-48: launch tsx directly; `npx`'s own resolution measured 60-70% of each spawn.
const TSX_BIN = join(process.cwd(), 'node_modules', '.bin', 'tsx');
const [LAUNCHER, LAUNCH_ARGS] = existsSync(TSX_BIN) ? [TSX_BIN, []] : ['npx', ['tsx']];

const fn = (name: string, inputs: string[], outputs: string[]) => ({
    type: 'function',
    name,
    stateMutability: 'view',
    inputs: inputs.map((t, i) => ({ name: `a${i}`, type: t })),
    outputs: outputs.map((t, i) => ({ name: `o${i}`, type: t })),
});

/**
 * Build a disposable SDK root plus the ONE sibling layout `abi-sync.ts` resolves
 * (`../SuperPaymaster/{contracts/src,out}`), and run the real script against it.
 */
function runSync(sdkOutputs: string[], upstreamOutputs: string[], opts: { upstreamExtra?: boolean } = {}) {
    const root = mkdtempSync(join(tmpdir(), 'abisync-'));
    const sdk = join(root, 'sdk');
    const up = join(root, 'SuperPaymaster');
    mkdirSync(join(sdk, 'packages/core/src/abis'), { recursive: true });
    mkdirSync(join(up, 'contracts/src'), { recursive: true });
    mkdirSync(join(up, 'out/Probe.sol'), { recursive: true });

    // The level is only "scanned" when its src/ exists — otherwise REQUIRE_UPSTREAM would fire for a
    // reason unrelated to what is under test, and the test would pass on the wrong signal.
    writeFileSync(join(up, 'contracts/src/Probe.sol'), 'contract Probe {}\n');
    writeFileSync(
        join(sdk, 'packages/core/src/abis/Probe.json'),
        JSON.stringify({ abi: [fn('probe', ['uint256'], sdkOutputs)] }, null, 2),
    );
    // `upstreamExtra` puts a function upstream that the SDK does not have, so a run can contain BOTH
    // an added-function drift and a return-shape drift at once. Without it the seam between the two
    // passes is never exercised — which is exactly how the third case below used to be vacuous.
    const upstreamAbi = [fn('probe', ['uint256'], upstreamOutputs)];
    if (opts.upstreamExtra) upstreamAbi.push(fn('extra', [], ['uint256']));
    writeFileSync(
        join(up, 'out/Probe.sol/Probe.json'),
        JSON.stringify({ abi: upstreamAbi }, null, 2),
    );

    try {
        const out = execFileSync(LAUNCHER, [...LAUNCH_ARGS, SYNC], {
            cwd: sdk, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
            env: { ...process.env, REQUIRE_UPSTREAM: '1' },
        });
        return { code: 0, out };
    } catch (error) {
        const e = error as { status?: number; stdout?: string; stderr?: string };
        return { code: e.status ?? 1, out: `${e.stdout ?? ''}${e.stderr ?? ''}` };
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
}

describe('abi:sync return-shape drift', { timeout: 60_000 }, () => {
    it('reports a same-signature / different-return function and exits non-zero', () => {
        // The real shape, reduced: a word inserted before the trailing address.
        const { code, out } = runSync(
            ['bytes32', 'uint16', 'address'],
            ['bytes32', 'uint16', 'uint16', 'address'],
        );
        expect(out).toMatch(/SAME SELECTOR, DIFFERENT RETURN/);
        expect(out).toMatch(/probe\(uint256\)/);
        // The message must carry BOTH shapes: "they differ" is not actionable, "7 vs 8 words with
        // slashBps inserted" is. A caller has to be able to tell insertion from replacement.
        expect(out).toMatch(/SDK returns \(bytes32,uint16,address\)/);
        expect(out).toMatch(/upstream returns \(bytes32,uint16,uint16,address\)/);
        expect(code).not.toBe(0);
    });

    it('POSITIVE CONTROL: identical returns are silent and exit 0', () => {
        // Without this, the assertion above would also pass if the script had simply started
        // shouting at everything — the failure mode that gets a gate deleted (verification.md §5).
        const { code, out } = runSync(['bytes32', 'uint16', 'address'], ['bytes32', 'uint16', 'address']);
        expect(out).not.toMatch(/SAME SELECTOR, DIFFERENT RETURN/);
        expect(out).toMatch(/in sync with upstream/);
        expect(code).toBe(0);
    });

    it('an added function is reported ONCE, as added — never also as a return change', () => {
        // Guards the seam between the two passes: the return-shape pass looks only at functions
        // present on BOTH sides, so it must not re-report what the added/removed pass already owns.
        //
        // THIS CASE USED TO BE VACUOUS and #366 review proved it: its fixture had no added function
        // at all, so the assertion was the positive control wearing a different name. Removing the
        // `have === undefined` half of the guard changed real behaviour (SAME SELECTOR occurrences
        // 1 → 5 against the live upstream) and all three cases stayed green. A test that cannot see
        // the guard it is named after is worse than no test: it occupies the slot.
        const { code, out } = runSync(
            ['bytes32', 'uint16', 'address'],
            ['bytes32', 'uint16', 'uint16', 'address'],
            { upstreamExtra: true },
        );
        expect(code).not.toBe(0);
        // The added function must be reported by the added/removed pass...
        expect(out).toMatch(/added function extra\(\)/);
        // ...and must NOT also surface as a return-shape change. Anchored on the NAME, because the
        // run legitimately contains one SAME SELECTOR line (for `probe`) — asserting "no SAME
        // SELECTOR at all" would fail for the right reason and hide the wrong one.
        expect(out).not.toMatch(/SAME SELECTOR[^;]*extra\(\)/);
        // And the real drift is still reported, so this fixture is not just quietly inert.
        expect(out).toMatch(/SAME SELECTOR[^;]*probe\(uint256\)/);
    });
});
