/**
 * Beta1 on-chain evidence: SuperPaymaster-SPONSORED gasless UserOp on live Sepolia.
 *
 * This is the make-or-break proof that a PaymasterV4 pays the gas while the smart
 * account holds 0 ETH and pays nothing. It is NOT a unit test — every step is a real
 * transaction whose hash is printed and whose status is asserted == 0x1.
 *
 * Distinct from the self-funded `l4-beta4-gasless.ts` harness in exactly three ways:
 *   1. the account is NEVER funded with ETH (it pays 0 gas — the whole point),
 *   2. JASON (paymaster owner + gas-token holder) credits the account's token deposit
 *      INSIDE the paymaster via depositFor, and
 *   3. the UserOp carries paymasterAndData (packPaymasterV4DepositData) so the paymaster
 *      sponsors gas and debits the gas token in postOp.
 *
 * Run (re-runnable; unique salt per run):
 *   pnpm tsx tests/regression/onchain-evidence/beta1-sponsored-gasless.ts
 * Requires .env.sepolia: SEPOLIA_RPC_URL, PIMLICO_BUNDLER_URL, PRIVATE_KEY_JASON.
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import {
    createPublicClient, createWalletClient, http, parseEther, formatEther, formatUnits,
    encodeFunctionData, getContract, maxUint256, type Address, type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { UserOperationBuilder } from '../../../packages/sdk/src/index.js';
import { PaymasterClient, PaymasterOperator } from '../../../packages/paymaster/src/V4/index.js';
import { wrapExecuteUserOp } from '../../../packages/airaccount/src/server/utils/execute-user-op.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env.sepolia') });

// ── beta.4 / PaymasterV4 Sepolia addresses (verified on-chain by the task owner) ────
const FACTORY: Address = '0x3a9127a5f0b4ca734d54629d0c3ad9f52739c071';
const ENTRY_POINT: Address = '0x0000000071727De22E5E9d8BAf0edAc6f37da032'; // EntryPoint v0.7
const PAYMASTER_V4: Address = '0xD0c82dc12B7d65b03dF7972f67d13F1D33469a98';
const GAS_TOKEN: Address = '0xDf669834F04988BcEE0E3B6013B6b867Bd38778d';
const ALG_ECDSA = 2;

const DEPOSIT_AMOUNT = parseEther('200'); // 200 gas-token units credited to the account inside the paymaster

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

const ACCOUNT_ABI = [
    { type: 'function', name: 'execute', stateMutability: 'nonpayable',
      inputs: [{ name: 'dest', type: 'address' }, { name: 'value', type: 'uint256' }, { name: 'func', type: 'bytes' }], outputs: [] },
] as const;

const EP_ABI = [
    { type: 'function', name: 'getNonce', stateMutability: 'view',
      inputs: [{ name: 'sender', type: 'address' }, { name: 'key', type: 'uint192' }], outputs: [{ type: 'uint256' }] },
] as const;

const ERC20_ABI = [
    { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'a', type: 'address' }], outputs: [{ type: 'uint256' }] },
    { type: 'function', name: 'allowance', stateMutability: 'view', inputs: [{ name: 'o', type: 'address' }, { name: 's', type: 'address' }], outputs: [{ type: 'uint256' }] },
] as const;

const clean = (s?: string) => (s || '').replace(/^['"]|['"]$/g, '');

async function main() {
    const rpc = clean(process.env.SEPOLIA_RPC_URL || process.env.RPC_URL);
    const bundlerUrl = clean(process.env.PIMLICO_BUNDLER_URL || process.env.PIMLICO_RPC_URL || process.env.BUNDLER_URL);
    const pkRaw = clean(process.env.PRIVATE_KEY_JASON);
    if (!rpc || !bundlerUrl || !pkRaw) throw new Error('Missing SEPOLIA_RPC_URL / PIMLICO_BUNDLER_URL / PRIVATE_KEY_JASON in .env.sepolia');
    const pk = (pkRaw.startsWith('0x') ? pkRaw : `0x${pkRaw}`) as Hex;
    const owner = privateKeyToAccount(pk); // JASON: paymaster owner + gas-token holder

    console.log('🧾 Beta1 — SuperPaymaster-SPONSORED gasless on-chain evidence');
    console.log(`   Owner/Operator (JASON): ${owner.address}`);
    console.log(`   PaymasterV4: ${PAYMASTER_V4}`);
    console.log(`   Gas token:   ${GAS_TOKEN}`);

    const publicClient = createPublicClient({ chain: sepolia, transport: http(rpc) });
    const walletClient = createWalletClient({ account: owner, chain: sepolia, transport: http(rpc) });
    const bundler = createPublicClient({ chain: sepolia, transport: http(bundlerUrl) });

    const assertOk = async (label: string, hash: Hex) => {
        const r = await publicClient.waitForTransactionReceipt({ hash });
        console.log(`   ↳ ${label}: ${hash} (status=${r.status})`);
        if (r.status !== 'success') throw new Error(`${label} reverted (tx ${hash})`);
        return r;
    };

    // ── Step 1: Deploy a beta.4 guard account, owner=JASON, dailyLimit>0, ECDSA approved. NO ETH funding. ──
    const config = {
        guardians: ['0x0000000000000000000000000000000000000000', '0x0000000000000000000000000000000000000000', '0x0000000000000000000000000000000000000000'] as readonly [Address, Address, Address],
        dailyLimit: parseEther('1'),
        approvedAlgIds: [ALG_ECDSA] as readonly number[],
        minDailyLimit: 0n,
        initialTokens: [] as readonly Address[],
        initialTokenConfigs: [] as readonly { tier1Limit: bigint; tier2Limit: bigint; dailyLimit: bigint }[],
    };
    const salt = BigInt(Date.now()); // unique per run
    const factory = getContract({ address: FACTORY, abi: FACTORY_ABI, client: publicClient });
    const sender = await factory.read.getAddress([owner.address, salt, config as any]) as Address;
    console.log(`\n[1] Smart account (sender): ${sender}  (salt=${salt})`);

    const deployedCode = await publicClient.getBytecode({ address: sender });
    if (!deployedCode || deployedCode === '0x') {
        const deployData = encodeFunctionData({ abi: FACTORY_ABI, functionName: 'createAccount', args: [owner.address, salt, config as any] });
        const txHash = await walletClient.sendTransaction({ to: FACTORY, data: deployData });
        await assertOk('account deploy', txHash);
    } else {
        console.log('   Account already deployed.');
    }

    const ethBefore = await publicClient.getBalance({ address: sender });
    console.log(`   Account ETH balance (must be 0): ${formatEther(ethBefore)} ETH`);
    if (ethBefore !== 0n) throw new Error(`Account holds ${formatEther(ethBefore)} ETH — sponsored-gasless proof requires 0 ETH`);

    // ── Step 2: JASON approves + deposits gas token to credit the ACCOUNT's deposit inside the paymaster. ──
    console.log(`\n[2] Crediting account's token deposit inside the paymaster (depositFor)`);
    const allowance = await publicClient.readContract({ address: GAS_TOKEN, abi: ERC20_ABI, functionName: 'allowance', args: [owner.address, PAYMASTER_V4] }) as bigint;
    if (allowance < DEPOSIT_AMOUNT) {
        const approveHash = await PaymasterClient.approveGasToken(walletClient, GAS_TOKEN, PAYMASTER_V4, maxUint256);
        await assertOk('approveGasToken', approveHash as Hex);
    } else {
        console.log(`   Allowance already sufficient (${formatUnits(allowance, 18)}).`);
    }
    const depositBefore = await PaymasterClient.getDepositedBalance(publicClient, PAYMASTER_V4, sender, GAS_TOKEN);
    const depositHash = await PaymasterClient.depositFor(walletClient, PAYMASTER_V4, sender, GAS_TOKEN, DEPOSIT_AMOUNT);
    await assertOk('depositFor', depositHash as Hex);
    const depositAfterCredit = await PaymasterClient.getDepositedBalance(publicClient, PAYMASTER_V4, sender, GAS_TOKEN);
    console.log(`   Account token deposit in paymaster: ${formatUnits(depositBefore, 18)} → ${formatUnits(depositAfterCredit, 18)}`);
    if (depositAfterCredit <= depositBefore) throw new Error('depositFor did not increase the account token deposit');

    // ── Step 3: checkGaslessReadiness — fix any issue as JASON (owner). ──
    console.log(`\n[3] checkGaslessReadiness`);
    let report = await PaymasterOperator.checkGaslessReadiness(publicClient, ENTRY_POINT, PAYMASTER_V4, sender, GAS_TOKEN);
    if (!report.isReady) {
        console.log('   Issues found:', report.issues);
        // Fix token price / token support / oracle as needed.
        const tokenPrice = await PaymasterOperator.getTokenPrice(publicClient, PAYMASTER_V4, GAS_TOKEN);
        if (tokenPrice === 0n) {
            console.log('   Fixing: addGasToken + setTokenPrice (1 USD = 1e18)...');
            try { await assertOk('addGasToken', (await PaymasterOperator.addGasToken(walletClient, PAYMASTER_V4, GAS_TOKEN)) as Hex); } catch (e: any) { console.log('   addGasToken skipped:', e?.shortMessage || e?.message); }
            await assertOk('setTokenPrice', (await PaymasterOperator.setTokenPrice(walletClient, PAYMASTER_V4, GAS_TOKEN, parseEther('1'))) as Hex);
        }
        if (report.issues.some((i) => i.includes('ETH/USD'))) {
            console.log('   Fixing: ensurePriceInitialized...');
            await PaymasterOperator.ensurePriceInitialized(walletClient, publicClient, PAYMASTER_V4);
        }
        if (report.issues.some((i) => i.includes('deposit in EntryPoint'))) {
            console.log('   Fixing: addDeposit 0.1 ETH...');
            await assertOk('addDeposit', (await PaymasterOperator.addDeposit(walletClient, PAYMASTER_V4, parseEther('0.1'))) as Hex);
        }
        report = await PaymasterOperator.checkGaslessReadiness(publicClient, ENTRY_POINT, PAYMASTER_V4, sender, GAS_TOKEN);
    }
    console.log(`   isReady=${report.isReady} issues=${JSON.stringify(report.issues)}`);
    console.log(`   details: stake=${formatEther(report.details.paymasterStake)} deposit=${formatEther(report.details.paymasterDeposit)} tokenPrice=${report.details.tokenPrice} userDeposit=${formatUnits(report.details.userPaymasterDeposit, 18)}`);
    if (!report.isReady) throw new Error(`Paymaster not ready for gasless: ${report.issues.join('; ')}`);

    // ── Step 3b: refresh the ETH/USD oracle cache if STALE. ──
    // PaymasterV4 returns validUntil = cachedPrice.updatedAt + priceStalenessThreshold. checkGaslessReadiness
    // only checks price != 0, NOT freshness — a stale cache yields a validUntil in the past and the bundler
    // rejects with "UserOperation expires too soon". updatePrice() is permissionless and re-pulls Chainlink.
    const STALE_ABI = [{ type: 'function', name: 'priceStalenessThreshold', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] }] as const;
    const cached0 = await PaymasterOperator.getCachedPrice(publicClient, PAYMASTER_V4);
    const staleness = BigInt(await publicClient.readContract({ address: PAYMASTER_V4, abi: STALE_ABI, functionName: 'priceStalenessThreshold' }) as bigint);
    const nowSec = BigInt(Math.floor(Date.now() / 1000));
    const validUntilOnchain = BigInt(cached0.updatedAt) + staleness;
    console.log(`\n[3b] Oracle freshness: cached.updatedAt=${cached0.updatedAt} staleness=${staleness} → validUntil=${validUntilOnchain} (now=${nowSec}, fresh=${validUntilOnchain > nowSec})`);
    if (validUntilOnchain <= nowSec + 60n) {
        console.log('   Cache stale → calling updatePrice() to re-pull Chainlink...');
        await assertOk('updatePrice', (await PaymasterOperator.updatePrice(walletClient, PAYMASTER_V4)) as Hex);
        const refreshed = await PaymasterOperator.getCachedPrice(publicClient, PAYMASTER_V4);
        const newValidUntil = BigInt(refreshed.updatedAt) + staleness;
        console.log(`   Refreshed cached.updatedAt=${refreshed.updatedAt} → validUntil=${newValidUntil} (fresh=${newValidUntil > nowSec})`);
        if (newValidUntil <= nowSec) throw new Error('updatePrice did not produce a future validUntil — Chainlink feed itself may be stale');
    }

    // ── Step 4: Build the sponsored UserOp. ──
    console.log(`\n[4] Building sponsored UserOp`);
    const inner = encodeFunctionData({ abi: ACCOUNT_ABI, functionName: 'execute', args: [owner.address, 0n, '0x'] });
    const callData = wrapExecuteUserOp(inner) as Hex;

    const ep = getContract({ address: ENTRY_POINT, abi: EP_ABI, client: publicClient });
    const nonce = await ep.read.getNonce([sender, 0n]) as bigint;
    const gasPrice = await (bundler as any).request({ method: 'pimlico_getUserOperationGasPrice', params: [] }).catch(() => null);
    const maxFeePerGas = gasPrice ? BigInt(gasPrice.fast.maxFeePerGas) : 3000000000n;
    const maxPriorityFeePerGas = gasPrice ? BigInt(gasPrice.fast.maxPriorityFeePerGas) : 2000000000n;

    const now = Math.floor(Date.now() / 1000);
    const validUntil = BigInt(now + 3600);
    const validAfter = 0n;
    let pmVerificationGas = 150000n;
    let pmPostOpGas = 150000n;
    const buildPmData = () => UserOperationBuilder.packPaymasterV4DepositData(PAYMASTER_V4, pmVerificationGas, pmPostOpGas, GAS_TOKEN, validUntil, validAfter);

    const userOp: any = {
        sender, nonce, initCode: '0x' as Hex, callData,
        accountGasLimits: UserOperationBuilder.packAccountGasLimits(300000n, 200000n),
        preVerificationGas: 100000n,
        gasFees: UserOperationBuilder.packGasFees(maxPriorityFeePerGas, maxFeePerGas),
        paymasterAndData: buildPmData(),
        signature: ('0x' + 'fa'.repeat(65)) as Hex,
    };

    const dumpRpcErr = (label: string, e: any) => {
        console.error(`   ↳ ${label} error:`, e?.shortMessage || e?.message);
        if (e?.details) console.error('     details:', e.details);
        if (e?.cause?.message) console.error('     cause:', e.cause.message);
        if (e?.metaMessages) console.error('     meta:', e.metaMessages.join(' | '));
        const data = e?.cause?.data || e?.data || e?.cause?.cause?.data;
        if (data) console.error('     revert data:', data);
    };

    // Sign over the (pre-estimation) hash so estimation gets a recoverable sig.
    const hash0 = await UserOperationBuilder.getUserOpHash({ userOp, entryPoint: ENTRY_POINT, chainId: sepolia.id, publicClient });
    userOp.signature = await owner.signMessage({ message: { raw: hash0 } });

    console.log('   eth_estimateUserOperationGas (with paymaster set)...');
    let est: any;
    try {
        est = await (bundler as any).request({ method: 'eth_estimateUserOperationGas', params: [UserOperationBuilder.toAlchemyUserOperation(userOp), ENTRY_POINT] });
        console.log(`   ✅ estimation: ${JSON.stringify(est)}`);
    } catch (e: any) {
        dumpRpcErr('eth_estimateUserOperationGas', e);
        throw new Error('gas estimation failed — paymaster did not accept the sponsored UserOp');
    }
    userOp.accountGasLimits = UserOperationBuilder.packAccountGasLimits(BigInt(est.verificationGasLimit), BigInt(est.callGasLimit));
    userOp.preVerificationGas = BigInt(est.preVerificationGas);
    if (est.paymasterVerificationGasLimit) pmVerificationGas = BigInt(est.paymasterVerificationGasLimit);
    if (est.paymasterPostOpGasLimit) pmPostOpGas = BigInt(est.paymasterPostOpGasLimit);
    userOp.paymasterAndData = buildPmData(); // re-pack with estimated paymaster gas limits

    // ── Step 5: final sign + submit. ──
    const userOpHash = await UserOperationBuilder.getUserOpHash({ userOp, entryPoint: ENTRY_POINT, chainId: sepolia.id, publicClient });
    userOp.signature = await owner.signMessage({ message: { raw: userOpHash } });
    console.log(`\n[5] Submitting sponsored UserOp (hash ${userOpHash})`);

    const opHash = await (bundler as any).request({ method: 'eth_sendUserOperation', params: [UserOperationBuilder.toAlchemyUserOperation(userOp), ENTRY_POINT] })
        .catch((e: any) => { dumpRpcErr('eth_sendUserOperation', e); throw e; });
    console.log(`   ✅ UserOp accepted by bundler: ${opHash}`);

    let receipt: any = null;
    for (let i = 0; i < 40; i++) {
        receipt = await (bundler as any).request({ method: 'eth_getUserOperationReceipt', params: [opHash] }).catch(() => null);
        if (receipt) break;
        await new Promise((r) => setTimeout(r, 3000));
    }
    if (!receipt) throw new Error('UserOp receipt timeout');
    const txHash = receipt.receipt?.transactionHash as Hex;
    const ok = receipt.success === true || receipt.success === 'true';
    console.log(`   Receipt: success=${receipt.success} tx=${txHash}`);
    // Cross-check the on-chain tx status == 0x1.
    const onchain = await publicClient.getTransactionReceipt({ hash: txHash });
    console.log(`   On-chain tx status: ${onchain.status}`);
    if (!ok || onchain.status !== 'success') throw new Error(`Sponsored UserOp did not succeed (success=${receipt.success}, status=${onchain.status}, tx ${txHash})`);

    // ── Step 6: prove gaslessness — account ETH stayed 0, token deposit DECREASED. ──
    const ethAfter = await publicClient.getBalance({ address: sender });
    const depositAfter = await PaymasterClient.getDepositedBalance(publicClient, PAYMASTER_V4, sender, GAS_TOKEN);
    console.log(`\n[6] PROOF`);
    console.log(`   Account ETH: before=${formatEther(ethBefore)}  after=${formatEther(ethAfter)} (must both be 0 — paymaster paid the gas)`);
    console.log(`   Account token deposit in paymaster: before-op=${formatUnits(depositAfterCredit, 18)}  after-op=${formatUnits(depositAfter, 18)}  (Δ=${formatUnits(depositAfterCredit - depositAfter, 18)} debited by postOp)`);
    if (ethAfter !== 0n) throw new Error(`Account spent ETH (after=${formatEther(ethAfter)}) — NOT truly gasless`);
    if (depositAfter >= depositAfterCredit) throw new Error('Token deposit did not decrease — paymaster did not debit the gas token');

    console.log('\n✅ Beta1 SPONSORED gasless PROVEN on Sepolia.');
    console.log('   --- EVIDENCE ---');
    console.log(`   account=${sender}`);
    console.log(`   paymaster=${PAYMASTER_V4}`);
    console.log(`   gasToken=${GAS_TOKEN}`);
    console.log(`   depositTx=${depositHash}`);
    console.log(`   userOpHash=${userOpHash}`);
    console.log(`   bundleTx=${txHash}`);
    console.log(`   etherscan=https://sepolia.etherscan.io/tx/${txHash}`);
    console.log(`   accountEthBefore=0 accountEthAfter=${formatEther(ethAfter)}`);
    console.log(`   tokenDepositBefore=${formatUnits(depositAfterCredit, 18)} tokenDepositAfter=${formatUnits(depositAfter, 18)}`);
}

main().catch((e) => { console.error('\n❌ Beta1 sponsored-gasless evidence FAILED:', e?.shortMessage || e?.message || e); process.exit(1); });
