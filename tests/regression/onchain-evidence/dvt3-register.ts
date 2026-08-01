/**
 * One-shot: stake + register the INDEPENDENT dvt3 node (board B) on the live Sepolia validator.
 *
 * dvt3 holds its BLS key in an EIP-2335 encrypted keystore (board /opt/dvt-build/node_state.json).
 * The plaintext BLS secret is decrypted HERE, IN MEMORY ONLY (never written to disk), fed to
 * @aastar/operator onboardDvtNode which: funds the fresh operator EOA (JASON 代付 ETH+GToken) →
 * approve → registerRole(ROLE_DVT, lock minStake) → registerWithProof(pubkey, popPoint, popSig).
 *
 * Inputs (env):
 *   SDK_DIR                 abs path to aastar-sdk (for .env.sepolia)
 *   DVT3_KEYSTORE_JSON      abs path to staged node_state.json (ciphertext only)
 *   DVT3_SECRET             keystore passphrase (unquoted)
 *   DVT3_OPERATOR_PK        fresh operator EOA private key (already persisted board 600)
 *   PRIVATE_KEY_JASON       funder (from .env.sepolia)
 *   SEPOLIA_RPC_URL / RPC_URL
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { pbkdf2Sync, scryptSync, createHash, createDecipheriv } from 'node:crypto';
import {
  createPublicClient, createWalletClient, http, formatEther, parseEther, keccak256, toHex, type Address, type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { bls12_381 as bls } from '@noble/curves/bls12-381';
import { onboardDvtNode } from '@aastar/operator';
import { CANONICAL_ADDRESSES, dvtOperatorActions } from '@aastar/core';

/** Fail with the missing variable's name rather than a cryptic downstream TypeError. */
function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing required env ${name} — see the header of this file for the full list`);
  return v;
}

const SDK_DIR = requireEnv('SDK_DIR');
dotenv.config({ path: path.resolve(SDK_DIR, '.env.sepolia') });
const norm = (pk: string): Hex => (pk.startsWith('0x') ? pk : `0x${pk}`) as Hex;
const log = (...a: any[]) => console.log(...a);

/** EIP-2335 v4 decrypt → 32-byte BLS secret hex. Kept in RAM; never persisted. */
function decryptEip2335(ks: any, password: string): Hex {
  const c = ks.crypto ?? ks;
  const kp = c.kdf.params;
  const tryWith = (pw: string): Hex | null => {
    const pwb = Buffer.from(pw, 'utf8');
    let dk: Buffer;
    if (c.kdf.function === 'pbkdf2') dk = pbkdf2Sync(pwb, Buffer.from(kp.salt, 'hex'), kp.c, kp.dklen, kp.prf.replace('hmac-', ''));
    else if (c.kdf.function === 'scrypt') dk = scryptSync(pwb, Buffer.from(kp.salt, 'hex'), kp.dklen, { N: kp.n, r: kp.r, p: kp.p, maxmem: 512 * 1024 * 1024 });
    else throw new Error(`unsupported kdf ${c.kdf.function}`);
    const cipherMsg = Buffer.from(c.cipher.message, 'hex');
    const checksum = createHash('sha256').update(Buffer.concat([dk.subarray(16, 32), cipherMsg])).digest('hex');
    if (checksum !== c.checksum.message) return null;
    const decipher = createDecipheriv('aes-128-ctr', dk.subarray(0, 16), Buffer.from(c.cipher.params.iv, 'hex'));
    return `0x${Buffer.concat([decipher.update(cipherMsg), decipher.final()]).toString('hex')}` as Hex;
  };
  // EIP-2335 says NFKD-normalize + strip control chars; try normalized then raw (encrypt lib may differ).
  return tryWith(password.normalize('NFKD')) ?? tryWith(password) ?? (() => { throw new Error('keystore checksum mismatch — wrong DVT3_SECRET'); })();
}

// EIP-2537 G1 (128B) encoding — matches register-node.mjs / the contract.
const _fp = (x: bigint) => { const s = x.toString(16).padStart(96, '0'); const b = new Uint8Array(48); for (let i = 0; i < 48; i++) b[i] = parseInt(s.substr(i * 2, 2), 16); return b; };
const eip2537G1 = (p: any) => { const a = p.toAffine(); const r = new Uint8Array(128); r.set(_fp(a.x), 16); r.set(_fp(a.y), 80); return ('0x' + Buffer.from(r).toString('hex')) as Hex; };

async function main() {
  const RPC = process.env.SEPOLIA_RPC_URL || requireEnv('RPC_URL');
  const transport = http(RPC);
  const publicClient = createPublicClient({ chain: sepolia, transport });
  const c = CANONICAL_ADDRESSES[11155111];
  const validator = c.aaStarBLSAlgorithm as Address;
  // ⚠️ Sepolia canonical.gToken drifted (now 0x8d6Fe002…, JASON balance 0) away from the token this
  // LIVE validator's registry actually stakes (0x4c09aE57…, JASON=owner+1523, dvt1 staked in it).
  // Pin onboardDvtNode to the SAME on-chain setup dvt1 used: validator.registry() + the real GToken.
  const STAKE_GTOKEN = '0x4c09aE57503Aa1E2A43b05621A38DbdD43b0Aa08' as Address;
  const validatorRegistry = await publicClient.readContract({
    address: validator, abi: [{ type: 'function', name: 'registry', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] }], functionName: 'registry',
  }) as Address;
  log(`stake token (pinned) = ${STAKE_GTOKEN}   validator.registry() = ${validatorRegistry}`);

  // --- load dvt3 node state + decrypt BLS secret (RAM) ---
  const ns = JSON.parse(fs.readFileSync(requireEnv('DVT3_KEYSTORE_JSON'), 'utf8'));
  const blsSecretRaw = decryptEip2335(ns.keystore, requireEnv('DVT3_SECRET'));
  // The keystore stores the raw 32-byte scalar; noble reduces mod r at sign/getPublicKey time, so the
  // EFFECTIVE signing key (= the one the on-chain pubkey corresponds to) is (raw mod r). buildDvtPop
  // strict-checks [1, r-1], so feed the reduced canonical scalar — same pubkey, same nodeId, same PoP.
  const blsSecret = toHex(BigInt(blsSecretRaw) % bls.params.r, { size: 32 });

  // derive pubkey, assert it matches node_state (no surprise key) + compute nodeId both ways
  const skBytes = Buffer.from(blsSecret.slice(2), 'hex');
  const pub = bls.longSignatures.getPublicKey(skBytes);
  const compressed = ('0x' + Buffer.from(pub.toBytes(true)).toString('hex')) as Hex;
  const eip2537 = eip2537G1(pub);
  if (compressed.toLowerCase() !== norm(ns.publicKey).toLowerCase())
    throw new Error(`decrypted key pubkey ${compressed} != node_state.publicKey ${ns.publicKey}`);
  const nodeIdCompressed = keccak256(compressed);
  const nodeIdEip2537 = keccak256(eip2537);
  log(`dvt3 pubkey(compressed) = ${compressed}`);
  log(`node_state.nodeId       = ${ns.nodeId}`);
  log(`keccak256(compressed)   = ${nodeIdCompressed}`);
  log(`keccak256(eip2537-128B) = ${nodeIdEip2537}`);

  const funder = privateKeyToAccount(norm(requireEnv('PRIVATE_KEY_JASON')));
  const operator = privateKeyToAccount(norm(requireEnv('DVT3_OPERATOR_PK')));
  const funderWallet = createWalletClient({ account: funder, chain: sepolia, transport });
  const operatorWallet = createWalletClient({ account: operator, chain: sepolia, transport });
  log(`\nvalidator = ${validator}`);
  log(`funder(JASON) = ${funder.address}  operator(dvt3) = ${operator.address}`);
  const funderEth = await publicClient.getBalance({ address: funder.address });
  log(`funder ETH = ${formatEther(funderEth)}`);

  // --- dryRun first: compute the plan + the nodeId onboardDvtNode will actually register ---
  const dry = await onboardDvtNode({ publicClient, operatorWallet, funderWallet, blsSecretKey: blsSecret, gToken: STAKE_GTOKEN, registry: validatorRegistry, dryRun: true });
  log(`\n[dryRun] nodeId=${dry.nodeId} requireStake=${dry.plan?.requireStake} wouldRegisterRole=${dry.plan?.wouldRegisterRole} plan=${JSON.stringify(dry.plan, (_k, v) => typeof v === 'bigint' ? v.toString() : v)}`);
  if (dry.nodeId.toLowerCase() !== norm(ns.nodeId).toLowerCase())
    throw new Error(`ABORT: onboardDvtNode nodeId ${dry.nodeId} != board node_state.nodeId ${ns.nodeId} — would register a nodeId the running node does not serve`);
  log(`✅ nodeId consistent with board node_state — safe to register`);

  if (process.env.DRY_ONLY === '1') { log('\nDRY_ONLY=1 → stop before broadcast'); return; }

  // --- real onboarding (JASON 代付) ---
  log(`\n=== onboardDvtNode (stake ${formatEther(dry.plan?.minStake ?? 0n)} + registerWithProof) ===`);
  const b = await onboardDvtNode({ publicClient, operatorWallet, funderWallet, blsSecretKey: blsSecret, gToken: STAKE_GTOKEN, registry: validatorRegistry, gTokenHeadroom: parseEther('5'), minOperatorEth: parseEther('0.1'), topUpEth: parseEther('0.1') });
  log(`nodeId=${b.nodeId} registered=${b.registered} staked=${b.staked} effectiveStake=${formatEther(b.effectiveStake)} (min ${formatEther(b.minStake)})`);
  log(`hashes=${JSON.stringify(b.hashes, null, 2)}`);
  if (!b.registered || !b.staked) throw new Error('FAIL: expected registered && staked');

  // independent re-read
  const dvt = dvtOperatorActions(validator)(publicClient as any);
  const isReg = await dvt.isRegistered({ nodeId: b.nodeId });
  const owner = await dvt.nodeOperator({ nodeId: b.nodeId });
  log(`\nre-read: isRegistered=${isReg} nodeOperator=${owner}`);
  if (!isReg || owner.toLowerCase() !== operator.address.toLowerCase()) throw new Error('FAIL: on-chain post-condition');
  log(`\n✅ dvt3 registered on-chain. register tx ${b.hashes.register}  operator ${operator.address}`);
}
main().catch((e) => {
  console.error('DVT3-REGISTER FAIL:', e?.shortMessage || e?.message || e);
  console.error('--- raw ---');
  console.error('name:', e?.name, '| code:', e?.code);
  if (e?.metaMessages) console.error('meta:', e.metaMessages.join('\n'));
  if (e?.details) console.error('details:', e.details);
  if (e?.cause) console.error('cause:', e.cause?.shortMessage || e.cause?.message || e.cause?.reason || JSON.stringify(e.cause)?.slice(0, 500));
  if (e?.cause?.cause) console.error('cause.cause:', e.cause.cause?.shortMessage || e.cause.cause?.reason || JSON.stringify(e.cause.cause)?.slice(0, 400));
  if (e?.stack) console.error('stack:', e.stack.split('\n').slice(0, 6).join('\n'));
  process.exit(1);
});
