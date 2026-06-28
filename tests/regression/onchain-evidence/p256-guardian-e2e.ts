/**
 * P-256 (WebAuthn passkey) guardian — on-chain evidence (REAL Sepolia txs, NOT a unit test).
 *
 * Proves the airaccount-contract v0.20.3 passkey-guardian social-recovery path end-to-end on
 * live Sepolia, driven entirely through the SDK's new P-256 surface (`@aastar/core`):
 *
 *   1. Deploy a fresh v0.20.3 account owned by JASON (InitConfig built via `buildInitConfig`).
 *   2. OWNER `addP256Guardian(x, y)` — owner-only bootstrap (no guardianSig; count < threshold).
 *   3. Read `getGuardianP256Key(0)` == (x, y) and `getRecoveryNonce()` == 0 on-chain.
 *   4. Software P-256 authenticator (`signP256GuardianAssertion`, mirrors gen_p256_assertion.mjs)
 *      signs a FULL WebAuthn assertion over the PROPOSE_RECOVERY challenge.
 *   5. `proposeRecoveryWithSig(newOwner, 0, sig)` — ANY relayer (here JASON) submits the
 *      pre-signed assertion; the contract runs the EIP-7212 precompile against the stored key.
 *   6. Read `activeRecovery()` — confirms the proposal + 1 approval (the proposing guardian).
 *
 * DECODE-VERIFY (off-chain, before/after the tx):
 *   - the operation challenge recomputed by the SDK == the challenge embedded in clientDataJSON,
 *   - the on-chain `sig` blob decodes to the 5-field WebAuthn assertion (low-S enforced),
 *   - the assertion self-verifies under the guardian's P-256 public key (noble),
 *   - the `RecoveryProposed(newOwner, proposedBy, guardianIdx=0)` event fired in the receipt.
 *
 * If `proposeRecoveryWithSig` reverts, the P-256 challenge/assertion encoding is WRONG — that is
 * the whole point of this evidence run (a contract-accepted passkey signature, not a unit test).
 *
 *   pnpm tsx tests/regression/onchain-evidence/p256-guardian-e2e.ts
 *
 * Requires .env.sepolia with SEPOLIA_RPC_URL (healthy) and PRIVATE_KEY_JASON (funded EOA).
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import {
    createPublicClient, createWalletClient, formatEther, getAddress, concat, sha256,
    publicActions, parseEventLogs, type Address, type Hex,
} from 'viem';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { p256 } from '@noble/curves/nist.js';
import { resilientSepoliaTransport, resilientSepoliaChain, bumpedFees } from './_rpc.js';
import {
    airAccountFactoryActions,
    airAccountActions,
    airAccountExtensionActions,
    buildInitConfig,
    buildProposeRecoveryChallenge,
    signP256GuardianAssertion,
    decodeWebAuthnAssertion,
    base64UrlEncode,
    p256GuardianPublicKey,
    CANONICAL_ADDRESSES,
    AirAccountExtensionABI,
    RECOVERY_NONCE_SLOT,
} from '../../../packages/core/src/index.js';
import { numberToHex } from 'viem';
import { RecoveryService } from '../../../packages/airaccount/src/server/index.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env.sepolia') });

const CHAIN_ID = 11155111;
const FACTORY: Address = CANONICAL_ADDRESSES[CHAIN_ID].airAccountFactoryV7 as Address; // v0.20.3
const ETHERSCAN = (h: string) => `https://sepolia.etherscan.io/tx/${h}`;

function clean(v?: string): string { return (v ?? '').replace(/^['"]|['"]$/g, ''); }

interface StepRecord { step: string; actor: string; tx?: string; note?: string; }

async function main() {
    const rpc = clean(process.env.SEPOLIA_RPC_URL || process.env.RPC_URL);
    const pk = clean(process.env.PRIVATE_KEY_JASON) as Hex;
    if (!rpc) throw new Error('SEPOLIA_RPC_URL missing in .env.sepolia');
    if (!pk) throw new Error('PRIVATE_KEY_JASON missing in .env.sepolia');
    const owner = privateKeyToAccount(pk.startsWith('0x') ? pk : (`0x${pk}` as Hex));

    const publicClient = createPublicClient({ chain: sepolia, transport: resilientSepoliaTransport() });
    const ownerWallet = createWalletClient({ account: owner, chain: resilientSepoliaChain, transport: resilientSepoliaTransport() }).extend(publicActions);
    const factorySvc = airAccountFactoryActions(FACTORY)(ownerWallet);
    const recoverySvc = new RecoveryService(publicClient);

    console.log('🧪 P-256 (passkey) guardian on-chain evidence (Sepolia)');
    console.log(`   Owner (JASON) EOA: ${owner.address}`);
    console.log(`   Owner balance: ${formatEther(await publicClient.getBalance({ address: owner.address }))} ETH`);
    console.log(`   Factory (v0.20.3): ${FACTORY}`);

    const steps: StepRecord[] = [];
    const fees = await bumpedFees(publicClient);

    const sendVerified = async (to: Address, data: Hex, label: string): Promise<Hex> => {
        const hash = await ownerWallet.sendTransaction({ to, data, ...fees } as any);
        const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 180_000 });
        if (receipt.status !== 'success') throw new Error(`${label} tx reverted: ${hash}`);
        console.log(`   ✅ ${label}: ${hash}  (status=0x1)`);
        return hash;
    };

    // ── 0. Software P-256 guardian (a passkey whose key lives in software, not Secure Enclave) ──
    const guardianPriv = generatePrivateKey();          // 32-byte P-256 scalar
    const { x, y } = p256GuardianPublicKey(guardianPriv); // SEC1 (x, y), each bytes32
    const guardianPub = concat(['0x04', x, y]);          // uncompressed point for verify
    console.log(`\n   Software passkey guardian pubkey: x=${x}`);
    console.log(`                                     y=${y}`);

    // ── 1. Deploy a fresh v0.20.3 account (no guardians yet) — config via buildInitConfig ──
    const config = buildInitConfig({ dailyLimit: 1_000_000_000_000_000_000n /* 1 ETH */ });
    const salt = BigInt(Math.floor(Date.now() / 1000));
    const account = await factorySvc.getAddress({ owner: owner.address, salt, config });
    console.log(`\n   Predicted account: ${account} (salt ${salt})`);
    const deployTx = await factorySvc.createAccount({ owner: owner.address, salt, config, account: owner, ...fees });
    {
        const rcpt = await publicClient.waitForTransactionReceipt({ hash: deployTx, timeout: 180_000 });
        if (rcpt.status !== 'success') throw new Error('createAccount reverted');
        console.log(`   ✅ Deploy account (via SDK factory): ${deployTx}`);
    }
    const code = await publicClient.getBytecode({ address: account });
    if (!code || code === '0x') throw new Error('Account has no bytecode after deploy');
    steps.push({ step: `Deploy v0.20.3 account (salt=${salt})`, actor: `JASON ${owner.address}`, tx: deployTx });

    const extReader = airAccountExtensionActions(account)(publicClient);
    const extWriter = airAccountExtensionActions(account)(ownerWallet);

    // ── 2. OWNER addP256Guardian(x, y) — owner-only bootstrap (guardianSig-FREE) ──
    const addTx = await extWriter.addP256Guardian({ x, y, account: owner, ...fees });
    {
        const rcpt = await publicClient.waitForTransactionReceipt({ hash: addTx, timeout: 180_000 });
        if (rcpt.status !== 'success') throw new Error('addP256Guardian reverted');
        console.log(`   ✅ addP256Guardian (owner-only, no guardianSig): ${addTx}`);
    }
    steps.push({ step: 'OWNER addP256Guardian(x, y) — guardianSig-free bootstrap', actor: `JASON ${owner.address}`, tx: addTx });

    // ── 3. Read back the stored P-256 key + recovery nonce ──
    const stored = await extReader.getGuardianP256Key({ index: 0 });
    if (stored.x.toLowerCase() !== x.toLowerCase() || stored.y.toLowerCase() !== y.toLowerCase()) {
        throw new Error(`getGuardianP256Key(0) mismatch: got (${stored.x}, ${stored.y})`);
    }
    const nonce = await extReader.getRecoveryNonce();
    console.log(`   📖 getGuardianP256Key(0) == registered (x, y) ✅`);
    console.log(`   📖 getRecoveryNonce() == ${nonce}`);

    // Cross-validate the internal-slot read methodology (used by getGuardian{Addition,Removal}Nonce
    // / getTierLimitNonce) against the PUBLIC getRecoveryNonce(): _recoveryNonce is slot 38, and the
    // mixed-sig nonces sit in the same forge-inspect-verified block (slots 15/16/39). If slot 38 read
    // == getRecoveryNonce(), the getStorageAt approach + the layout slot constants are sound.
    const slot38 = await publicClient.getStorageAt({ address: account, slot: numberToHex(RECOVERY_NONCE_SLOT, { size: 32 }) });
    if (BigInt(slot38 ?? '0x0') !== nonce) {
        throw new Error(`storage-slot read mismatch: slot 38 (${slot38}) != getRecoveryNonce() (${nonce})`);
    }
    const additionNonce = await extReader.getGuardianAdditionNonce();
    console.log(`   🔍 storage-slot cross-check: getStorageAt(slot 38) == getRecoveryNonce() == ${nonce} ✅`);
    console.log(`   📖 getGuardianAdditionNonce() (slot 39) == ${additionNonce}`);
    const guardianCount = await airAccountActions(account)(publicClient).guardianCount();
    console.log(`   📖 guardianCount == ${guardianCount}`);

    // ── 4. Build the PROPOSE_RECOVERY challenge + software WebAuthn assertion ──
    const newOwner = privateKeyToAccount(generatePrivateKey()).address;
    const challenge = buildProposeRecoveryChallenge({ chainId: CHAIN_ID, account, nonce, newOwner });
    const assertion = signP256GuardianAssertion({ privateKey: guardianPriv, challenge });
    console.log(`\n   Proposed newOwner: ${newOwner}`);
    console.log(`   PROPOSE_RECOVERY challenge: ${challenge}`);

    // DECODE-VERIFY (pre-tx): the sig decodes, low-S holds, and it self-verifies under (x, y).
    const decoded = decodeWebAuthnAssertion(assertion.sig);
    const cdjText = Buffer.from(decoded.clientDataJSONPrefix.slice(2), 'hex').toString()
        + base64UrlEncode(Buffer.from(challenge.slice(2), 'hex'))
        + Buffer.from(decoded.clientDataJSONSuffix.slice(2), 'hex').toString();
    const embeddedB64 = base64UrlEncode(Buffer.from(challenge.slice(2), 'hex'));
    if (!cdjText.includes(embeddedB64)) throw new Error('DECODE-VERIFY: challenge not embedded in clientDataJSON');
    // Reconstruct the exact signed payload and self-verify with the guardian public key.
    const authBytes = Buffer.from(assertion.authenticatorData.slice(2), 'hex');
    const cdHash = Buffer.from((sha256(`0x${Buffer.from(cdjText).toString('hex')}` as Hex)).slice(2), 'hex');
    const message = Buffer.concat([authBytes, cdHash]);
    const selfVerify = p256.verify(
        { r: BigInt(decoded.r), s: BigInt(decoded.s) },
        new Uint8Array(message),
        Buffer.from(guardianPub.slice(2), 'hex'),
        { prehash: true, lowS: true },
    );
    if (!selfVerify) throw new Error('DECODE-VERIFY: P-256 assertion does NOT self-verify under (x, y)');
    console.log('   🔍 DECODE-VERIFY (pre-tx): challenge embedded ✅, assertion self-verifies under (x,y) ✅, low-S ✅');

    // ── 5. proposeRecoveryWithSig(newOwner, 0, sig) — relayer submits the passkey assertion ──
    const proposeTx = await extWriter.proposeRecoveryWithSig({ newOwner, gIdx: 0, sig: assertion.sig, account: owner, ...fees });
    const proposeRcpt = await publicClient.waitForTransactionReceipt({ hash: proposeTx, timeout: 180_000 });
    if (proposeRcpt.status !== 'success') throw new Error(`proposeRecoveryWithSig reverted: ${proposeTx}`);
    console.log(`   ✅ proposeRecoveryWithSig (passkey-signed, on-chain EIP-7212 verify PASSED): ${proposeTx}`);
    steps.push({ step: 'proposeRecoveryWithSig(newOwner, gIdx=0, WebAuthn assertion)', actor: `relayer JASON ${owner.address}`, tx: proposeTx });

    // ── 6. Verify the RecoveryProposed event + activeRecovery() read ──
    const events = parseEventLogs({ abi: AirAccountExtensionABI as any, logs: proposeRcpt.logs, eventName: 'RecoveryProposed' });
    const proposed = events.find((e: any) => getAddress(e.args.newOwner) === getAddress(newOwner));
    if (!proposed) throw new Error('RecoveryProposed event for newOwner not found in receipt');
    if (Number((proposed as any).args.guardianIdx) !== 0) throw new Error('RecoveryProposed.guardianIdx != 0');
    console.log(`   🔍 RecoveryProposed(newOwner=${newOwner}, guardianIdx=0) event fired ✅`);

    const ar = await recoverySvc.getActiveRecovery(account);
    if (getAddress(ar.newOwner) !== getAddress(newOwner)) throw new Error(`activeRecovery.newOwner mismatch: ${ar.newOwner}`);
    if (ar.approvalCount !== 1) throw new Error(`expected 1 approval (proposing guardian), got ${ar.approvalCount}`);
    console.log(`   📖 activeRecovery(): newOwner=${ar.newOwner}, approvals=${ar.approvalCount}, executeAfter=${ar.executeAfter}`);
    console.log('   ✅ Passkey-guardian recovery PROPOSED on-chain with 1 approval.');

    // ── Emit markdown evidence ──
    const now = new Date().toISOString();
    const md: string[] = [];
    md.push(`### Run ${now}`, '');
    md.push(`- **Network:** Ethereum Sepolia (chainId ${CHAIN_ID})`);
    md.push(`- **Factory (v0.20.3):** \`${FACTORY}\``);
    md.push(`- **Account owner (JASON):** \`${owner.address}\``);
    md.push(`- **Deployed account:** \`${account}\` (salt \`${salt}\`)`);
    md.push(`- **P-256 guardian pubkey:** x=\`${x}\` y=\`${y}\``);
    md.push(`- **Proposed newOwner:** \`${newOwner}\``);
    md.push(`- **PROPOSE_RECOVERY challenge:** \`${challenge}\``);
    md.push('', '| # | Step | Actor | Tx hash |', '|---|------|-------|---------|');
    steps.forEach((s, i) => {
        const cell = s.tx ? `[\`${s.tx}\`](${ETHERSCAN(s.tx)})` : (s.note ?? '');
        md.push(`| ${i + 1} | ${s.step} | ${s.actor} | ${cell} |`);
    });
    md.push('', '**Decode-verify assertions (all ✅):**', '');
    md.push('- on-chain `getGuardianP256Key(0)` == registered (x, y)');
    md.push('- SDK-recomputed PROPOSE_RECOVERY challenge == challenge embedded in `clientDataJSON`');
    md.push('- on-chain `sig` decodes to 5-field WebAuthn assertion `(authenticatorData, prefix, suffix, r, s)`; `s` low-S');
    md.push('- assertion self-verifies under the guardian P-256 public key (noble `p256.verify`)');
    md.push('- `proposeRecoveryWithSig` mined `status=0x1` → contract EIP-7212 verify of the passkey signature PASSED');
    md.push('- `RecoveryProposed(newOwner, proposedBy, guardianIdx=0)` event fired');
    md.push(`- \`activeRecovery()\`: newOwner=\`${ar.newOwner}\`, approvals=${ar.approvalCount}`);
    md.push('');
    const block = md.join('\n');

    const outPath = path.resolve(process.cwd(), 'tests/regression/onchain-evidence/.p256-guardian.last.md');
    fs.writeFileSync(outPath, block);
    console.log(`\n──────── MARKDOWN EVIDENCE (also written to ${outPath}) ────────\n`);
    console.log(block);
    console.log('\n✅ P-256 guardian on-chain evidence COMPLETE — passkey-signed recovery proposal landed on Sepolia (status=0x1).');
}

main().catch((e) => { console.error('\n❌ P-256 guardian evidence FAILED:', e?.shortMessage || e?.message || e); process.exit(1); });
