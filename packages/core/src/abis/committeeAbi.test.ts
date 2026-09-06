import { describe, expect, it } from 'vitest';
import {
    AAStarAirAccountV7ABI,
    AAStarCommitteeValidatorABI,
    BLSAggregatorABI,
    AirAccountExtensionABI,
    RegistryABI,
} from './index.js';

type AbiEntry = { type: string; name?: string; inputs?: { type: string }[] };
const fns = (abi: unknown) => new Set((abi as AbiEntry[]).filter((e) => e.type === 'function').map((e) => e.name!));
const sigs = (abi: unknown) =>
    new Set(
        (abi as AbiEntry[])
            .filter((e) => e.type === 'function')
            .map((e) => `${e.name}(${(e.inputs ?? []).map((i) => i.type).join(',')})`)
    );

/**
 * These ABIs are VENDORED from upstream repos, so nothing in a normal build fails when one of them
 * silently loses a function — and `abi:sync` cannot see the AAStarAirAccountV7 case at all, because
 * that contract sits in KNOWN_DRIFT for its intentional Extension merge. That whitelist is exactly
 * what hid `enrollInCommitteeValidator` going missing. These assertions are the backstop.
 */
/**
 * ## A presence list cannot tell "lost by accident" from "removed on purpose"
 *
 * This block was written against YetAnotherAA-Validator **#237** and required
 * `lastSetMutationBlock`. Upstream **#244** (CC-115 D2, 2026-08-30) replaced the block-start
 * snapshot model with the epoch-pinned one and removed it, along with `rootAtBlockStart` and
 * `countAtBlockStart`.
 *
 * So when the vendored ABI was finally re-generated from the current source, **this test failed** —
 * a hand-maintained "must be present" list is a ratchet, and it ratchets against correct upstream
 * removals exactly as hard as against accidental ones. It had no way to tell them apart, and its
 * failure message ("missing lastSetMutationBlock") pointed at the fix rather than at the cause.
 *
 * The list is kept, because the case it was written for is real — `enrollInCommitteeValidator`
 * did go missing under `KNOWN_DRIFT`. But it is now the WEAKER of two checks. The stronger one
 * lives in `actions/committee.test.ts`: it records the function names the reader actually calls
 * and requires the ABI to declare each of them. That one derives its list from behaviour, so an
 * upstream removal of something nobody calls does not fail it, and a removal of something we DO
 * call fails it without anyone editing a list.
 *
 * Neither can answer the question that actually mattered here — **is it in the deployed
 * bytecode?** No unit test can; that belongs to the drift gate, and this ABI was in no sync script
 * at all, which is why it went four functions stale unnoticed.
 */
describe('AAStarCommitteeValidator ABI (YetAnotherAA-Validator #244, epoch-pinned)', () => {
    it('is exported and non-empty', () => {
        expect(Array.isArray(AAStarCommitteeValidatorABI)).toBe(true);
        expect((AAStarCommitteeValidatorABI as AbiEntry[]).length).toBeGreaterThan(0);
    });

    it('carries every function the SDK committee reader calls', () => {
        // If any of these disappear, actions/committee.ts fails at runtime with an opaque
        // "function not found", not at build time.
        for (const f of [
            'committeeActive',
            'requiredQuorum',
            'TREE_DEPTH',
            'activeCount',
            'enrolledAccount',
            'getMerkleProof',
            // 'lastSetMutationBlock' — REMOVED upstream at #244. Absent from the deployed bytecode
            // at 0x7ac7E9d4… (measured), so requiring it here kept a call alive that always
            // reverted. Do not re-add: see the note above the describe.
        ]) {
            expect(fns(AAStarCommitteeValidatorABI), `missing ${f}`).toContain(f);
        }
    });

    it('exposes the epoch controls the CC-104 runbook needs (both steps, not just the flip)', () => {
        // committeeActive() flips with setEpochLength, but requiredQuorum() also needs a pinned
        // snapshot — a runbook that only calls setEpochLength leaves nothing able to validate.
        expect(fns(AAStarCommitteeValidatorABI)).toContain('setEpochLength');
        // By SIGNATURE, not by name. The pre-#244 ABI declared `snapshotEpoch()` while the contract
        // has `snapshotEpoch(bytes32[] activeNodeIds)` — a keeper-called state change, not a getter.
        // A name-only assertion passed against the wrong shape, and a selector probe then reported
        // the function "absent" when it was present all along. Name and signature are different
        // questions, and this file has both helpers; the weaker one was chosen here by habit.
        expect(sigs(AAStarCommitteeValidatorABI)).toContain('snapshotEpoch(bytes32[])');
        expect(fns(AAStarCommitteeValidatorABI)).toContain('epochPinned');
    });

    it('getMerkleProof returns (slot, proof) so callers can build a CommitteeSigner', () => {
        const e = (AAStarCommitteeValidatorABI as any[]).find((x) => x.name === 'getMerkleProof');
        expect(e.inputs.map((i: any) => i.type)).toEqual(['bytes32']);
        expect(e.outputs.map((o: any) => o.type)).toEqual(['uint256', 'bytes32[]']);
    });
});

describe('AAStarAirAccountV7 ABI — the KNOWN_DRIFT blind spot', () => {
    it('has enrollInCommitteeValidator (missing until CC-103; abi:sync stayed green)', () => {
        expect(fns(AAStarAirAccountV7ABI)).toContain('enrollInCommitteeValidator');
    });

    it('has proposeGuardianAddition (same omission)', () => {
        expect(sigs(AAStarAirAccountV7ABI)).toContain('proposeGuardianAddition(address)');
    });

    it('still carries the merged Extension surface the raw upstream ABI lacks', () => {
        // The merge is deliberate (fallback -> delegatecall). Re-vendoring the RAW upstream ABI to
        // "fix" a drift report would drop these and break every consumer calling them at the account.
        for (const f of ['addP256Guardian', 'approveRecovery', 'bindERC8004AgentWallet']) {
            expect(fns(AAStarAirAccountV7ABI), `lost merged Extension fn ${f}`).toContain(f);
        }
    });

    it('keeps the cross-repo owner-auth view stable (INTERFACES.md contract)', () => {
        expect(sigs(AAStarAirAccountV7ABI)).toContain('isValidOwnerAuth(bytes32,bytes)');
    });
});

/**
 * ⚠️ PROVENANCE WARNING — CC-50 B2, STILL OPEN (narrowed).
 *
 * The surface asserted below comes from SuperPaymaster `03713feb` (Registry 5.7.0 /
 * BLSAggregator 4.6.0), which is a COMMITTED, PUSHED, CLEAN revision on the experiment branch
 * `codex/repcredit-e2e-evidence-20260823` — pinned byte-for-byte in `scripts/upstream-abi-pin.json`
 * and enforced by `pnpm run check:abi-drift:strict`. That is strictly better than the previous
 * state (a sibling repo's WORKING TREE, unattributable to any commit), but it is still:
 *
 *   - NOT merged to SuperPaymaster main,
 *   - NOT tagged (git describe: v5.4.2-7-g03713feb),
 *   - NOT deployed to any public chain.
 *
 * So this block asserts the SDK matches an experiment REVISION. Drift against the eventual
 * released surface remains invisible to it. repo:sp still owes CC-50 a merged/tagged commit;
 * when it lands, re-copy from that tag's `out/`, update the pin, and realign these assertions.
 *
 * Do NOT publish a release that contains this surface until that happens.
 */
describe('guardian-slash surface (SuperPaymaster Registry 5.7.0 / BLSAggregator 4.6.0 @ 03713feb — EXPERIMENT REVISION, see warning above)', () => {
    it('BLSAggregator carries the bounded exit and two-phase fraud-proof additions', () => {
        for (const f of [
            'executeGuardianSlash',
            'queueGuardianSlash',
            'fraudProofVerifier',
            // 4.6.0 replaced the instant setter with a timelocked propose/apply rotation.
            'proposeFraudProofVerifier',
            'applyFraudProofVerifier',
            'cancelFraudProofVerifierRotation',
            'pendingFraudProofVerifier',
            'pendingFraudProofVerifierReadyAt',
            'VERIFIER_ROTATION_DELAY',
            'guardianSlashed',
            'proposalSignersCommitment',
            'requestGuardianExit',
            'cancelGuardianExit',
            'consumeGuardianExit',
            'guardianExitRequests',
            'guardianSlashCases',
            'pendingGuardianSlashCount',
        ]) {
            expect(fns(BLSAggregatorABI), `missing ${f}`).toContain(f);
        }
        // The instant setter must be GONE: leaving it in the SDK copy would let a caller encode a
        // selector the deployed contract no longer has, i.e. a bare revert (see CC-50 no-silent-stubs).
        expect(fns(BLSAggregatorABI)).not.toContain('setFraudProofVerifier');
    });

    /**
     * CC-49 HIGH-A domain separation (4.6.0). These are what bind a quorum signature to ONE
     * aggregator and ONE purpose; without them in the SDK's copy the evidence runner cannot
     * reconstruct — or cross-check — the preimage the contract will verify.
     */
    it('BLSAggregator exposes the versioned BLS domain and its path tags', () => {
        for (const f of [
            'DOMAIN_NAME',
            'domainSeparator',
            'TAG_REPUTATION',
            'TAG_QUEUE_SLASH',
            'TAG_EXECUTE_SLASH',
            'TAG_POP',
            'TAG_PROPOSAL',
            'TAG_SIGNERS_COMMITMENT',
            'TAG_FRAUD_PROOF',
            'reputationMessageHash',
            'popDigest',
            'fraudProofDigest',
        ]) {
            expect(fns(BLSAggregatorABI), `missing ${f}`).toContain(f);
        }
        expect(sigs(BLSAggregatorABI)).toContain('reputationMessageHash(uint256,address[],uint256[],uint256)');
    });

    it('Registry carries the unified credit policy (per-proposal cap + total exposure)', () => {
        for (const f of [
            'maxAggregateCreditUpliftPerProposal',
            'maxTotalCreditExposure',
            'totalCreditExposure',
            'setCreditPolicy',
            'blsDomainSeparator',
        ]) {
            expect(fns(RegistryABI), `missing ${f}`).toContain(f);
        }
        // CC-115 B4: Registry 5.8.0 NARROWED this from (perProposalCap, totalCap, baseline,
        // applyBaseline) to caps only. The dropped `applyBaseline` is why the measurement harness
        // in scripts/repcredit-e2e.ts can no longer restore totalCreditExposure and now fails
        // loudly instead — asserted here so a future widening is a deliberate review, not a
        // surprise.
        expect(sigs(RegistryABI)).toContain('setCreditPolicy(uint256,uint256)');
        expect(sigs(RegistryABI)).not.toContain('setCreditPolicy(uint256,uint256,uint256,bool)');
        // 5.7.0 folded the single-value setter into setCreditPolicy.
        expect(fns(RegistryABI)).not.toContain('setMaxAggregateCreditUpliftPerProposal');
    });

    it('AirAccountExtension carries the P256 guardian-addition timelock', () => {
        expect(sigs(AirAccountExtensionABI)).toContain('proposeP256GuardianAddition(bytes32,bytes32)');
    });
});
