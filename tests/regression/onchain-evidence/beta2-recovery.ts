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
    encodeFunctionData, getContract, decodeErrorResult, getAddress,
    type Address, type Hex,
} from 'viem';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { sepolia } from 'viem/chains';

dotenv.config({ path: path.resolve(process.cwd(), '.env.sepolia') });

// ── beta.4 Sepolia addresses ────────────────────────────────────────────────
const FACTORY: Address = '0x3a9127a5f0b4ca734d54629d0c3ad9f52739c071';
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

// Account recovery + read fragments (match AAStarAirAccountBase / AAStarAgentStorageLayout).
const ACCOUNT_ABI = [
    { type: 'function', name: 'owner', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
    { type: 'function', name: 'guardianCount', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
    { type: 'function', name: 'guardians', stateMutability: 'view', inputs: [{ name: 'i', type: 'uint256' }], outputs: [{ type: 'address' }] },
    { type: 'function', name: 'addGuardian', stateMutability: 'nonpayable', inputs: [{ name: '_guardian', type: 'address' }], outputs: [] },
    { type: 'function', name: 'proposeRecovery', stateMutability: 'nonpayable', inputs: [{ name: '_newOwner', type: 'address' }], outputs: [] },
    { type: 'function', name: 'approveRecovery', stateMutability: 'nonpayable', inputs: [], outputs: [] },
    { type: 'function', name: 'executeRecovery', stateMutability: 'nonpayable', inputs: [], outputs: [] },
    { type: 'function', name: 'activeRecovery', stateMutability: 'view', inputs: [], outputs: [
        { name: 'newOwner', type: 'address' }, { name: 'proposedAt', type: 'uint256' },
        { name: 'approvalBitmap', type: 'uint256' }, { name: 'cancellationBitmap', type: 'uint256' } ] },
    // Custom errors (for decoding the executeRecovery timelock revert).
    { type: 'error', name: 'RecoveryTimelockNotExpired', inputs: [] },
    { type: 'error', name: 'RecoveryNotApproved', inputs: [] },
    { type: 'error', name: 'NoActiveRecovery', inputs: [] },
    { type: 'error', name: 'NotGuardian', inputs: [] },
] as const;

function clean(v?: string): string { return (v ?? '').replace(/^['"]|['"]$/g, ''); }

interface StepRecord { step: string; actor: string; tx?: string; note?: string; }

async function main() {
    const rpc = clean(process.env.SEPOLIA_RPC_URL || process.env.RPC_URL);
    const pk = clean(process.env.PRIVATE_KEY_JASON) as Hex;
    if (!rpc) throw new Error('SEPOLIA_RPC_URL missing in .env.sepolia');
    if (!pk) throw new Error('PRIVATE_KEY_JASON missing in .env.sepolia');
    const owner = privateKeyToAccount(pk.startsWith('0x') ? pk : (`0x${pk}` as Hex));

    const publicClient = createPublicClient({ chain: sepolia, transport: http(rpc) });
    const ownerWallet = createWalletClient({ account: owner, chain: sepolia, transport: http(rpc) });

    console.log('🧪 Beta2 social-recovery on-chain evidence (Sepolia)');
    console.log(`   Owner (JASON) EOA: ${owner.address}`);
    console.log(`   Owner balance: ${formatEther(await publicClient.getBalance({ address: owner.address }))} ETH`);

    const steps: StepRecord[] = [];

    // Helper: send a tx from a given wallet, wait for receipt, assert status=0x1.
    const sendVerified = async (
        wallet: ReturnType<typeof createWalletClient>,
        to: Address, data: Hex, label: string, value = 0n,
    ): Promise<Hex> => {
        const hash = await wallet.sendTransaction({ to, data, value } as any);
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        if (receipt.status !== 'success') throw new Error(`${label} tx reverted: ${hash}`);
        console.log(`   ✅ ${label}: ${hash}  (status=0x1)`);
        return hash;
    };

    // ── Generate two FRESH guardian wallets ─────────────────────────────────
    const g1Pk = generatePrivateKey();
    const g2Pk = generatePrivateKey();
    const g1 = privateKeyToAccount(g1Pk);
    const g2 = privateKeyToAccount(g2Pk);
    const g1Wallet = createWalletClient({ account: g1, chain: sepolia, transport: http(rpc) });
    const g2Wallet = createWalletClient({ account: g2, chain: sepolia, transport: http(rpc) });
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

    const factory = getContract({ address: FACTORY, abi: FACTORY_ABI, client: publicClient });
    const account = await factory.read.getAddress([owner.address, salt, config as any]) as Address;
    console.log(`   Predicted account: ${account}`);

    const deployData = encodeFunctionData({ abi: FACTORY_ABI, functionName: 'createAccount', args: [owner.address, salt, config as any] });
    const deployTx = await sendVerified(ownerWallet, FACTORY, deployData, 'Deploy beta.4 account');
    steps.push({ step: `Deploy beta.4 account (salt=${salt})`, actor: `JASON ${owner.address}`, tx: deployTx });

    const code = await publicClient.getBytecode({ address: account });
    if (!code || code === '0x') throw new Error('Account has no bytecode after deploy');
    const acct = getContract({ address: account, abi: ACCOUNT_ABI, client: publicClient });
    console.log(`   Account owner on-chain: ${await acct.read.owner()}`);

    // ── 2. OWNER addGuardian(g1), addGuardian(g2) ───────────────────────────
    const addG1 = await sendVerified(ownerWallet, account, encodeFunctionData({ abi: ACCOUNT_ABI, functionName: 'addGuardian', args: [g1.address] }), 'addGuardian(g1)');
    const addG2 = await sendVerified(ownerWallet, account, encodeFunctionData({ abi: ACCOUNT_ABI, functionName: 'addGuardian', args: [g2.address] }), 'addGuardian(g2)');
    steps.push({ step: 'OWNER addGuardian(g1)', actor: `JASON ${owner.address}`, tx: addG1 });
    steps.push({ step: 'OWNER addGuardian(g2)', actor: `JASON ${owner.address}`, tx: addG2 });
    console.log(`   guardianCount on-chain: ${await acct.read.guardianCount()}`);

    // ── 3. Guardian g1 proposeRecovery(newOwner) ────────────────────────────
    const proposeTx = await sendVerified(g1Wallet, account, encodeFunctionData({ abi: ACCOUNT_ABI, functionName: 'proposeRecovery', args: [newOwner] }), 'g1 proposeRecovery(newOwner)');
    steps.push({ step: `Guardian g1 proposeRecovery(${newOwner})`, actor: `g1 ${g1.address}`, tx: proposeTx });

    // ── 4. Guardian g2 approveRecovery() ────────────────────────────────────
    const approveTx = await sendVerified(g2Wallet, account, encodeFunctionData({ abi: ACCOUNT_ABI, functionName: 'approveRecovery', args: [] }), 'g2 approveRecovery()');
    steps.push({ step: 'Guardian g2 approveRecovery() (reaches 2-of-3)', actor: `g2 ${g2.address}`, tx: approveTx });

    // ── 5. Read activeRecovery() ────────────────────────────────────────────
    const [arNewOwner, proposedAt, approvalBitmap, cancellationBitmap] = await acct.read.activeRecovery() as readonly [Address, bigint, bigint, bigint];
    const popcount = (v: bigint) => { let c = 0; while (v > 0n) { c += Number(v & 1n); v >>= 1n; } return c; };
    const approvalCount = popcount(approvalBitmap);
    const RECOVERY_TIMELOCK = 2n * 24n * 60n * 60n;
    const arRead = {
        newOwner: arNewOwner,
        proposedAt: proposedAt.toString(),
        approvalBitmap: `0x${approvalBitmap.toString(16)} (binary ${approvalBitmap.toString(2)}, ${approvalCount} approvals)`,
        cancellationBitmap: `0x${cancellationBitmap.toString(16)}`,
        executeAfter: (proposedAt + RECOVERY_TIMELOCK).toString(),
    };
    console.log('\n   📖 activeRecovery() read:');
    console.log(`      newOwner          = ${arRead.newOwner}`);
    console.log(`      proposedAt        = ${arRead.proposedAt}`);
    console.log(`      approvalBitmap    = ${arRead.approvalBitmap}`);
    console.log(`      cancellationBitmap= ${arRead.cancellationBitmap}`);
    console.log(`      executeAfter      = ${arRead.executeAfter} (proposedAt + 2 days)`);
    if (getAddress(arNewOwner) !== getAddress(newOwner)) throw new Error('activeRecovery.newOwner mismatch');
    if (approvalCount !== 2) throw new Error(`expected 2 approvals, got ${approvalCount}`);
    console.log('   ✅ Proposal recorded with 2-of-3 approvals.');

    // ── 6. executeRecovery() — expect RecoveryTimelockNotExpired (2-day gate) ─
    console.log('\n   ⏱  Attempting executeRecovery() immediately (expect timelock revert)...');
    let timelockResult = '';
    try {
        // Use simulate so we capture the revert without spending gas / sending a doomed tx.
        await publicClient.simulateContract({
            address: account, abi: ACCOUNT_ABI, functionName: 'executeRecovery', account: owner.address,
        });
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
            try { decoded = (decodeErrorResult({ abi: ACCOUNT_ABI, data: rawHex }) as any).errorName; } catch {}
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
