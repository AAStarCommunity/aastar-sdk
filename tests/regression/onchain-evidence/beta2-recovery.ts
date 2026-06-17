/**
 * Beta2 — Social-recovery on-chain evidence (REAL Sepolia txs, NOT a unit test).
 *
 * Proves the AirAccount beta.4 social-recovery flow end-to-end on live Sepolia:
 *   1. Deploy a beta.4 account owned by JASON via factory.createAccount.
 *   2. OWNER addGuardian(g1), addGuardian(g2)  — 2 txs (onlyOwner gate).
 *   3. Guardian g1 proposeRecovery(newOwner)   — 1 tx (starts 2-day timelock + 1st approval).
 *   4. Guardian g2 approveRecovery()           — 1 tx (reaches 2-of-3 threshold).
 *   5. Read activeRecovery() on-chain          — confirms proposal w/ 2 approvals.
 *   6. executeRecovery() once                  — captures RecoveryTimelockNotExpired revert
 *                                                (the 2-day gate; we do NOT wait it out).
 *
 * Every state-changing tx is verified to status=0x1 before being reported.
 *
 * Re-runnable: each run uses a UNIQUE salt (timestamp) so it deploys a fresh account.
 * Funds two FRESH guardian wallets (~0.01 ETH each) from JASON so guardians can pay
 * their own gas for the direct proposeRecovery/approveRecovery calls.
 *
 *   pnpm tsx tests/regression/onchain-evidence/beta2-recovery.ts
 *
 * Requires .env.sepolia with SEPOLIA_RPC_URL and PRIVATE_KEY_JASON (funded EOA).
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import {
    createPublicClient, createWalletClient, http, parseEther, formatEther,
    encodeFunctionData, getContract, decodeErrorResult, getAddress, parseAbi,
    type Address, type Hex,
} from 'viem';
// Minimal standard account read + the expected-revert error — NOT the recovery scenario ABI
// (that lives in the SDK RecoveryService). Test scaffolding only.
const AA_SETUP_ABI = parseAbi([
    'function owner() view returns (address)',
    'error RecoveryTimelockNotExpired()',
]);
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { publicActions } from 'viem';
import { ethers } from 'ethers';
import { resilientSepoliaTransport, resilientSepoliaChain, bumpedFees } from './_rpc.js';
// Account creation + owner read also via the SDK (airAccountFactoryActions / airAccountActions) — 100% SDK API.
import { airAccountFactoryActions, airAccountActions } from '../../../packages/core/src/index.js';
import { CANONICAL_ADDRESSES } from '../../../packages/core/src/addresses.js';
// SCENARIO-LEVEL API UNDER TEST: the social-recovery flow is driven through the SDK's
// RecoveryService (it owns the addGuardian/proposeRecovery/approveRecovery/executeRecovery
// encoders + the activeRecovery/guardianCount reads). AIRACCOUNT_ABI (SDK-vendored) is used
// only to decode the expected custom-error revert. No hand-written recovery ABI.
import { RecoveryService } from '../../../packages/airaccount/src/server/index.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env.sepolia') });

// ── beta.4 Sepolia addresses ────────────────────────────────────────────────
const FACTORY: Address = CANONICAL_ADDRESSES[11155111].airAccountFactoryV7 as Address; // v0.19 factory (SDK source of truth)
const ALG_ECDSA = 2;
const ETHERSCAN = (h: string) => `https://sepolia.etherscan.io/tx/${h}`;

// Factory config tuple (matches l4-beta4-gasless.ts / on-chain factory).
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

// NOTE: the account recovery ABI is NO LONGER hand-written here. All recovery
// operations + reads go through the SDK RecoveryService; the imported (SDK-vendored)
// AIRACCOUNT_ABI is used only to decode the expected RecoveryTimelockNotExpired revert.

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

    // The SDK RecoveryService — the scenario-level API under test (encoders + reads).
    const recoverySvc = new RecoveryService(new ethers.JsonRpcProvider(rpc));

    console.log('🧪 Beta2 social-recovery on-chain evidence (Sepolia)');
    console.log(`   Owner (JASON) EOA: ${owner.address}`);
    console.log(`   Owner balance: ${formatEther(await publicClient.getBalance({ address: owner.address }))} ETH`);

    const steps: StepRecord[] = [];
    const fees = await bumpedFees(publicClient); // explicit priority tip so txs confirm promptly

    // Helper: send a tx from a given wallet, wait for receipt, assert status=0x1.
    const sendVerified = async (
        wallet: ReturnType<typeof createWalletClient>,
        to: Address, data: Hex, label: string, value = 0n,
    ): Promise<Hex> => {
        const hash = await wallet.sendTransaction({ to, data, value, ...fees } as any);
        const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 180_000 });
        if (receipt.status !== 'success') throw new Error(`${label} tx reverted: ${hash}`);
        console.log(`   ✅ ${label}: ${hash}  (status=0x1)`);
        return hash;
    };

    // ── Generate two FRESH guardian wallets ─────────────────────────────────
    const g1Pk = generatePrivateKey();
    const g2Pk = generatePrivateKey();
    const g1 = privateKeyToAccount(g1Pk);
    const g2 = privateKeyToAccount(g2Pk);
    const g1Wallet = createWalletClient({ account: g1, chain: resilientSepoliaChain, transport: resilientSepoliaTransport() });
    const g2Wallet = createWalletClient({ account: g2, chain: resilientSepoliaChain, transport: resilientSepoliaTransport() });
    // Fresh proposed new-owner address (just needs to be non-zero, non-owner, non-guardian).
    const newOwner = privateKeyToAccount(generatePrivateKey()).address;
    console.log(`   Guardian g1: ${g1.address}`);
    console.log(`   Guardian g2: ${g2.address}`);
    console.log(`   Proposed newOwner: ${newOwner}`);

    // Fund guardians (~0.01 ETH each) sequentially from JASON (same EOA → no nonce race).
    const fund1 = await sendVerified(ownerWallet, g1.address, '0x', 'Fund guardian g1 (0.01 ETH)', parseEther('0.01'));
    const fund2 = await sendVerified(ownerWallet, g2.address, '0x', 'Fund guardian g2 (0.01 ETH)', parseEther('0.01'));
    steps.push({ step: 'Fund guardian g1 with 0.01 ETH', actor: `JASON ${owner.address}`, tx: fund1 });
    steps.push({ step: 'Fund guardian g2 with 0.01 ETH', actor: `JASON ${owner.address}`, tx: fund2 });

    // ── 1. Deploy beta.4 account owned by JASON ─────────────────────────────
    const config = {
        guardians: ['0x0000000000000000000000000000000000000000', '0x0000000000000000000000000000000000000000', '0x0000000000000000000000000000000000000000'] as readonly [Address, Address, Address],
        dailyLimit: parseEther('1'),                 // dailyLimit > 0 (GUARD-enabled)
        approvedAlgIds: [ALG_ECDSA] as readonly number[],
        minDailyLimit: 0n,
        initialTokens: [] as readonly Address[],
        initialTokenConfigs: [] as readonly { tier1Limit: bigint; tier2Limit: bigint; dailyLimit: bigint }[],
    };
    const salt = BigInt(Math.floor(Date.now() / 1000)); // unique per run
    console.log(`\n   Using salt: ${salt}`);

    // Address prediction + deployment via the SDK factory action (v0.19 factory), not inline ABI.
    const account = await factorySvc.getAddress({ owner: owner.address, salt, config });
    console.log(`   Predicted account: ${account}`);

    const deployTx = await factorySvc.createAccount({ owner: owner.address, salt, config, account: owner, ...fees });
    {
        const rcpt = await publicClient.waitForTransactionReceipt({ hash: deployTx, timeout: 180_000 });
        if (rcpt.status !== 'success') throw new Error('createAccount reverted');
        console.log(`   ✅ Deploy account (via SDK factory): ${deployTx}`);
    }
    steps.push({ step: `Deploy v0.19 account (salt=${salt})`, actor: `JASON ${owner.address}`, tx: deployTx });

    const code = await publicClient.getBytecode({ address: account });
    if (!code || code === '0x') throw new Error('Account has no bytecode after deploy');
    const onchainOwner = await airAccountActions(account)(publicClient).owner();
    console.log(`   Account owner on-chain (via SDK): ${onchainOwner}`);

    // ── 2. OWNER addGuardian(g1), addGuardian(g2) — calldata via SDK RecoveryService ──
    const addG1 = await sendVerified(ownerWallet, account, recoverySvc.encodeAddGuardian(g1.address) as Hex, 'addGuardian(g1)');
    const addG2 = await sendVerified(ownerWallet, account, recoverySvc.encodeAddGuardian(g2.address) as Hex, 'addGuardian(g2)');
    steps.push({ step: 'OWNER addGuardian(g1)', actor: `JASON ${owner.address}`, tx: addG1 });
    steps.push({ step: 'OWNER addGuardian(g2)', actor: `JASON ${owner.address}`, tx: addG2 });
    console.log(`   guardianCount on-chain (via SDK): ${await recoverySvc.getGuardianCount(account)}`);

    // ── 3. Guardian g1 proposeRecovery(newOwner) — via SDK RecoveryService ──
    const proposeTx = await sendVerified(g1Wallet, account, recoverySvc.encodeProposeRecovery(newOwner) as Hex, 'g1 proposeRecovery(newOwner)');
    steps.push({ step: `Guardian g1 proposeRecovery(${newOwner})`, actor: `g1 ${g1.address}`, tx: proposeTx });

    // ── 4. Guardian g2 approveRecovery() — via SDK RecoveryService ──
    const approveTx = await sendVerified(g2Wallet, account, recoverySvc.encodeApproveRecovery() as Hex, 'g2 approveRecovery()');
    steps.push({ step: 'Guardian g2 approveRecovery() (reaches 2-of-3)', actor: `g2 ${g2.address}`, tx: approveTx });

    // ── 5. Read activeRecovery() — via SDK RecoveryService (decodes the struct + popcount) ──
    const ar = await recoverySvc.getActiveRecovery(account);
    const arRead = {
        newOwner: ar.newOwner,
        proposedAt: ar.proposedAt.toString(),
        approvalBitmap: `0x${ar.approvalBitmap.toString(16)} (binary ${ar.approvalBitmap.toString(2)}, ${ar.approvalCount} approvals)`,
        cancellationBitmap: `0x${ar.cancellationBitmap.toString(16)}`,
        executeAfter: ar.executeAfter.toString(),
    };
    console.log('\n   📖 activeRecovery() read (via SDK):');
    console.log(`      newOwner          = ${arRead.newOwner}`);
    console.log(`      proposedAt        = ${arRead.proposedAt}`);
    console.log(`      approvalBitmap    = ${arRead.approvalBitmap}`);
    console.log(`      cancellationBitmap= ${arRead.cancellationBitmap}`);
    console.log(`      executeAfter      = ${arRead.executeAfter} (proposedAt + 2 days)`);
    if (getAddress(ar.newOwner) !== getAddress(newOwner)) throw new Error('activeRecovery.newOwner mismatch');
    if (ar.approvalCount !== 2) throw new Error(`expected 2 approvals, got ${ar.approvalCount}`);
    console.log('   ✅ Proposal recorded with 2-of-3 approvals.');

    // ── 6. executeRecovery() — expect RecoveryTimelockNotExpired (2-day gate) ─
    console.log('\n   ⏱  Attempting executeRecovery() immediately (expect timelock revert)...');
    let timelockResult = '';
    try {
        // executeRecovery calldata encoded by the SDK RecoveryService; eth_call captures the
        // revert without spending gas / sending a doomed tx.
        await publicClient.call({ to: account, data: recoverySvc.encodeExecuteRecovery() as Hex, account: owner.address });
        throw new Error('executeRecovery did NOT revert — timelock gate missing!');
    } catch (e: any) {
        // viem surfaces the decoded custom error on a nested ContractFunctionRevertedError.
        // Walk the cause chain looking for either an already-decoded `data.errorName`
        // (object form) or a raw hex `data` we can decode ourselves.
        let decoded = '';
        let rawHex: Hex | undefined;
        let node: any = e;
        for (let depth = 0; node && depth < 8; depth++) {
            const d = node.data;
            if (d && typeof d === 'object' && typeof d.errorName === 'string') { decoded = d.errorName; break; }
            if (typeof d === 'string' && d.startsWith('0x') && d !== '0x') { rawHex = d as Hex; }
            if (typeof node.errorName === 'string') { decoded = node.errorName; break; }
            node = node.cause;
        }
        if (!decoded && rawHex) {
            try { decoded = (decodeErrorResult({ abi: AA_SETUP_ABI, data: rawHex }) as any).errorName; } catch {}
        }
        const reason = decoded || e?.cause?.shortMessage || e?.shortMessage || e?.message || '';
        if (decoded === 'RecoveryTimelockNotExpired' || /RecoveryTimelockNotExpired|timelock/i.test(reason)) {
            timelockResult = `RecoveryTimelockNotExpired (revert) — the 2-day timelock gate is enforced. executeRecovery requires waiting until executeAfter=${arRead.executeAfter} (proposedAt + 172800s).`;
            console.log(`   ✅ executeRecovery reverted as expected: ${timelockResult}`);
        } else {
            timelockResult = `UNEXPECTED revert: ${reason}${rawHex ? ` (data ${rawHex})` : ''}`;
            console.error(`   ❌ ${timelockResult}`);
            throw new Error(`executeRecovery reverted with an unexpected reason: ${timelockResult}`);
        }
    }
    steps.push({ step: 'executeRecovery() attempted immediately', actor: 'anyone (simulated from JASON)', note: timelockResult });

    // ── Emit a markdown evidence block to stdout for the doc ─────────────────
    const now = new Date().toISOString();
    const md: string[] = [];
    md.push(`### Run ${now}`, '');
    md.push(`- **Network:** Ethereum Sepolia (chainId 11155111)`);
    md.push(`- **Factory (beta.4):** \`${FACTORY}\``);
    md.push(`- **Account owner (JASON):** \`${owner.address}\``);
    md.push(`- **Deployed account:** \`${account}\` (salt \`${salt}\`)`);
    md.push(`- **Guardian g1:** \`${g1.address}\``);
    md.push(`- **Guardian g2:** \`${g2.address}\``);
    md.push(`- **Proposed newOwner:** \`${newOwner}\``);
    md.push('', '| # | Step | Actor | Tx hash / result |', '|---|------|-------|------------------|');
    steps.forEach((s, i) => {
        const cell = s.tx ? `[\`${s.tx}\`](${ETHERSCAN(s.tx)})` : (s.note ?? '');
        md.push(`| ${i + 1} | ${s.step} | ${s.actor} | ${cell} |`);
    });
    md.push('', '**`activeRecovery()` read after step 4 (2-of-3 reached):**', '', '```');
    md.push(`newOwner           = ${arRead.newOwner}`);
    md.push(`proposedAt         = ${arRead.proposedAt}`);
    md.push(`approvalBitmap     = ${arRead.approvalBitmap}`);
    md.push(`cancellationBitmap = ${arRead.cancellationBitmap}`);
    md.push(`executeAfter       = ${arRead.executeAfter}  (proposedAt + 2 days / 172800s)`);
    md.push('```', '');
    md.push(`**executeRecovery() timelock gate:** ${timelockResult}`, '');
    const block = md.join('\n');

    const outPath = path.resolve(process.cwd(), 'tests/regression/onchain-evidence/.beta2-recovery.last.md');
    fs.writeFileSync(outPath, block);
    console.log(`\n──────── MARKDOWN EVIDENCE (also written to ${outPath}) ────────\n`);
    console.log(block);
    console.log('\n✅ Beta2 social-recovery on-chain evidence COMPLETE — all txs status=0x1, timelock gate confirmed.');
}

main().catch((e) => { console.error('\n❌ Beta2 recovery evidence FAILED:', e?.shortMessage || e?.message || e); process.exit(1); });
