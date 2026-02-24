
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { 
    type Address, 
    type Hash, 
    type Hex, 
    parseEther, 
    formatEther, 
    createWalletClient, 
    http, 
    createPublicClient, 
    encodeFunctionData, 
    keccak256, 
    encodeAbiParameters, 
    parseAbiParameters,
    toHex, 
    stringToHex,
    stringToBytes, 
    parseAbi,
    concat,
    pad,
    hexToBytes,
    erc20Abi,
    zeroAddress 
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';


// Use SDK APIs
import { loadNetworkConfig, type NetworkConfig } from '../tests/regression/config.js';
import { 
    createEndUserClient,
    SuperPaymasterClient,
    PaymasterClient
} from '../packages/sdk/src/index.js';

import { 
    SuperPaymasterABI, 
    RegistryABI, 
    EntryPointABI,
    paymasterActions,
    superPaymasterActions
} from '../packages/core/src/index.js';

const require = createRequire(import.meta.url);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Logging Helper ---
type CsvFormat = 'v1' | 'v2';

function createCsvRecorder(outPath: string, format: CsvFormat) {
    const headersV1 = 'Timestamp,Label,TxHash,GasUsed(L2),L1Fee(Wei),TotalCost(ETH),xPNTsConsumed,TokenName\n';
    const headersV2 =
        'Timestamp,Label,TxHash,GasUsed(L2),L2ExecutionFee(Wei),L1DataFee(Wei),TotalCost(Wei),TotalCost(ETH),xPNTsConsumed,TokenName\n';
    const headers = format === 'v2' ? headersV2 : headersV1;

    if (fs.existsSync(outPath)) {
        const firstLine = fs.readFileSync(outPath, 'utf-8').split('\n')[0] + '\n';
        if (firstLine !== headers) {
            throw new Error(`CSV header mismatch for ${outPath}. Expected ${format} header.`);
        }
    } else {
        fs.writeFileSync(outPath, headers);
    }

    return (params: {
        label: string;
        txHash: string;
        gasUsed: bigint;
        l1FeeWei: bigint;
        l2ExecutionFeeWei: bigint;
        totalCostWei: bigint;
        xpntsConsumed?: string;
        tokenName?: string;
    }) => {
        const timestamp = new Date().toISOString();
        const xpntsConsumed = params.xpntsConsumed ?? '0';
        const tokenName = params.tokenName ?? 'N/A';

        if (format === 'v2') {
            const row = `${timestamp},${params.label},${params.txHash},${params.gasUsed.toString()},${params.l2ExecutionFeeWei.toString()},${params.l1FeeWei.toString()},${params.totalCostWei.toString()},${formatEther(params.totalCostWei)},${xpntsConsumed},${tokenName}\n`;
            fs.appendFileSync(outPath, row);
        } else {
            const row = `${timestamp},${params.label},${params.txHash},${params.gasUsed.toString()},${params.l1FeeWei.toString()},${formatEther(params.totalCostWei)},${xpntsConsumed},${tokenName}\n`;
            fs.appendFileSync(outPath, row);
        }

        console.log(`   📝 Data recorded to ${path.relative(process.cwd(), outPath)}`);
    };
}
const { bls12_381 } = require('@noble/curves/bls12-381');
(BigInt.prototype as any).toJSON = function () { return this.toString(); };

// Load State
function loadState(networkName: string): any {
    const STATE_FILE = path.resolve(__dirname, `l4-state.${networkName}.json`);
    if (!fs.existsSync(STATE_FILE)) return { operators: {}, aaAccounts: [] };
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
}

async function waitAndCheckReceipt(
    publicClient: any,
    bundlerClient: any,
    opHash: Hash,
    label: string,
    record: ReturnType<typeof createCsvRecorder>,
    tokenAddress?: Address,
    userAddress?: Address
) {
    console.log(`   ⏳ [${label}] Waiting for confirmation...`);
    
    // Fetch state before for xPNTs consumption calculation
    let debtBefore = 0n;
    let balanceBefore = 0n;
    let tokenName = 'N/A';
    if (tokenAddress && userAddress) {
        try {
            debtBefore = await publicClient.readContract({
                address: tokenAddress,
                abi: parseAbi(['function getDebt(address) view returns (uint256)']),
                functionName: 'getDebt',
                args: [userAddress]
            }).catch(() => 0n);
            balanceBefore = await publicClient.readContract({
                address: tokenAddress,
                abi: erc20Abi,
                functionName: 'balanceOf',
                args: [userAddress]
            }).catch(() => 0n);
            tokenName = await publicClient.readContract({
                address: tokenAddress,
                abi: parseAbi(['function name() view returns (string)']),
                functionName: 'name'
            }).catch(() => 'xPNTs');
        } catch (e) {}
    }

    let receipt: any = null;
    for (let i = 0; i < 45; i++) {
        try {
            // @ts-ignore
            receipt = await bundlerClient.request({ method: 'eth_getUserOperationReceipt', params: [opHash] });
            if (receipt) break;
        } catch (e) {}
        await new Promise(r => setTimeout(r, 2000));
    }
    
    if (receipt && receipt.success) {
        const txHash = receipt.receipt.transactionHash;
        console.log(`   🎉 [${label}] SUCCESS!`);
        console.log(`   🔗 Link: https://optimistic.etherscan.io/tx/${txHash}`);
        
        const actualGasUsed = BigInt(receipt.receipt.gasUsed);
        const l2ExecutionFeeWei = BigInt(receipt.actualGasCost);
        const l1FeeWei = receipt.receipt.l1Fee ? BigInt(receipt.receipt.l1Fee) : 0n;
        const totalCostWei = l2ExecutionFeeWei + l1FeeWei;
        const totalCostStr = formatEther(totalCostWei);
        
        let xpntsConsumed = '0';
        if (tokenAddress && userAddress) {
             const debtAfter = await publicClient.readContract({
                address: tokenAddress,
                abi: parseAbi(['function getDebt(address) view returns (uint256)']),
                functionName: 'getDebt',
                args: [userAddress]
            }).catch(() => debtBefore);
            const balanceAfter = await publicClient.readContract({
                address: tokenAddress,
                abi: erc20Abi,
                functionName: 'balanceOf',
                args: [userAddress]
            }).catch(() => balanceBefore);

            const debtDelta = debtAfter - debtBefore;
            const balanceDelta = balanceAfter - balanceBefore;

            if (debtDelta !== 0n) {
                if (debtDelta > 0n) {
                    xpntsConsumed = formatEther(debtDelta);
                    console.log(`   💰 Debt Increase: ${xpntsConsumed} ${tokenName}`);
                } else {
                    xpntsConsumed = formatEther(-debtDelta);
                    console.log(`   💰 Debt Decrease: ${xpntsConsumed} ${tokenName}`);
                }
            } else if (balanceDelta < 0n) {
                xpntsConsumed = formatEther(-balanceDelta);
                console.log(`   💰 Token Burned: ${xpntsConsumed} ${tokenName}`);
            }
        }

        console.log(`   📊 DATA [${label}]: L2Gas=${actualGasUsed}, TotalCost=${totalCostStr} ETH`);
        
        record({
            label,
            txHash,
            gasUsed: actualGasUsed,
            l1FeeWei,
            l2ExecutionFeeWei,
            totalCostWei,
            xpntsConsumed,
            tokenName
        });
        return true;
    } else {
        console.log(`   ❌ [${label}] FAILED or Timeout.`);
        if (receipt && !receipt.success) {
             console.log(`   📝 Reason: ${receipt.reason || 'Unknown revert'}`);
        }
        return false;
    }
}

// EXCLUSIVE Secure Key loading from cast wallet
const decryptedKeys: Record<string, Hex> = {};
function getPrivateKeyFromCast(accountName: string): Hex {
    if (decryptedKeys[accountName]) return decryptedKeys[accountName];
    
    console.log(`\n🔐 Decrypting keystore for: ${accountName}`);
    console.log(`   (Waiting for your password in terminal...)`);
    
    // Resolve cast path (common on macOS/Foundry)
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

// --- Gas Price Guard ---
// OP Mainnet baseFeePerGas is typically ~0.000026 Gwei (26,000 wei).
// eth_gasPrice returns higher (~0.001 Gwei) because it adds priority fee buffer.
// We use baseFeePerGas from the latest block to match Etherscan Gas Tracker.
// Threshold: < 0.00003 Gwei = 30,000 wei. Above this = too expensive, wait.
async function waitForAcceptableGasPrice(publicClient: any, maxBaseFeeWei: bigint = 30_000n, ignoreGasPrice: boolean = false): Promise<void> {
    const maxGwei = Number(maxBaseFeeWei) / 1e9;
    console.log(`\n⛽ [GAS PRICE GUARD] Max acceptable baseFee: ${maxGwei.toFixed(9)} Gwei (${maxBaseFeeWei} wei) ${ignoreGasPrice ? '(IGNORE FLAG SET)' : ''}`);
    while (true) {
        try {
            const block = await publicClient.getBlock({ blockTag: 'latest' });
            const baseFee = block.baseFeePerGas ?? 0n;
            const baseFeeGwei = Number(baseFee) / 1e9;
            
            // Also show eth_gasPrice for reference
            const suggestedGasPrice = await publicClient.getGasPrice().catch(() => 0n);
            const suggestedGwei = Number(suggestedGasPrice) / 1e9;
            
            const estimatedTxCost = baseFee * 170_000n;
            console.log(`   ⛽ Block #${block.number} baseFee: ${baseFeeGwei.toFixed(9)} Gwei (${baseFee} wei) | eth_gasPrice: ${suggestedGwei.toFixed(6)} Gwei | Est. tx cost: ${formatEther(estimatedTxCost)} ETH`);
            
            if (baseFee <= maxBaseFeeWei) {
                console.log(`   ✅ baseFee acceptable (${baseFeeGwei.toFixed(9)} <= ${maxGwei.toFixed(9)} Gwei). Proceeding.`);
                return;
            }
            if (ignoreGasPrice) {
                console.log(`   🚨 baseFee too high (${baseFeeGwei.toFixed(9)} Gwei), but --ignore-gas-price is true. Proceeding anyway!`);
                return;
            }
            console.log(`   ⚠️ baseFee too high (${baseFeeGwei.toFixed(9)} > ${maxGwei.toFixed(9)} Gwei)! Waiting 30s before retry...`);
            await new Promise(r => setTimeout(r, 30_000));
        } catch (e: any) {
            console.log(`   ⚠️ Failed to fetch gas price: ${e.message}. Retrying in 30s...`);
            await new Promise(r => setTimeout(r, 30_000));
        }
    }
}

// --- Random Delay Helper ---
async function randomDelay(minMs: number = 20_000, maxMs: number = 30_000): Promise<void> {
    const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
    console.log(`   ⏳ Random delay: ${(delay / 1000).toFixed(1)}s...`);
    await new Promise(r => setTimeout(r, delay));
}

export async function runGaslessDataCollection(config: NetworkConfig, networkName: string = 'op-mainnet') {
    const args = process.argv.slice(2);
    const getArg = (key: string) => {
        const i = args.indexOf(key);
        if (i === -1) return undefined;
        return args[i + 1];
    };
    const toInt = (v: string | undefined) => {
        if (v === undefined) return undefined;
        const n = Number(v);
        return Number.isFinite(n) && n >= 0 ? Math.floor(n) : undefined;
    };
    const toBool = (v: string | undefined) => {
        if (v === undefined) return undefined;
        const s = v.toLowerCase();
        if (s === 'true' || s === '1' || s === 'yes') return true;
        if (s === 'false' || s === '0' || s === 'no') return false;
        return undefined;
    };

    const v4Count = toInt(getArg('--v4-count'));
    const superCreditCount = toInt(getArg('--super-credit-count'));
    const t21Count = toInt(getArg('--t21-count'));
    const t5Count = toInt(getArg('--t5-count'));
    const controlledMode = (v4Count !== undefined && v4Count > 0) || (superCreditCount !== undefined && superCreditCount > 0) || (t21Count !== undefined && t21Count > 0) || (t5Count !== undefined && t5Count > 0);
    const skipPriceRefresh = toBool(getArg('--skip-price-refresh')) ?? false;
    const ignoreGasPrice = toBool(getArg('--ignore-gas-price')) ?? false;
    const noDeployAa = toBool(getArg('--no-deploy-aa')) ?? false;
    // Max gas price: 0.00003 Gwei = 30,000 wei. OP Mainnet typically ~0.000026 Gwei.
    const maxGasPriceWei = 30_000n; // 0.00003 Gwei

    const defaultOut = path.resolve(__dirname, '../packages/analytics/data/gasless_data_collection.csv');
    const outCsv = getArg('--out-csv') || defaultOut;
    const csvFormatArg = (getArg('--csv-format') as CsvFormat | undefined) || (outCsv.endsWith('_v2.csv') ? 'v2' : 'v1');
    const csvFormat: CsvFormat = csvFormatArg === 'v2' ? 'v2' : 'v1';
    const record = createCsvRecorder(outCsv, csvFormat);

    const state = loadState(networkName);
    const publicClient = createPublicClient({ chain: config.chain, transport: http(config.rpcUrl) });
    const bundlerClient = createPublicClient({ chain: config.chain, transport: http(config.bundlerUrl) });

    // --- Gas Price Guard: check before starting ---
    await waitForAcceptableGasPrice(publicClient, maxGasPriceWei, ignoreGasPrice);

    // Strict Rule: EXCLUSIVELY from cast wallet
    const jasonAccountName = process.env.DEPLOYER_ACCOUNT || 'optimism-deployer';
    const anniAccountName = process.env.ANNI_ACCOUNT || 'optimism-anni';

    let jasonKey: Hex, anniKey: Hex;
    try {
        jasonKey = getPrivateKeyFromCast(jasonAccountName);
        anniKey = getPrivateKeyFromCast(anniAccountName);
    } catch (e: any) {
        console.error(`   ❌ CRITICAL: ${e.message}`);
        process.exit(1);
    }
    
    let supplierKey: Hex;
    try {
        const supplierAccountName = process.env.SUPPLIER_ACCOUNT || 'optimism-deployer';
        supplierKey = getPrivateKeyFromCast(supplierAccountName);
    } catch {
        console.log(`   ℹ️ No supplier keystore, using ${jasonAccountName} as supplier.`);
        supplierKey = jasonKey;
    }

    const jasonAcc = privateKeyToAccount(jasonKey);
    const anniAcc = privateKeyToAccount(anniKey);
    const supplierAcc = privateKeyToAccount(supplierKey);
    
    // Wallets for EOA interactions
    const jasonWallet = createWalletClient({ account: jasonAcc, chain: config.chain, transport: http(config.rpcUrl) });
    const anniWallet = createWalletClient({ account: anniAcc, chain: config.chain, transport: http(config.rpcUrl) });

    let globalTokenName = 'xPNTs';

    console.log('\n═══════════════════════════════════════════════');
    console.log('🧪 L4 Gasless Data Collection (Paper3)');
    console.log(`   Jason (${jasonAccountName}): ${jasonAcc.address}`);
    console.log(`   Anni (${anniAccountName}):  ${anniAcc.address}`);
    console.log('═══════════════════════════════════════════════\n');

    const SP = config.contracts.superPaymaster;
    const REG = config.contracts.registry;
    const GTOKEN = config.contracts.gToken;
    const ROLE_ENDUSER = keccak256(stringToBytes('ENDUSER'));
    const ENTRYPOINT = config.contracts.entryPoint as Address;

    // ---------------------------------------------------------
    // AA Clients & Discovery
    // ---------------------------------------------------------
    const jasonEndUserClient = createEndUserClient({
        chain: config.chain,
        transport: http(config.rpcUrl),
        account: jasonAcc,
        addresses: config.contracts
    });

    const { accountAddress: jasonAA, isDeployed: jasonDeployed } = await jasonEndUserClient.createSmartAccount({ owner: jasonAcc.address });
    const { accountAddress: anniAA, isDeployed: anniDeployed } = await jasonEndUserClient.createSmartAccount({ owner: anniAcc.address }); // Anni AA lookup

    console.log(`🔍 Smart Accounts:`);
    console.log(`   Jason AA: ${jasonAA} (Deployed: ${jasonDeployed})`);
    console.log(`   Anni AA:  ${anniAA}`);

    if (!jasonDeployed) {
        if (noDeployAa) {
            throw new Error(`Jason AA not deployed (use --no-deploy-aa false to allow auto-deploy).`);
        }
        console.log(`   ⚠️ Deploying Jason AA...`);
        const { hash } = await jasonEndUserClient.deploySmartAccount({ owner: jasonAcc.address });
        console.log(`   🔗 Deploy Tx: https://optimistic.etherscan.io/tx/${hash}`);
        await publicClient.waitForTransactionReceipt({ hash });
    }

    // Discover Jason's PM V4 Proxy
    let jasonPMProxy = config.contracts.paymasterV4Impl;
    try {
        const pm = await publicClient.readContract({
            address: config.contracts.paymasterFactory,
            abi: parseAbi(['function getPaymasterByOperator(address) view returns (address)']),
            functionName: 'getPaymasterByOperator',
            args: [jasonAcc.address]
        }) as Address;
        if (pm && pm !== zeroAddress) jasonPMProxy = pm;
    } catch (e) {}
    console.log(`   ✅ Jason's PM V4 Proxy: ${jasonPMProxy}`);

    // Discover Anni's Token
    let anniToken = config.contracts.aPNTs; 
    try {
        const opData = await publicClient.readContract({
            address: SP,
            abi: SuperPaymasterABI,
            functionName: 'operators',
            args: [anniAcc.address]
        }) as any;
        if (opData && opData[4] && opData[4] !== zeroAddress) {
            anniToken = opData[4];
            console.log(`   ✅ Anni's Community Token: ${anniToken}`);
        }
    } catch (e) {}

    const DIVIDER = '\n' + '═'.repeat(60) + '\n';

    // ---------------------------------------------------------
    // Pre-check: SuperPaymaster Price Freshness
    // ---------------------------------------------------------
    if (!skipPriceRefresh) {
        console.log(DIVIDER + `🔍 [PRE-CHECK] SuperPaymaster Price Freshness`);
        try {
            const cache = await publicClient.readContract({
                address: SP,
                abi: SuperPaymasterABI,
                functionName: 'cachedPrice'
            }) as any;
            const staleness = await publicClient.readContract({
                address: SP,
                abi: SuperPaymasterABI,
                functionName: 'priceStalenessThreshold'
            }) as bigint;

            const updatedAt = BigInt(cache[1]);
            const now = BigInt(Math.floor(Date.now() / 1000));
            
            if (now - updatedAt > staleness - 300n) { // 5 min margin
                console.log(`   ⏳ SuperPaymaster price is stale (${now - updatedAt}s old). Refreshing...`);
                const hash = await jasonWallet.writeContract({
                    address: SP,
                    abi: SuperPaymasterABI,
                    functionName: 'updatePrice',
                    args: []
                });
                await publicClient.waitForTransactionReceipt({ hash });
                console.log(`   ✅ SuperPaymaster price refreshed in tx: ${hash}`);
            } else {
                console.log(`   ✅ SuperPaymaster price is fresh (${now - updatedAt}s old).`);
            }
        } catch (e) {
            console.log(`   ⚠️ Failed to refresh SP price, continuing anyway: ${(e as any).message}`);
        }
    }

    // ---------------------------------------------------------
    // Scenario T1: Gasless Token Transfer (PaymasterV4)
    // ---------------------------------------------------------
    const runT1Once = async () => {
        console.log(DIVIDER + `🔹 [T1] Gasless Token Transfer (PaymasterV4)`);
        console.log(`   Payer:  Jason AA (${jasonAA})`);
        console.log(`   Token:  ${anniToken}`);

        const pmBal = await publicClient.readContract({
            address: jasonPMProxy as Address,
            abi: parseAbi(['function balances(address,address) view returns (uint256)']),
            functionName: 'balances',
            args: [jasonAA, anniToken]
        }).catch(() => 0n);

        if (pmBal < parseEther('0.005')) {
            console.log(`   ℹ️ Jason AA balance in PM V4: ${formatEther(pmBal)}. (Low)`);
        }

        try {
            const callData = PaymasterClient.encodeExecution(
                anniToken,
                0n,
                PaymasterClient.encodeTokenTransfer(anniAA, parseEther('0.001'))
            );

            const t1Hash = await PaymasterClient.submitGaslessUserOperation(
                publicClient,
                jasonWallet,
                jasonAA,
                ENTRYPOINT,
                jasonPMProxy as Address,
                anniToken as Address,
                config.bundlerUrl,
                callData,
                { 
                    autoEstimate: true,
                    verificationGasLimit: 60000n,
                    paymasterVerificationGasLimit: 90000n
                }
            );

            console.log(`   🚀 T1 UserOp: ${t1Hash}`);
            await waitAndCheckReceipt(publicClient, bundlerClient, t1Hash, "T1", record, anniToken as Address, jasonAA);
        } catch (e: any) {
            console.error(`   ❌ T1 Failed: ${e.message}`);
        }
    };

    // ---------------------------------------------------------
    // Scenario T2: SuperPaymaster (Credit vs Normal)
    // ---------------------------------------------------------
    const runT2CreditOnce = async () => {
        console.log(DIVIDER + `🔹 [T2] Gasless Payment via Community Token (Credit Mode)`);
        console.log(`   Description: User has SBT. SP records debt in Community Token.`);
        
        try {
            const callData = PaymasterClient.encodeExecution(
                anniToken as Address,
                0n,
                PaymasterClient.encodeTokenTransfer(supplierAcc.address, parseEther('0.001'))
            );

            const t2Hash = await PaymasterClient.submitGaslessUserOperation(
                publicClient,
                jasonWallet,
                jasonAA,
                ENTRYPOINT,
                SP as Address,
                anniToken as Address,
                config.bundlerUrl,
                callData,
                { 
                    autoEstimate: true, 
                    operator: anniAcc.address,
                    verificationGasLimit: 60000n,
                    paymasterVerificationGasLimit: 90000n
                }
            );

            console.log(`   🚀 T2 (Credit) UserOp: ${t2Hash}`);
            await waitAndCheckReceipt(publicClient, bundlerClient, t2Hash, "T2_SP_Credit", record, anniToken as Address, jasonAA);
        } catch (e: any) {
            console.error(`   ❌ T2 Failed: ${e.message}`);
        }
    };

    // Helper: run T2.1 once (extracted from default flow for controlled mode reuse)
    const runT21Once = async () => {
        console.log(DIVIDER + `🔹 [T2.1] Gasless Payment via Community Token (Normal Mode - Burn)`);
        console.log(`   Description: If supported, SP burns user's Community Token (no debt).`);
        
        try {
            const minUserTokenBalance = parseEther('2');
            const userTokenBalance = await publicClient.readContract({
                address: anniToken as Address,
                abi: erc20Abi,
                functionName: 'balanceOf',
                args: [jasonAA]
            }).catch(() => 0n);

            if (userTokenBalance < minUserTokenBalance) {
                const topUpAmount = parseEther('10');
                const anniBalance = await publicClient.readContract({
                    address: anniToken as Address,
                    abi: erc20Abi,
                    functionName: 'balanceOf',
                    args: [anniAcc.address]
                }).catch(() => 0n);

                if (anniBalance >= topUpAmount) {
                    const transferHash = await anniWallet.writeContract({
                        address: anniToken as Address,
                        abi: erc20Abi,
                        functionName: 'transfer',
                        args: [jasonAA, topUpAmount]
                    });
                    await publicClient.waitForTransactionReceipt({ hash: transferHash });
                } else {
                    console.log(`   ⚠️ Insufficient token balance to top up user: have=${formatEther(anniBalance)}`);
                }
            }

            const callData = PaymasterClient.encodeExecution(
                anniToken as Address,
                0n,
                PaymasterClient.encodeTokenTransfer(supplierAcc.address, parseEther('0.001'))
            );

            const t21Hash = await PaymasterClient.submitGaslessUserOperation(
                publicClient,
                jasonWallet,
                jasonAA,
                ENTRYPOINT,
                SP as Address,
                anniToken as Address,
                config.bundlerUrl,
                callData,
                {
                    autoEstimate: true,
                    operator: anniAcc.address,
                    verificationGasLimit: 60000n,
                    paymasterVerificationGasLimit: 90000n
                }
            );

            console.log(`   🚀 T2.1 (Normal) UserOp: ${t21Hash}`);
            await waitAndCheckReceipt(publicClient, bundlerClient, t21Hash, "T2.1_SP_Normal", record, anniToken as Address, jasonAA);
        } catch (e: any) {
            console.error(`   ❌ T2.1 Failed: ${e.message}`);
        }
    };

    // Helper: run T5 once (extracted from default flow for controlled mode reuse)
    const runT5Once = async () => {
        console.log(DIVIDER + `🔹 [T5] Credit Settlement Check`);
        try {
            const debt = await publicClient.readContract({
                address: anniToken as Address,
                abi: parseAbi(['function getDebt(address) view returns (uint256)']),
                functionName: 'getDebt',
                args: [jasonAA]
            }).catch(() => 0n);
            
            console.log(`   💳 Jason AA Current Debt: ${formatEther(debt)} ${globalTokenName}`);
            
            if (debt > 0n) {
                const myBal = await publicClient.readContract({
                    address: anniToken as Address,
                    abi: erc20Abi,
                    functionName: 'balanceOf',
                    args: [jasonAA]
                });

                if (myBal < debt) {
                    console.log(`   💸 AA balance low (${formatEther(myBal)}). Transferring ${formatEther(debt)} from Anni EOA...`);
                    const fundHash = await anniWallet.writeContract({
                        address: anniToken as Address,
                        abi: erc20Abi,
                        functionName: 'transfer',
                        args: [jasonAA, debt]
                    });
                    await publicClient.waitForTransactionReceipt({ hash: fundHash });
                    console.log(`   ✅ AA Funded in tx: ${fundHash}`);
                }

                console.log(`   🚀 Repaying debt gaslessly...`);
                const repayCall = encodeFunctionData({
                    abi: parseAbi(['function repayDebt(uint256) external']),
                    functionName: 'repayDebt',
                    args: [debt]
                });

                const t5Hash = await PaymasterClient.submitGaslessUserOperation(
                    publicClient,
                    jasonWallet,
                    jasonAA,
                    ENTRYPOINT,
                    SP as Address,
                    anniToken as Address,
                    config.bundlerUrl,
                    PaymasterClient.encodeExecution(anniToken, 0n, repayCall),
                    { 
                        autoEstimate: true, 
                        operator: anniAcc.address,
                        verificationGasLimit: 60000n,
                        paymasterVerificationGasLimit: 90000n
                    }
                );
                console.log(`   🚀 T5 UserOp: ${t5Hash}`);
                await waitAndCheckReceipt(publicClient, bundlerClient, t5Hash, "T5", record, anniToken as Address, jasonAA);
            } else {
                console.log(`   ✅ No debt to repay. Running T2 credit first to create debt...`);
                await runT2CreditOnce();
                await randomDelay();
                // Now retry T5
                const debt2 = await publicClient.readContract({
                    address: anniToken as Address,
                    abi: parseAbi(['function getDebt(address) view returns (uint256)']),
                    functionName: 'getDebt',
                    args: [jasonAA]
                }).catch(() => 0n);
                if (debt2 > 0n) {
                    const myBal2 = await publicClient.readContract({
                        address: anniToken as Address,
                        abi: erc20Abi,
                        functionName: 'balanceOf',
                        args: [jasonAA]
                    });
                    if (myBal2 < debt2) {
                        const fundHash2 = await anniWallet.writeContract({
                            address: anniToken as Address,
                            abi: erc20Abi,
                            functionName: 'transfer',
                            args: [jasonAA, debt2]
                        });
                        await publicClient.waitForTransactionReceipt({ hash: fundHash2 });
                    }
                    const repayCall2 = encodeFunctionData({
                        abi: parseAbi(['function repayDebt(uint256) external']),
                        functionName: 'repayDebt',
                        args: [debt2]
                    });
                    const t5Hash2 = await PaymasterClient.submitGaslessUserOperation(
                        publicClient, jasonWallet, jasonAA, ENTRYPOINT,
                        SP as Address, anniToken as Address, config.bundlerUrl,
                        PaymasterClient.encodeExecution(anniToken, 0n, repayCall2),
                        { autoEstimate: true, operator: anniAcc.address, verificationGasLimit: 60000n, paymasterVerificationGasLimit: 90000n }
                    );
                    console.log(`   🚀 T5 UserOp: ${t5Hash2}`);
                    await waitAndCheckReceipt(publicClient, bundlerClient, t5Hash2, "T5", record, anniToken as Address, jasonAA);
                }
            }
        } catch (e: any) {
            console.error(`   ❌ T5 Failed: ${e.message}`);
        }
    };

    if (controlledMode) {
        const v4N = v4Count ?? 0;
        const superN = superCreditCount ?? 0;
        const t21N = t21Count ?? 0;
        const t5N = t5Count ?? 0;
        const totalOps = v4N + superN + t21N + t5N;
        console.log(DIVIDER + `🎯 Controlled Mode: T1=${v4N}, T2=${superN}, T2.1=${t21N}, T5=${t5N} (total=${totalOps})`);
        for (let i = 0; i < v4N; i++) {
            console.log(`\n--- T1 iteration ${i + 1}/${v4N} ---`);
            await runT1Once();
            if (i < v4N - 1) await randomDelay();
        }
        for (let i = 0; i < superN; i++) {
            console.log(`\n--- T2 iteration ${i + 1}/${superN} ---`);
            await runT2CreditOnce();
            if (i < superN - 1) await randomDelay();
        }
        for (let i = 0; i < t21N; i++) {
            console.log(`\n--- T2.1 iteration ${i + 1}/${t21N} ---`);
            await runT21Once();
            if (i < t21N - 1) await randomDelay();
        }
        for (let i = 0; i < t5N; i++) {
            console.log(`\n--- T5 iteration ${i + 1}/${t5N} ---`);
            await runT5Once();
            if (i < t5N - 1) await randomDelay();
        }
        console.log(DIVIDER + `✅ Controlled Data Collection Completed (${totalOps} operations).`);
        return;
    }

    await runT1Once();
    await runT2CreditOnce();

    console.log(DIVIDER + `🔹 [T2.1] Gasless Payment via Community Token (Normal Mode - Burn)`);
    console.log(`   Description: If supported, SP burns user's Community Token (no debt).`);
    
    try {
        const minUserTokenBalance = parseEther('2');
        const userTokenBalance = await publicClient.readContract({
            address: anniToken as Address,
            abi: erc20Abi,
            functionName: 'balanceOf',
            args: [jasonAA]
        }).catch(() => 0n);

        if (userTokenBalance < minUserTokenBalance) {
            const topUpAmount = parseEther('10');
            const anniBalance = await publicClient.readContract({
                address: anniToken as Address,
                abi: erc20Abi,
                functionName: 'balanceOf',
                args: [anniAcc.address]
            }).catch(() => 0n);

            if (anniBalance >= topUpAmount) {
                const transferHash = await anniWallet.writeContract({
                    address: anniToken as Address,
                    abi: erc20Abi,
                    functionName: 'transfer',
                    args: [jasonAA, topUpAmount]
                });
                await publicClient.waitForTransactionReceipt({ hash: transferHash });
            } else {
                console.log(`   ⚠️ Insufficient token balance to top up user: have=${formatEther(anniBalance)}`);
            }
        }

        const callData = PaymasterClient.encodeExecution(
            anniToken as Address,
            0n,
            PaymasterClient.encodeTokenTransfer(supplierAcc.address, parseEther('0.001'))
        );

        const t21Hash = await PaymasterClient.submitGaslessUserOperation(
            publicClient,
            jasonWallet,
            jasonAA,
            ENTRYPOINT,
            SP as Address,
            anniToken as Address,
            config.bundlerUrl,
            callData,
            {
                autoEstimate: true,
                operator: anniAcc.address,
                verificationGasLimit: 60000n,
                paymasterVerificationGasLimit: 90000n
            }
        );

        console.log(`   🚀 T2.1 (Normal) UserOp: ${t21Hash}`);
        await waitAndCheckReceipt(publicClient, bundlerClient, t21Hash, "T2.1_SP_Normal", record, anniToken as Address, jasonAA);
    } catch (e: any) {
        console.error(`   ❌ T2.1 Failed: ${e.message}`);
    }

    // ---------------------------------------------------------
    // Scenario T3: Gasless SBT Role Registration (via SuperPaymaster)
    // ---------------------------------------------------------
    console.log(DIVIDER + `🔹 [T3] Gasless SBT Mint/Role Registration`);
    
    const isRegistered = await publicClient.readContract({
        address: REG,
        abi: RegistryABI,
        functionName: 'hasRole',
        args: [ROLE_ENDUSER, jasonAA]
    }).catch(() => false);

    if (!isRegistered) {
        try {
            const stakeAmount = parseEther('0.1'); 
            const roleData = encodeAbiParameters(
                [{ name: 'account', type: 'address' }, { name: 'community', type: 'address' }, { name: 'avatarURI', type: 'string' }, { name: 'ensName', type: 'string' }, { name: 'stakeAmount', type: 'uint256' }],
                [jasonAA, anniAA, "ipfs://paper7", "jason.paper7.eth", stakeAmount]
            );
            
            const registerCall = encodeFunctionData({
                abi: RegistryABI,
                functionName: 'registerRole',
                args: [ROLE_ENDUSER, jasonAA, roleData]
            });

            const t3Hash = await PaymasterClient.submitGaslessUserOperation(
                publicClient,
                jasonWallet,
                jasonAA,
                ENTRYPOINT,
                SP as Address, 
                anniToken as Address,
                config.bundlerUrl,
                PaymasterClient.encodeExecution(REG, 0n, registerCall),
                { autoEstimate: true, operator: anniAcc.address }
            );

            console.log(`   🚀 T3 UserOp: ${t3Hash}`);
            await waitAndCheckReceipt(publicClient, bundlerClient, t3Hash, "T3", record);
        } catch (e: any) {
             console.error(`   ❌ T3 Failed: ${e.message}`);
        }
    } else {
        console.log(`   ✅ Jason AA already has SBT/Role.`);
    }

    // ---------------------------------------------------------
    // Scenario T4: BLS Batch Reputation Update (Operator Action)
    // ---------------------------------------------------------
    console.log(DIVIDER + `🔹 [T4] BLS Batch Reputation Update (Operator Action)`);
    try {
        const aggregatorAddr = await publicClient.readContract({
            address: SP as Address,
            abi: SuperPaymasterABI,
            functionName: 'BLS_AGGREGATOR'
        }).catch(() => zeroAddress) as Address;

        if (aggregatorAddr !== zeroAddress) {
            console.log(`   🧠 BLS Aggregator found at ${aggregatorAddr}`);
            console.log(`   ℹ️ Verified: Aggregator is active.`);
        } else if (config.contracts.blsAggregator) {
            console.log(`   ⚠️ BLS Aggregator is 0x0. Attempting to configure...`);
            const hash = await jasonWallet.writeContract({
                address: SP as Address,
                abi: SuperPaymasterABI,
                functionName: 'setBLSAggregator',
                args: [config.contracts.blsAggregator]
            });
            await publicClient.waitForTransactionReceipt({ hash });
            console.log(`   ✅ BLS Aggregator set in tx: ${hash}`);
        } else {
            console.log(`   ⚠️ BLS Aggregator not configured on SP and no config found.`);
        }
    } catch (e) {}

    // ---------------------------------------------------------
    // Scenario T5: Credit Settlement / xPNTs Repayment
    // ---------------------------------------------------------
    console.log(DIVIDER + `🔹 [T5] Credit Settlement Check`);
    try {
        const debt = await publicClient.readContract({
            address: anniToken as Address,
            abi: parseAbi(['function getDebt(address) view returns (uint256)']),
            functionName: 'getDebt',
            args: [jasonAA]
        }).catch(() => 0n);
        
        console.log(`   💳 Jason AA Current Debt: ${formatEther(debt)} ${globalTokenName}`);
        
        if (debt > 0n) {
            // Fix: Fund AA with xPNTs BEFORE repayment estimation
            const myBal = await publicClient.readContract({
                address: anniToken as Address,
                abi: erc20Abi,
                functionName: 'balanceOf',
                args: [jasonAA]
            });

            if (myBal < debt) {
                console.log(`   💸 AA balance low (${formatEther(myBal)}). Transferring ${formatEther(debt)} from Anni EOA...`);
                // Anni is the owner of anniToken
                const fundHash = await anniWallet.writeContract({
                    address: anniToken as Address,
                    abi: erc20Abi,
                    functionName: 'transfer',
                    args: [jasonAA, debt]
                });
                await publicClient.waitForTransactionReceipt({ hash: fundHash });
                console.log(`   ✅ AA Funded in tx: ${fundHash}`);
            }

            console.log(`   🚀 Repaying debt gaslessly...`);
            const repayCall = encodeFunctionData({
                abi: parseAbi(['function repayDebt(uint256) external']),
                functionName: 'repayDebt',
                args: [debt]
            });

            const t5Hash = await PaymasterClient.submitGaslessUserOperation(
                publicClient,
                jasonWallet,
                jasonAA,
                ENTRYPOINT,
                SP as Address,
                anniToken as Address,
                config.bundlerUrl,
                PaymasterClient.encodeExecution(anniToken, 0n, repayCall),
                { 
                    autoEstimate: true, 
                    operator: anniAcc.address,
                    // Alchemy Efficiency Tuning: (PVG=100k) / (PVG + VGL + PMVGL) >= 0.4
                    // VGL(60k) + PMVGL(90k) = 150k. 100/250 = 0.4.
                    verificationGasLimit: 60000n,
                    paymasterVerificationGasLimit: 90000n
                }
            );
            console.log(`   🚀 T5 UserOp: ${t5Hash}`);
            await waitAndCheckReceipt(publicClient, bundlerClient, t5Hash, "T5", record, anniToken as Address, jasonAA);
        } else {
            console.log(`   ✅ No debt to repay.`);
        }
    } catch (e: any) {
        console.error(`   ❌ T5 Failed: ${e.message}`);
    }

    console.log(DIVIDER + `✅ Data Collection Cycle Completed.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const args = process.argv.slice(2);
    let network = 'op-mainnet'; 
    const networkArg = args.find(arg => arg.startsWith('--network'));
    if (networkArg) network = networkArg.includes('=') ? networkArg.split('=')[1] : args[args.indexOf('--network') + 1];
    const config = loadNetworkConfig(network);
    runGaslessDataCollection(config, network).catch(console.error);
}
