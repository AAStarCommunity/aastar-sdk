/**
 * Paper3 v7.9 — Alchemy Gas Manager Controlled Baseline Experiment
 *
 * Purpose
 * -------
 * Collect a strictly controlled Alchemy Gas Manager sample (n=20) on Optimism
 * Mainnet using the SAME conditions as our PaymasterV4 / SuperPaymaster samples:
 *   - EntryPoint v0.7 (0x0000...A032)
 *   - SimpleAccount (Jason AA)
 *   - Single UserOp, ERC-20 transfer (USDC)
 *   - cast wallet signing (DEPLOYER_ACCOUNT)
 *
 * This closes the cross-system validity gap in v7.8 where the Alchemy
 * baseline was passively scanned from EP v0.6 + mixed account types.
 *
 * Architecture (Plan C — no-retry, no SDK modification)
 * -----------------------------------------------------
 * For each run:
 *   1. Build partial UserOp (dummy gas params)
 *   2. Call alchemy_requestGasAndPaymasterAndData (single call)
 *   3. Pack returned paymasterAndData with returned gas params
 *   4. Sign userOpHash with cast wallet
 *   5. Submit eth_sendUserOperation to Alchemy bundler
 *   6. Wait for receipt, record actualGasUsed
 *   7. On failure: log + continue to next run (overprovision n=22 for n=20 target)
 *
 * Usage
 * -----
 *   cp env.op-mainnet.controlled.example .env.op-mainnet.controlled
 *   # Fill in ALCHEMY_PAYMASTER_POLICY_ID and ALCHEMY_RPC_URL_OP
 *
 *   pnpm tsx scripts/l4-alchemy-controlled-op-mainnet.ts --n 22
 *
 * Output
 * ------
 * CSV in v2 schema (gasless_data_collection.csv compatible) with Label=B1_ALCHEMY_CONTROLLED:
 *   Timestamp,Label,TxHash,GasUsed(L2),L2ExecutionFee(Wei),L1DataFee(Wei),
 *     TotalCost(Wei),TotalCost(ETH),xPNTsConsumed,TokenName
 *
 * Then run reverse-extraction to match actualGasUsed metric:
 *   pnpm tsx packages/analytics/scripts/collect_paymaster_baselines.ts \
 *       --network op-mainnet --rpc-url "$OPT_MAINNET_RPC" \
 *       --tx-hashes-csv <csv_output> \
 *       --paymaster <alchemy_paymaster_v07_address> \
 *       --label B1_ALCHEMY_CONTROLLED \
 *       --out <csv_output>_actualgas.csv
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import {
    type Address, type Hex,
    createPublicClient, http,
    encodeFunctionData, parseAbi,
    concat, pad, toHex, keccak256, encodeAbiParameters,
    formatEther,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { optimism } from 'viem/chains';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';

(BigInt.prototype as any).toJSON = function () { return this.toString(); };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================
// Config Loading
// ============================================================

function loadEnv() {
    // Primary env: .env.op-mainnet.controlled (adds Alchemy-specific vars)
    // Falls back to .env.op-mainnet for shared cast-wallet + RPC config.
    const controlled = path.resolve(__dirname, '../.env.op-mainnet.controlled');
    const base = path.resolve(__dirname, '../.env.op-mainnet');
    if (fs.existsSync(controlled)) {
        dotenv.config({ path: controlled });
    }
    if (fs.existsSync(base)) {
        dotenv.config({ path: base });  // does not override already-set vars
    }
}

function loadConfig() {
    const cfgPath = path.resolve(__dirname, '../config.op-mainnet.json');
    if (!fs.existsSync(cfgPath)) throw new Error(`Missing config.op-mainnet.json`);
    return JSON.parse(fs.readFileSync(cfgPath, 'utf-8')) as {
        entryPoint: Address;
        simpleAccountFactory: Address;
        [k: string]: any;
    };
}

// ============================================================
// Cast Wallet (identical to l4-gasless-op-mainnet.ts)
// ============================================================

const decryptedKeys: Record<string, Hex> = {};

function getPrivateKeyFromCast(accountName: string): Hex {
    if (decryptedKeys[accountName]) return decryptedKeys[accountName];

    console.log(`\n🔐 Decrypting keystore for: ${accountName}`);
    console.log(`   (Waiting for your password in terminal...)`);

    let castCmd = 'cast';
    try {
        execSync('which cast', { stdio: 'ignore' });
    } catch {
        const commonPaths = [
            path.join(process.env.HOME || '', '.foundry/bin/cast'),
            '/usr/local/bin/cast',
            '/opt/homebrew/bin/cast'
        ];
        const found = commonPaths.find(p => fs.existsSync(p));
        if (found) castCmd = found;
    }

    try {
        const result = execSync(`${castCmd} wallet decrypt-keystore ${accountName}`, {
            encoding: 'utf-8',
            stdio: ['inherit', 'pipe', 'inherit'],
            env: { ...process.env, PATH: `${process.env.PATH}:/usr/local/bin:${path.join(process.env.HOME || '', '.foundry/bin')}` }
        }).trim();

        const match = result.match(/(?:0x)?([a-fA-F0-9]{64})/);
        if (match) {
            console.log(`   ✅ Decrypted identity: ${accountName}`);
            const key = `0x${match[1]}` as Hex;
            decryptedKeys[accountName] = key;
            return key;
        }
        throw new Error("No private key found in output");
    } catch (e: any) {
        throw new Error(`Decryption failed for ${accountName}: ${e.message}`);
    }
}

// ============================================================
// CSV Recorder (identical v2 schema to l4-gasless-op-mainnet.ts)
// ============================================================

type CsvRecorder = (params: {
    label: string;
    txHash: string;
    gasUsed: bigint;
    l1FeeWei: bigint;
    l2ExecutionFeeWei: bigint;
    totalCostWei: bigint;
    xpntsConsumed?: string;
    tokenName?: string;
}) => void;

function createCsvRecorder(outPath: string): CsvRecorder {
    const headers = 'Timestamp,Label,TxHash,GasUsed(L2),L2ExecutionFee(Wei),L1DataFee(Wei),TotalCost(Wei),TotalCost(ETH),xPNTsConsumed,TokenName\n';

    if (fs.existsSync(outPath)) {
        const firstLine = fs.readFileSync(outPath, 'utf-8').split('\n')[0] + '\n';
        if (firstLine !== headers) {
            throw new Error(`CSV header mismatch for ${outPath}. Expected v2 header.`);
        }
    } else {
        fs.mkdirSync(path.dirname(outPath), { recursive: true });
        fs.writeFileSync(outPath, headers);
    }

    return (params) => {
        const timestamp = new Date().toISOString();
        const xpntsConsumed = params.xpntsConsumed ?? '0';
        const tokenName = params.tokenName ?? 'N/A';
        const row = `${timestamp},${params.label},${params.txHash},${params.gasUsed.toString()},${params.l2ExecutionFeeWei.toString()},${params.l1FeeWei.toString()},${params.totalCostWei.toString()},${formatEther(params.totalCostWei)},${xpntsConsumed},${tokenName}\n`;
        fs.appendFileSync(outPath, row);
        console.log(`   📝 Data recorded to ${path.relative(process.cwd(), outPath)}`);
    };
}

// ============================================================
// Alchemy Gas Manager API (core of this script)
// ============================================================

interface AlchemyGasAndPaymasterResponse {
    // EP v0.7 decomposed format
    paymaster: Address;
    paymasterData: Hex;
    paymasterVerificationGasLimit: Hex;
    paymasterPostOpGasLimit: Hex;
    // Gas params (Alchemy re-estimates for us)
    callGasLimit: Hex;
    verificationGasLimit: Hex;
    preVerificationGas: Hex;
    maxFeePerGas: Hex;
    maxPriorityFeePerGas: Hex;
}

async function fetchAlchemyPaymasterData(
    alchemyRpcUrl: string,
    policyId: string,
    entryPoint: Address,
    partialUserOp: {
        sender: Address;
        nonce: Hex;
        callData: Hex;
    },
): Promise<AlchemyGasAndPaymasterResponse> {
    // 65-byte dummy signature (valid SimpleAccount ECDSA format for estimation)
    const dummySignature = '0xfffffffffffffffffffffffffffffff0000000000000000000000000000000007aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1c';

    const payload = {
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'alchemy_requestGasAndPaymasterAndData',
        params: [{
            policyId,
            entryPoint,
            userOperation: {
                sender: partialUserOp.sender,
                nonce: partialUserOp.nonce,
                callData: partialUserOp.callData,
                signature: dummySignature,
            },
            dummySignature,
            overrides: {},
        }],
    };

    const resp = await fetch(alchemyRpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    const json: any = await resp.json();
    if (json.error) {
        throw new Error(`alchemy_requestGasAndPaymasterAndData failed: ${JSON.stringify(json.error)}`);
    }
    return json.result as AlchemyGasAndPaymasterResponse;
}

// ============================================================
// UserOp hashing (EP v0.7 PackedUserOperation)
// ============================================================

function getUserOpHashV07(
    op: {
        sender: Address;
        nonce: bigint;
        initCode: Hex;
        callData: Hex;
        accountGasLimits: Hex;
        preVerificationGas: bigint;
        gasFees: Hex;
        paymasterAndData: Hex;
    },
    entryPoint: Address,
    chainId: bigint,
): Hex {
    const packed = encodeAbiParameters(
        [
            { type: 'address' }, { type: 'uint256' }, { type: 'bytes32' }, { type: 'bytes32' },
            { type: 'bytes32' }, { type: 'uint256' }, { type: 'bytes32' }, { type: 'bytes32' },
        ],
        [
            op.sender,
            op.nonce,
            keccak256(op.initCode && op.initCode !== '0x' ? op.initCode : '0x'),
            keccak256(op.callData),
            op.accountGasLimits,
            op.preVerificationGas,
            op.gasFees,
            keccak256(op.paymasterAndData),
        ],
    );
    const enc = encodeAbiParameters(
        [{ type: 'bytes32' }, { type: 'address' }, { type: 'uint256' }],
        [keccak256(packed), entryPoint, chainId],
    );
    return keccak256(enc);
}

// ============================================================
// Submit helper (RPC-level, no retry)
// ============================================================

async function submitUserOpToBundler(
    bundlerUrl: string,
    packedUserOp: {
        sender: Address;
        nonce: bigint;
        callData: Hex;
        callGasLimit: bigint;
        verificationGasLimit: bigint;
        preVerificationGas: bigint;
        maxFeePerGas: bigint;
        maxPriorityFeePerGas: bigint;
        paymaster: Address;
        paymasterVerificationGasLimit: bigint;
        paymasterPostOpGasLimit: bigint;
        paymasterData: Hex;
        signature: Hex;
    },
    entryPoint: Address,
): Promise<Hex> {
    // EP v0.7 decomposed format (per Alchemy bundler convention)
    const msg = {
        sender: packedUserOp.sender,
        nonce: toHex(packedUserOp.nonce),
        callData: packedUserOp.callData,
        callGasLimit: toHex(packedUserOp.callGasLimit),
        verificationGasLimit: toHex(packedUserOp.verificationGasLimit),
        preVerificationGas: toHex(packedUserOp.preVerificationGas),
        maxFeePerGas: toHex(packedUserOp.maxFeePerGas),
        maxPriorityFeePerGas: toHex(packedUserOp.maxPriorityFeePerGas),
        paymaster: packedUserOp.paymaster,
        paymasterVerificationGasLimit: toHex(packedUserOp.paymasterVerificationGasLimit),
        paymasterPostOpGasLimit: toHex(packedUserOp.paymasterPostOpGasLimit),
        paymasterData: packedUserOp.paymasterData,
        signature: packedUserOp.signature,
    };

    const payload = {
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'eth_sendUserOperation',
        params: [msg, entryPoint],
    };

    const resp = await fetch(bundlerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    const json: any = await resp.json();
    if (json.error) {
        throw new Error(`eth_sendUserOperation failed: ${JSON.stringify(json.error)}`);
    }
    return json.result as Hex;
}

async function waitForUserOpReceipt(
    bundlerUrl: string,
    userOpHash: Hex,
    timeoutMs: number = 120000,
): Promise<any> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        const resp = await fetch(bundlerUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: Date.now(),
                method: 'eth_getUserOperationReceipt',
                params: [userOpHash],
            }),
        });
        const json: any = await resp.json();
        if (json.result) return json.result;
        await new Promise(r => setTimeout(r, 2500));
    }
    throw new Error(`Timeout waiting for receipt of ${userOpHash}`);
}

// ============================================================
// Gas Price Guard (identical to l4-gasless-op-mainnet.ts)
// ============================================================

async function waitForAcceptableGasPrice(
    publicClient: any,
    maxBaseFeeWei: bigint = 30_000n,
    ignoreGasPrice: boolean = false,
): Promise<void> {
    const maxGwei = Number(maxBaseFeeWei) / 1e9;
    console.log(`\n⛽ [GAS PRICE GUARD] Max acceptable baseFee: ${maxGwei.toFixed(9)} Gwei (${maxBaseFeeWei} wei)`);
    while (true) {
        try {
            const block = await publicClient.getBlock({ blockTag: 'latest' });
            const baseFee = block.baseFeePerGas ?? 0n;
            const baseFeeGwei = Number(baseFee) / 1e9;
            console.log(`   ⛽ Block #${block.number} baseFee: ${baseFeeGwei.toFixed(9)} Gwei (${baseFee} wei)`);

            if (baseFee <= maxBaseFeeWei) {
                console.log(`   ✅ baseFee acceptable (${baseFeeGwei.toFixed(9)} <= ${maxGwei.toFixed(9)} Gwei). Proceeding.`);
                return;
            }
            if (ignoreGasPrice) {
                console.log(`   🚨 baseFee too high, but --ignore-gas-price is true. Proceeding anyway!`);
                return;
            }
            console.log(`   ⚠️ baseFee too high. Waiting 30s before retry...`);
            await new Promise(r => setTimeout(r, 30_000));
        } catch (e: any) {
            console.log(`   ⚠️ Failed to fetch gas price: ${e.message}. Retrying in 30s...`);
            await new Promise(r => setTimeout(r, 30_000));
        }
    }
}

async function randomDelay(minMs: number = 15_000, maxMs: number = 25_000): Promise<void> {
    const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
    console.log(`   ⏳ Random delay: ${(delay / 1000).toFixed(1)}s between runs...`);
    await new Promise(r => setTimeout(r, delay));
}

// ============================================================
// Main
// ============================================================

async function main() {
    loadEnv();
    const config = loadConfig();

    const args = process.argv.slice(2);
    const getArg = (k: string) => {
        const i = args.indexOf(k);
        return i >= 0 ? args[i + 1] : undefined;
    };
    const toBool = (v: string | undefined) => {
        if (!v) return false;
        const s = v.toLowerCase();
        return s === 'true' || s === '1' || s === 'yes';
    };

    const n = Number(getArg('--n') || '22');
    const defaultOut = path.resolve(
        __dirname,
        `../packages/analytics/data/paper_gas_op_mainnet/${new Date().toISOString().slice(0, 10)}/alchemy_controlled_simple_erc20.csv`,
    );
    const outCsv = getArg('--out') || defaultOut;
    const ignoreGasPrice = toBool(getArg('--ignore-gas-price'));
    const dryRun = toBool(getArg('--dry-run'));

    // Required env
    const ALCHEMY_RPC = process.env.ALCHEMY_RPC_URL_OP || process.env.OPT_MAINNET_RPC;
    const POLICY_ID = process.env.ALCHEMY_PAYMASTER_POLICY_ID;
    if (!ALCHEMY_RPC) throw new Error('Missing ALCHEMY_RPC_URL_OP or OPT_MAINNET_RPC in env');
    if (!POLICY_ID) throw new Error('Missing ALCHEMY_PAYMASTER_POLICY_ID in env (create a sponsorship policy in Alchemy Gas Manager)');

    const JASON_ACCOUNT = process.env.DEPLOYER_ACCOUNT || 'optimism-deployer';
    const JASON_AA = (process.env.JASON_AA || process.env.CONTROLLED_SIMPLE_ACCOUNT) as Address;
    if (!JASON_AA) throw new Error('Missing JASON_AA or CONTROLLED_SIMPLE_ACCOUNT in env (deployed SimpleAccount address)');

    const USDC = (process.env.CONTROLLED_USDC || '0x0b2c639c533813f4aa9d7837caf62653d097ff85') as Address;
    const RECIPIENT = (process.env.CONTROLLED_RECIPIENT || process.env.ANNI_ADDRESS) as Address;
    if (!RECIPIENT) throw new Error('Missing CONTROLLED_RECIPIENT or ANNI_ADDRESS in env (transfer destination)');

    const TRANSFER_AMOUNT = BigInt(process.env.CONTROLLED_TRANSFER_AMOUNT || '1000'); // 0.001 USDC (6 decimals)

    const ENTRYPOINT = config.entryPoint;
    const LABEL = 'B1_ALCHEMY_CONTROLLED';

    console.log('='.repeat(70));
    console.log('   Paper3 v7.9 - Alchemy Gas Manager Controlled Baseline');
    console.log('='.repeat(70));
    console.log(`   Network:          Optimism Mainnet (chainId=10)`);
    console.log(`   EntryPoint:       ${ENTRYPOINT}`);
    console.log(`   SimpleAccount:    ${JASON_AA}`);
    console.log(`   USDC:             ${USDC}`);
    console.log(`   Recipient:        ${RECIPIENT}`);
    console.log(`   Transfer Amount:  ${TRANSFER_AMOUNT} (${Number(TRANSFER_AMOUNT) / 1e6} USDC)`);
    console.log(`   Alchemy RPC:      ${ALCHEMY_RPC.replace(/v2\/.*/, 'v2/REDACTED')}`);
    console.log(`   Policy ID:        ${POLICY_ID.slice(0, 8)}...`);
    console.log(`   Runs Target:      ${n} (allowing some failures; paper target is n=20)`);
    console.log(`   Output CSV:       ${outCsv}`);
    console.log(`   Label:            ${LABEL}`);
    console.log(`   Dry Run:          ${dryRun}`);
    console.log('='.repeat(70));

    if (dryRun) {
        console.log('\n🔬 DRY RUN: validating Alchemy API connectivity (no on-chain submit)...');
    }

    // Load Jason's signer via cast wallet (interactive; one password entry caches for all runs)
    let jasonKey: Hex;
    try {
        jasonKey = getPrivateKeyFromCast(JASON_ACCOUNT);
    } catch (e: any) {
        console.error(`\n❌ CRITICAL: ${e.message}`);
        process.exit(1);
    }
    const jasonAcc = privateKeyToAccount(jasonKey);

    const publicClient = createPublicClient({ chain: optimism, transport: http(ALCHEMY_RPC) });

    // Gas price guard (skip for dry run)
    if (!dryRun) {
        await waitForAcceptableGasPrice(publicClient, 30_000n, ignoreGasPrice);
    }

    const record = createCsvRecorder(outCsv);

    // Log file (parallel to CSV; captures failed attempts)
    const logPath = outCsv.replace(/\.csv$/, '.log');
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    const appendLog = (line: string) => {
        fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${line}\n`);
    };
    appendLog(`=== Start run: n=${n}, label=${LABEL} ===`);

    // Prepare callData (USDC transfer via SimpleAccount.execute)
    const erc20IFace = parseAbi(['function transfer(address to, uint256 amount) returns (bool)']);
    const executeIFace = parseAbi(['function execute(address dest, uint256 value, bytes func)']);
    const innerTransfer = encodeFunctionData({
        abi: erc20IFace,
        functionName: 'transfer',
        args: [RECIPIENT, TRANSFER_AMOUNT],
    });
    const callData = encodeFunctionData({
        abi: executeIFace,
        functionName: 'execute',
        args: [USDC, 0n, innerTransfer],
    });

    let success = 0;
    let failed = 0;
    let firstPaymaster: Address | null = null;

    for (let i = 1; i <= n; i++) {
        console.log(`\n${'-'.repeat(70)}`);
        console.log(`🚀 Run ${i}/${n}`);
        console.log('-'.repeat(70));
        try {
            // Get fresh nonce (read each iteration; SimpleAccount increments per op)
            const nonce = (await (publicClient as any).readContract({
                address: ENTRYPOINT,
                abi: parseAbi(['function getNonce(address, uint192) view returns (uint256)']),
                functionName: 'getNonce',
                args: [JASON_AA, 0n],
            })) as bigint;
            console.log(`   🔢 Nonce: ${nonce}`);

            // Step 1: Ask Alchemy for sponsorship + gas params (single call, no retry)
            console.log(`   ☁️  Requesting Alchemy sponsorship...`);
            const sp = await fetchAlchemyPaymasterData(
                ALCHEMY_RPC,
                POLICY_ID,
                ENTRYPOINT,
                {
                    sender: JASON_AA,
                    nonce: toHex(nonce),
                    callData,
                },
            );
            if (!firstPaymaster) firstPaymaster = sp.paymaster;
            console.log(`   ✅ Sponsored!`);
            console.log(`      Paymaster:   ${sp.paymaster}`);
            console.log(`      PVG:         ${BigInt(sp.preVerificationGas)}`);
            console.log(`      CallGas:     ${BigInt(sp.callGasLimit)}`);
            console.log(`      VerGas:      ${BigInt(sp.verificationGasLimit)}`);
            console.log(`      PMVerGas:    ${BigInt(sp.paymasterVerificationGasLimit)}`);
            console.log(`      PMPostGas:   ${BigInt(sp.paymasterPostOpGasLimit)}`);
            console.log(`      MaxFee:      ${BigInt(sp.maxFeePerGas)}`);
            console.log(`      Priority:    ${BigInt(sp.maxPriorityFeePerGas)}`);

            if (dryRun) {
                console.log(`   🔬 DRY RUN: stopping before submit.`);
                appendLog(`Run ${i}: dry-run sponsorship OK`);
                break;
            }

            // Step 2: Pack userOp for hashing (EP v0.7)
            const accountGasLimits = concat([
                pad(toHex(BigInt(sp.verificationGasLimit)), { size: 16 }),
                pad(toHex(BigInt(sp.callGasLimit)), { size: 16 }),
            ]) as Hex;
            const gasFees = concat([
                pad(toHex(BigInt(sp.maxPriorityFeePerGas)), { size: 16 }),
                pad(toHex(BigInt(sp.maxFeePerGas)), { size: 16 }),
            ]) as Hex;
            const paymasterAndData = concat([
                sp.paymaster,
                pad(toHex(BigInt(sp.paymasterVerificationGasLimit)), { size: 16 }),
                pad(toHex(BigInt(sp.paymasterPostOpGasLimit)), { size: 16 }),
                sp.paymasterData,
            ]) as Hex;

            const userOpForHash = {
                sender: JASON_AA,
                nonce: nonce,
                initCode: '0x' as Hex,
                callData,
                accountGasLimits,
                preVerificationGas: BigInt(sp.preVerificationGas),
                gasFees,
                paymasterAndData,
            };

            const userOpHash = getUserOpHashV07(userOpForHash, ENTRYPOINT, BigInt(10));
            console.log(`   ✍️  userOpHash: ${userOpHash}`);

            // Step 3: Sign with Jason's EOA
            const signature = await jasonAcc.signMessage({ message: { raw: userOpHash } });

            // Step 4: Submit
            console.log(`   📤 Submitting to Alchemy bundler...`);
            const submittedHash = await submitUserOpToBundler(
                ALCHEMY_RPC,
                {
                    sender: JASON_AA,
                    nonce: nonce,
                    callData,
                    callGasLimit: BigInt(sp.callGasLimit),
                    verificationGasLimit: BigInt(sp.verificationGasLimit),
                    preVerificationGas: BigInt(sp.preVerificationGas),
                    maxFeePerGas: BigInt(sp.maxFeePerGas),
                    maxPriorityFeePerGas: BigInt(sp.maxPriorityFeePerGas),
                    paymaster: sp.paymaster,
                    paymasterVerificationGasLimit: BigInt(sp.paymasterVerificationGasLimit),
                    paymasterPostOpGasLimit: BigInt(sp.paymasterPostOpGasLimit),
                    paymasterData: sp.paymasterData,
                    signature,
                },
                ENTRYPOINT,
            );
            console.log(`   🎯 Submitted! userOpHash: ${submittedHash}`);

            // Step 5: Wait for receipt
            console.log(`   ⏳ Waiting for receipt...`);
            const receipt = await waitForUserOpReceipt(ALCHEMY_RPC, submittedHash);

            if (!receipt.success) {
                throw new Error(`UserOp reverted: ${receipt.reason || JSON.stringify(receipt)}`);
            }

            const txHash = receipt.receipt.transactionHash as Hex;
            console.log(`   🎉 Mined! Tx: ${txHash}`);
            console.log(`   🔗 https://optimistic.etherscan.io/tx/${txHash}`);

            // Step 6: Record
            const actualGasUsed = BigInt(receipt.receipt.gasUsed);
            const l2ExecutionFeeWei = BigInt(receipt.actualGasCost);
            const l1FeeWei = receipt.receipt.l1Fee ? BigInt(receipt.receipt.l1Fee) : 0n;
            const totalCostWei = l2ExecutionFeeWei + l1FeeWei;

            record({
                label: LABEL,
                txHash,
                gasUsed: actualGasUsed,
                l1FeeWei,
                l2ExecutionFeeWei,
                totalCostWei,
                xpntsConsumed: '0',
                tokenName: 'USDC',
            });
            appendLog(`Run ${i}: SUCCESS tx=${txHash} gas=${actualGasUsed}`);
            success++;

            // Delay between runs to avoid nonce races / rate limits
            if (i < n) {
                await randomDelay(15_000, 25_000);
            }
        } catch (e: any) {
            console.error(`   ❌ Run ${i} FAILED: ${e.message}`);
            appendLog(`Run ${i}: FAILED ${e.message}`);
            failed++;
            // Cool-off slightly after failure
            if (i < n) await new Promise(r => setTimeout(r, 10_000));
        }
    }

    console.log(`\n${'='.repeat(70)}`);
    console.log(`   Summary`);
    console.log('='.repeat(70));
    console.log(`   Success: ${success}/${n}`);
    console.log(`   Failed:  ${failed}/${n}`);
    console.log(`   CSV:     ${outCsv}`);
    console.log(`   Log:     ${logPath}`);
    console.log(`   First paymaster observed: ${firstPaymaster ?? 'N/A'}`);
    console.log(`   Next step: run reverse-extraction to match actualGasUsed metric:`);
    console.log(`     pnpm tsx packages/analytics/scripts/collect_paymaster_baselines.ts \\`);
    console.log(`       --network op-mainnet \\`);
    console.log(`       --rpc-url "$OPT_MAINNET_RPC" \\`);
    console.log(`       --entrypoint ${ENTRYPOINT} \\`);
    console.log(`       --paymaster ${firstPaymaster ?? '<paymaster-observed-in-log>'} \\`);
    console.log(`       --label ${LABEL} \\`);
    console.log(`       --paymaster-name AlchemyGasManagerV07 \\`);
    console.log(`       --chain optimism \\`);
    console.log(`       --tx-hashes-csv ${outCsv} \\`);
    console.log(`       --out ${outCsv.replace(/\.csv$/, '_actualgas.csv')}`);
    appendLog(`=== End run: success=${success}/${n}, failed=${failed}/${n}, paymaster=${firstPaymaster ?? 'N/A'} ===`);

    if (success === 0) {
        console.error(`\n🔴 No successful runs. Check Alchemy policy, USDC balance, and error log.`);
        process.exit(1);
    }
    if (success < 20) {
        console.warn(`\n⚠️  Only ${success} successful runs (target ≥ 20). Consider re-running with --n for a top-up.`);
    }
}

main().catch(e => {
    console.error('Fatal:', e);
    process.exit(1);
});
