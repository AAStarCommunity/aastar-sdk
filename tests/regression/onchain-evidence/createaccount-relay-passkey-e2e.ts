/**
 * createAccount RELAY mode — KMS-style passkey-at-birth deploy on Sepolia (v0.22.0, aastar-sdk#249).
 *
 * Proves the gap 0.30.0 left uncovered: the v0.22.0 passkey-at-birth e2e used an EOA owner (DIRECT mode,
 * msg.sender == owner). Production KMS accounts hold the owner key in a TEE and CANNOT send a raw tx, so
 * they MUST use RELAY mode: the owner signs the CREATE_ACCOUNT digest (EIP-191), a separate deployer
 * wallet relays the tx and pays gas (msg.sender != owner).
 *
 * The whole point under test is `buildCreateAccountHash` (the SDK's byte-exact replica of the factory's
 * internal `_getConfigHash` + CREATE_ACCOUNT preimage). If a single byte is wrong, the factory's
 * `ecrecover != owner` and the deploy reverts InvalidOwnerSignature — so a SUCCESSFUL relay deploy IS the
 * proof the replica matches the on-chain hash. Here the owner is a software EOA standing in for the KMS
 * signer (same EIP-191 personal-sign); the deployer is the funded relayer.
 *
 *   pnpm exec tsx tests/regression/onchain-evidence/createaccount-relay-passkey-e2e.ts
 *
 * Requires: .env.sepolia (SEPOLIA_RPC_URL[/2/3], PRIVATE_KEY_JASON funded as the deployer/relayer).
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import { p256 } from '@noble/curves/nist.js';
import {
    createPublicClient,
    createWalletClient,
    http,
    keccak256,
    toBytes,
    bytesToHex,
    getAddress,
    type Address,
    type Hex,
    type PublicClient,
} from 'viem';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import {
    CANONICAL_ADDRESSES,
    AAStarAirAccountV7ABI,
    buildInitConfig,
    buildCreateAccountHash,
    airAccountFactoryActions,
} from '@aastar/core';

dotenv.config({ path: path.resolve(process.cwd(), '.env.sepolia') });

const SEPOLIA = 11155111;
const FACTORY = getAddress(CANONICAL_ADDRESSES[SEPOLIA].airAccountFactoryV7); // v0.22.0
const RPCS = [process.env.SEPOLIA_RPC_URL, process.env.SEPOLIA_RPC_URL2, process.env.SEPOLIA_RPC_URL3].filter(Boolean) as string[];
const ZERO = '0x0000000000000000000000000000000000000000';

async function withRpcFallback<T>(fn: (c: PublicClient) => Promise<T>): Promise<T> {
    let lastErr: unknown;
    for (const url of RPCS) {
        try {
            return await fn(createPublicClient({ chain: sepolia, transport: http(url) }) as PublicClient);
        } catch (e) { lastErr = e; }
    }
    throw lastErr;
}

async function main() {
    const deployerPk = process.env.PRIVATE_KEY_JASON as Hex;
    if (!deployerPk) throw new Error('PRIVATE_KEY_JASON required (deployer/relayer)');
    const deployer = privateKeyToAccount(deployerPk);
    const walletClient = createWalletClient({ account: deployer, chain: sepolia, transport: http(RPCS[0]) });

    // Owner = a FRESH key standing in for the KMS owner: it ONLY signs the digest (EIP-191), never sends
    // a tx. Fresh => createNonces(owner) == 0 and a brand-new CREATE2 address each run.
    const owner = privateKeyToAccount(generatePrivateKey());

    // Owner device passkey (software P-256 stand-in) → injected at birth.
    const p256Priv = p256.utils.randomSecretKey();
    const pub = p256.getPublicKey(p256Priv, false); // 0x04 ‖ X(32) ‖ Y(32)
    const ownerP256X = bytesToHex(pub.slice(1, 33)) as Hex;
    const ownerP256Y = bytesToHex(pub.slice(33, 65)) as Hex;

    // Guardian (a fixed address); Tier-3 device-passkey config (approvedAlgIds=[0x0a]).
    const guardian = privateKeyToAccount(generatePrivateKey()).address;
    const config = buildInitConfig({
        guardians: [{ ecdsa: guardian }],
        dailyLimit: 10n ** 18n,
        minDailyLimit: 10n ** 17n,
        approvedAlgIds: [0x0a],
    });

    const salt = BigInt(keccak256(toBytes(`createaccount-relay-passkey/#249/${owner.address}`)));

    console.log(`owner(KMS stand-in) = ${owner.address}`);
    console.log(`deployer/relayer    = ${deployer.address}`);
    console.log(`passkey X           = ${ownerP256X.slice(0, 18)}…`);

    const factoryRead = airAccountFactoryActions(FACTORY)(await pubClient());
    const nonce = (await factoryRead.createNonces({ owner: owner.address })) as bigint;
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
    console.log(`\n[1] createNonces(owner) = ${nonce}; deadline = ${deadline}`);

    // The SDK digest UNDER TEST.
    const hash = buildCreateAccountHash({
        chainId: SEPOLIA, factory: FACTORY, owner: owner.address, salt,
        ownerP256X, ownerP256Y, config, nonce, deadline,
    });
    console.log(`[2] buildCreateAccountHash = ${hash}`);

    // Owner signs it EIP-191 (exactly what a KMS owner-key sign produces; viem applies toEthSignedMessageHash).
    const ownerSig = await owner.signMessage({ message: { raw: hash } });

    // Counterfactual address bound to (owner, salt, config, passkey).
    const predicted = await factoryRead.getAddress({ owner: owner.address, salt, config, ownerP256X, ownerP256Y });
    console.log(`[3] predicted account = ${predicted}`);

    // RELAY deploy: deployer (msg.sender) != owner; authorization is the ownerSig over the digest.
    const tx = await airAccountFactoryActions(FACTORY)(walletClient).createAccount({
        owner: owner.address, salt, config, ownerP256X, ownerP256Y, nonce, deadline, ownerSig, account: deployer,
    });
    const rcpt = await withRpcFallback((c) => c.waitForTransactionReceipt({ hash: tx }));
    console.log(`[4] relay deploy tx=${tx} status=${rcpt.status}`);
    if (rcpt.status !== 'success') throw new Error('relay deploy REVERTED — buildCreateAccountHash mismatch (InvalidOwnerSignature) or expired/nonce');

    // ── Acceptance ──────────────────────────────────────────────────────────────────────────────
    const code = await withRpcFallback((c) => c.getCode({ address: predicted }));
    if (!code || code === '0x') throw new Error('predicted address has no code — getAddress prediction wrong');
    const bornX = (await withRpcFallback((c) => c.readContract({ address: predicted, abi: AAStarAirAccountV7ABI, functionName: 'p256KeyX' }))) as Hex;
    const bornValidator = (await withRpcFallback((c) => c.readContract({ address: predicted, abi: AAStarAirAccountV7ABI, functionName: 'validator' }))) as Address;
    const newNonce = (await factoryRead.createNonces({ owner: owner.address })) as bigint;
    console.log(`\n[5] p256KeyX @birth = ${bornX.slice(0, 18)}… (== passkey: ${bornX.toLowerCase() === ownerP256X.toLowerCase()})`);
    console.log(`    validator @birth = ${bornValidator} (non-zero: ${bornValidator !== ZERO})`);
    console.log(`    createNonces(owner) ${nonce} → ${newNonce} (relay consumed the nonce)`);

    if (bornX.toLowerCase() !== ownerP256X.toLowerCase()) throw new Error('passkey not injected at birth (p256KeyX != ownerP256X)');
    if (bornValidator === ZERO) throw new Error('validator not wired at birth');
    if (newNonce !== nonce + 1n) throw new Error(`createNonces did not increment (${nonce} → ${newNonce})`);

    console.log('\n🎉 PASS — KMS-style RELAY passkey-at-birth deploy ACCEPTED on-chain; buildCreateAccountHash is byte-exact.');
}

async function pubClient(): Promise<PublicClient> {
    return createPublicClient({ chain: sepolia, transport: http(RPCS[0]) }) as PublicClient;
}

main().catch((e) => { console.error('❌ FAILED:', e); process.exit(1); });
