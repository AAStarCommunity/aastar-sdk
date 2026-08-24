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
describe('AAStarCommitteeValidator ABI (YetAnotherAA-Validator #237)', () => {
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
            'lastSetMutationBlock',
        ]) {
            expect(fns(AAStarCommitteeValidatorABI), `missing ${f}`).toContain(f);
        }
    });

    it('exposes the epoch controls the CC-104 runbook needs (both steps, not just the flip)', () => {
        // committeeActive() flips with setEpochLength, but requiredQuorum() also needs a pinned
        // snapshot — a runbook that only calls setEpochLength leaves nothing able to validate.
        expect(fns(AAStarCommitteeValidatorABI)).toContain('setEpochLength');
        expect(fns(AAStarCommitteeValidatorABI)).toContain('snapshotEpoch');
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

describe('guardian-slash surface (SuperPaymaster CC-89 4.4.0)', () => {
    it('BLSAggregator carries the bounded exit and two-phase fraud-proof additions', () => {
        for (const f of [
            'executeGuardianSlash',
            'queueGuardianSlash',
            'fraudProofVerifier',
            'setFraudProofVerifier',
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
    });

    it('Registry carries the proposal-scoped aggregate uplift cap', () => {
        for (const f of [
            'maxAggregateCreditUpliftPerProposal',
            'setMaxAggregateCreditUpliftPerProposal',
        ]) {
            expect(fns(RegistryABI), `missing ${f}`).toContain(f);
        }
    });

    it('AirAccountExtension carries the P256 guardian-addition timelock', () => {
        expect(sigs(AirAccountExtensionABI)).toContain('proposeP256GuardianAddition(bytes32,bytes32)');
    });
});
