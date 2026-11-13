/**
 * The guardian-slash read surface held against the LIVE BLSAggregator (T2.1.1 / CC-13 batch A).
 *
 * Every getter added in T2.1.1 is a wrapper around a contract-coupled read. The unit tests pin the
 * wrapper against the ABI FILE; only this file can say the ABI file still matches what is deployed.
 *
 * WHAT THIS CAN AND CANNOT SETTLE
 * -------------------------------
 * It settles that each getter EXISTS on the deployed aggregator, returns the width the SDK expects,
 * and — for `guardianSlashCases` — that the return width matches the live version: 224 bytes
 * (7 words) for the deployed 4.11.0, which this rc.8 build must refuse, or 256 bytes (8 words) for
 * 4.13.0, which it decodes. Width is the one measurement separating the two structs, since they
 * share a selector.
 *
 * It does NOT settle that the words decode into the RIGHT fields. No guardian-slash case has ever
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

/** guardianSlashCases width per aggregator version this file can judge. 4.11.0 is what Sepolia runs before rc.8. */
const SLASH_CASE_WIDTH: Record<string, 7 | 8> = { 'BLSAggregator-4.11.0': 7, 'BLSAggregator-4.13.0': 8 };

describe('guardian-slash read surface vs the live BLSAggregator', () => {
    it.runIf(RUN_ONCHAIN)('is talking to a BLSAggregator whose guardianSlashCases width this file knows', async () => {
        // Anchor first. This build ships the rc.8 ABI (BLSAggregator-4.13.0, 8 words) while the
        // Sepolia aggregator is still 4.11.0 (7 words) until the rc.8 deployment. Both are named
        // here on purpose: any third version is news to review, not something to decode.
        expect(Object.keys(SLASH_CASE_WIDTH)).toContain(await agg().version());
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

    it.runIf(RUN_ONCHAIN)('guardianSlashCases: a 4.11.0 aggregator is refused by width, a 4.13.0 one decodes', async () => {
        // THE load-bearing assertion of this file. 4.11.0 and 4.13.0 share the guardianSlashCases
        // selector and differ by one word (slashBps), so a plain readContract would keep "working"
        // against the wrong one while returning shifted values. Reading id 0 is enough: the struct
        // width does not depend on whether a case exists.
        //
        // Before the rc.8 deployment the live answer is 224 bytes and this build must REFUSE it;
        // after it, 256 bytes and the read must decode. The version read decides which one is
        // asserted, and an unknown version fails the anchor above.
        //
        // ⚠️ ONLY THE WIDTH GUARD IS AWAKE HERE. No guardian-slash case has been queued, so the
        // return is all zero bytes and the zero address is legitimately zero-padded; the
        // field-displacement half is covered by the sentinel fixture in the offline suite.
        const version = await agg().version();
        if (SLASH_CASE_WIDTH[version] === 7) {
            await expect(agg().guardianSlashCase({ caseId: 0n })).rejects.toThrow(
                /returned 224 bytes for guardianSlashCases\(0\), expected 256 .*BLSAggregator-4\.11\.0 struct/,
            );
            return;
        }
        expect(SLASH_CASE_WIDTH[version]).toBe(8);
        const c = await agg().guardianSlashCase({ caseId: 0n });
        expect(c.status).toBe(GuardianSlashStatus.NONE);
        expect(c.slashBps).toBe(0);
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
