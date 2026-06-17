/**
 * DVT real-node E2E — SDK-assembled combined signature accepted by the LIVE on-chain verifier.
 *
 * This is the airaccount-contract #63 Phase-B deliverable: it proves that the @aastar/core SDK
 * (the `dvtWire` encoder + `BLSSigner` aggregation, with ABIs from @aastar/core) can assemble the
 * DVT verifier proof from REAL DVT-node co-signatures, and that the deployed `AAStarBLSAlgorithm`
 * verifier on Sepolia ACCEPTS it (`validate(...) == 0`). Nothing here is mocked: two live DVT nodes
 * co-sign, the proof is built locally by the SDK, and the on-chain pairing check is the oracle.
 *
 * Flow (all live):
 *   1. Build a minimal ERC-4337 v0.7 PackedUserOperation for the test AA account.
 *   2. userOpHash = on-chain EntryPoint.getUserOpHash(userOp)               (authoritative hash).
 *   3. ownerAuth  = AA owner's EIP-191 personal_sign over userOpHash         (node Stage-1 gate).
 *   4. POST {userOp, ownerAuth} to node1 + node2 /signature/sign; each returns a 256-byte EIP-2537
 *      G2 signature + message:userOpHash. Assert message === our userOpHash (Stage-1 binding).
 *   5. Aggregate the two G2 signatures (G2 point addition) into the 256-byte aggregate. Cross-check
 *      two independent SDK paths: @noble G2-add of the EIP-2537 points, and core BLSSigner over the
 *      nodes' compact forms — both must produce the byte-identical aggregate.
 *   6. proof = dvtWire.encodeDVTVerifierProof([node1Id, node2Id], agg)       (= [nodeIds][blsSig]).
 *   7. AAStarBLSAlgorithm.validate(userOpHash, proof) → assert === 0n        (ACCEPTED on-chain).
 *   8. Negative control: a tampered proof (valid-point but wrong aggregate) must NOT validate.
 *
 *   pnpm exec tsx tests/regression/onchain-evidence/dvt-realnode-e2e.ts
 *
 * Requires: .env.sepolia (SEPOLIA_RPC_URL[/2/3], an owner key matching the AA account's owner()),
 *           and the two DVT nodes live on localhost:3001 / :3002.
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import { bls12_381 as noble } from '@noble/curves/bls12-381';
import {
    createPublicClient,
    createWalletClient,
    http,
    concat,
    numberToHex,
    type Address,
    type Hex,
    type PublicClient,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
// SDK under test — ABIs + crypto come ONLY from @aastar/core.
import {
    EntryPointABI,
    AAStarBLSAlgorithmABI,
    BLSSigner,
    encodeDVTVerifierProof,
    encodeG2Point,
    // Reads via the SDK actions (owner / getNonce / verifier validate) — 100% SDK API.
    airAccountActions,
    entryPointActions,
    blsAlgorithmActions,
} from '@aastar/core';

dotenv.config({ path: path.resolve(process.cwd(), '.env.sepolia') });

// ── Fixed, on-chain-registered inputs (verified, not assumed) ────────────────────────────────
const AA_ACCOUNT: Address = '0x45Dfe3D5938fDf5a8D30641C3FDA9c9fb1F31ba9';
const VERIFIER: Address = '0x68c381Ad3A2e3380F22840008027E9Ec2783F43A'; // AAStarBLSAlgorithm (Sepolia, v0.19.0-beta.2)
const ENTRY_POINT: Address = '0x0000000071727De22E5E9d8BAf0edAc6f37da032'; // EntryPoint v0.7
const NODES = [
    { url: 'http://localhost:3001', nodeId: '0xb548c8e23d2df1158ebb19fe07eb1ac4d9c47f13b3c9d3aed83b206930506a6d' as Hex },
    { url: 'http://localhost:3002', nodeId: '0x7f7e6290d0588435c6d12093b420fafc5b4c7ab23c73645ca7186189dca9537c' as Hex },
];

const RPCS = [process.env.SEPOLIA_RPC_URL, process.env.SEPOLIA_RPC_URL2, process.env.SEPOLIA_RPC_URL3].filter(
    Boolean
) as string[];

// Candidate owner keys from .env.sepolia; we pick the one whose address === AA owner().
const OWNER_KEY_CANDIDATES = ['PRIVATE_KEY_JASON', 'PRIVATE_KEY_SUPPLIER', 'PRIVATE_KEY'] as const;

const ZERO_BYTES32 = `0x${'00'.repeat(32)}` as Hex;

// ── helpers ──────────────────────────────────────────────────────────────────────────────────
const norm = (h: string): Hex => ((h.startsWith('0x') ? h : `0x${h}`).toLowerCase() as Hex);

/** Make a public client over one RPC URL. */
function clientFor(url: string): PublicClient {
    return createPublicClient({ chain: sepolia, transport: http(url) }) as PublicClient;
}

/** Run a read against each RPC in turn; the validate() pairing call is heavy and may hang sockets. */
async function withRpcFallback<T>(fn: (c: PublicClient, url: string) => Promise<T>): Promise<T> {
    let lastErr: unknown;
    for (const url of RPCS) {
        try {
            return await fn(clientFor(url), url);
        } catch (e) {
            lastErr = e;
            console.warn(`   ! RPC ${url.slice(0, 38)}… failed: ${(e as Error).message.split('\n')[0].slice(0, 90)}`);
        }
    }
    throw lastErr;
}

type PackedUserOp = {
    sender: Address;
    nonce: bigint;
    initCode: Hex;
    callData: Hex;
    accountGasLimits: Hex;
    preVerificationGas: bigint;
    gasFees: Hex;
    paymasterAndData: Hex;
    signature: Hex;
};

/** Decode a node's 256-byte EIP-2537 G2 signature into a @noble G2 projective point. */
function eip2537ToG2(sig256: Hex) {
    const raw = sig256.slice(2);
    if (raw.length !== 512) throw new Error(`expected 256-byte EIP-2537 sig, got ${raw.length / 2} bytes`);
    const slot = (i: number) => raw.slice(i * 128, i * 128 + 128); // 64-byte slot = 128 hex chars
    const coord = (h: string) => BigInt('0x' + h.slice(32)); // drop the 16-byte (32-hex) left pad
    const Fp2 = noble.fields.Fp2;
    const point = noble.G2.ProjectivePoint.fromAffine({
        x: Fp2.fromBigTuple([coord(slot(0)), coord(slot(1))]),
        y: Fp2.fromBigTuple([coord(slot(2)), coord(slot(3))]),
    });
    point.assertValidity();
    return point;
}

/** Ask one DVT node to co-sign; returns its 256-byte EIP-2537 sig + compact form + echoed hash. */
async function requestNodeSign(
    url: string,
    userOpRpc: Record<string, string>,
    ownerAuth: Hex
): Promise<{ nodeId: Hex; signature: Hex; signatureCompact: Hex; message: Hex }> {
    const res = await fetch(`${url}/signature/sign`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userOp: userOpRpc, ownerAuth }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(`node ${url} -> ${res.status} ${JSON.stringify(body)}`);
    return {
        nodeId: norm(body.nodeId),
        signature: norm(body.signature),
        signatureCompact: norm(body.signatureCompact),
        message: norm(body.message),
    };
}

async function main() {
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log(' DVT real-node E2E — SDK-assembled proof vs LIVE on-chain verifier (#63 Phase B)');
    console.log('═══════════════════════════════════════════════════════════════════════════');
    if (RPCS.length === 0) throw new Error('No SEPOLIA_RPC_URL[/2/3] in .env.sepolia');

    // ── (0) Resolve the owner signer by reading owner() on-chain ──────────────────────────────
    const owner = (await withRpcFallback((c) =>
        airAccountActions(AA_ACCOUNT)(c).owner()
    )) as Address;
    console.log(`\n[0] AA account ${AA_ACCOUNT}`);
    console.log(`    owner() = ${owner}`);

    let ownerPk: Hex | undefined;
    let ownerKeyName = '';
    for (const name of OWNER_KEY_CANDIDATES) {
        let v = process.env[name];
        if (!v) continue;
        if (!v.startsWith('0x')) v = `0x${v}`;
        if (privateKeyToAccount(v as Hex).address.toLowerCase() === owner.toLowerCase()) {
            ownerPk = v as Hex;
            ownerKeyName = name;
            break;
        }
    }
    if (!ownerPk) throw new Error(`No .env.sepolia key (${OWNER_KEY_CANDIDATES.join('/')}) matches owner() ${owner}`);
    const ownerAccount = privateKeyToAccount(ownerPk);
    const walletClient = createWalletClient({ account: ownerAccount, chain: sepolia, transport: http(RPCS[0]) });
    console.log(`    owner signer = ${ownerKeyName} (${ownerAccount.address}) ✓ matches owner()`);

    // ── (1) Build a minimal ERC-4337 v0.7 PackedUserOperation ─────────────────────────────────
    const nonce = (await withRpcFallback((c) =>
        entryPointActions(ENTRY_POINT)(c).getNonce({ sender: AA_ACCOUNT, key: 0n })
    )) as bigint;
    const userOp: PackedUserOp = {
        sender: AA_ACCOUNT,
        nonce,
        initCode: '0x',
        callData: '0x', // dummy — this op is never submitted, only hashed + co-signed
        accountGasLimits: ZERO_BYTES32,
        preVerificationGas: 0n,
        gasFees: ZERO_BYTES32,
        paymasterAndData: '0x',
        signature: '0x',
    };
    console.log(`\n[1] PackedUserOperation built (nonce=${nonce}, callData=0x, gas fields zero)`);

    // ── (2) Authoritative userOpHash from the on-chain EntryPoint ─────────────────────────────
    const userOpHash = (await withRpcFallback((c) =>
        c.readContract({ address: ENTRY_POINT, abi: EntryPointABI, functionName: 'getUserOpHash', args: [userOp] })
    )) as Hex;
    console.log(`\n[2] EntryPoint.getUserOpHash = ${userOpHash}`);

    // ── (3) ownerAuth = owner's EIP-191 personal_sign over the userOpHash ─────────────────────
    const ownerAuth = await walletClient.signMessage({ account: ownerAccount, message: { raw: userOpHash } });
    console.log(`\n[3] ownerAuth (owner EIP-191 personal_sign) = ${ownerAuth.slice(0, 26)}… (${(ownerAuth.length - 2) / 2} bytes)`);

    // ── (4) Collect DVT-node co-signatures (live) ─────────────────────────────────────────────
    // The node re-derives getUserOpHash from these exact fields; serialize them as strings.
    const userOpRpc = {
        sender: userOp.sender,
        nonce: numberToHex(userOp.nonce),
        initCode: userOp.initCode,
        callData: userOp.callData,
        accountGasLimits: userOp.accountGasLimits,
        preVerificationGas: numberToHex(userOp.preVerificationGas),
        gasFees: userOp.gasFees,
        paymasterAndData: userOp.paymasterAndData,
        signature: userOp.signature,
    };
    console.log(`\n[4] Requesting co-signatures from ${NODES.length} live DVT nodes …`);
    const signed: { nodeId: Hex; signature: Hex; signatureCompact: Hex; message: Hex }[] = [];
    for (const node of NODES) {
        const r = await requestNodeSign(node.url, userOpRpc, ownerAuth);
        // Stage-1 binding: the node MUST have signed OUR derived hash, and report its registered nodeId.
        if (r.message !== userOpHash.toLowerCase())
            throw new Error(`node ${node.url} signed a different hash: ${r.message} != ${userOpHash}`);
        if (r.nodeId !== node.nodeId.toLowerCase())
            throw new Error(`node ${node.url} returned unexpected nodeId ${r.nodeId} (expected ${node.nodeId})`);
        if ((r.signature.length - 2) / 2 !== 256) throw new Error(`node ${node.url} sig is not 256-byte EIP-2537`);
        console.log(`    ${node.url}  nodeId=${r.nodeId.slice(0, 18)}…  message===userOpHash ✓  sig=256B ✓`);
        signed.push(r);
    }

    // ── (5) Aggregate the two G2 signatures — two independent SDK paths, must agree ────────────
    // Path A: @noble G2 point addition of the EIP-2537 points, re-encoded via dvtWire.encodeG2Point.
    const aggPointA = signed.slice(1).reduce((acc, s) => acc.add(eip2537ToG2(s.signature)), eip2537ToG2(signed[0].signature));
    const aggViaG2Add = encodeG2Point(`0x${aggPointA.toHex(false)}` as Hex); // 192B uncompressed -> 256B EIP-2537
    // Path B: core BLSSigner.aggregateSignatures over the nodes' compact (96B) forms, re-encoded.
    const aggCompact = BLSSigner.aggregateSignatures(signed.map((s) => s.signatureCompact));
    const aggViaBLSSigner = encodeG2Point(aggCompact);
    if (aggViaG2Add.toLowerCase() !== aggViaBLSSigner.toLowerCase())
        throw new Error(`aggregation mismatch:\n  G2-add=${aggViaG2Add}\n  BLSSigner=${aggViaBLSSigner}`);
    const aggSig = aggViaG2Add;
    console.log(`\n[5] Aggregated G2 signature (256B EIP-2537) — G2-add === BLSSigner ✓`);
    console.log(`    aggSig = ${aggSig.slice(0, 42)}…${aggSig.slice(-8)}`);

    // ── (6) Build the verifier proof via the SDK encoder ──────────────────────────────────────
    const nodeIds = signed.map((s) => s.nodeId);
    const proof = encodeDVTVerifierProof(nodeIds, aggSig); // [nodeId1][nodeId2][blsSig(256)]
    console.log(`\n[6] dvtWire.encodeDVTVerifierProof([node1,node2], aggSig) = ${(proof.length - 2) / 2} bytes`);

    // ── (7) On-chain verification — the oracle ────────────────────────────────────────────────
    console.log(`\n[7] Calling AAStarBLSAlgorithm.validate(userOpHash, proof) on ${VERIFIER} …`);
    const validateResult = (await withRpcFallback((c) =>
        blsAlgorithmActions(VERIFIER)(c).validate({ userOpHash, proof })
    )) as bigint;
    const accepted = validateResult === 0n;
    console.log(`    validate() = ${validateResult}  -> ${accepted ? '0 ✅ VALID (ACCEPTED)' : '≠0 ❌ REJECTED'}`);

    // ── (8) Negative control: a structurally-valid but WRONG proof must not validate ──────────
    // Claim both nodeIds but supply only node1's single signature → aggregate-pubkey/sig mismatch.
    // (Swapping nodeId order is NOT a valid negative: BLS pubkey aggregation is commutative.)
    const tamperedProof = encodeDVTVerifierProof(nodeIds, signed[0].signature);
    console.log(`\n[8] Negative control: proof with both nodeIds but only node1's sig …`);
    let negResult: bigint | null = null;
    let negReverted = false;
    try {
        negResult = (await withRpcFallback((c) =>
            blsAlgorithmActions(VERIFIER)(c).validate({ userOpHash, proof: tamperedProof })
        )) as bigint;
    } catch (e) {
        negReverted = true;
        console.log(`    validate(tampered) reverted: ${(e as Error).message.split('\n')[0].slice(0, 80)}`);
    }
    const negRejected = negReverted || (negResult !== null && negResult !== 0n);
    if (negResult !== null) console.log(`    validate(tampered) = ${negResult} -> ${negResult === 0n ? '0 (UNEXPECTED accept!)' : '≠0 ✅ rejected'}`);

    // ── Evidence block ────────────────────────────────────────────────────────────────────────
    console.log('\n┌─────────────────────────── EVIDENCE (DVT #63 Phase B) ───────────────────────────');
    console.log(`│ AA account     : ${AA_ACCOUNT}`);
    console.log(`│ owner / signer : ${owner}  (${ownerKeyName})`);
    console.log(`│ verifier       : ${VERIFIER} (Sepolia AAStarBLSAlgorithm)`);
    console.log(`│ userOpHash     : ${userOpHash}`);
    console.log(`│ nodeId[0]      : ${nodeIds[0]}`);
    console.log(`│ nodeId[1]      : ${nodeIds[1]}`);
    console.log(`│ aggregated sig : ${aggSig}`);
    console.log(`│ proof bytes    : ${(proof.length - 2) / 2}`);
    console.log(`│ validate()     : ${validateResult}  ${accepted ? '= 0 ✅ VALID' : '❌ REJECTED'}`);
    console.log(`│ neg-control    : ${negReverted ? 'reverted' : negResult}  ${negRejected ? '✅ rejected' : '❌ accepted (BAD)'}`);
    console.log('└──────────────────────────────────────────────────────────────────────────────────');

    if (!accepted) throw new Error('FAIL: on-chain validate() did not return 0 for the SDK-assembled proof');
    if (!negRejected) throw new Error('FAIL: negative control was accepted — verifier is not enforcing');
    console.log('\n🎉 PASS — SDK-assembled DVT combined signature ACCEPTED on-chain (validate = 0), negative control rejected.');
}

main().catch((e) => {
    console.error(`\n❌ E2E FAILED: ${e.message}`);
    process.exit(1);
});
