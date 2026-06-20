/**
 * P-256 (passkey) MAIN-ACCOUNT creation via the SERVER-CLIENT path — on-chain evidence
 * (REAL Sepolia txs, NOT a unit test). Closes aastar-sdk #118.
 *
 * The gap: the server-client `AccountManager` (the path YAA / KMS-custodied owners use) could
 * only deploy ECDSA-guardian accounts (`createAccountWithDefaults`). There was no way to inject
 * `InitConfig.guardianP256X/Y`, so a passkey guardian could not be installed AT DEPLOY time.
 *
 * This proves the new `AccountManager.createAccountWithP256Guardians` end-to-end:
 *
 *   1. Build a software P-256 guardian key (x, y).
 *   2. SERVER-CLIENT: `AccountManager.createAccountWithP256Guardians({ p256Guardians:[{x,y}], … })`
 *      → builds the FULL 8-field InitConfig via core `buildInitConfig`, predicts the address via the
 *      factory's full-config `getAddress(owner, salt, config)` (tuple-encoded), and persists the record.
 *   3. Reconstruct the deploy InitConfig from the persisted record via the SERVER helper
 *      `initConfigFromRecord` (the exact bytes transfer-manager embeds in the first-UserOp initCode).
 *   4. Cross-check: core `factory.getAddress({owner,salt,config})` (object-encoded) == the server's
 *      predicted address → proves the tuple and object encodings produce the byte-identical config hash.
 *   5. DEPLOY by sending the factory `createAccount(owner, salt, config)` from the funded owner EOA.
 *      (This substitutes ONLY the KMS-signed-UserOp deploy leg — which is the unchanged existing path —
 *      with a direct factory call; `createAccount` ignores msg.sender, the owner is the `owner` arg.)
 *   6. Assert the account deployed at the SERVER-predicted address, then read
 *      `getGuardianP256Key(0)` on-chain and assert it == the (x, y) the server installed.
 *      `guardianCount() == 1` confirms exactly one guardian slot was bootstrapped.
 *
 * If the P-256 coords were dropped or mis-positioned in InitConfig, either the deployed address would
 * differ from the prediction (step 6) or `getGuardianP256Key(0)` would return the zero pair — both fail.
 *
 *   pnpm tsx tests/regression/onchain-evidence/p256-account-create-e2e.ts
 *
 * Requires .env.sepolia with a healthy SEPOLIA_RPC_URL and a funded PRIVATE_KEY_JASON.
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import {
    createPublicClient, createWalletClient, formatEther, getAddress,
    publicActions, type Address, type Hex,
} from 'viem';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { resilientSepoliaTransport, resilientSepoliaChain, bumpedFees } from './_rpc.js';
import {
    airAccountFactoryActions,
    airAccountActions,
    airAccountExtensionActions,
    p256GuardianPublicKey,
    CANONICAL_ADDRESSES,
} from '../../../packages/core/src/index.js';
import {
    AccountManager,
    EthereumProvider,
    MemoryStorage,
    LocalWalletSigner,
    sepoliaV07Config,
    EntryPointVersion,
    SilentLogger,
    initConfigFromRecord,
} from '../../../packages/airaccount/src/server/index.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env.sepolia') });

const CHAIN_ID = 11155111;
const FACTORY: Address = CANONICAL_ADDRESSES[CHAIN_ID].airAccountFactoryV7 as Address; // v0.20.0
const ETHERSCAN = (h: string) => `https://sepolia.etherscan.io/tx/${h}`;
const DAILY_LIMIT = 1_000_000_000_000_000_000n; // 1 ETH

function clean(v?: string): string { return (v ?? '').replace(/^['"]|['"]$/g, '').trim(); }

/** First healthy RPC URL — AccountManager takes a single rpcUrl (its only read is the prediction). */
function pickRpc(): string {
    const url = clean(process.env.SEPOLIA_RPC_URL) || clean(process.env.SEPOLIA_RPC_URL3)
        || clean(process.env.SEPOLIA_RPC_URL2) || clean(process.env.RPC_URL);
    if (!url) throw new Error('No Sepolia RPC URL in .env.sepolia (set SEPOLIA_RPC_URL)');
    return url;
}

interface StepRecord { step: string; actor: string; tx?: string; note?: string; }

async function main() {
    const rpc = pickRpc();
    const pk = clean(process.env.PRIVATE_KEY_JASON) as Hex;
    if (!pk) throw new Error('PRIVATE_KEY_JASON missing in .env.sepolia');
    const privKey = (pk.startsWith('0x') ? pk : (`0x${pk}` as Hex));
    const owner = privateKeyToAccount(privKey);

    const publicClient = createPublicClient({ chain: sepolia, transport: resilientSepoliaTransport() });
    const ownerWallet = createWalletClient({ account: owner, chain: resilientSepoliaChain, transport: resilientSepoliaTransport() }).extend(publicActions);

    console.log('🧪 P-256 (passkey) main-account creation via the SERVER-CLIENT path (#118) — Sepolia');
    console.log(`   Owner (JASON) EOA: ${owner.address}`);
    console.log(`   Owner balance: ${formatEther(await publicClient.getBalance({ address: owner.address }))} ETH`);
    console.log(`   Factory (v0.20.0): ${FACTORY}`);

    const steps: StepRecord[] = [];

    // ── 0. Software P-256 guardian key (a passkey whose key lives in software) ──
    const guardianPriv = generatePrivateKey();
    const { x, y } = p256GuardianPublicKey(guardianPriv); // SEC1 (x, y), each bytes32
    console.log(`\n   Software passkey guardian pubkey: x=${x}`);
    console.log(`                                     y=${y}`);

    // ── 1. SERVER-CLIENT AccountManager (the YAA / KMS-custodied path) ──
    const storage = new MemoryStorage();
    const signer = new LocalWalletSigner(privKey); // stands in for the KMS-custodied owner key
    const ethereum = new EthereumProvider({
        rpcUrl: rpc,
        bundlerRpcUrl: rpc, // unused here (no UserOp submission); required by ServerConfig
        chainId: CHAIN_ID,
        entryPoints: { v07: sepoliaV07Config() }, // factory = canonical v0.20.0
        defaultVersion: '0.7',
        storage,
        signer,
        logger: new SilentLogger(),
    });
    const accountManager = new AccountManager(ethereum, storage, signer, new SilentLogger());

    // Large (>2^53) bigint salt — exercises the #118 M2 lossless decimal-string persistence.
    const salt = (BigInt(Math.floor(Date.now() / 1000)) << 32n) + 7n;
    const record = await accountManager.createAccountWithP256Guardians('yaa-e2e-user', {
        p256Guardians: [{ x, y }],
        dailyLimit: DAILY_LIMIT,
        minDailyLimit: DAILY_LIMIT / 10n,
        salt,
        entryPointVersion: EntryPointVersion.V0_7,
    });
    console.log(`\n   SERVER predicted account: ${record.address} (salt ${salt})`);
    console.log(`   record.salt (persisted): ${JSON.stringify(record.salt)} (type ${typeof record.salt})`);
    console.log(`   record.guardianSpecs: ${JSON.stringify(record.guardianSpecs)}`);
    console.log(`   record.approvedAlgIds: ${JSON.stringify(record.approvedAlgIds)}  minDailyLimit: ${record.minDailyLimit}`);

    if (getAddress(record.factoryAddress as Address) !== getAddress(FACTORY)) {
        throw new Error(`server factory ${record.factoryAddress} != canonical v0.20.0 factory ${FACTORY}`);
    }
    if (!record.guardianSpecs || record.guardianSpecs.length !== 1 || !('p256' in record.guardianSpecs[0])) {
        throw new Error('record did not persist the P-256 guardian spec');
    }
    // #118 M2: salt persisted as a lossless decimal string; reconstruct the EXACT bigint for deploy.
    if (record.salt !== salt.toString()) {
        throw new Error(`salt not persisted losslessly: record.salt=${record.salt} != ${salt.toString()}`);
    }
    const deploySalt = BigInt(record.salt);
    if (deploySalt !== salt) throw new Error(`salt round-trip lost precision: ${deploySalt} != ${salt}`);
    // #118 H1: default approvedAlgIds must whitelist ECDSA(0x02)+P256(0x03), never BLS(0x01).
    if (JSON.stringify(record.approvedAlgIds) !== JSON.stringify([0x02, 0x03])) {
        throw new Error(`approvedAlgIds wrong: ${JSON.stringify(record.approvedAlgIds)} (expected [2,3])`);
    }
    console.log(`   🔍 salt round-trip lossless (BigInt(record.salt) == ${deploySalt}) ✅; approvedAlgIds == [0x02, 0x03] ✅`);

    // ── 2. Reconstruct the deploy InitConfig from the persisted record (SERVER helper) ──
    const config = initConfigFromRecord(record);
    if (config.guardianP256X[0].toLowerCase() !== x.toLowerCase() || config.guardianP256Y[0].toLowerCase() !== y.toLowerCase()) {
        throw new Error('reconstructed InitConfig lost the P-256 coords in slot 0');
    }

    // ── 3. Cross-check: object-encoded getAddress == server's tuple-encoded prediction (using deploySalt) ──
    const factorySvc = airAccountFactoryActions(FACTORY)(ownerWallet);
    const coreGetAddr = await factorySvc.getAddress({ owner: owner.address, salt: deploySalt, config });
    if (getAddress(coreGetAddr) !== getAddress(record.address as Address)) {
        throw new Error(`encoding mismatch: core getAddress ${coreGetAddr} != server-predicted ${record.address}`);
    }
    console.log(`   🔍 core getAddress(config) == server prediction (${record.address}) ✅ (byte-identical config)`);

    // ── 4. DEPLOY via the factory createAccount(owner, salt, config) from the owner EOA ──
    const already = await publicClient.getBytecode({ address: record.address as Address });
    let deployTx: Hex | undefined;
    if (already && already !== '0x') {
        console.log('   ℹ️  account already deployed (salt collision) — skipping deploy, verifying on-chain key.');
        steps.push({ step: `Account already deployed (salt=${salt})`, actor: `JASON ${owner.address}`, note: 'pre-existing' });
    } else {
        const fees = await bumpedFees(publicClient);
        deployTx = await factorySvc.createAccount({ owner: owner.address, salt: deploySalt, config, account: owner, ...fees });
        const rcpt = await publicClient.waitForTransactionReceipt({ hash: deployTx, timeout: 180_000 });
        if (rcpt.status !== 'success') throw new Error(`createAccount reverted: ${deployTx}`);
        console.log(`   ✅ DEPLOY (factory createAccount with server-built P-256 InitConfig): ${deployTx}`);
        steps.push({ step: `Deploy v0.20.0 account WITH P-256 guardian (salt=${salt})`, actor: `JASON ${owner.address}`, tx: deployTx });
    }

    const code = await publicClient.getBytecode({ address: record.address as Address });
    if (!code || code === '0x') throw new Error('account has no bytecode at the server-predicted address after deploy');
    console.log(`   ✅ account deployed at the SERVER-predicted address: ${record.address}`);

    // ── 5. Read the installed P-256 guardian key on-chain — THE proof ──
    const extReader = airAccountExtensionActions(record.address as Address)(publicClient);
    const stored = await extReader.getGuardianP256Key({ index: 0 });
    if (stored.x.toLowerCase() !== x.toLowerCase() || stored.y.toLowerCase() !== y.toLowerCase()) {
        throw new Error(`getGuardianP256Key(0) mismatch: got (${stored.x}, ${stored.y}), expected (${x}, ${y})`);
    }
    const guardianCount = await airAccountActions(record.address as Address)(publicClient).guardianCount();
    console.log(`   📖 getGuardianP256Key(0) == server-installed (x, y) ✅`);
    console.log(`   📖 guardianCount() == ${guardianCount}`);
    if (Number(guardianCount) !== 1) throw new Error(`expected guardianCount == 1, got ${guardianCount}`);

    // ── Emit markdown evidence ──
    const now = new Date().toISOString();
    const md: string[] = [];
    md.push(`### Run ${now}`, '');
    md.push(`- **Network:** Ethereum Sepolia (chainId ${CHAIN_ID})`);
    md.push(`- **Factory (v0.20.0):** \`${FACTORY}\``);
    md.push(`- **Account owner (JASON):** \`${owner.address}\``);
    md.push(`- **Server-predicted & deployed account:** \`${record.address}\` (salt \`${salt}\`)`);
    md.push(`- **P-256 guardian pubkey:** x=\`${x}\` y=\`${y}\``);
    md.push(`- **record.guardianSpecs:** \`${JSON.stringify(record.guardianSpecs)}\``);
    md.push(`- **record.approvedAlgIds:** \`${JSON.stringify(record.approvedAlgIds)}\`, minDailyLimit \`${record.minDailyLimit}\``);
    md.push('', '| # | Step | Actor | Tx hash |', '|---|------|-------|---------|');
    steps.forEach((s, i) => {
        const cell = s.tx ? `[\`${s.tx}\`](${ETHERSCAN(s.tx)})` : (s.note ?? '');
        md.push(`| ${i + 1} | ${s.step} | ${s.actor} | ${cell} |`);
    });
    md.push('', '**Decode-verify assertions (all ✅):**', '');
    md.push('- `AccountManager.createAccountWithP256Guardians` persisted the P-256 guardian spec + resolved config');
    md.push('- server `initConfigFromRecord` reconstructs the deploy InitConfig with the P-256 coords in slot 0');
    md.push('- core object-encoded `getAddress(config)` == server tuple-encoded prediction (byte-identical config hash)');
    md.push('- `createAccount` mined `status=0x1`; account deployed at the SERVER-predicted CREATE2 address');
    md.push('- on-chain `getGuardianP256Key(0)` == the (x, y) the server installed (NO acceptance sig needed)');
    md.push(`- on-chain \`guardianCount()\` == ${guardianCount}`);
    md.push('');
    const block = md.join('\n');

    const outPath = path.resolve(process.cwd(), 'tests/regression/onchain-evidence/.p256-account-create.last.md');
    fs.writeFileSync(outPath, block);
    console.log(`\n──────── MARKDOWN EVIDENCE (also written to ${outPath}) ────────\n`);
    console.log(block);
    console.log('\n✅ P-256 main-account creation via the server-client path COMPLETE — passkey guardian installed at deploy, verified on-chain (status=0x1).');
}

main().catch((e) => { console.error('\n❌ P-256 account-create evidence FAILED:', e?.shortMessage || e?.message || e); process.exit(1); });
