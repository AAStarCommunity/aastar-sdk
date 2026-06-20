/**
 * Row 10 sig-format probe. Isolates WHY account.validateUserOp rejected the BLS op while
 * verifier.validate(userOpHash, proof)==0. Uses the SAME dummy userOp as dvt-realnode-e2e (so
 * verifier.validate==0 is reproducible), then tries account.validateUserOp from EntryPoint with
 * several candidate account-level BLS signature encodings. Whichever returns 0 is the correct format.
 *
 * Result (2026-06-20): verifier.validate==0 but validateUserOp==1 for ALL of [0x01]‖proof /
 * proof-only / [0x01]‖len‖ids‖sig — i.e. the account-level BLS sig framing the EntryPoint.handleOps
 * path needs is NOT [algId]‖rawVerifierProof. This is the open DVT-program account-sig item.
 *
 *   pnpm exec tsx tests/regression/onchain-evidence/v0.23.0-row10-sigfmt-probe.ts
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import { bls12_381 as noble } from '@noble/curves/bls12-381';
import {
    createPublicClient, createWalletClient, http, concat, numberToHex, parseEther, keccak256, toBytes,
    getAddress, type Address, type Hex, type PublicClient,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import {
    CANONICAL_ADDRESSES, EntryPointABI, AAStarAirAccountV7ABI, AAStarBLSAlgorithmABI,
    AAStarAirAccountFactoryV7ABI, buildInitConfig, encodeDVTVerifierProof, encodeG2Point,
    airAccountFactoryActions, entryPointActions, blsAlgorithmActions,
} from '@aastar/core';

dotenv.config({ path: path.resolve(process.cwd(), '.env.sepolia') });
const SEP = 11155111;
const VERIFIER = getAddress(CANONICAL_ADDRESSES[SEP].aaStarBLSAlgorithm);
const FACTORY = getAddress(CANONICAL_ADDRESSES[SEP].airAccountFactoryV7);
const ENTRY_POINT = getAddress(CANONICAL_ADDRESSES[SEP].entryPoint);
const TUNNELS = ['https://advisors-pumps-cheapest-municipal.trycloudflare.com', 'https://assumed-oil-talk-lawyer.trycloudflare.com', 'https://lending-configuring-shark-sept.trycloudflare.com'];
const RPCS = [process.env.SEPOLIA_RPC_URL, process.env.SEPOLIA_RPC_URL2, process.env.SEPOLIA_RPC_URL3].map((s) => (s || '').replace(/^['"]|['"]$/g, '')).filter(Boolean) as string[];
const clientFor = (u: string) => createPublicClient({ chain: sepolia, transport: http(u) }) as PublicClient;
async function rpc<T>(fn: (c: PublicClient) => Promise<T>): Promise<T> { let last: unknown; for (const u of RPCS) { try { return await fn(clientFor(u)); } catch (e) { last = e; } } throw last; }
const norm = (h: string): Hex => ((h.startsWith('0x') ? h : `0x${h}`).toLowerCase() as Hex);
function eip2537ToG2(s: Hex) { const raw = s.slice(2); const slot = (i: number) => raw.slice(i * 128, i * 128 + 128); const coord = (h: string) => BigInt('0x' + h.slice(32)); const Fp2 = noble.fields.Fp2; const p = noble.G2.ProjectivePoint.fromAffine({ x: Fp2.fromBigTuple([coord(slot(0)), coord(slot(1))]), y: Fp2.fromBigTuple([coord(slot(2)), coord(slot(3))]) }); p.assertValidity(); return p; }
async function sign(url: string, userOpRpc: any, ownerAuth: Hex) { const res = await fetch(`${url}/signature/sign`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ userOp: userOpRpc, ownerAuth }) }); const b = await res.json().catch(() => ({})); if (!res.ok || !b.nodeId || !b.signature) throw new Error(`${res.status}`); return { nodeId: norm(b.nodeId), signature: norm(b.signature) }; }

async function main() {
    let pk = process.env.PRIVATE_KEY_JASON || ''; if (!pk.startsWith('0x')) pk = `0x${pk}`;
    const owner = privateKeyToAccount(pk as Hex);
    const wallet = createWalletClient({ account: owner, chain: sepolia, transport: http(RPCS[0]) });
    const SALT = BigInt(keccak256(toBytes('dvt-v0.20-cross-repo-e2e/bls-only/2026-06')));
    const config = buildInitConfig({ guardians: [], dailyLimit: parseEther('1'), approvedAlgIds: [0x01] });
    const account = await rpc((c) => airAccountFactoryActions(FACTORY)(c).getAddress({ owner: owner.address, salt: SALT, config })) as Address;
    const ZERO = `0x${'00'.repeat(32)}` as Hex;
    const nonce = await rpc((c) => entryPointActions(ENTRY_POINT)(c).getNonce({ sender: account, key: 0n })) as bigint;
    const userOp = { sender: account, nonce, initCode: '0x' as Hex, callData: '0x' as Hex, accountGasLimits: ZERO, preVerificationGas: 0n, gasFees: ZERO, paymasterAndData: '0x' as Hex, signature: '0x' as Hex };
    const userOpHash = await rpc((c) => c.readContract({ address: ENTRY_POINT, abi: EntryPointABI, functionName: 'getUserOpHash', args: [userOp] })) as Hex;
    const ownerAuth = await wallet.signMessage({ account: owner, message: { raw: userOpHash } });
    const userOpRpc = { sender: userOp.sender, nonce: numberToHex(userOp.nonce), initCode: userOp.initCode, callData: userOp.callData, accountGasLimits: userOp.accountGasLimits, preVerificationGas: numberToHex(userOp.preVerificationGas), gasFees: userOp.gasFees, paymasterAndData: userOp.paymasterAndData, signature: userOp.signature };
    const got = new Map<Hex, Hex>();
    for (const u of TUNNELS) { try { const r = await sign(u, userOpRpc, ownerAuth); const reg = await rpc((c) => c.readContract({ address: VERIFIER, abi: AAStarBLSAlgorithmABI, functionName: 'isRegistered', args: [r.nodeId] })) as boolean; if (reg && !got.has(r.nodeId)) got.set(r.nodeId, r.signature); } catch { /* */ } }
    const signed = [...got.entries()].map(([nodeId, signature]) => ({ nodeId, signature }));
    console.log(`collected ${signed.length} registered nodes: ${signed.map((s) => s.nodeId).join(', ')}`);
    if (signed.length < 2) { console.log('BLOCKER: <2 nodes'); return; }
    const agg = signed.slice(1).reduce((a, s) => a.add(eip2537ToG2(s.signature)), eip2537ToG2(signed[0].signature));
    const aggSig = encodeG2Point(`0x${agg.toHex(false)}` as Hex);
    const proof = encodeDVTVerifierProof(signed.map((s) => s.nodeId), aggSig);
    const v = await rpc((c) => blsAlgorithmActions(VERIFIER)(c).validate({ userOpHash, proof })) as bigint;
    console.log(`verifier.validate(userOpHash, proof) = ${v}  (0 ⇒ aggregate accepted at verifier level)`);

    const candidates: Record<string, Hex> = {
        '[0x01][proof]': concat([numberToHex(0x01, { size: 1 }), proof]),
        'proof-only (no algId)': proof,
        '[0x01][nodeIdsLen32][...ids][sig]': concat([numberToHex(0x01, { size: 1 }), numberToHex(signed.length, { size: 32 }), ...signed.map((s) => s.nodeId), aggSig]),
    };
    for (const [name, sig] of Object.entries(candidates)) {
        let r: string;
        try { const sim = await rpc((c) => c.simulateContract({ address: account, abi: AAStarAirAccountV7ABI, functionName: 'validateUserOp', args: [{ ...userOp, signature: sig }, userOpHash, 0n], account: ENTRY_POINT })); r = `${sim.result}`; }
        catch (e) { r = `revert: ${(e as Error).message.split('\n')[0].slice(0, 70)}`; }
        console.log(`  validateUserOp  ${name.padEnd(34)} (${(sig.length - 2) / 2}B) => ${r}`);
    }
}
main().catch((e) => { console.error('probe failed:', e?.message || e); process.exit(1); });
