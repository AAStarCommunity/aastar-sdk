/**
 * Beta2 — REAL on-chain (Sepolia) evidence for session-key flows (secp256k1 + P256).
 *
 * Proves the SessionKeyValidator **Session-tuple** ABI fix works against the live
 * deployed contract — not just in unit tests. A flat-params encoding would revert;
 * a successful grant + isSessionActive==true read is the proof the 8-field tuple
 * (uint48 expiry, address contractScope, bytes4 selectorScope, bool revoked,
 *  uint16 velocityLimit, uint32 velocityWindow, address[] callTargets, bytes4[] selectorAllowlist)
 * is encoded correctly.
 *
 * Flow:
 *   0. Deploy ONE beta.4 AirAccount (owner = ANNI EOA) via factory (unique salt).
 *   A. secp256k1 session: grantSessionDirect → isSessionActive(true) → revokeSession → isSessionActive(false)
 *   B. P256 session:      grantP256SessionDirect → isP256SessionActive(true) → revokeP256Session → isP256SessionActive(false)
 *
 * Access control: grant*Direct require msg.sender == ownerOf(account) → the OWNER EOA (ANNI)
 * calls SessionKeyValidator directly. Each step is a real tx; every tx hash is printed and
 * verified status==0x1 before being reported.
 *
 * Run:  pnpm tsx tests/regression/onchain-evidence/beta2-session.ts
 * Requires .env.sepolia with SEPOLIA_RPC_URL and PRIVATE_KEY_ANNI (funded ~1.1 ETH).
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import {
    createPublicClient, createWalletClient, http, parseEther, formatEther,
    encodeFunctionData, getContract, parseAbi, keccak256, encodePacked,
    type Address, type Hex,
} from 'viem';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { publicActions } from 'viem';
import { resilientSepoliaTransport, resilientSepoliaChain, bumpedFees } from './_rpc.js';
// Account creation + owner read also go through the SDK (airAccountFactoryActions / airAccountActions),
// not inline ABIs — so the WHOLE flow (setup + scenario) is 100% SDK API.
import { airAccountFactoryActions, airAccountActions } from '../../../packages/core/src/index.js';
import { CANONICAL_ADDRESSES } from '../../../packages/core/src/addresses.js';
// SCENARIO-LEVEL API UNDER TEST: the session-key flows are driven through the SDK's
// SessionKeyService (it owns the 8-field Session tuple encoding + the on-chain reads),
// NOT hand-written ABIs. This E2E proves OUR wrapper works on-chain, not just the contract.
import { SessionKeyService } from '../../../packages/airaccount/src/server/index.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env.sepolia') });

// ── Sepolia addresses (v0.19 stack, from the SDK's CANONICAL source of truth) ──
const FACTORY: Address = CANONICAL_ADDRESSES[11155111].airAccountFactoryV7 as Address; // v0.19 factory
const SESSION_KEY_VALIDATOR: Address = CANONICAL_ADDRESSES[11155111].sessionKeyValidator as Address; // v0.19
const ALG_ECDSA = 2;
const ETHERSCAN = (h: string) => `https://sepolia.etherscan.io/tx/${h}`;

// ── Factory ABI (same shape as l4-beta4-gasless.ts) ─────────────────────────
const FACTORY_ABI = [
    { type: 'function', name: 'getAddress', stateMutability: 'view',
      inputs: [{ name: 'owner', type: 'address' }, { name: 'salt', type: 'uint256' },
        { name: 'config', type: 'tuple', components: [
          { name: 'guardians', type: 'address[3]' }, { name: 'dailyLimit', type: 'uint256' },
          { name: 'approvedAlgIds', type: 'uint8[]' }, { name: 'minDailyLimit', type: 'uint256' },
          { name: 'initialTokens', type: 'address[]' },
          { name: 'initialTokenConfigs', type: 'tuple[]', components: [
            { name: 'tier1Limit', type: 'uint256' }, { name: 'tier2Limit', type: 'uint256' }, { name: 'dailyLimit', type: 'uint256' }] }] }],
      outputs: [{ type: 'address' }] },
    { type: 'function', name: 'createAccount', stateMutability: 'nonpayable',
      inputs: [{ name: 'owner', type: 'address' }, { name: 'salt', type: 'uint256' },
        { name: 'config', type: 'tuple', components: [
          { name: 'guardians', type: 'address[3]' }, { name: 'dailyLimit', type: 'uint256' },
          { name: 'approvedAlgIds', type: 'uint8[]' }, { name: 'minDailyLimit', type: 'uint256' },
          { name: 'initialTokens', type: 'address[]' },
          { name: 'initialTokenConfigs', type: 'tuple[]', components: [
            { name: 'tier1Limit', type: 'uint256' }, { name: 'tier2Limit', type: 'uint256' }, { name: 'dailyLimit', type: 'uint256' }] }] }],
      outputs: [{ type: 'address' }] },
] as const;

const OWNER_ABI = parseAbi(['function owner() external view returns (address)']);

// NOTE: the SessionKeyValidator ABI is NO LONGER hand-written here — all session
// operations (grant/revoke/isActive, secp256k1 + P256) go through the SDK's
// SessionKeyService, which owns the Session-tuple ABI. That is the scenario under test.

type Step = { label: string; tx?: string };
const steps: Step[] = [];

async function main() {
    const pkRaw = (process.env.PRIVATE_KEY_ANNI)!.replace(/^['"]|['"]$/g, '');
    if (!pkRaw) throw new Error('PRIVATE_KEY_ANNI missing from .env.sepolia');
    const pk = (pkRaw.startsWith('0x') ? pkRaw : `0x${pkRaw}`) as Hex;
    const owner = privateKeyToAccount(pk);

    const publicClient = createPublicClient({ chain: sepolia, transport: resilientSepoliaTransport() });
    const walletClient = createWalletClient({ account: owner, chain: resilientSepoliaChain, transport: resilientSepoliaTransport() }).extend(publicActions);
    const factorySvc = airAccountFactoryActions(FACTORY)(walletClient);

    // The SDK SessionKeyService — the scenario-level API under test. It encodes the
    // Session tuple + exposes the on-chain reads; the E2E only signs/broadcasts the bytes.
    // Migrated to viem: the service now takes a viem PublicClient as its read client.
    const sessionSvc = new SessionKeyService(
        publicClient,
        SESSION_KEY_VALIDATOR,
        SESSION_KEY_VALIDATOR, // agent-session validator unused in this flow
    );

    console.log('🧪 Beta2 — Session-key on-chain evidence (secp256k1 + P256)');
    console.log(`   Owner EOA (ANNI): ${owner.address}`);
    console.log(`   Balance: ${formatEther(await publicClient.getBalance({ address: owner.address }))} ETH`);
    console.log(`   SessionKeyValidator: ${SESSION_KEY_VALIDATOR}`);

    // Helper: send a tx, wait for receipt, assert status==0x1.
    // Robust to transient RPC broadcast-response timeouts: signs locally and derives the
    // tx hash up front, so a timed-out eth_sendRawTransaction (the raw tx still propagates)
    // is recovered by polling for the receipt rather than aborting the run.
    const fees = await bumpedFees(publicClient); // explicit priority tip so txs confirm promptly
    const send = async (label: string, data: Hex, to: Address = SESSION_KEY_VALIDATOR): Promise<string> => {
        const nonce = await publicClient.getTransactionCount({ address: owner.address, blockTag: 'pending' });
        const request = await walletClient.prepareTransactionRequest({ to, data, nonce, ...fees });
        const serialized = await walletClient.signTransaction(request as any);
        const hash = keccak256(serialized);
        try {
            await walletClient.sendRawTransaction({ serializedTransaction: serialized });
        } catch (e: any) {
            console.warn(`   ⚠️  ${label}: broadcast RPC timed out, polling for receipt (${hash})`);
        }
        const rcpt = await publicClient.waitForTransactionReceipt({ hash, timeout: 180_000 });
        const ok = rcpt.status === 'success';
        console.log(`   ${ok ? '✅' : '❌'} ${label}: ${hash} (status=${ok ? '0x1' : '0x0'})`);
        steps.push({ label, tx: hash });
        if (!ok) throw new Error(`${label} reverted on-chain (tx ${hash})`);
        return hash;
    };

    // ── 0. Deploy ONE beta.4 account (owner = ANNI, dailyLimit > 0, approvedAlgIds = [2]) ──
    const config = {
        guardians: ['0x0000000000000000000000000000000000000000', '0x0000000000000000000000000000000000000000', '0x0000000000000000000000000000000000000000'] as readonly [Address, Address, Address],
        dailyLimit: parseEther('1'),
        approvedAlgIds: [ALG_ECDSA] as readonly number[],
        minDailyLimit: 0n,
        initialTokens: [] as readonly Address[],
        initialTokenConfigs: [] as readonly { tier1Limit: bigint; tier2Limit: bigint; dailyLimit: bigint }[],
    };
    // Unique salt per run: avoids SessionAlreadyExists and cross-run collisions.
    const salt = BigInt(Date.now()) * 1000n + BigInt(Math.floor(Math.random() * 1000));

    // Account address prediction + deployment via the SDK factory action (not inline ABI).
    const account = await factorySvc.getAddress({ owner: owner.address, salt, config });
    console.log(`\n── Step 0: deploy beta.4 account (salt=${salt}) ──`);
    console.log(`   Predicted account: ${account}`);

    const code = await publicClient.getBytecode({ address: account });
    if (!code || code === '0x') {
        const deployTx = await factorySvc.createAccount({ owner: owner.address, salt, config, account: owner, ...fees });
        const rcpt = await publicClient.waitForTransactionReceipt({ hash: deployTx, timeout: 180_000 });
        console.log(`   ${rcpt.status === 'success' ? '✅' : '❌'} createAccount (deploy beta.4 account): ${deployTx}`);
        steps.push({ label: 'createAccount (deploy beta.4 account)', tx: deployTx });
        if (rcpt.status !== 'success') throw new Error('createAccount reverted');
    } else {
        console.log('   Account already deployed (salt reused).');
    }

    // Sanity: confirm the account's owner() == ANNI via the SDK account action (grant*Direct requires msg.sender == ownerOf).
    const onchainOwner = await airAccountActions(account)(publicClient).owner();
    console.log(`   account.owner() = ${onchainOwner}  (expect ${owner.address})`);
    if (onchainOwner.toLowerCase() !== owner.address.toLowerCase()) {
        throw new Error(`account.owner() != ANNI — grantSessionDirect would revert NotAccountOwner`);
    }

    // Session cfg: future expiry (1 day), ZeroAddress scope, 0x00000000 selector, revoked=false,
    // velocity 0, empty arrays. Must satisfy _validateCfg: 0 < expiry <= now + 7 days.
    const expiry = Math.floor(Date.now() / 1000) + 24 * 3600;
    const cfg = {
        expiry,
        contractScope: '0x0000000000000000000000000000000000000000' as Address,
        selectorScope: '0x00000000' as Hex,
        revoked: false,
        velocityLimit: 0,
        velocityWindow: 0,
        callTargets: [] as readonly Address[],
        selectorAllowlist: [] as readonly Hex[],
    };

    // ── A. secp256k1 session (regression for the tuple fix) ──
    console.log('\n── Step A: secp256k1 session ──');
    const sessionKey = privateKeyToAccount(generatePrivateKey()).address;
    console.log(`   sessionKey: ${sessionKey}`);

    // A.1 grantSessionDirect — calldata + Session TUPLE encoded by the SDK SessionKeyService.
    const grantData = sessionSvc.encodeGrantSession({
        account, sessionKey, expiry,
        contractScope: cfg.contractScope, selectorScope: cfg.selectorScope,
        velocityLimit: cfg.velocityLimit, velocityWindow: cfg.velocityWindow,
        callTargets: cfg.callTargets as string[], selectorAllowlist: cfg.selectorAllowlist as string[],
    }) as Hex;
    await send('A.1 grantSessionDirect', grantData);

    // A.2 read isSessionActive (via SDK) → expect true
    const activeA1 = await sessionSvc.isSessionActive(account, sessionKey);
    console.log(`   A.2 isSessionActive(after grant) = ${activeA1}  (expect true)`);
    if (!activeA1) throw new Error('isSessionActive returned false after grant — tuple fix is WRONG');

    // A.3 revokeSession → then read false (both via SDK)
    const revokeData = sessionSvc.encodeRevokeSession(account, sessionKey) as Hex;
    await send('A.3 revokeSession', revokeData);
    const activeA2 = await sessionSvc.isSessionActive(account, sessionKey);
    console.log(`   A.3 isSessionActive(after revoke) = ${activeA2}  (expect false)`);
    if (activeA2) throw new Error('isSessionActive still true after revoke');

    // ── B. P256 session ──
    console.log('\n── Step B: P256 session ──');
    // keyX/keyY = two 32-byte hex values (a representative passkey pubkey for evidence).
    const keyX = keccak256(encodePacked(['string', 'uint256'], ['beta2-p256-X', salt])) as Hex;
    const keyY = keccak256(encodePacked(['string', 'uint256'], ['beta2-p256-Y', salt])) as Hex;
    console.log(`   keyX: ${keyX}`);
    console.log(`   keyY: ${keyY}`);

    // B.1 grantP256SessionDirect — calldata + Session TUPLE encoded by the SDK SessionKeyService.
    const grantP256Data = sessionSvc.encodeGrantP256Session({
        account, keyX, keyY, expiry,
        contractScope: cfg.contractScope, selectorScope: cfg.selectorScope,
        velocityLimit: cfg.velocityLimit, velocityWindow: cfg.velocityWindow,
        callTargets: cfg.callTargets as string[], selectorAllowlist: cfg.selectorAllowlist as string[],
    }) as Hex;
    await send('B.1 grantP256SessionDirect', grantP256Data);

    // B.2 read isP256SessionActive (via SDK) → expect true
    const activeB1 = await sessionSvc.isP256SessionActive(account, keyX, keyY);
    console.log(`   B.2 isP256SessionActive(after grant) = ${activeB1}  (expect true)`);
    if (!activeB1) throw new Error('isP256SessionActive returned false after grant — tuple fix is WRONG');

    // B.3 revokeP256Session → then read false (both via SDK)
    const revokeP256Data = sessionSvc.encodeRevokeP256Session(account, keyX, keyY) as Hex;
    await send('B.3 revokeP256Session', revokeP256Data);
    const activeB2 = await sessionSvc.isP256SessionActive(account, keyX, keyY);
    console.log(`   B.3 isP256SessionActive(after revoke) = ${activeB2}  (expect false)`);
    if (activeB2) throw new Error('isP256SessionActive still true after revoke');

    // ── Summary ──
    console.log('\n✅ Beta2 session-key on-chain evidence PASSED — Session TUPLE works on the deployed contract.');
    console.log('\n── EVIDENCE SUMMARY ──');
    console.log(`account: ${account}`);
    for (const s of steps) console.log(`${s.label}: ${s.tx}  ${ETHERSCAN(s.tx!)}`);

    // Emit a machine-readable block for doc generation.
    console.log('\n---EVIDENCE-JSON---');
    console.log(JSON.stringify({
        account,
        sessionKeyValidator: SESSION_KEY_VALIDATOR,
        owner: owner.address,
        salt: salt.toString(),
        secp256k1: { sessionKey, activeAfterGrant: activeA1, activeAfterRevoke: activeA2 },
        p256: { keyX, keyY, activeAfterGrant: activeB1, activeAfterRevoke: activeB2 },
        steps: steps.map((s) => ({ label: s.label, tx: s.tx, etherscan: ETHERSCAN(s.tx!) })),
    }, null, 2));
}

main().catch((e) => {
    console.error('\n❌ Beta2 session-key evidence FAILED:', e?.shortMessage || e?.message || e);
    if (e?.cause?.data) console.error('   revert data:', e.cause.data);
    if (e?.metaMessages) console.error('   meta:', e.metaMessages.join(' | '));
    process.exit(1);
});
