/**
 * The guardian-slash read surface held against the LIVE BLSAggregator (T2.1.1 / CC-13 batch A).
 *
 * Every getter added in T2.1.1 is a wrapper around a contract-coupled read. The unit tests pin the
 * wrapper against the ABI FILE; only this file can say the ABI file still matches what is deployed.
 *
 * WHAT THIS CAN AND CANNOT SETTLE
 * -------------------------------
 * It settles that each getter EXISTS on the deployed aggregator, returns the width the SDK expects,
 * and — for `guardianSlashCases` — that the return is exactly 224 bytes (7 words), which is the one
 * measurement separating the deployed 4.11.0 struct from the 4.12.0 source struct that shares its
 * selector.
 *
 * It does NOT settle that the 7 words decode into the RIGHT fields. No guardian-slash case has ever
 * been queued on this aggregator, so every id returns 224 zero bytes, and zeroes decode identically
 * under any field ordering. That link is pinned offline against
 * `BLSAggregator-4.11.0.deployed.json` (matched 70/70 on non-tuple selectors against the deployed
 * bytecode) and cannot be corroborated on-chain, because a selector does not encode its outputs.
 *
 * Stated plainly so nobody reads a green run here as "the decode is verified".
 *
 * THESE ONES ACTUALLY RUN IN THE MERGE GATE — AND THAT IS NOT TRUE OF EVERY "on-chain" TEST HERE
 * ---------------------------------------------------------------------------------------------
 * `ci.yml` sets `AASTAR_ONCHAIN_TEST=1` and `SEPOLIA_RPC_URL=<public node>` for the unit-test job,
 * so everything below executes on every PR. The log-replay assertions (committeeTree, dvt.onchain)
 * do NOT: they need an endpoint that serves `eth_getLogs` over history consistently, which the free
 * public node does not, and FU-38 gates them off.
 *
 * The dividing line is the RPC METHOD, not the word "on-chain". This file is pure `eth_call` — a
 * point read at head, which a public node answers reliably — so it is gate-eligible. Worth knowing
 * before adding an assertion here: reach for `eth_getLogs` and this file silently joins the batch
 * that nothing runs.
 */
import { describe, it, expect } from 'vitest';
import { createPublicClient, http, type Address } from 'viem';

import { aggregatorActions, GuardianSlashStatus } from './aggregator.js';
import { CANONICAL_ADDRESSES } from '../addresses.js';

const RUN_ONCHAIN = process.env.AASTAR_ONCHAIN_TEST === '1';
const RPC = process.env.SEPOLIA_RPC_URL ?? process.env.SEPOLIA_RPC ?? 'https://ethereum-sepolia-rpc.publicnode.com';
const AGG = CANONICAL_ADDRESSES[11155111].blsAggregator as Address;
const agg = () => aggregatorActions(AGG)(createPublicClient({ transport: http(RPC) }) as never);

describe('guardian-slash read surface vs the live BLSAggregator', () => {
    it.runIf(RUN_ONCHAIN)('is talking to BLSAggregator-4.11.0 — the version these shapes belong to', async () => {
        // Anchor first. Every other assertion here is only meaningful for 4.11.0; if the aggregator
        // has been upgraded, a shape mismatch below is expected news, not a defect, and this line is
        // what tells the two apart.
        expect(await agg().version()).toBe('BLSAggregator-4.11.0');
    });

    it.runIf(RUN_ONCHAIN)('the two cooldown constants read back as the spec.md pins', async () => {
        const [exitCooldown, caseWindow] = await Promise.all([
            agg().guardianExitCooldown(),
            agg().guardianSlashCaseWindow(),
        ]);
        expect(exitCooldown).toBe(86400n);   // 1 day
        expect(caseWindow).toBe(345600n);    // 4 days — the value spec.md §1.1 pins
    });

    it.runIf(RUN_ONCHAIN)('SLASH_THRESHOLD_FLOOR is at or below every configured threshold', async () => {
        // A relationship, not a literal: pinning `floor === 2` would go stale the moment governance
        // moved it, and would say nothing about whether the table is legal. What must always hold is
        // that no configured threshold sits below the floor the setter enforces.
        const floor = await agg().slashThresholdFloor();
        const { warning, minor, major } = await agg().getSlashThresholds();
        for (const [name, t] of [['warning', warning], ['minor', minor], ['major', major]] as const) {
            expect(t, `${name} threshold ${t} is below SLASH_THRESHOLD_FLOOR ${floor}`).toBeGreaterThanOrEqual(floor);
        }
    });

    it.runIf(RUN_ONCHAIN)('the two slash path tags exist and are DIFFERENT', async () => {
        const { queue, execute } = await agg().slashPathTags();
        expect(queue).toMatch(/^0x[0-9a-f]{64}$/i);
        expect(execute).toMatch(/^0x[0-9a-f]{64}$/i);
        // The tags exist to separate QUEUE intent from EXECUTE intent. Equal tags would mean a
        // signature authorising a queue also authorises an execution — the domain separation the
        // tags are for would be silently absent while both reads still "worked".
        expect(queue).not.toBe(execute);
    });

    it.runIf(RUN_ONCHAIN)('guardianSlashCases returns exactly 7 words — the deployed 4.11.0 struct', async () => {
        // THE load-bearing assertion of this file. If the aggregator is upgraded to the 4.12.0
        // struct, the selector does not change and a plain readContract would keep "working" while
        // returning shifted values; guardianSlashCase throws GUARDIAN_SLASH_CASE_SHAPE instead.
        // Reading id 0 is enough: the struct width does not depend on whether a case exists.
        //
        // ⚠️ ONLY THE WIDTH GUARD IS AWAKE HERE. Measured by mutation against this live chain
        // (review of #362, CI's own public endpoint):
        //
        //   GUARDIAN_SLASH_CASE_WORDS   7 → 8   → 1 failed  ← the width guard carries this test
        //   GUARDIAN_SLASH_CASE_VERIFIER_WORD 6 → 0 → 7 passed  ← the zero-padding guard is SILENT
        //
        // That second result is not a defect, it is the consequence of there being no queued case:
        // the return is 224 zero bytes, and the zero address is legitimately zero-padded, so that
        // assertion reads the same whichever word it points at. Do NOT read this green as "field
        // displacement is covered" — it is covered by the sentinel fixture in the offline suite,
        // and the on-chain half of it wakes up when the first real case is queued.
        const c = await agg().guardianSlashCase({ caseId: 0n });
        expect(c.status).toBe(GuardianSlashStatus.NONE);
        expect(c.verifier).toBe('0x0000000000000000000000000000000000000000');
    });

    it.runIf(RUN_ONCHAIN)('the per-guardian getters answer for an address with no history', async () => {
        // The zero address is a deliberate choice: it has no slash or exit history, so the expected
        // answer is knowable without depending on any live operational state (which would make this
        // flaky in the way FU-38 describes).
        const ZERO = '0x0000000000000000000000000000000000000000' as Address;
        const [until, pending, req] = await Promise.all([
            agg().guardianExitCooldownUntil({ guardian: ZERO }),
            agg().pendingGuardianSlashCount({ guardian: ZERO }),
            agg().guardianExitRequest({ guardian: ZERO }),
        ]);
        expect(until).toBe(0n);
        expect(pending).toBe(0n);
        expect(req).toEqual({ readyAt: 0n, expiresAt: 0n });
    });

    it.runIf(RUN_ONCHAIN)('slashPolicyAdmin is readable, and we record whether it is still an EOA', async () => {
        // Not an assertion about WHICH address — that is governance's call, and pinning it would
        // make a legitimate handover look like a regression. What is worth surfacing is the state
        // T2.1.2 is blocked on: whether the admin is still the bootstrap EOA or a TimelockController.
        const admin = await agg().slashPolicyAdmin();
        expect(admin).toMatch(/^0x[0-9a-fA-F]{40}$/);
        expect(BigInt(admin)).not.toBe(0n); // a zero admin would mean the threshold table is frozen
        const code = await createPublicClient({ transport: http(RPC) }).getCode({ address: admin });
        if (!code || code === '0x') {
            console.warn(
                `[slash-governance] slashPolicyAdmin ${admin} has no code — still the bootstrap EOA, ` +
                'not a TimelockController. T2.1.2 (batch B) is the handover; until it lands, the slash ' +
                'threshold table can be changed by a single key.',
            );
        }
    });
});
