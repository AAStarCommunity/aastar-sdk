import { describe, expect, it, vi } from 'vitest';
import type { Address, Hex, PublicClient } from 'viem';
import {
    ALG_ID_DVT,
    assertCommitteeSubmittable,
    fetchCommitteeSigners,
    getCommitteeState,
    getMountedDvtValidator,
    isAccountEnrolled,
} from './committee.js';
import { COMMITTEE_QUORUM_UNAVAILABLE } from '../crypto/dvtWire.js';
import { CANONICAL_ADDRESSES } from '../addresses.js';
import { AAStarCommitteeValidatorABI } from '../abis/index.js';

// Read the canonical pins rather than literals. These are only stub targets — the assertions here
// never touch a chain — but a hardcoded address silently goes stale on a canonical bump and then
// the file reads as if it were exercising the current stack when it is not (CC-45 shipped exactly
// that). T5.2.1 moved both of these from the v0.31.0 stack to v0.33.0.
const VALIDATOR = CANONICAL_ADDRESSES[11155111].aaStarBLSAlgorithm as Address;
const ROUTER = CANONICAL_ADDRESSES[11155111].aaStarValidator as Address;
const ACCOUNT = '0xf249d5708cC3e1Dff42F5B36935FF270BeC403A0' as Address;
const nid = (n: number): Hex => `0x${n.toString(16).padStart(64, '0')}`;

/**
 * Minimal PublicClient stub: `reads` maps a functionName to a value or a (args) => value.
 * Every call is recorded so tests can assert HOW it was called (block pinning, address, args),
 * not just what came back.
 */
function stubClient(reads: Record<string, unknown | ((args: readonly unknown[]) => unknown)>, blockNumber = 100n) {
    const calls: { functionName: string; address: Address; args?: readonly unknown[]; blockNumber?: bigint }[] = [];
    const client = {
        getBlockNumber: vi.fn(async () => blockNumber),
        readContract: vi.fn(async (p: any) => {
            calls.push({ functionName: p.functionName, address: p.address, args: p.args, blockNumber: p.blockNumber });
            const v = reads[p.functionName];
            if (v === undefined) throw new Error(`stub: unexpected read ${p.functionName}`);
            return typeof v === 'function' ? (v as (a: readonly unknown[]) => unknown)(p.args ?? []) : v;
        }),
    } as unknown as PublicClient;
    return { client, calls };
}

const healthy = {
    committeeActive: true,
    requiredQuorum: 2n,
    TREE_DEPTH: 14n,
    activeCount: 3n,
    enrolledAccount: true,
};

describe('getMountedDvtValidator', () => {
    it('resolves algId 0x01 on the router', async () => {
        const { client, calls } = stubClient({ getAlgorithm: VALIDATOR });
        await expect(getMountedDvtValidator(client, ROUTER)).resolves.toBe(VALIDATOR);
        expect(calls[0]).toMatchObject({ functionName: 'getAlgorithm', address: ROUTER, args: [ALG_ID_DVT] });
        expect(ALG_ID_DVT).toBe(0x01);
    });
});

describe('getCommitteeState', () => {
    it('derives perSignerBytes from the CHAIN-read depth, not a constant', async () => {
        const { client } = stubClient({ ...healthy, TREE_DEPTH: 14n });
        await expect(getCommitteeState(client, VALIDATOR)).resolves.toMatchObject({
            active: true,
            requiredQuorum: 2n,
            quorumUsable: true,
            treeDepth: 14,
            perSignerBytes: 512,
            activeCount: 3n,
        });
    });

    it('follows the validator if upstream changes TREE_DEPTH (CC-103 Q4 — no hardcoding)', async () => {
        const { client } = stubClient({ ...healthy, TREE_DEPTH: 20n });
        const s = await getCommitteeState(client, VALIDATOR);
        expect(s.treeDepth).toBe(20);
        expect(s.perSignerBytes).toBe(64 + 20 * 32);
    });

    it('pins every read to ONE block so the fields cannot straddle an epoch rollover', async () => {
        const { client, calls } = stubClient(healthy, 4242n);
        await getCommitteeState(client, VALIDATOR);
        const reads = calls.filter((c) => c.functionName !== 'getBlockNumber');
        expect(reads.length).toBeGreaterThanOrEqual(4);
        // If any read were unpinned it could observe a different committee configuration.
        for (const c of reads) expect(c.blockNumber).toBe(4242n);
    });

    it('flags the fail-closed sentinel instead of reporting an absurd quorum', async () => {
        const { client } = stubClient({ ...healthy, requiredQuorum: COMMITTEE_QUORUM_UNAVAILABLE });
        const s = await getCommitteeState(client, VALIDATOR);
        expect(s.requiredQuorum).toBe(COMMITTEE_QUORUM_UNAVAILABLE);
        expect(s.quorumUsable).toBe(false);
    });

    it('reports committee OFF without inventing a quorum', async () => {
        const { client } = stubClient({
            ...healthy,
            committeeActive: false,
            requiredQuorum: COMMITTEE_QUORUM_UNAVAILABLE,
        });
        const s = await getCommitteeState(client, VALIDATOR);
        expect(s.active).toBe(false);
        expect(s.quorumUsable).toBe(false);
    });
});

describe('isAccountEnrolled', () => {
    it('reads enrolledAccount for the given account', async () => {
        const { client, calls } = stubClient({ enrolledAccount: (a: readonly unknown[]) => a[0] === ACCOUNT });
        await expect(isAccountEnrolled(client, VALIDATOR, ACCOUNT)).resolves.toBe(true);
        expect(calls[0]).toMatchObject({ functionName: 'enrolledAccount', address: VALIDATOR, args: [ACCOUNT] });
        await expect(isAccountEnrolled(client, VALIDATOR, ROUTER)).resolves.toBe(false);
    });
});

describe('fetchCommitteeSigners', () => {
    const proofOf = (slot: bigint): Hex[] => Array.from({ length: 14 }, (_, i) => nid(Number(slot) * 100 + i));

    it('shapes each node into a CommitteeSigner carrying its own slot and proof', async () => {
        const slots: Record<string, bigint> = { [nid(1)]: 0n, [nid(2)]: 1n, [nid(3)]: 2n };
        const { client } = stubClient({
            getMerkleProof: (a: readonly unknown[]) => {
                const s = slots[a[0] as string];
                return [s, proofOf(s)];
            },
        });
        const { signers, atBlock } = await fetchCommitteeSigners(client, VALIDATOR, [
            nid(1),
            nid(2),
            nid(3),
        ]);
        expect(signers).toHaveLength(3);
        // Each entry must keep ITS OWN slot/proof — a mix-up here produces a well-formed payload
        // whose proofs authenticate the wrong signers.
        for (const s of signers) {
            expect(s.slot).toBe(slots[s.nodeId]);
            expect(s.merkleProof).toEqual(proofOf(slots[s.nodeId]));
            expect(s.merkleProof).toHaveLength(14);
        }
        expect(atBlock).toBe(100n);
    });

    it('reads every proof at the SAME block, so the set cannot mutate mid-fetch', async () => {
        const { client, calls } = stubClient(
            { getMerkleProof: () => [0n, proofOf(0n)] },
            777n
        );
        await fetchCommitteeSigners(client, VALIDATOR, [nid(1), nid(2)]);
        for (const c of calls.filter((x) => x.functionName !== 'getBlockNumber')) {
            expect(c.blockNumber).toBe(777n);
        }
    });

    it('calls ONLY functions the vendored ABI declares', async () => {
        /*
         * The test this replaces asserted `lastSetMutationBlock` came back as 99n — and it passed for
         * as long as the function had not existed on chain, because a stub answers whatever it is
         * asked. Measured on Sepolia: that selector is absent from the deployed committee validator's
         * runtime bytecode, so the real call reverted and took the whole fetch down with it, AFTER
         * every proof had been fetched successfully.
         *
         * A mock cannot tell you a function exists. What it CAN check is cheaper and still worth
         * having: that the names this module calls are at least declared by the ABI it ships with.
         * That is one of the two ways this bug could have been caught early — the other is
         * ABI-vs-deployed-bytecode, which no unit test can do and which belongs in the drift gate.
         */
        const { client, calls } = stubClient({ getMerkleProof: () => [0n, proofOf(0n)] }, 100n);
        await fetchCommitteeSigners(client, VALIDATOR, [nid(1)]);
        const declared = new Set(
            (AAStarCommitteeValidatorABI as readonly { type: string; name?: string }[])
                .filter((e) => e.type === 'function')
                .map((e) => e.name),
        );
        const called = calls.filter((c) => c.functionName !== 'getBlockNumber').map((c) => c.functionName);
        // Control: the meter must be able to say no. An empty `called` would pass vacuously, and an
        // ABI that declared everything would too.
        expect(called.length).toBeGreaterThan(0);
        expect(declared.has('lastSetMutationBlock')).toBe(false); // removed upstream at #244
        for (const fn of called) expect(declared.has(fn)).toBe(true);
    });

    it('no longer declares the four functions the deployed validator does not have', () => {
        // Guard against re-vendoring a pre-#244 copy. Three were removed when the block-start
        // snapshot model became the epoch-pinned one; the fourth was never missing — the old ABI
        // had `snapshotEpoch()` where the contract has `snapshotEpoch(bytes32[])`, which is why a
        // selector probe reported it absent. Name and signature are different questions.
        const fns = (AAStarCommitteeValidatorABI as readonly { type: string; name?: string; inputs?: unknown[] }[])
            .filter((e) => e.type === 'function');
        const names = new Set(fns.map((e) => e.name));
        for (const gone of ['lastSetMutationBlock', 'rootAtBlockStart', 'countAtBlockStart']) {
            expect(names.has(gone)).toBe(false);
        }
        const snapshot = fns.find((e) => e.name === 'snapshotEpoch');
        expect(snapshot?.inputs).toHaveLength(1); // bytes32[] activeNodeIds — not the zero-arg getter
    });
});

describe('assertCommitteeSubmittable', () => {
    it('passes when committee is on, the account is enrolled, and quorum is met', async () => {
        const { client } = stubClient(healthy);
        await expect(assertCommitteeSubmittable(client, VALIDATOR, ACCOUNT, 3)).resolves.toMatchObject({
            active: true,
            quorumUsable: true,
        });
    });

    it('names committee-off FIRST — the caller should encode legacy, not chase a quorum', async () => {
        const { client } = stubClient({
            ...healthy,
            committeeActive: false,
            requiredQuorum: COMMITTEE_QUORUM_UNAVAILABLE,
        });
        await expect(assertCommitteeSubmittable(client, VALIDATOR, ACCOUNT, 3)).rejects.toThrow(
            /committeeActive\(\) is false/
        );
        await expect(assertCommitteeSubmittable(client, VALIDATOR, ACCOUNT, 3)).rejects.toThrow(/LEGACY framing/);
    });

    it('names the missing enrollment rather than failing later on-chain', async () => {
        const { client } = stubClient({ ...healthy, enrolledAccount: false });
        await expect(assertCommitteeSubmittable(client, VALIDATOR, ACCOUNT, 3)).rejects.toThrow(
            /has not enrolled/
        );
        await expect(assertCommitteeSubmittable(client, VALIDATOR, ACCOUNT, 3)).rejects.toThrow(
            /enrollInCommitteeValidator/
        );
    });

    it('explains the sentinel (needs snapshotEpoch) instead of "need 1.1e77 signers"', async () => {
        const { client } = stubClient({ ...healthy, requiredQuorum: COMMITTEE_QUORUM_UNAVAILABLE });
        const p = assertCommitteeSubmittable(client, VALIDATOR, ACCOUNT, 3);
        await expect(p).rejects.toThrow(/fail-closed sentinel/);
        await expect(assertCommitteeSubmittable(client, VALIDATOR, ACCOUNT, 3)).rejects.toThrow(/snapshotEpoch/);
    });

    it('rejects an under-quorum signer count before it costs gas', async () => {
        const { client } = stubClient({ ...healthy, requiredQuorum: 3n });
        await expect(assertCommitteeSubmittable(client, VALIDATOR, ACCOUNT, 2)).rejects.toThrow(
            /only 2 committee signer/
        );
        await expect(assertCommitteeSubmittable(client, VALIDATOR, ACCOUNT, 3)).resolves.toBeTruthy();
    });

    it('checks committee-off BEFORE enrollment — the more actionable cause wins', async () => {
        // Both wrong: the message must be the one the caller can act on (encode legacy), not
        // "go enroll" for a validator that is not even in committee mode.
        const { client } = stubClient({
            ...healthy,
            committeeActive: false,
            enrolledAccount: false,
            requiredQuorum: COMMITTEE_QUORUM_UNAVAILABLE,
        });
        await expect(assertCommitteeSubmittable(client, VALIDATOR, ACCOUNT, 3)).rejects.toThrow(
            /committeeActive\(\) is false/
        );
    });
});
