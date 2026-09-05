/**
 * CC-103 committee per-signer wire — on-chain conformance E2E (READ-ONLY, no tx).
 *
 * Verifies the SDK's committee encoder against the LIVE Sepolia `AAStarCommitteeValidator`
 * (0x1A8Db639…) rather than against hand-made fixtures:
 *
 *   1. live committee state          — committeeActive / requiredQuorum / TREE_DEPTH / activeCount
 *   2. real Merkle proofs            — getMerkleProof() for every node actually in the active set
 *   3. proof folding                 — mirror of the contract's _verifyMerkle; must reproduce
 *                                      the on-chain runningRoot() from each real proof
 *   4. encode → re-parse round trip  — decode our own payload with the contract's exact parser
 *                                      (offsets, stride, slot bound, strict-ascending rule)
 *   5. accountId absence             — B2: the account injects address(this); we never emit it
 *   6. legacy back-compat            — committeeActive()==false path stays byte-identical
 *
 * What this CANNOT do: a positive `validate()` call. Committee mode is off on-chain
 * (`epochLength == 0`) and turning it on is the validator owner's action, tracked as CC-104.
 * That step is reported, not simulated.
 *
 * Env: SEPOLIA_RPC_URL (or RPC_URL) from .env.sepolia.
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import { concat, createPublicClient, http, keccak256, numberToHex, parseAbiItem, size, toHex, type Address, type Hex } from 'viem';
import { sepolia } from 'viem/chains';
import {
    AAStarCommitteeValidatorABI,
    CANONICAL_ADDRESSES,
    COMMITTEE_QUORUM_UNAVAILABLE,
    DVT_TIER_T2,
    assertCommitteeSubmittable,
    fetchCommitteeSigners,
    getCommitteeState,
    getMountedDvtValidator,
    isAccountEnrolled,
    readFrozenRootAgreement,
    encodeCommitteeBLSBlock,
    encodeDVTAccountSignature,
    type CommitteeSigner,
} from '@aastar/core';

dotenv.config({ path: path.resolve(import.meta.dirname, '../../../.env.sepolia') });

const RPC = process.env.SEPOLIA_RPC_URL || process.env.RPC_URL;
if (!RPC) throw new Error('missing SEPOLIA_RPC_URL / RPC_URL in .env.sepolia');

const pc = createPublicClient({ chain: sepolia, transport: http(RPC) });
// The v0.31.0 stack IS canonical now (airaccount-contract published all 12 addresses on CC-48;
// the transitional COMMITTEE_STACK_ADDRESSES group existed only while they were incomplete).
const canonical = CANONICAL_ADDRESSES[sepolia.id];
const stack = {
    factory: canonical.airAccountFactoryV7 as Address,
    router: canonical.aaStarValidator as Address,
    committeeValidator: canonical.aaStarBLSAlgorithm as Address,
    accountImpl: canonical.airAccountV7Impl as Address,
};

/**
 * A positive control for `isAccountEnrolled`, DERIVED FROM CHAIN rather than pinned.
 *
 * This used to be the literal `0xf249d5708cC3e1Dff42F5B36935FF270BeC403A0`, and the check failed.
 * Measured: that address is a 45-byte EIP-1167 proxy whose `validatorRouter()` is
 * `0xA15127e8…` — the **v0.31.0** router. It belongs to the previous stack generation, so it is
 * correctly not enrolled on the v0.33.0 committee validator. The fixture was stale, not the SDK.
 *
 * A pinned "known enrolled account" goes stale on exactly the event this suite exists to track: a
 * stack redeploy. Reading `AccountEnrolled` and keeping one that is STILL enrolled makes the
 * control describe the deployment under test instead of the one it was written against.
 *
 * It throws rather than skipping when it finds none: "no enrolled account in the recent window"
 * and "the positive control passed" must not look alike.
 */
async function findEnrolledAccount(pc: ReturnType<typeof createPublicClient>): Promise<Address> {
    const latest = await pc.getBlockNumber();
    const from = latest > 45_000n ? latest - 45_000n : 0n;
    const logs = await pc.getLogs({
        address: stack.committeeValidator,
        event: parseAbiItem('event AccountEnrolled(address indexed account)'),
        fromBlock: from,
        toBlock: latest,
    });
    // Newest first: an account enrolled and later unenrolled must not be picked just because it
    // appears in the log. `enrolledAccount()` is the authority; the event only nominates candidates.
    for (const log of [...logs].reverse()) {
        const account = (log as { args: { account?: Address } }).args.account;
        if (account && (await isAccountEnrolled(pc, stack.committeeValidator, account))) return account;
    }
    throw new Error(
        `no still-enrolled account found in AccountEnrolled logs on ${stack.committeeValidator} ` +
            `over blocks ${from}..${latest}. The positive control for isAccountEnrolled cannot be ` +
            'built, so this run would only be testing the negative case.',
    );
}

let failures = 0;
const ok = (label: string, detail = '') => console.log(`  PASS  ${label}${detail ? ' — ' + detail : ''}`);
const bad = (label: string, detail: string) => {
    failures++;
    console.log(`  FAIL  ${label} — ${detail}`);
};
const check = (cond: boolean, label: string, detail = '') => (cond ? ok(label, detail) : bad(label, detail || 'assertion failed'));

const readValidator = (functionName: string, args: readonly unknown[] = []) =>
    pc.readContract({
        address: stack.committeeValidator,
        abi: AAStarCommitteeValidatorABI,
        functionName,
        args: args as never,
    });

/** Byte-for-byte mirror of AAStarCommitteeValidator._verifyMerkle's folding. */
function foldMerkle(slot: bigint, leaf: Hex, proof: readonly Hex[]): Hex {
    let cur = leaf;
    let idx = slot;
    for (const sib of proof) {
        // Contract: keccak256(abi.encode(cur, sib)) — abi.encode of two bytes32 is plain concatenation.
        cur = (idx & 1n) === 0n ? keccak256(concat([cur, sib])) : keccak256(concat([sib, cur]));
        idx >>= 1n;
    }
    return cur;
}

/** Mirror of the contract's committee-payload parser (AAStarCommitteeValidator.sol ~line 495). */
function parseCommitteeBlock(payload: Hex, treeDepth: number) {
    const bytes = payload.slice(2);
    const word = (byteOff: number) => `0x${bytes.slice(byteOff * 2, byteOff * 2 + 64)}` as Hex;
    const k = Number(BigInt(word(0)));
    const perSigner = 64 + treeDepth * 32;
    const signers: { nodeId: Hex; slot: bigint; proof: Hex[] }[] = [];
    let off = 32;
    let prev = 0n;
    for (let i = 0; i < k; i++) {
        const nodeId = word(off);
        const slot = BigInt(word(off + 32));
        if (slot >= 1n << BigInt(treeDepth)) throw new Error(`signer ${i}: non-canonical slot ${slot}`);
        if (i !== 0 && BigInt(nodeId) <= prev) throw new Error(`signer ${i}: nodeIds not strictly ascending`);
        prev = BigInt(nodeId);
        const proof: Hex[] = [];
        for (let l = 0; l < treeDepth; l++) proof.push(word(off + 64 + l * 32));
        signers.push({ nodeId, slot, proof });
        off += perSigner;
    }
    const blsSig = `0x${bytes.slice(off * 2)}` as Hex;
    return { k, signers, blsSig, consumed: off };
}

async function main() {
    const block = await pc.getBlockNumber();
    console.log(`CC-103 committee wire E2E — Sepolia block ${block}`);
    console.log(`validator ${stack.committeeValidator}  router ${stack.router}\n`);

    // ── 1. live committee state ───────────────────────────────────────────────────────────────
    console.log('[1] live committee state');
    const [active, quorum, depthRaw, activeCount, runningRoot] = (await Promise.all([
        readValidator('committeeActive'),
        readValidator('requiredQuorum'),
        readValidator('TREE_DEPTH'),
        readValidator('activeCount'),
        readValidator('runningRoot'),
    ])) as [boolean, bigint, bigint, bigint, Hex];
    const treeDepth = Number(depthRaw);
    const perSigner = 64 + treeDepth * 32;
    console.log(`      committeeActive=${active}  activeCount=${activeCount}  TREE_DEPTH=${treeDepth}  perSigner=${perSigner}`);
    console.log(`      requiredQuorum=${quorum === COMMITTEE_QUORUM_UNAVAILABLE ? 'type(uint256).max (fail-closed sentinel)' : quorum}`);
    check(treeDepth === 14, 'TREE_DEPTH read from chain, not assumed', `${treeDepth}`);
    check(perSigner === 512, 'perSigner derived from on-chain depth', `${perSigner} bytes`);

    // ── 2. real active-set members + their real proofs ────────────────────────────────────────
    console.log('\n[2] real active-set members + on-chain Merkle proofs');
    const logs = await pc.getLogs({
        address: stack.committeeValidator,
        event: {
            type: 'event',
            name: 'SlotAssigned',
            inputs: [
                { name: 'nodeId', type: 'bytes32', indexed: true },
                { name: 'slot', type: 'uint256', indexed: false },
            ],
        },
        fromBlock: 'earliest',
        toBlock: 'latest',
    });
    const nodeIds = [...new Set(logs.map((l) => (l as any).args.nodeId as Hex))];
    check(nodeIds.length === Number(activeCount), 'SlotAssigned set matches activeCount()', `${nodeIds.length} nodes`);

    const signers: CommitteeSigner[] = [];
    for (const nodeId of nodeIds) {
        const [slot, proof] = (await readValidator('getMerkleProof', [nodeId])) as [bigint, readonly Hex[]];
        check(proof.length === treeDepth, `proof length for ${nodeId.slice(0, 10)}…`, `${proof.length} siblings`);
        signers.push({ nodeId, slot, merkleProof: [...proof] });
    }

    // ── 3. fold every real proof; must reproduce the on-chain root ────────────────────────────
    console.log('\n[3] fold real proofs with the contract algorithm -> compare to runningRoot()');
    console.log(`      runningRoot = ${runningRoot}`);
    for (const s of signers) {
        // leaf = nodeId itself (AAStarCommitteeValidator.sol:106 "leaf = nodeId, or 0 if empty";
        // validate() passes `nid` straight into _verifyMerkle).
        const folded = foldMerkle(BigInt(s.slot), s.nodeId, s.merkleProof);
        check(folded === runningRoot, `slot ${s.slot} proof folds to runningRoot`, folded === runningRoot ? '' : `got ${folded}`);
    }

    // ── 4. encode -> re-parse with the contract's parser ──────────────────────────────────────
    console.log('\n[4] encode with the SDK, re-parse with the contract parser');
    const blsSig = toHex(new Uint8Array(256));
    const blockHex = encodeCommitteeBLSBlock(signers, blsSig, treeDepth);
    const expectedLen = 32 + signers.length * perSigner + 256;
    check(size(blockHex) === expectedLen, 'encoded block length', `${size(blockHex)} == 32 + ${signers.length}*${perSigner} + 256`);

    const parsed = parseCommitteeBlock(blockHex, treeDepth);
    check(parsed.k === signers.length, 'nodeIdsLength decodes as the SIGNER COUNT', `k=${parsed.k}`);
    check(parsed.consumed + 256 === size(blockHex), 'parser consumes exactly up to the 256-byte blsSig');
    check(parsed.blsSig === blsSig, 'blsSig survives the round trip');

    const sortedIn = [...signers].sort((a, b) => (BigInt(a.nodeId) < BigInt(b.nodeId) ? -1 : 1));
    let fieldsOk = true;
    parsed.signers.forEach((p, i) => {
        const want = sortedIn[i];
        if (p.nodeId !== want.nodeId || p.slot !== BigInt(want.slot) || concat(p.proof) !== concat([...want.merkleProof])) {
            fieldsOk = false;
        }
    });
    check(fieldsOk, 'each parsed entry keeps its own nodeId+slot+proof after sorting');

    // The contract rejects non-ascending ids; our encoder must therefore always emit ascending.
    let ascending = true;
    for (let i = 1; i < parsed.signers.length; i++) {
        if (BigInt(parsed.signers[i].nodeId) <= BigInt(parsed.signers[i - 1].nodeId)) ascending = false;
    }
    check(ascending, 'emitted nodeIds are strictly ascending (contract rejects otherwise)');

    // Every parsed proof must still verify against the live root after the round trip.
    let allVerify = true;
    for (const p of parsed.signers) {
        if (foldMerkle(p.slot, p.nodeId, p.proof) !== runningRoot) allVerify = false;
    }
    check(allVerify, 're-parsed proofs still fold to the live runningRoot');

    // ── 5. accountId must not appear (B2) ─────────────────────────────────────────────────────
    console.log('\n[5] accountId absence (CC-103 B2)');
    const acct = (await findEnrolledAccount(pc)).slice(2).toLowerCase();
    check(!blockHex.toLowerCase().includes(acct), 'reference account address absent from the payload');
    check(BigInt(`0x${blockHex.slice(2, 66)}`) === BigInt(signers.length), 'first word is the signer count, not an accountId');

    // ── 6. legacy back-compat ─────────────────────────────────────────────────────────────────
    console.log('\n[6] legacy framing unchanged (committeeActive()==false path)');
    const p256 = { r: numberToHex(7, { size: 32 }), s: numberToHex(8, { size: 32 }) };
    const legacy = encodeDVTAccountSignature({ tier: DVT_TIER_T2, p256, nodeIds: [...nodeIds], blsSig });
    const legacyExpected = concat([
        numberToHex(DVT_TIER_T2, { size: 1 }),
        p256.r,
        p256.s,
        numberToHex(nodeIds.length, { size: 32 }),
        ...[...nodeIds].sort((a, b) => (BigInt(a) < BigInt(b) ? -1 : 1)),
        blsSig,
    ]);
    check(legacy === legacyExpected, 'legacy T2 bytes identical to the pre-committee layout');

    // ── 7. the SDK reader module against the LIVE validator ───────────────────────────────────
    // actions/committee.ts is unit-tested against a stubbed client, which by construction cannot
    // catch an ABI mismatch, a renamed getter, or a changed return shape. These calls do.
    console.log('\n[7] actions/committee.ts against the live validator');

    const mounted = await getMountedDvtValidator(pc, stack.router);
    check(
        mounted.toLowerCase() === stack.committeeValidator.toLowerCase(),
        'getMountedDvtValidator resolves algId 0x01 to the committee validator',
        mounted
    );

    const state = await getCommitteeState(pc, stack.committeeValidator);
    check(state.treeDepth === treeDepth, 'getCommitteeState.treeDepth matches the raw read', `${state.treeDepth}`);
    check(state.perSignerBytes === perSigner, 'getCommitteeState.perSignerBytes derived from it', `${state.perSignerBytes}`);
    check(state.active === active, 'getCommitteeState.active matches committeeActive()', `${state.active}`);
    check(state.activeCount === activeCount, 'getCommitteeState.activeCount matches', `${state.activeCount}`);
    check(
        state.quorumUsable === (quorum !== COMMITTEE_QUORUM_UNAVAILABLE),
        'getCommitteeState.quorumUsable flags the fail-closed sentinel',
        `${state.quorumUsable}`
    );

    const referenceEnrolledAccount = await findEnrolledAccount(pc);
    const enrolled = await isAccountEnrolled(pc, stack.committeeValidator, referenceEnrolledAccount);
    check(enrolled, `isAccountEnrolled sees a chain-derived enrolled account (${referenceEnrolledAccount})`);
    const notEnrolled = await isAccountEnrolled(pc, stack.committeeValidator, stack.router);
    check(!notEnrolled, 'isAccountEnrolled returns false for a never-enrolled address (negative)');

    const fetched = await fetchCommitteeSigners(pc, stack.committeeValidator, nodeIds);
    check(fetched.signers.length === nodeIds.length, 'fetchCommitteeSigners returns one signer per node');
    let fetchedOk = fetched.signers.length > 0;
    for (const s of fetched.signers) {
        if (s.merkleProof.length !== treeDepth) fetchedOk = false;
        // The proofs it shapes must be the SAME ones that fold to the live root — i.e. the helper
        // did not mix up which slot/proof belongs to which nodeId.
        if (foldMerkle(BigInt(s.slot), s.nodeId, s.merkleProof) !== runningRoot) fetchedOk = false;
    }
    check(fetchedOk, 'every fetched signer folds to the live runningRoot (slot/proof not mixed up)');
    // The staleness signal is no longer `lastSetMutationBlock` — that function was removed upstream
    // at #244 and is absent from the deployed bytecode, so reading it took the whole fetch down.
    // What the contract actually compares is the roots, so that is what is checked here.
    // Uses the shared reader rather than a fourth hand-rolled copy — three copies of this comparison
    // are how the removed field survived in two runners after the SDK dropped it.
    const fresh = await readFrozenRootAgreement(pc, stack.committeeValidator);
    const [liveRoot, epochNow, frozenRoot] = [fresh.runningRoot, fresh.epoch, fresh.frozenRoot];
    check(
        typeof fetched.atBlock === 'bigint' && fresh.agrees,
        'proofs fetched now would verify against the FROZEN epochSetRoot(e-1)',
        // e-1, not e. `validate()` reads setRoot[e-1]; comparing against epochSetRoot(e) is the
        // off-by-one that passes today only because all three roots currently coincide.
        `atBlock=${fetched.atBlock} epoch=${epochNow} running=${liveRoot.slice(0, 12)}… frozen(e-1)=${frozenRoot.slice(0, 12)}…`
    );

    // Encoding what the reader produced must give the same bytes as the hand-built path above.
    const fromReader = encodeCommitteeBLSBlock(fetched.signers, blsSig, state.treeDepth);
    check(fromReader === blockHex, 'encodeCommitteeBLSBlock(reader output) == encode(hand-built)');

    // assertCommitteeSubmittable must REFUSE while committee mode is off — this is the live proof
    // that the guard fires, not a stubbed one.
    let refused = '';
    try {
        await assertCommitteeSubmittable(pc, stack.committeeValidator, referenceEnrolledAccount, 3);
    } catch (e: any) {
        refused = e?.message ?? '';
    }
    if (active) {
        check(refused === '', 'assertCommitteeSubmittable passes while committee is ON');
    } else {
        check(
            /committeeActive\(\) is false/.test(refused),
            'assertCommitteeSubmittable REFUSES while committee is off, naming the cause',
            refused.slice(0, 80)
        );
    }

    // ── verdict ───────────────────────────────────────────────────────────────────────────────
    console.log('\n─────────────────────────────────────────────────────────────');
    if (failures > 0) {
        console.error(`RESULT: ${failures} check(s) FAILED`);
        process.exit(1);
    }
    console.log('RESULT: all read-only conformance checks PASSED');
    console.log('');
    console.log('NOT COVERED — committee positive validate() path is BLOCKED on-chain:');
    console.log(`  committeeActive() = ${active} (epochLength == 0)`);
    console.log(`  requiredQuorum()  = ${quorum === COMMITTEE_QUORUM_UNAVAILABLE ? 'type(uint256).max sentinel' : quorum}`);
    console.log('  Unblocking needs BOTH, by the validator owner (CC-104, @repo:dvt):');
    console.log('    (a) setEpochLength(N != 0)   -> committeeActive() == true');
    console.log('    (b) snapshotEpoch()          -> pins setRoot[e-1] so requiredQuorum() stops');
    console.log('        returning the sentinel; without it committeeActive is true but NOTHING validates.');
}

main().catch((e) => {
    console.error('CC103-E2E FAIL:', e?.shortMessage || e?.message || e);
    if (e?.stack) console.error(e.stack.split('\n').slice(0, 5).join('\n'));
    process.exit(1);
});
