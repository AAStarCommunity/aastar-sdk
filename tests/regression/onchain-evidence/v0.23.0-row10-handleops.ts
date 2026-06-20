/**
 * Row 10 strengthening — drive a REAL EntryPoint.handleOps for the BLS-only account, so the BLS
 * validation path is proven THROUGH EntryPoint (UserOperationEvent success=true), not only via the
 * `validate()` eth_call view in dvt-realnode-e2e.ts.
 *
 * Flow (all live, against the recorded BLS-only account 0xA063c7B5…):
 *   1. Build a REAL v0.7 PackedUserOperation: callData = execute(owner, 0, 0x) (a benign 0-ETH self
 *      transfer to the owner EOA — always succeeds), real gas limits + fees.
 *   2. userOpHash = EntryPoint.getUserOpHash(userOp).
 *   3. ownerAuth = JASON EIP-191 personal_sign(userOpHash); POST {userOp, ownerAuth} to the 3 DVT
 *      tunnels; collect registered co-sigs; aggregate G2; proof = encodeDVTVerifierProof(ids, agg).
 *   4. userOp.signature = concat([0x01, proof])  (algId-prefixed BLS account signature).
 *   5. Pre-check: simulate validateUserOp(userOp, userOpHash, 0) from EntryPoint → must be 0.
 *   6. Ensure EntryPoint deposit for the account (depositTo) covers the prefund.
 *   7. EntryPoint.handleOps([userOp], JASON) — REAL tx. Decode UserOperationEvent(success=true).
 *
 *   pnpm exec tsx tests/regression/onchain-evidence/v0.23.0-row10-handleops.ts
 *
 * Env: .env.sepolia (SEPOLIA_RPC_URL[/2/3], PRIVATE_KEY_JASON funded) + the 3 DVT tunnels live.
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import { bls12_381 as noble } from '@noble/curves/bls12-381';
import {
    createPublicClient, createWalletClient, http, concat, numberToHex, parseEther, formatEther,
    encodeFunctionData, decodeEventLog, getAddress, recoverMessageAddress, type Address, type Hex, type PublicClient,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import {
    CANONICAL_ADDRESSES, EntryPointABI, AAStarAirAccountV7ABI, AAStarBLSAlgorithmABI,
    encodeDVTVerifierProof, encodeBLSAccountSignature, encodeG2Point, entryPointActions,
    getDefaultDvtNodes,
} from '@aastar/core';

const VERIFIER = getAddress(CANONICAL_ADDRESSES[11155111].aaStarBLSAlgorithm);

dotenv.config({ path: path.resolve(process.cwd(), '.env.sepolia') });

const SEP = 11155111;
const ENTRY_POINT = getAddress(CANONICAL_ADDRESSES[SEP].entryPoint);
const ACC10 = getAddress('0xA063c7B5810fc2f9f0e5198376c83b6B57c80d0c');
// AAStar's always-on testnet DVT nodes (dvt1/2/3.aastar.io) — the SDK default config.
const TUNNELS = getDefaultDvtNodes(SEP).map((n) => n.url);
const RPCS = [process.env.SEPOLIA_RPC_URL, process.env.SEPOLIA_RPC_URL2, process.env.SEPOLIA_RPC_URL3]
    .map((s) => (s || '').replace(/^['"]|['"]$/g, '')).filter(Boolean) as string[];
const clientFor = (url: string) => createPublicClient({ chain: sepolia, transport: http(url) }) as PublicClient;
async function rpc<T>(fn: (c: PublicClient) => Promise<T>): Promise<T> {
    let last: unknown;
    for (const url of RPCS) { try { return await fn(clientFor(url)); } catch (e) { last = e; } }
    throw last;
}
const norm = (h: string): Hex => ((h.startsWith('0x') ? h : `0x${h}`).toLowerCase() as Hex);
const pack = (hi: bigint, lo: bigint): Hex => numberToHex((hi << 128n) | lo, { size: 32 });

function eip2537ToG2(sig256: Hex) {
    const raw = sig256.slice(2);
    const slot = (i: number) => raw.slice(i * 128, i * 128 + 128);
    const coord = (h: string) => BigInt('0x' + h.slice(32));
    const Fp2 = noble.fields.Fp2;
    const p = noble.G2.ProjectivePoint.fromAffine({ x: Fp2.fromBigTuple([coord(slot(0)), coord(slot(1))]), y: Fp2.fromBigTuple([coord(slot(2)), coord(slot(3))]) });
    p.assertValidity();
    return p;
}
async function requestNodeSign(url: string, userOpRpc: Record<string, string>, ownerAuth: Hex) {
    const res = await fetch(`${url}/signature/sign`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ userOp: userOpRpc, ownerAuth }) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`node ${url} -> ${res.status} ${JSON.stringify(body)}`);
    if (!body.nodeId || !body.signature) throw new Error(`node ${url} -> missing nodeId/signature`);
    return { nodeId: norm(body.nodeId), signature: norm(body.signature) };
}

async function main() {
    let pk = process.env.PRIVATE_KEY_JASON || '';
    if (pk && !pk.startsWith('0x')) pk = `0x${pk}`;
    const owner = privateKeyToAccount(pk as Hex);
    const wallet = createWalletClient({ account: owner, chain: sepolia, transport: http(RPCS[0]) });
    console.log(`Row 10 handleOps — account ${ACC10}, owner ${owner.address}`);

    // (1) Real UserOp: callData = execute(owner, 0, 0x) (benign 0-ETH transfer to owner EOA).
    const callData = encodeFunctionData({ abi: AAStarAirAccountV7ABI, functionName: 'execute', args: [owner.address, 0n, '0x'] });
    const block = await rpc((c) => c.getBlock());
    const baseFee = block.baseFeePerGas ?? parseEther('0.000000002');
    const maxPriority = 2_000_000_000n; // 2 gwei tip
    const maxFee = baseFee * 2n + maxPriority;
    const verificationGasLimit = 3_000_000n; // BLS pairing is heavy
    const callGasLimit = 200_000n;
    const preVerificationGas = 150_000n;
    const nonce = await rpc((c) => entryPointActions(ENTRY_POINT)(c).getNonce({ sender: ACC10, key: 0n })) as bigint;
    const userOp = {
        sender: ACC10, nonce, initCode: '0x' as Hex, callData,
        accountGasLimits: pack(verificationGasLimit, callGasLimit),
        preVerificationGas, gasFees: pack(maxPriority, maxFee), paymasterAndData: '0x' as Hex, signature: '0x' as Hex,
    };

    // (2) Authoritative hash.
    const userOpHash = await rpc((c) => c.readContract({ address: ENTRY_POINT, abi: EntryPointABI, functionName: 'getUserOpHash', args: [userOp] })) as Hex;
    console.log(`userOpHash = ${userOpHash}`);

    // (3) ownerAuth + DVT co-sigs.
    const ownerAuth = await wallet.signMessage({ account: owner, message: { raw: userOpHash } });
    // DIAGNOSTIC: confirm the owner ECDSA the contract's _validateTripleSignature will recover (L935-937)
    // resolves to owner() — isolates an owner-sig fault from a BLS fault when validateUserOp==1.
    const recoveredOwner = await recoverMessageAddress({ message: { raw: userOpHash }, signature: ownerAuth as Hex });
    console.log(`ownerAuth recovers to ${recoveredOwner} (owner=${owner.address}, match=${recoveredOwner.toLowerCase() === owner.address.toLowerCase()})`);
    const userOpRpc = { sender: userOp.sender, nonce: numberToHex(userOp.nonce), initCode: userOp.initCode, callData: userOp.callData, accountGasLimits: userOp.accountGasLimits, preVerificationGas: numberToHex(userOp.preVerificationGas), gasFees: userOp.gasFees, paymasterAndData: userOp.paymasterAndData, signature: userOp.signature };
    // Collect co-sigs, GATING on isRegistered (the verifier aggregates registeredKeys(nodeId)); a
    // zero/unregistered nodeId would corrupt the aggregate. Retry across rounds for flaky tunnels.
    const collected = new Map<Hex, Hex>(); // nodeId -> sig
    for (let round = 0; round < 4 && collected.size < 2; round++) {
        for (const url of TUNNELS) {
            try {
                const r = await requestNodeSign(url, userOpRpc, ownerAuth);
                if (BigInt(r.nodeId) === 0n) { console.warn(`  ! ${url.slice(8, 40)}: zero nodeId — skip`); continue; }
                const reg = await rpc((c) => c.readContract({ address: VERIFIER, abi: AAStarBLSAlgorithmABI, functionName: 'isRegistered', args: [r.nodeId] })) as boolean;
                if (!reg) { console.warn(`  ! ${url.slice(8, 40)}: nodeId ${r.nodeId.slice(0, 12)}… NOT registered — skip`); continue; }
                if (!collected.has(r.nodeId)) { collected.set(r.nodeId, r.signature); console.log(`  ${url.replace('https://', '').slice(0, 34)} nodeId=${r.nodeId.slice(0, 14)}… registered ✓`); }
            } catch (e) { console.warn(`  ! ${url.slice(8, 40)}: ${(e as Error).message.slice(0, 70)}`); }
        }
        if (collected.size < 2 && round < 3) { console.log(`  round ${round + 1}: ${collected.size} registered co-sigs, retrying…`); await new Promise((r) => setTimeout(r, 4000)); }
    }
    const signed = [...collected.entries()].map(([nodeId, signature]) => ({ nodeId, signature }));
    if (signed.length < 2) throw new Error(`BLOCKER: need >=2 REGISTERED DVT co-sigs, got ${signed.length} (tunnels down/flaky this run)`);
    const agg = signed.slice(1).reduce((a, s) => a.add(eip2537ToG2(s.signature)), eip2537ToG2(signed[0].signature));
    const aggSig = encodeG2Point(`0x${agg.toHex(false)}` as Hex);
    const proof = encodeDVTVerifierProof(signed.map((s) => s.nodeId), aggSig);

    // ISOLATION: check the BLS aggregate ITSELF at the verifier BEFORE framing the account sig, so a
    // failure is attributable — verifier==0 + account==1 ⇒ owner-ECDSA/account-format bug; verifier!=0
    // ⇒ the collected node set's aggregate is bad (flaky tunnels), NOT my encoding.
    let verifierResult: bigint | string;
    try {
        verifierResult = await rpc((c) => c.readContract({ address: VERIFIER, abi: AAStarBLSAlgorithmABI, functionName: 'validate', args: [userOpHash, proof] })) as bigint;
    } catch (e) { verifierResult = `revert: ${(e as Error).message.split('\n')[0].slice(0, 90)}`; }
    console.log(`verifier.validate(proof) = ${verifierResult} (0 ⇒ BLS aggregate over ${signed.length} nodes is valid)`);

    // (4) Account-level ALG_BLS (0x01) signature for EntryPoint.handleOps:
    //     [0x01][nodeIdsLength(32)][nodeIds][blsSig(256)][ownerECDSA(65)].
    //     The trailing 65 bytes are the owner's EIP-191 sig over userOpHash (ownerAuth, computed above)
    //     — the contract's _validateTripleSignature requires recovered==owner in addition to the BLS
    //     aggregate. (NOT [0x01]‖verifierProof, which omits the length prefix + owner sig and fails.)
    const sig = encodeBLSAccountSignature({
        nodeIds: signed.map((s) => s.nodeId),
        blsSig: aggSig,
        ownerSig: ownerAuth as Hex,
    });
    const signedUserOp = { ...userOp, signature: sig };

    // (5) Pre-check validateUserOp == 0 (from EntryPoint).
    let preValid: bigint | string;
    try {
        const sim = await rpc((c) => c.simulateContract({ address: ACC10, abi: AAStarAirAccountV7ABI, functionName: 'validateUserOp', args: [signedUserOp, userOpHash, 0n], account: ENTRY_POINT }));
        preValid = sim.result as bigint;
    } catch (e) { preValid = `revert: ${(e as Error).message.split('\n')[0].slice(0, 90)}`; }
    console.log(`validateUserOp pre-check = ${preValid} (0 ⇒ BLS sig accepted)`);
    if (preValid !== 0n) throw new Error(`BLOCKER: validateUserOp pre-check = ${preValid} while verifier.validate = ${verifierResult}. If verifier==0 but validateUserOp!=0, the BLS aggregate is fine — the fault is account-side (e.g. validator()==0 → call setValidator; owner-ECDSA mismatch; tier gate). If verifier!=0, the collected node set's aggregate is bad (flaky tunnels). Aborting before wasting a reverted handleOps tx.`);

    // (6) Ensure deposit covers prefund.
    const required = (verificationGasLimit + callGasLimit + preVerificationGas) * maxFee;
    const dep = await rpc((c) => c.readContract({ address: ENTRY_POINT, abi: EntryPointABI, functionName: 'balanceOf', args: [ACC10] })) as bigint;
    console.log(`deposit=${formatEther(dep)} ETH, required≈${formatEther(required)} ETH`);
    if (dep < required) {
        const topUp = required - dep + parseEther('0.005');
        const dtx = await wallet.writeContract({ address: ENTRY_POINT, abi: EntryPointABI, functionName: 'depositTo', args: [ACC10], value: topUp });
        await rpc((c) => c.waitForTransactionReceipt({ hash: dtx }));
        console.log(`depositTo(${ACC10}) ${formatEther(topUp)} ETH tx=${dtx}`);
    }

    // (7) Real handleOps.
    console.log('submitting EntryPoint.handleOps([userOp], JASON) …');
    const tx = await wallet.writeContract({ address: ENTRY_POINT, abi: EntryPointABI, functionName: 'handleOps', args: [[signedUserOp], owner.address], maxFeePerGas: maxFee, maxPriorityFeePerGas: maxPriority });
    console.log(`handleOps tx = ${tx}`);
    const rcpt = await rpc((c) => c.waitForTransactionReceipt({ hash: tx, timeout: 180_000 }));
    console.log(`handleOps mined: status=${rcpt.status} block=${rcpt.blockNumber}`);
    let uoe = '';
    for (const lg of rcpt.logs) {
        if (getAddress(lg.address) === ENTRY_POINT) {
            try { const d = decodeEventLog({ abi: EntryPointABI, data: lg.data, topics: lg.topics as any }); if (d.eventName === 'UserOperationEvent') uoe = `success=${(d.args as any).success} actualGasCost=${(d.args as any).actualGasCost} actualGasUsed=${(d.args as any).actualGasUsed} nonce=${(d.args as any).nonce}`; } catch { /* */ }
        }
    }
    console.log(`\n┌── Row 10 handleOps EVIDENCE`);
    console.log(`│ account      : ${ACC10}`);
    console.log(`│ userOpHash   : ${userOpHash}`);
    console.log(`│ nodeIds      : ${signed.map((s) => s.nodeId).join(', ')}`);
    console.log(`│ validateUserOp pre-check : ${preValid}`);
    console.log(`│ handleOps tx : ${tx}  status=${rcpt.status}`);
    console.log(`│ UserOperationEvent : ${uoe || '(NOT FOUND)'}`);
    console.log('└──');
    if (rcpt.status !== 'success' || !/success=true/.test(uoe)) throw new Error('handleOps did not yield UserOperationEvent(success=true)');
    console.log('\n🎉 Row 10 PASS — BLS-signed UserOp validated + executed through EntryPoint (success=true).');
}

main().catch((e) => { console.error('\n❌ Row10 handleOps:', e?.shortMessage || e?.message || e); process.exit(1); });
