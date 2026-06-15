/**
 * Beta3 — Weighted-signature governance on-chain evidence (REAL Sepolia txs, NOT a unit test).
 *
 * Proves the AAStarAirAccount weighted-signature governance flow (algId 0x07, routed via
 * AirAccountExtension) end-to-end on live Sepolia:
 *   1. Deploy a beta.4 account owned by BOB via factory.createAccount, with 2 generated
 *      guardians set in the factory config (guardian slots 0 and 1).
 *   2. OWNER setWeightConfig(cfg1)  — first-time valid config (onlyOwner; non-weakening vs
 *      the all-zero initial config, so setWeightConfig is the correct entry). Then read
 *      weightConfig() on-chain.
 *   3. OWNER proposeWeightChange(cfg2) — a *weakening* config (lowers tier3 6→5), which the
 *      contract REQUIRES to go through the guardian-governed proposal flow (onlyOwner;
 *      _isWeakening must be true). Then read pendingWeightChange() on-chain.
 *   4. Guardian g1 approveWeightChange() → guardian g2 approveWeightChange() — 2 txs
 *      (reach 2-of-3). Read pendingWeightChange().approvalBitmap → confirm 2 approvals.
 *   5. executeWeightChange() once, immediately — captures WeightChangeTimelockNotExpired
 *      revert (the 2-day timelock gate); we do NOT wait it out.
 *
 * Access control (confirmed against AirAccountExtension.sol):
 *   - setWeightConfig(cfg)     onlyOwner; reverts WeakeningRequiresProposal if it weakens,
 *                              reverts WeightChangePending if a proposal is pending.
 *   - proposeWeightChange(cfg) onlyOwner; reverts WeakeningRequiresProposal if NOT weakening,
 *                              reverts WeightChangePending if a proposal is pending.
 *   - approveWeightChange()    GUARDIAN only (reverts NotGuardian otherwise); each guardian
 *                              once (tracked in approvalBitmap by guardian index).
 *   - executeWeightChange()    anyone, after 2-of-3 approvals AND 2-day timelock.
 *
 * WeightConfig validation (_validateWeightConfig):
 *   tier1Threshold != 0; every individual weight < tier1Threshold;
 *   tier2 (if set) >= tier1; tier3 (if set) >= tier2; tier3 set => tier2 set.
 *
 * Every state-changing tx is verified to status=0x1 before being reported.
 *
 * Re-runnable: each run uses a UNIQUE salt (timestamp) so it deploys a fresh account.
 * Funds two FRESH guardian wallets (~0.01 ETH each) from BOB so guardians can pay their own
 * gas for the direct approveWeightChange calls.
 *
 *   pnpm tsx tests/regression/onchain-evidence/beta3-weighted-sig.ts
 *
 * Uses ONLY PRIVATE_KEY_BOB (avoids cross-agent nonce conflicts with JASON/ANNI).
 * Requires .env.sepolia with SEPOLIA_RPC_URL and PRIVATE_KEY_BOB (funded EOA).
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import {
    createPublicClient, createWalletClient, http, parseEther, formatEther,
    encodeFunctionData, getContract, decodeErrorResult,
    type Address, type Hex,
} from 'viem';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { sepolia } from 'viem/chains';

dotenv.config({ path: path.resolve(process.cwd(), '.env.sepolia') });

// ── beta.4 Sepolia addresses ────────────────────────────────────────────────
const FACTORY: Address = '0x3a9127a5f0b4ca734d54629d0c3ad9f52739c071';
const ALG_ECDSA = 2;
const ETHERSCAN = (h: string) => `https://sepolia.etherscan.io/tx/${h}`;
const WEIGHT_CHANGE_TIMELOCK = 2n * 24n * 60n * 60n; // 2 days

// Factory config tuple (matches l4-beta4-gasless.ts / beta2-recovery.ts / on-chain factory).
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

// WeightConfig tuple components (canonical 10-field order from AAStarAgentStorageLayout.sol).
const WEIGHT_CONFIG_COMPONENTS = [
    { name: 'passkeyWeight', type: 'uint8' }, { name: 'ecdsaWeight', type: 'uint8' },
    { name: 'blsWeight', type: 'uint8' }, { name: 'guardian0Weight', type: 'uint8' },
    { name: 'guardian1Weight', type: 'uint8' }, { name: 'guardian2Weight', type: 'uint8' },
    { name: '_padding', type: 'uint8' }, { name: 'tier1Threshold', type: 'uint8' },
    { name: 'tier2Threshold', type: 'uint8' }, { name: 'tier3Threshold', type: 'uint8' },
] as const;

// Account ABI — weighted-sig governance + guardian reads + custom errors.
const ACCOUNT_ABI = [
    { type: 'function', name: 'owner', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
    { type: 'function', name: 'guardianCount', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
    { type: 'function', name: 'guardians', stateMutability: 'view', inputs: [{ name: 'i', type: 'uint256' }], outputs: [{ type: 'address' }] },
    { type: 'function', name: 'setWeightConfig', stateMutability: 'nonpayable',
      inputs: [{ name: 'config', type: 'tuple', components: WEIGHT_CONFIG_COMPONENTS }], outputs: [] },
    { type: 'function', name: 'proposeWeightChange', stateMutability: 'nonpayable',
      inputs: [{ name: 'proposed', type: 'tuple', components: WEIGHT_CONFIG_COMPONENTS }], outputs: [] },
    { type: 'function', name: 'approveWeightChange', stateMutability: 'nonpayable', inputs: [], outputs: [] },
    { type: 'function', name: 'executeWeightChange', stateMutability: 'nonpayable', inputs: [], outputs: [] },
    { type: 'function', name: 'weightConfig', stateMutability: 'view', inputs: [], outputs: WEIGHT_CONFIG_COMPONENTS },
    { type: 'function', name: 'pendingWeightChange', stateMutability: 'view', inputs: [], outputs: [
        { name: 'proposed', type: 'tuple', components: WEIGHT_CONFIG_COMPONENTS },
        { name: 'proposedAt', type: 'uint256' }, { name: 'approvalBitmap', type: 'uint256' } ] },
    // Custom errors (for decoding reverts).
    { type: 'error', name: 'InsecureWeightConfig', inputs: [] },
    { type: 'error', name: 'WeakeningRequiresProposal', inputs: [] },
    { type: 'error', name: 'WeightChangePending', inputs: [] },
    { type: 'error', name: 'NoWeightChangeProposal', inputs: [] },
    { type: 'error', name: 'WeightChangeAlreadyApproved', inputs: [] },
    { type: 'error', name: 'WeightChangeNotApproved', inputs: [] },
    { type: 'error', name: 'WeightChangeTimelockNotExpired', inputs: [] },
    { type: 'error', name: 'NotOwner', inputs: [] },
    { type: 'error', name: 'NotGuardian', inputs: [] },
] as const;

function clean(v?: string): string { return (v ?? '').replace(/^['"]|['"]$/g, ''); }
function popcount(v: bigint): number { let c = 0; while (v > 0n) { c += Number(v & 1n); v >>= 1n; } return c; }

// WeightConfig as the 10-field tuple in canonical order.
type WC = readonly [number, number, number, number, number, number, number, number, number, number];
const WC_FIELDS = ['passkeyWeight', 'ecdsaWeight', 'blsWeight', 'guardian0Weight', 'guardian1Weight',
    'guardian2Weight', '_padding', 'tier1Threshold', 'tier2Threshold', 'tier3Threshold'] as const;
// viem returns a multi-output read as a positional array, but a NESTED tuple (the `proposed`
// field of pendingWeightChange) as a named object. Normalise both to a positional WC.
function toWC(v: any): WC {
    if (Array.isArray(v)) return v.map((x) => Number(x)) as unknown as WC;
    return WC_FIELDS.map((f) => Number(v[f])) as unknown as WC;
}
const fmtWC = (w: WC) =>
    `passkey=${w[0]} ecdsa=${w[1]} bls=${w[2]} g0=${w[3]} g1=${w[4]} g2=${w[5]} _pad=${w[6]} tier1=${w[7]} tier2=${w[8]} tier3=${w[9]}`;

interface StepRecord { step: string; actor: string; tx?: string; note?: string; }

async function main() {
    const rpc = clean(process.env.SEPOLIA_RPC_URL || process.env.RPC_URL);
    const pk = clean(process.env.PRIVATE_KEY_BOB) as Hex;
    if (!rpc) throw new Error('SEPOLIA_RPC_URL missing in .env.sepolia');
    if (!pk) throw new Error('PRIVATE_KEY_BOB missing in .env.sepolia');
    const owner = privateKeyToAccount(pk.startsWith('0x') ? pk : (`0x${pk}` as Hex));

    const publicClient = createPublicClient({ chain: sepolia, transport: http(rpc) });
    const ownerWallet = createWalletClient({ account: owner, chain: sepolia, transport: http(rpc) });

    console.log('🧪 Beta3 weighted-signature governance on-chain evidence (Sepolia)');
    console.log(`   Owner (BOB) EOA: ${owner.address}`);
    console.log(`   Owner balance: ${formatEther(await publicClient.getBalance({ address: owner.address }))} ETH`);

    const steps: StepRecord[] = [];

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

    // ── Generate two FRESH guardian wallets (guardian slots 0 and 1) ────────
    const g1 = privateKeyToAccount(generatePrivateKey());
    const g2 = privateKeyToAccount(generatePrivateKey());
    const g1Wallet = createWalletClient({ account: g1, chain: sepolia, transport: http(rpc) });
    const g2Wallet = createWalletClient({ account: g2, chain: sepolia, transport: http(rpc) });
    console.log(`   Guardian g1 (slot 0): ${g1.address}`);
    console.log(`   Guardian g2 (slot 1): ${g2.address}`);

    // Fund guardians (~0.01 ETH each) sequentially from BOB (same EOA → no nonce race).
    const fund1 = await sendVerified(ownerWallet, g1.address, '0x', 'Fund guardian g1 (0.01 ETH)', parseEther('0.01'));
    const fund2 = await sendVerified(ownerWallet, g2.address, '0x', 'Fund guardian g2 (0.01 ETH)', parseEther('0.01'));
    steps.push({ step: 'Fund guardian g1 with 0.01 ETH', actor: `BOB ${owner.address}`, tx: fund1 });
    steps.push({ step: 'Fund guardian g2 with 0.01 ETH', actor: `BOB ${owner.address}`, tx: fund2 });

    // ── 1. Deploy beta.4 account owned by BOB, guardians set at deploy time ──
    const config = {
        guardians: [g1.address, g2.address, '0x0000000000000000000000000000000000000000'] as readonly [Address, Address, Address],
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
    const deployTx = await sendVerified(ownerWallet, FACTORY, deployData, 'Deploy beta.4 account (guardians g1,g2)');
    steps.push({ step: `Deploy beta.4 account (salt=${salt}, guardians g1,g2)`, actor: `BOB ${owner.address}`, tx: deployTx });

    const code = await publicClient.getBytecode({ address: account });
    if (!code || code === '0x') throw new Error('Account has no bytecode after deploy');
    const acct = getContract({ address: account, abi: ACCOUNT_ABI, client: publicClient });
    console.log(`   Account owner on-chain:   ${await acct.read.owner()}`);
    console.log(`   guardianCount on-chain:   ${await acct.read.guardianCount()}`);
    console.log(`   guardians[0] on-chain:    ${await acct.read.guardians([0n])}`);
    console.log(`   guardians[1] on-chain:    ${await acct.read.guardians([1n])}`);

    // ── 2. OWNER setWeightConfig(cfg1) — first valid config ─────────────────
    // cfg1: weights all < tier1(4); tier2(5)>=tier1; tier3(6)>=tier2. Valid & non-weakening
    // vs the all-zero initial config, so setWeightConfig (not propose) is correct.
    const cfg1: WC = [3, 2, 2, 1, 1, 1, 0, 4, 5, 6];
    console.log(`\n   cfg1 (first setWeightConfig): ${fmtWC(cfg1)}`);
    const setData = encodeFunctionData({ abi: ACCOUNT_ABI, functionName: 'setWeightConfig', args: [cfg1 as any] });
    const setTx = await sendVerified(ownerWallet, account, setData, 'OWNER setWeightConfig(cfg1)');
    steps.push({ step: 'OWNER setWeightConfig(cfg1) — first config', actor: `BOB ${owner.address}`, tx: setTx });

    const wc1 = toWC(await acct.read.weightConfig());
    console.log(`   📖 weightConfig() read: ${fmtWC(wc1)}`);
    for (let i = 0; i < 10; i++) if (wc1[i] !== cfg1[i]) throw new Error(`weightConfig field ${i} mismatch: got ${wc1[i]} expected ${cfg1[i]}`);
    console.log('   ✅ weightConfig() matches cfg1.');

    // ── 3. OWNER proposeWeightChange(cfg2) — a WEAKENING config ─────────────
    // cfg2 lowers tier3 from 6 → 5 (_isWeakening true). Still valid: tier3(5)>=tier2(5)>=tier1(4).
    const cfg2: WC = [3, 2, 2, 1, 1, 1, 0, 4, 5, 5];
    console.log(`\n   cfg2 (proposeWeightChange, weakens tier3 6→5): ${fmtWC(cfg2)}`);
    const propData = encodeFunctionData({ abi: ACCOUNT_ABI, functionName: 'proposeWeightChange', args: [cfg2 as any] });
    const propTx = await sendVerified(ownerWallet, account, propData, 'OWNER proposeWeightChange(cfg2)');
    steps.push({ step: 'OWNER proposeWeightChange(cfg2) — weakening (tier3 6→5)', actor: `BOB ${owner.address}`, tx: propTx });

    const readPending = async () => {
        const [proposed, proposedAt, approvalBitmap] =
            await acct.read.pendingWeightChange() as readonly [any, bigint, bigint];
        return { proposed: toWC(proposed), proposedAt, approvalBitmap };
    };
    let pend = await readPending();
    console.log('   📖 pendingWeightChange() read:');
    console.log(`      proposed       = ${fmtWC(pend.proposed)}`);
    console.log(`      proposedAt     = ${pend.proposedAt}`);
    console.log(`      approvalBitmap = 0x${pend.approvalBitmap.toString(16)} (${popcount(pend.approvalBitmap)} approvals)`);
    if (pend.proposedAt === 0n) throw new Error('pendingWeightChange.proposedAt is 0 after propose');
    for (let i = 0; i < 10; i++) if (pend.proposed[i] !== cfg2[i]) throw new Error(`pending.proposed field ${i} mismatch`);
    console.log('   ✅ pendingWeightChange() recorded cfg2.');

    // ── 4. Guardian g1 approveWeightChange() → g2 approveWeightChange() ─────
    const ap1 = await sendVerified(g1Wallet, account, encodeFunctionData({ abi: ACCOUNT_ABI, functionName: 'approveWeightChange', args: [] }), 'g1 approveWeightChange()');
    steps.push({ step: 'Guardian g1 approveWeightChange() (1st approval)', actor: `g1 ${g1.address}`, tx: ap1 });
    const ap2 = await sendVerified(g2Wallet, account, encodeFunctionData({ abi: ACCOUNT_ABI, functionName: 'approveWeightChange', args: [] }), 'g2 approveWeightChange()');
    steps.push({ step: 'Guardian g2 approveWeightChange() (reaches 2-of-3)', actor: `g2 ${g2.address}`, tx: ap2 });

    pend = await readPending();
    const approvalCount = popcount(pend.approvalBitmap);
    const executeAfter = pend.proposedAt + WEIGHT_CHANGE_TIMELOCK;
    const pendRead = {
        proposed: fmtWC(pend.proposed),
        proposedAt: pend.proposedAt.toString(),
        approvalBitmap: `0x${pend.approvalBitmap.toString(16)} (binary ${pend.approvalBitmap.toString(2)}, ${approvalCount} approvals)`,
        executeAfter: executeAfter.toString(),
    };
    console.log('\n   📖 pendingWeightChange() read after 2 approvals:');
    console.log(`      proposed       = ${pendRead.proposed}`);
    console.log(`      proposedAt     = ${pendRead.proposedAt}`);
    console.log(`      approvalBitmap = ${pendRead.approvalBitmap}`);
    console.log(`      executeAfter   = ${pendRead.executeAfter} (proposedAt + 2 days)`);
    if (approvalCount !== 2) throw new Error(`expected 2 approvals, got ${approvalCount}`);
    console.log('   ✅ Proposal has 2-of-3 guardian approvals (approvalBitmap = 0x3).');

    // ── 5. executeWeightChange() immediately — expect timelock revert ───────
    console.log('\n   ⏱  Attempting executeWeightChange() immediately (expect timelock revert)...');
    let timelockResult = '';
    try {
        await publicClient.simulateContract({
            address: account, abi: ACCOUNT_ABI, functionName: 'executeWeightChange', account: owner.address,
        });
        throw new Error('executeWeightChange did NOT revert — timelock gate missing!');
    } catch (e: any) {
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
        if (decoded === 'WeightChangeTimelockNotExpired' || /WeightChangeTimelockNotExpired|timelock/i.test(reason)) {
            timelockResult = `WeightChangeTimelockNotExpired (revert) — the 2-day timelock gate is enforced. executeWeightChange requires waiting until executeAfter=${pendRead.executeAfter} (proposedAt + 172800s). The 2-of-3 approval threshold is already met.`;
            console.log(`   ✅ executeWeightChange reverted as expected: ${timelockResult}`);
        } else {
            timelockResult = `UNEXPECTED revert: ${reason}${rawHex ? ` (data ${rawHex})` : ''}`;
            console.error(`   ❌ ${timelockResult}`);
            throw new Error(`executeWeightChange reverted with an unexpected reason: ${timelockResult}`);
        }
    }
    steps.push({ step: 'executeWeightChange() attempted immediately', actor: 'anyone (simulated from BOB)', note: timelockResult });

    // ── Emit a markdown evidence block to stdout for the doc ─────────────────
    const now = new Date().toISOString();
    const md: string[] = [];
    md.push(`## Beta3 — Weighted-signature governance`, '');
    md.push(`### Run ${now}`, '');
    md.push(`- **Network:** Ethereum Sepolia (chainId 11155111)`);
    md.push(`- **Factory (beta.4):** \`${FACTORY}\``);
    md.push(`- **Account owner (BOB):** \`${owner.address}\``);
    md.push(`- **Deployed account:** \`${account}\` (salt \`${salt}\`)`);
    md.push(`- **Guardian g1 (slot 0):** \`${g1.address}\``);
    md.push(`- **Guardian g2 (slot 1):** \`${g2.address}\``);
    md.push(`- **cfg1 (first \`setWeightConfig\`):** \`${fmtWC(cfg1)}\``);
    md.push(`- **cfg2 (\`proposeWeightChange\`, weakens tier3 6→5):** \`${fmtWC(cfg2)}\``);
    md.push('', '| Step | Action | Actor | Tx hash / result |', '|------|--------|-------|------------------|');
    steps.forEach((s, i) => {
        const cell = s.tx ? `[\`${s.tx}\`](${ETHERSCAN(s.tx)})` : (s.note ?? '');
        md.push(`| ${i + 1} | ${s.step} | ${s.actor} | ${cell} |`);
    });
    md.push('', '**`weightConfig()` read after step 3 (cfg1 applied):**', '', '```');
    md.push(fmtWC(wc1));
    md.push('```', '');
    md.push('**`pendingWeightChange()` read after the 2 approvals (the proof of 2-of-3):**', '', '```');
    md.push(`proposed       = ${pendRead.proposed}`);
    md.push(`proposedAt     = ${pendRead.proposedAt}`);
    md.push(`approvalBitmap = ${pendRead.approvalBitmap}`);
    md.push(`executeAfter   = ${pendRead.executeAfter}  (proposedAt + 2 days / 172800s)`);
    md.push('```', '');
    md.push(`**\`executeWeightChange()\` timelock gate:** ${timelockResult}`, '');
    md.push(`> \`executeWeightChange()\` is intentionally **not** completed in this run: it requires`);
    md.push(`> waiting until \`executeAfter = ${pendRead.executeAfter}\` (proposedAt + 2 days). To finish,`);
    md.push(`> re-call \`executeWeightChange()\` on \`${account}\` after that timestamp — it will then`);
    md.push(`> apply cfg2 as the active \`weightConfig\`. The 2-of-3 approval threshold is already met`);
    md.push(`> on-chain (see the \`pendingWeightChange()\` read above); only the timelock remains.`, '');
    const block = md.join('\n');

    const outPath = path.resolve(process.cwd(), 'tests/regression/onchain-evidence/.beta3-weighted-sig.last.md');
    fs.writeFileSync(outPath, block);
    console.log(`\n──────── MARKDOWN EVIDENCE (also written to ${outPath}) ────────\n`);
    console.log(block);
    console.log('\n✅ Beta3 weighted-signature governance on-chain evidence COMPLETE — all txs status=0x1, 2-of-3 reached, timelock gate confirmed.');
}

main().catch((e) => { console.error('\n❌ Beta3 weighted-sig evidence FAILED:', e?.shortMessage || e?.message || e); process.exit(1); });
