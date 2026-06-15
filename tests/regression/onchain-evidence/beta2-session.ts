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

dotenv.config({ path: path.resolve(process.cwd(), '.env.sepolia') });

// ── Sepolia addresses ───────────────────────────────────────────────────────
const FACTORY: Address = '0x3a9127a5f0b4ca734d54629d0c3ad9f52739c071';            // beta.4 factory
const SESSION_KEY_VALIDATOR: Address = '0x655ca2e9a2d1178f7fbcea1856560d1e0c657ebf'; // beta.3, reused by beta.4
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

// ── SessionKeyValidator ABI — the Session TUPLE (the fix under test) ─────────
const SKV_ABI = parseAbi([
    'struct Session { uint48 expiry; address contractScope; bytes4 selectorScope; bool revoked; uint16 velocityLimit; uint32 velocityWindow; address[] callTargets; bytes4[] selectorAllowlist; }',
    'function grantSessionDirect(address account, address sessionKey, Session cfg) external',
    'function revokeSession(address account, address sessionKey) external',
    'function isSessionActive(address account, address sessionKey) external view returns (bool)',
    'function grantP256SessionDirect(address account, bytes32 p256KeyX, bytes32 p256KeyY, Session cfg) external',
    'function revokeP256Session(address account, bytes32 p256KeyX, bytes32 p256KeyY) external',
    'function isP256SessionActive(address account, bytes32 p256KeyX, bytes32 p256KeyY) external view returns (bool)',
]);

type Step = { label: string; tx?: string };
const steps: Step[] = [];

async function main() {
    const rpc = (process.env.SEPOLIA_RPC_URL || process.env.RPC_URL)!.replace(/^['"]|['"]$/g, '');
    const pkRaw = (process.env.PRIVATE_KEY_ANNI)!.replace(/^['"]|['"]$/g, '');
    if (!pkRaw) throw new Error('PRIVATE_KEY_ANNI missing from .env.sepolia');
    const pk = (pkRaw.startsWith('0x') ? pkRaw : `0x${pkRaw}`) as Hex;
    const owner = privateKeyToAccount(pk);

    const publicClient = createPublicClient({ chain: sepolia, transport: http(rpc) });
    const walletClient = createWalletClient({ account: owner, chain: sepolia, transport: http(rpc) });

    console.log('🧪 Beta2 — Session-key on-chain evidence (secp256k1 + P256)');
    console.log(`   Owner EOA (ANNI): ${owner.address}`);
    console.log(`   Balance: ${formatEther(await publicClient.getBalance({ address: owner.address }))} ETH`);
    console.log(`   SessionKeyValidator: ${SESSION_KEY_VALIDATOR}`);

    // Helper: send a tx, wait for receipt, assert status==0x1.
    // Robust to transient RPC broadcast-response timeouts: signs locally and derives the
    // tx hash up front, so a timed-out eth_sendRawTransaction (the raw tx still propagates)
    // is recovered by polling for the receipt rather than aborting the run.
    const send = async (label: string, data: Hex, to: Address = SESSION_KEY_VALIDATOR): Promise<string> => {
        const nonce = await publicClient.getTransactionCount({ address: owner.address, blockTag: 'pending' });
        const request = await walletClient.prepareTransactionRequest({ to, data, nonce });
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

    const factory = getContract({ address: FACTORY, abi: FACTORY_ABI, client: publicClient });
    const account = await factory.read.getAddress([owner.address, salt, config as any]) as Address;
    console.log(`\n── Step 0: deploy beta.4 account (salt=${salt}) ──`);
    console.log(`   Predicted account: ${account}`);

    const code = await publicClient.getBytecode({ address: account });
    if (!code || code === '0x') {
        const deployData = encodeFunctionData({ abi: FACTORY_ABI, functionName: 'createAccount', args: [owner.address, salt, config as any] });
        await send('createAccount (deploy beta.4 account)', deployData, FACTORY);
    } else {
        console.log('   Account already deployed (salt reused).');
    }

    // Sanity: confirm the account's owner() == ANNI (grant*Direct requires msg.sender == ownerOf).
    const onchainOwner = await publicClient.readContract({ address: account, abi: OWNER_ABI, functionName: 'owner' }) as Address;
    console.log(`   account.owner() = ${onchainOwner}  (expect ${owner.address})`);
    if (onchainOwner.toLowerCase() !== owner.address.toLowerCase()) {
        throw new Error(`account.owner() != ANNI — grantSessionDirect would revert NotAccountOwner`);
    }

    const skv = getContract({ address: SESSION_KEY_VALIDATOR, abi: SKV_ABI, client: publicClient });

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

    // A.1 grantSessionDirect — Session TUPLE calldata. A flat encoding would revert here.
    const grantData = encodeFunctionData({ abi: SKV_ABI, functionName: 'grantSessionDirect', args: [account, sessionKey, cfg as any] });
    await send('A.1 grantSessionDirect', grantData);

    // A.2 read isSessionActive → expect true
    const activeA1 = await skv.read.isSessionActive([account, sessionKey]) as boolean;
    console.log(`   A.2 isSessionActive(after grant) = ${activeA1}  (expect true)`);
    if (!activeA1) throw new Error('isSessionActive returned false after grant — tuple fix is WRONG');

    // A.3 revokeSession → then read false
    const revokeData = encodeFunctionData({ abi: SKV_ABI, functionName: 'revokeSession', args: [account, sessionKey] });
    await send('A.3 revokeSession', revokeData);
    const activeA2 = await skv.read.isSessionActive([account, sessionKey]) as boolean;
    console.log(`   A.3 isSessionActive(after revoke) = ${activeA2}  (expect false)`);
    if (activeA2) throw new Error('isSessionActive still true after revoke');

    // ── B. P256 session ──
    console.log('\n── Step B: P256 session ──');
    // keyX/keyY = two 32-byte hex values (a representative passkey pubkey for evidence).
    const keyX = keccak256(encodePacked(['string', 'uint256'], ['beta2-p256-X', salt])) as Hex;
    const keyY = keccak256(encodePacked(['string', 'uint256'], ['beta2-p256-Y', salt])) as Hex;
    console.log(`   keyX: ${keyX}`);
    console.log(`   keyY: ${keyY}`);

    // B.1 grantP256SessionDirect — Session TUPLE calldata.
    const grantP256Data = encodeFunctionData({ abi: SKV_ABI, functionName: 'grantP256SessionDirect', args: [account, keyX, keyY, cfg as any] });
    await send('B.1 grantP256SessionDirect', grantP256Data);

    // B.2 read isP256SessionActive → expect true
    const activeB1 = await skv.read.isP256SessionActive([account, keyX, keyY]) as boolean;
    console.log(`   B.2 isP256SessionActive(after grant) = ${activeB1}  (expect true)`);
    if (!activeB1) throw new Error('isP256SessionActive returned false after grant — tuple fix is WRONG');

    // B.3 revokeP256Session → then read false
    const revokeP256Data = encodeFunctionData({ abi: SKV_ABI, functionName: 'revokeP256Session', args: [account, keyX, keyY] });
    await send('B.3 revokeP256Session', revokeP256Data);
    const activeB2 = await skv.read.isP256SessionActive([account, keyX, keyY]) as boolean;
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
