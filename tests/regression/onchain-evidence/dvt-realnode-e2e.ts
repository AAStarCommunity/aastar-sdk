/**
 * DVT real-node E2E (cross-repo, v0.20.0) — SDK-assembled combined signature ACCEPTED by the LIVE
 * canonical on-chain verifier, against a FRESH BLS-only account.
 *
 * This is the YetAnotherAA-Validator #42 / aastar-sdk DVT-program deliverable. It proves that the
 * @aastar/core SDK (`dvtWire` encoder + @noble G2 aggregation, ABIs + addresses from @aastar/core)
 * can assemble the DVT verifier proof from the THREE real DVT nodes' co-signatures (reachable via
 * Cloudflare tunnels), and that the CANONICAL v0.20.0 `AAStarBLSAlgorithm`
 * (CANONICAL_ADDRESSES[11155111].aaStarBLSAlgorithm = 0xAF525A16…) ACCEPTS it (`validate(...) == 0`).
 * Nothing is mocked: the nodes co-sign, the proof is built locally by the SDK, and the on-chain
 * pairing check is the oracle.
 *
 * Flow (all live):
 *   0. Deploy a FRESH BLS-only v0.20.0 account owned by JASON via the SDK factory:
 *      buildInitConfig({ guardians: [], dailyLimit: 1 ETH, approvedAlgIds: [0x01] }) through the
 *      guard-enabled createAccount(owner, salt, config) path. Guard-enabled ⇒ the algId-whitelist
 *      gate applies (AAStarAirAccountV7.sol). Read back approvedAlgorithms(0x01)==true /
 *      approvedAlgorithms(0x02)==false / owner()==JASON.
 *   1. Build a minimal ERC-4337 v0.7 PackedUserOperation for that account (nonce via EntryPoint).
 *   2. userOpHash = on-chain EntryPoint.getUserOpHash(userOp)                  (authoritative hash).
 *   3. ownerAuth  = JASON's EIP-191 personal_sign over userOpHash               (node Stage-1 gate).
 *   4. POST {userOp, ownerAuth} to each Cloudflare tunnel /signature/sign; each returns its registered
 *      nodeId + a 256-byte EIP-2537 G2 signature + publicKey. Build the tunnel→nodeId map dynamically
 *      and cross-check each nodeId is isRegistered() on the verifier (and its publicKey matches
 *      registeredKeys(nodeId)). Use >= 2 of the registered nodes.
 *   5. Aggregate the G2 signatures (G2 point addition via @noble) into a 256-byte EIP-2537 aggregate.
 *   6. proof = encodeDVTVerifierProof([nodeIds], agg)                          (= [nodeIds][blsSig]).
 *   7. AAStarBLSAlgorithm.validate(userOpHash, proof) → assert === 0n          (ACCEPTED on-chain).
 *      This is an eth_call (view) on the verifier — recorded as a call, no tx.
 *   8. Negative control (mandatory-BLS): the SAME userOp signed with JASON's owner ECDSA
 *      (algId 0x02 || raw-65) — a VALID owner signature — must be REJECTED by validateUserOp
 *      (returns 1 = SIG_VALIDATION_FAILED) because approvedAlgIds=[0x01] excludes ECDSA.
 *
 *   pnpm exec tsx tests/regression/onchain-evidence/dvt-realnode-e2e.ts
 *
 * Requires: .env.sepolia (SEPOLIA_RPC_URL[/2/3], PRIVATE_KEY_JASON funded on Sepolia) and the three
 *           DVT nodes live behind their Cloudflare tunnels (see TUNNELS below).
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
    parseEther,
    keccak256,
    toBytes,
    getAddress,
    type Address,
    type Hex,
    type PublicClient,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
// SDK under test — ABIs + addresses + crypto come ONLY from @aastar/core.
import {
    CANONICAL_ADDRESSES,
    EntryPointABI,
    AAStarBLSAlgorithmABI,
    AAStarAirAccountV7ABI,
    buildInitConfig,
    encodeDVTVerifierProof,
    encodeG2Point,
    airAccountActions,
    airAccountFactoryActions,
    entryPointActions,
    blsAlgorithmActions,
} from '@aastar/core';

dotenv.config({ path: path.resolve(process.cwd(), '.env.sepolia') });

const SEPOLIA = 11155111;
// Canonical v0.20.0 addresses (single source of truth = @aastar/core address book).
const VERIFIER = getAddress(CANONICAL_ADDRESSES[SEPOLIA].aaStarBLSAlgorithm); // 0xAF525A16…
const FACTORY = getAddress(CANONICAL_ADDRESSES[SEPOLIA].airAccountFactoryV7);
const ENTRY_POINT = getAddress(CANONICAL_ADDRESSES[SEPOLIA].entryPoint); // EntryPoint v0.7

// Hard-pin the verifier so a stale address book can never silently retarget this acceptance test.
const EXPECTED_VERIFIER = getAddress('0xAF525A161CB17e0A1b6254ef0B8d8473bdA05174');
if (VERIFIER !== EXPECTED_VERIFIER) {
    throw new Error(`VERIFIER drift: CANONICAL_ADDRESSES[${SEPOLIA}].aaStarBLSAlgorithm=${VERIFIER} != ${EXPECTED_VERIFIER}`);
}

// DVT nodes behind Cloudflare tunnels (YetAnotherAA-Validator #93). tunnel→nodeId is resolved
// DYNAMICALLY from each node's /signature/sign response (we do NOT assume the order).
const TUNNELS = [
    'https://advisors-pumps-cheapest-municipal.trycloudflare.com',
    'https://assumed-oil-talk-lawyer.trycloudflare.com',
    'https://lending-configuring-shark-sept.trycloudflare.com',
];

// algId constants (AAStarAirAccountBase.sol): ALG_BLS=0x01, ALG_ECDSA=0x02, ALG_P256=0x03.
const ALG_BLS = 0x01;
const ALG_ECDSA = 0x02;

const RPCS = [process.env.SEPOLIA_RPC_URL, process.env.SEPOLIA_RPC_URL2, process.env.SEPOLIA_RPC_URL3].filter(
    Boolean
) as string[];

const ZERO_BYTES32 = `0x${'00'.repeat(32)}` as Hex;
// Deterministic CREATE2 salt — same (owner, salt, config) ⇒ same address, so reruns are idempotent.
const SALT = BigInt(keccak256(toBytes('dvt-v0.20-cross-repo-e2e/bls-only/2026-06'))); // uint256

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

/** Ask one DVT node to co-sign; returns its registered nodeId + 256-byte EIP-2537 sig + publicKey. */
async function requestNodeSign(
    url: string,
    userOpRpc: Record<string, string>,
    ownerAuth: Hex
): Promise<{ nodeId: Hex; signature: Hex; publicKey: Hex }> {
    const res = await fetch(`${url}/signature/sign`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userOp: userOpRpc, ownerAuth }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`node ${url} -> ${res.status} ${JSON.stringify(body)}`);
    if (!body.nodeId || !body.signature) throw new Error(`node ${url} -> missing nodeId/signature in ${JSON.stringify(body)}`);
    return {
        nodeId: norm(body.nodeId),
        signature: norm(body.signature),
        publicKey: body.publicKey ? norm(body.publicKey) : ('0x' as Hex),
    };
}

async function main() {
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log(' DVT real-node E2E (cross-repo, v0.20.0) — SDK proof vs canonical AAStarBLSAlgorithm');
    console.log('═══════════════════════════════════════════════════════════════════════════');
    if (RPCS.length === 0) throw new Error('No SEPOLIA_RPC_URL[/2/3] in .env.sepolia');

    // ── (0a) Owner = JASON (the deployer + the owner that produces ownerAuth) ─────────────────
    let jasonPk = process.env.PRIVATE_KEY_JASON;
    if (!jasonPk) throw new Error('PRIVATE_KEY_JASON missing from .env.sepolia');
    if (!jasonPk.startsWith('0x')) jasonPk = `0x${jasonPk}`;
    const owner = privateKeyToAccount(jasonPk as Hex);
    const walletClient = createWalletClient({ account: owner, chain: sepolia, transport: http(RPCS[0]) });
    console.log(`\n[0a] owner (JASON) = ${owner.address}`);
    console.log(`     verifier  = ${VERIFIER}`);
    console.log(`     factory   = ${FACTORY}`);

    // ── (0b) Build a BLS-only InitConfig and predict / deploy the account ─────────────────────
    const config = buildInitConfig({
        guardians: [], // no guardians
        dailyLimit: parseEther('1'), // > 0 ⇒ guard ENABLED ⇒ algId-whitelist gate applies
        approvedAlgIds: [ALG_BLS], // BLS ONLY (excludes ECDSA 0x02)
    });
    const account = (await withRpcFallback((c) =>
        airAccountFactoryActions(FACTORY)(c).getAddress({ owner: owner.address, salt: SALT, config })
    )) as Address;
    console.log(`\n[0b] predicted BLS-only account = ${account} (salt=${numberToHex(SALT)})`);

    const code = await withRpcFallback((c) => c.getCode({ address: account }));
    if (code && code !== '0x') {
        console.log('     account already deployed ✓ (idempotent rerun)');
    } else {
        console.log('     deploying via factory.createAccount(owner, salt, config) …');
        const txHash = await airAccountFactoryActions(FACTORY)(walletClient).createAccount({
            owner: owner.address,
            salt: SALT,
            config,
            account: owner,
        });
        console.log(`     deploy tx = ${txHash}`);
        const rcpt = await withRpcFallback((c) => c.waitForTransactionReceipt({ hash: txHash }));
        console.log(`     deploy status = ${rcpt.status} (block ${rcpt.blockNumber})`);
        if (rcpt.status !== 'success') throw new Error('account deploy reverted');
    }

    // ── (0c) Read the algId whitelist + owner ON-CHAIN (the contract's source of truth) ───────
    const onchainOwner = (await withRpcFallback((c) => airAccountActions(account)(c).owner())) as Address;
    const algApproved = async (algId: number) =>
        (await withRpcFallback((c) =>
            c.readContract({ address: account, abi: AAStarAirAccountV7ABI, functionName: 'approvedAlgorithms', args: [algId] })
        )) as boolean;
    const blsApproved = await algApproved(ALG_BLS);
    const ecdsaApproved = await algApproved(ALG_ECDSA);
    console.log(`\n[0c] on-chain owner() = ${onchainOwner}  (== JASON: ${onchainOwner.toLowerCase() === owner.address.toLowerCase()})`);
    console.log(`     approvedAlgorithms(0x01 BLS)   = ${blsApproved}`);
    console.log(`     approvedAlgorithms(0x02 ECDSA) = ${ecdsaApproved}`);
    if (onchainOwner.toLowerCase() !== owner.address.toLowerCase()) throw new Error('account owner() != JASON');
    if (blsApproved !== true) throw new Error('BUG: approvedAlgorithms(0x01) != true on the deployed account');
    if (ecdsaApproved !== false) throw new Error('BUG: approvedAlgorithms(0x02) != false — account is not BLS-only');

    // ── (1) Build a minimal ERC-4337 v0.7 PackedUserOperation ─────────────────────────────────
    const nonce = (await withRpcFallback((c) =>
        entryPointActions(ENTRY_POINT)(c).getNonce({ sender: account, key: 0n })
    )) as bigint;
    const userOp: PackedUserOp = {
        sender: account,
        nonce,
        initCode: '0x',
        callData: '0x', // dummy — this op is never submitted, only hashed + co-signed
        accountGasLimits: ZERO_BYTES32,
        preVerificationGas: 0n,
        gasFees: ZERO_BYTES32,
        paymasterAndData: '0x',
        signature: '0x',
    };
    console.log(`\n[1] PackedUserOperation built (sender=account, nonce=${nonce}, callData=0x, gas fields zero)`);

    // ── (2) Authoritative userOpHash from the on-chain EntryPoint ─────────────────────────────
    const userOpHash = (await withRpcFallback((c) =>
        c.readContract({ address: ENTRY_POINT, abi: EntryPointABI, functionName: 'getUserOpHash', args: [userOp] })
    )) as Hex;
    console.log(`\n[2] EntryPoint.getUserOpHash = ${userOpHash}`);

    // ── (3) ownerAuth = JASON's EIP-191 personal_sign over the userOpHash ─────────────────────
    const ownerAuth = await walletClient.signMessage({ account: owner, message: { raw: userOpHash } });
    console.log(`\n[3] ownerAuth (JASON EIP-191 personal_sign) = ${ownerAuth.slice(0, 26)}… (${(ownerAuth.length - 2) / 2} bytes)`);

    // ── (4) Collect DVT-node co-signatures (live) — resolve tunnel→nodeId dynamically ─────────
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
    console.log(`\n[4] Requesting co-signatures from ${TUNNELS.length} DVT tunnels …`);
    const signed: { url: string; nodeId: Hex; signature: Hex; publicKey: Hex }[] = [];
    for (const url of TUNNELS) {
        try {
            const r = await requestNodeSign(url, userOpRpc, ownerAuth);
            if ((r.signature.length - 2) / 2 !== 256) throw new Error(`sig is not 256-byte EIP-2537 (${(r.signature.length - 2) / 2} bytes)`);
            // Gate on isRegistered (authoritative): validate() aggregates registeredKeys(nodeId) for
            // the claimed nodeIds and pairs them against the aggregate sig — so validate()==0 IS the
            // cryptographic proof that each node signed with the key registered for its nodeId. The
            // node's returned `publicKey` is logged for the record but NOT used as a gate (it may be a
            // different encoding, e.g. compressed G1, than the on-chain 128-byte EIP-2537 registeredKeys).
            const registered = (await withRpcFallback((c) =>
                c.readContract({ address: VERIFIER, abi: AAStarBLSAlgorithmABI, functionName: 'isRegistered', args: [r.nodeId] })
            )) as boolean;
            const pkLen = r.publicKey === '0x' ? 0 : (r.publicKey.length - 2) / 2;
            console.log(`    ${url.replace('https://', '').slice(0, 40)}  nodeId=${r.nodeId.slice(0, 18)}…  registered=${registered}  pubkey=${pkLen}B`);
            if (!registered) {
                console.warn(`    ! ${url}: nodeId ${r.nodeId} is NOT registered on ${VERIFIER} — excluding from the proof`);
                continue;
            }
            signed.push({ url, ...r });
        } catch (e) {
            console.warn(`    ! ${url} failed: ${(e as Error).message.split('\n')[0].slice(0, 120)}`);
        }
    }
    console.log(`    collected ${signed.length} registered co-signatures.`);
    if (signed.length < 2) throw new Error(`need >= 2 registered node co-signatures, got ${signed.length}`);
    // Reject duplicate nodeIds (would corrupt the aggregate/claim set).
    const uniqIds = new Set(signed.map((s) => s.nodeId));
    if (uniqIds.size !== signed.length) throw new Error('duplicate nodeId across tunnels — refusing to build proof');

    // ── (5) Aggregate the G2 signatures via @noble point addition ─────────────────────────────
    const aggPoint = signed.slice(1).reduce((acc, s) => acc.add(eip2537ToG2(s.signature)), eip2537ToG2(signed[0].signature));
    const aggSig = encodeG2Point(`0x${aggPoint.toHex(false)}` as Hex); // 192B uncompressed -> 256B EIP-2537
    console.log(`\n[5] Aggregated ${signed.length} G2 signatures (256B EIP-2537)`);
    console.log(`    aggSig = ${aggSig.slice(0, 42)}…${aggSig.slice(-8)}`);

    // ── (6) Build the verifier proof via the SDK encoder ──────────────────────────────────────
    const nodeIds = signed.map((s) => s.nodeId);
    const proof = encodeDVTVerifierProof(nodeIds, aggSig); // [nodeId_1]…[nodeId_N][blsSig(256)]
    console.log(`\n[6] encodeDVTVerifierProof([${nodeIds.length} nodeIds], aggSig) = ${(proof.length - 2) / 2} bytes`);

    // ── (7) On-chain verification — the oracle (eth_call / view) ───────────────────────────────
    console.log(`\n[7] Calling AAStarBLSAlgorithm.validate(userOpHash, proof) on ${VERIFIER} (eth_call) …`);
    const validateResult = (await withRpcFallback((c) =>
        blsAlgorithmActions(VERIFIER)(c).validate({ userOpHash, proof })
    )) as bigint;
    const accepted = validateResult === 0n;
    console.log(`    validate() = ${validateResult}  -> ${accepted ? '0 ✅ VALID (ACCEPTED)' : '≠0 ❌ REJECTED'}`);

    // ── (8) Negative control: same op, JASON owner ECDSA (algId 0x02) → MUST be rejected ──────
    // approvedAlgIds=[0x01] excludes ECDSA, so even a VALID owner ECDSA sig is rejected by the
    // account's algId-whitelist gate (validateUserOp returns 1 = SIG_VALIDATION_FAILED).
    const ecdsaSig = concat([numberToHex(ALG_ECDSA, { size: 1 }), ownerAuth]); // [0x02][65-byte owner sig] = 66B
    const ecdsaUserOp = { ...userOp, signature: ecdsaSig };
    console.log(`\n[8] Negative control: validateUserOp with owner ECDSA (0x02||raw-65), simulated from EntryPoint …`);
    let ecdsaValidation: bigint | null = null;
    let ecdsaReverted = false;
    try {
        const sim = await withRpcFallback((c) =>
            c.simulateContract({
                address: account,
                abi: AAStarAirAccountV7ABI,
                functionName: 'validateUserOp',
                args: [ecdsaUserOp, userOpHash, 0n],
                account: ENTRY_POINT, // onlyEntryPoint — set eth_call `from` to the EntryPoint
            })
        );
        ecdsaValidation = sim.result as bigint;
    } catch (e) {
        ecdsaReverted = true;
        console.log(`    validateUserOp(ECDSA) reverted: ${(e as Error).message.split('\n')[0].slice(0, 90)}`);
    }
    // SIG_VALIDATION_FAILED == 1. Anything != 0 (or a revert) is a rejection.
    const ecdsaRejected = ecdsaReverted || (ecdsaValidation !== null && ecdsaValidation !== 0n);
    if (ecdsaValidation !== null)
        console.log(`    validateUserOp(ECDSA) = ${ecdsaValidation} -> ${ecdsaValidation === 0n ? '0 (UNEXPECTED accept!)' : `${ecdsaValidation} ✅ rejected (SIG_VALIDATION_FAILED)`}`);

    // ── Evidence block ────────────────────────────────────────────────────────────────────────
    console.log('\n┌─────────────────── EVIDENCE (DVT cross-repo, v0.20.0) ───────────────────');
    console.log(`│ BLS-only account : ${account}`);
    console.log(`│ owner (JASON)    : ${owner.address}`);
    console.log(`│ approvedAlg 0x01 : ${blsApproved}   approvedAlg 0x02 : ${ecdsaApproved}`);
    console.log(`│ verifier         : ${VERIFIER} (canonical AAStarBLSAlgorithm)`);
    console.log(`│ userOpHash       : ${userOpHash}`);
    for (const s of signed) console.log(`│ tunnel→nodeId    : ${s.url} -> ${s.nodeId}`);
    console.log(`│ aggregated sig   : ${aggSig}`);
    console.log(`│ proof bytes      : ${(proof.length - 2) / 2}`);
    console.log(`│ validate() (call): ${validateResult}  ${accepted ? '= 0 ✅ VALID' : '❌ REJECTED'}`);
    console.log(`│ neg ECDSA        : ${ecdsaReverted ? 'reverted' : ecdsaValidation}  ${ecdsaRejected ? '✅ rejected' : '❌ accepted (BAD)'}`);
    console.log('└──────────────────────────────────────────────────────────────────────────');

    if (!accepted) throw new Error('FAIL: on-chain validate() did not return 0 for the SDK-assembled proof');
    if (!ecdsaRejected) throw new Error('FAIL: ECDSA negative control was accepted — mandatory-BLS not enforced');
    console.log('\n🎉 PASS — DVT combined signature ACCEPTED on-chain (validate = 0); ECDSA op rejected (mandatory-BLS).');
}

main().catch((e) => {
    console.error(`\n❌ E2E FAILED: ${e.message}`);
    process.exit(1);
});
