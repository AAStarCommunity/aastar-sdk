/**
 * Tier-1 single-ECDSA (algId 0x02) — on-chain acceptance probe on Sepolia (#273).
 *
 * airaccount-contract v0.25.0 removes the raw-65 ECDSA fallback, so the SDK's
 * generateTieredSignature(tier=1) now frames Tier-1 as [algId 0x02][r][s][v] = 66 bytes.
 *
 * The live deployed account is v0.24.0 (the raw-65 fallback is STILL present there), so this probe
 * proves the FORWARD-COMPAT risk that a signing-path change carries: does the currently-deployed
 * v0.24.0 account ACCEPT the new 0x02-framed Tier-1 signature — i.e. does shipping SDK 0.36.1 keep
 * Tier-1 working on today's accounts, and not break it during the v0.24→v0.25 transition?
 *
 * Everything is software-reproducible — NO DVT / bundler / device passkey needed (Tier-1 is a pure
 * owner ECDSA over userOpHash).
 *
 * Flow:
 *   0. Deploy a fresh account (owner=JASON, approvedAlgIds=[0x02]); set the validator router (this is
 *      how the tiered submit path is actually reached in production — validator set ⇒ tier path).
 *   1. Build a v0.7 PackedUserOperation; userOpHash via EntryPoint.getUserOpHash.
 *   2. Tier-1 sig via the REAL SDK path: BLSSignatureService.generateTieredSignature({tier:1}) backed
 *      by a LocalWalletSigner(JASON) → [0x02] ‖ EIP-191 personal_sign(userOpHash) (66 bytes).
 *   3. eth_call validateUserOp(userOp{tier1Sig}, userOpHash, 0) from the EntryPoint → assert == 0 (ACCEPTED).
 *   4. Baseline: the OLD raw-65 output (no 0x02 prefix) → record the result (shows whether the live
 *      v0.24.0 account still carries the raw-65 fallback that v0.25.0 removes).
 *   5. Negative: a 0x02-framed sig from a WRONG key → assert != 0 (REJECTED) — the oracle discriminates.
 *
 *   pnpm exec tsx tests/regression/onchain-evidence/tier1-ecdsa-algid-e2e.ts
 *
 * Requires: .env.sepolia (SEPOLIA_RPC_URL[/2/3], PRIVATE_KEY_JASON funded). No DVT / bundler needed.
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import {
    createPublicClient,
    createWalletClient,
    http,
    hexToBytes,
    keccak256,
    toBytes,
    numberToHex,
    getAddress,
    type Address,
    type Hex,
    type PublicClient,
} from 'viem';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import {
    CANONICAL_ADDRESSES,
    EntryPointABI,
    AAStarAirAccountV7ABI,
    buildInitConfig,
    airAccountFactoryActions,
    entryPointActions,
} from '@aastar/core';
// The SDK path UNDER TEST — imported from source so the #273 fix (packEcdsaAlgId inside
// generateTieredSignature) is exercised directly, not a possibly-stale dist build.
import { BLSSignatureService } from '../../../packages/airaccount/src/server/services/bls-signature-service';
import { LocalWalletSigner } from '../../../packages/airaccount/src/server/adapters/local-wallet-signer';

dotenv.config({ path: path.resolve(process.cwd(), '.env.sepolia') });

const SEPOLIA = 11155111;
const FACTORY = getAddress(CANONICAL_ADDRESSES[SEPOLIA].airAccountFactoryV7);
const ENTRY_POINT = getAddress(CANONICAL_ADDRESSES[SEPOLIA].entryPoint);
const VALIDATOR_ROUTER = getAddress(CANONICAL_ADDRESSES[SEPOLIA].aaStarValidator);

const ALG_ECDSA = 0x02;
const RPCS = [process.env.SEPOLIA_RPC_URL, process.env.SEPOLIA_RPC_URL2, process.env.SEPOLIA_RPC_URL3]
    .map((s) => (s || '').replace(/^['"]|['"]$/g, ''))
    .filter(Boolean) as string[];
const ZERO_ADDR = '0x0000000000000000000000000000000000000000' as Address;
// Deterministic salt — idempotent reruns reuse the same account.
const SALT = BigInt(keccak256(toBytes('tier1-ecdsa-algid-e2e/#273/2026-07')));

type PackedUserOp = {
    sender: Address; nonce: bigint; initCode: Hex; callData: Hex;
    accountGasLimits: Hex; preVerificationGas: bigint; gasFees: Hex; paymasterAndData: Hex; signature: Hex;
};

async function withRpcFallback<T>(fn: (c: PublicClient) => Promise<T>): Promise<T> {
    let lastErr: unknown;
    for (const url of RPCS) {
        try { return await fn(createPublicClient({ chain: sepolia, transport: http(url) }) as PublicClient); }
        catch (e) { lastErr = e; }
    }
    throw lastErr;
}

async function main() {
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log(' Tier-1 single-ECDSA (0x02) acceptance probe — SDK generateTieredSignature(tier=1), Sepolia (#273)');
    console.log('═══════════════════════════════════════════════════════════════════════════');
    if (RPCS.length === 0) throw new Error('No SEPOLIA_RPC_URL[/2/3] in .env.sepolia');

    let jasonPk = process.env.PRIVATE_KEY_JASON;
    if (!jasonPk) throw new Error('PRIVATE_KEY_JASON missing from .env.sepolia');
    if (!jasonPk.startsWith('0x')) jasonPk = `0x${jasonPk}`;
    const owner = privateKeyToAccount(jasonPk as Hex);
    const walletClient = createWalletClient({ account: owner, chain: sepolia, transport: http(RPCS[0]) });
    console.log(`\n[0a] owner(JASON)=${owner.address}  validatorRouter=${VALIDATOR_ROUTER}`);

    // ── (0b) Deploy a fresh account approving algId 0x02 (guard enabled ⇒ algId whitelist applies) ──
    const config = buildInitConfig({
        dailyLimit: 10n ** 18n, // 1 ETH — guard enabled ⇒ the approvedAlgIds whitelist is enforced
        approvedAlgIds: [ALG_ECDSA],
    });
    const account = (await withRpcFallback((c) =>
        airAccountFactoryActions(FACTORY)(c).getAddress({ owner: owner.address, salt: SALT, config })
    )) as Address;
    console.log(`\n[0b] account = ${account} (salt=${numberToHex(SALT)})`);
    const code = await withRpcFallback((c) => c.getCode({ address: account }));
    if (code && code !== '0x') {
        console.log('     already deployed ✓ (idempotent rerun)');
    } else {
        const tx = await airAccountFactoryActions(FACTORY)(walletClient).createAccount({ owner: owner.address, salt: SALT, config, account: owner });
        const r = await withRpcFallback((c) => c.waitForTransactionReceipt({ hash: tx }));
        console.log(`     deploy tx=${tx} status=${r.status}`);
        if (r.status !== 'success') throw new Error('deploy reverted');
    }

    // ── (0c) Set validator router (set-once) — this is what makes the tiered submit path apply in prod ──
    const curValidator = (await withRpcFallback((c) =>
        c.readContract({ address: account, abi: AAStarAirAccountV7ABI, functionName: 'validator' })
    )) as Address;
    if (curValidator === ZERO_ADDR) {
        const tx = await walletClient.writeContract({ address: account, abi: AAStarAirAccountV7ABI, functionName: 'setValidator', args: [VALIDATOR_ROUTER], chain: sepolia });
        const r = await withRpcFallback((c) => c.waitForTransactionReceipt({ hash: tx }));
        console.log(`\n[0c] setValidator tx=${tx} status=${r.status}`);
    } else {
        console.log(`\n[0c] validator already set = ${curValidator}`);
    }

    // ── (1) Build a v0.7 PackedUserOperation + authoritative userOpHash ─────────────────────────
    const nonce = (await withRpcFallback((c) => entryPointActions(ENTRY_POINT)(c).getNonce({ sender: account, key: 0n }))) as bigint;
    const userOp: PackedUserOp = {
        sender: account, nonce, initCode: '0x', callData: '0x',
        accountGasLimits: `0x${'00'.repeat(32)}` as Hex, preVerificationGas: 0n, gasFees: `0x${'00'.repeat(32)}` as Hex, paymasterAndData: '0x', signature: '0x',
    };
    const userOpHash = (await withRpcFallback((c) =>
        c.readContract({ address: ENTRY_POINT, abi: EntryPointABI, functionName: 'getUserOpHash', args: [userOp] })
    )) as Hex;
    console.log(`\n[1] userOpHash = ${userOpHash}`);

    // ── (2) Tier-1 signature via the REAL SDK path (generateTieredSignature → packEcdsaAlgId) ────
    const storageStub = {
        getBlsConfig: async () => undefined,
        findAccountByUserId: async () => ({ signerAddress: owner.address }),
    };
    const svc = new BLSSignatureService(
        { blsSeedNodes: [] } as any,
        {} as any, // ethereum — unused on the tier-1 path
        storageStub as any,
        new LocalWalletSigner(jasonPk)
    );
    const tier1Sig = (await svc.generateTieredSignature({ tier: 1, userId: 'jason', userOpHash })) as Hex;
    const tier1Bytes = (tier1Sig.length - 2) / 2;
    console.log(`[2] SDK tier-1 sig = ${tier1Sig.slice(0, 8)}…  (${tier1Bytes}B, algId=0x${tier1Sig.slice(2, 4)})`);
    if (tier1Sig.slice(0, 4) !== '0x02' || tier1Bytes !== 66) {
        throw new Error(`SDK tier-1 output is not the expected [0x02][r][s][v] 66-byte frame (got 0x${tier1Sig.slice(2, 4)}, ${tier1Bytes}B)`);
    }

    // ── (3/4/5) On-chain oracle: validateUserOp from the EntryPoint (eth_call) ───────────────────
    async function validate(sigBytes: Hex): Promise<bigint | 'revert'> {
        try {
            const sim = await withRpcFallback((c) =>
                c.simulateContract({
                    address: account, abi: AAStarAirAccountV7ABI, functionName: 'validateUserOp',
                    args: [{ ...userOp, signature: sigBytes }, userOpHash, 0n], account: ENTRY_POINT,
                })
            );
            return sim.result as bigint;
        } catch { return 'revert'; }
    }

    // (3) THE acceptance: the new 0x02-framed Tier-1 sig must be accepted by the live v0.24.0 account.
    const accepted = await validate(tier1Sig);
    const acceptOk = accepted === 0n;
    console.log(`\n[3] validateUserOp(0x02-framed tier-1) = ${accepted}  -> ${acceptOk ? '0 ✅ ACCEPTED' : '❌ REJECTED'}`);

    // (4) Baseline: the OLD raw-65 output (what 0.36.0 emitted). On v0.24.0 (fallback present) this is
    //     expected to still validate; on a v0.25.0 account it would be rejected. Informational.
    const raw65 = (await owner.signMessage({ message: { raw: userOpHash } })) as Hex;
    const raw65Result = await validate(raw65);
    console.log(`[4] validateUserOp(OLD raw-65, no algId) = ${raw65Result}  -> ${raw65Result === 0n ? 'still accepted (v0.24.0 fallback present; v0.25.0 removes it)' : 'rejected (fallback already gone)'}`);

    // (5) Negative: a well-formed 0x02 frame but signed by a DIFFERENT key → must be rejected.
    const wrong = privateKeyToAccount(generatePrivateKey());
    const wrongSig65 = (await wrong.signMessage({ message: { raw: userOpHash } })) as Hex;
    const wrongTier1 = (`0x02${wrongSig65.slice(2)}`) as Hex;
    const wrongResult = await validate(wrongTier1);
    const wrongOk = wrongResult !== 0n;
    console.log(`[5] validateUserOp(0x02 frame, WRONG signer) = ${wrongResult}  -> ${wrongOk ? '✅ rejected (oracle discriminates)' : '❌ accepted (UNEXPECTED)'}`);

    console.log('\n┌─────────────────── EVIDENCE (Tier-1 single-ECDSA 0x02, #273) ───────────────────');
    console.log(`│ account        : ${account}`);
    console.log(`│ owner (JASON)  : ${owner.address}`);
    console.log(`│ userOpHash     : ${userOpHash}`);
    console.log(`│ tier-1 sig     : ${tier1Sig.slice(0, 10)}… (${tier1Bytes}B, 0x02-framed)`);
    console.log(`│ [3] 0x02 tier-1 accepted : ${accepted} ${acceptOk ? '✅' : '❌'}`);
    console.log(`│ [4] old raw-65           : ${raw65Result} (${raw65Result === 0n ? 'v0.24.0 still accepts' : 'rejected'})`);
    console.log(`│ [5] wrong-signer 0x02    : ${wrongResult} ${wrongOk ? '✅ rejected' : '❌'}`);
    console.log('└──────────────────────────────────────────────────────────────────────────────');

    if (!acceptOk) throw new Error('FAIL: the live account REJECTED the SDK 0x02-framed tier-1 signature — shipping 0.36.1 would break Tier-1');
    if (!wrongOk) throw new Error('FAIL: the oracle accepted a wrong-signer signature — validateUserOp is not discriminating');
    console.log('\n✅ Tier-1 0x02 acceptance PROVEN on the live v0.24.0 account (#273).');
}

main().catch((e) => { console.error('\n❌ E2E FAILED:', e instanceof Error ? e.message : e); process.exit(1); });
