import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createWalletClient, createPublicClient, http, parseEther, formatEther, Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import * as fs from 'fs';
import { createObjectCsvWriter } from 'csv-writer';

// @ts-ignore
import { CONTRACTS } from '@aastar/shared-config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../../env/.env.v3');
dotenv.config({ path: envPath });

// --- Config ---
const PUBLIC_RPC = process.env.SEPOLIA_RPC_URL;
const RELAYER_KEY = process.env.PRIVATE_KEY_RELAYER as Hex;
const RECEIVER = (process.env.TEST_RECEIVER_ADDRESS || "0x93E67dbB7B2431dE61a9F6c7E488e7F0E2eD2B3e") as Hex;

// Token to transfer (using aPNTs for consistency with experiment reqs)
const contracts: any = CONTRACTS;
const TOKEN_ADDRESS = (process.env.APNTS_ADDRESS || contracts?.sepolia?.testTokens?.aPNTs || contracts?.sepolia?.testTokens?.xPNTs_A || "") as Hex;

const erc20Abi = [
    { inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], name: "transfer", outputs: [{ name: "", type: "bool" }], stateMutability: "nonpayable", type: "function" }
] as const;

// --- CSV Setup ---
const csvPath = path.resolve(__dirname, '../data/experiment_data.csv');
const csvWriter = createObjectCsvWriter({
    path: csvPath,
    header: [
        { id: 'timestamp', title: 'TIMESTAMP' },
        { id: 'group', title: 'GROUP' },
        { id: 'type', title: 'TYPE' },
        { id: 'txHash', title: 'TX_HASH' },
        { id: 'gasUsed', title: 'GAS_USED' },
        { id: 'gasPrice', title: 'GAS_PRICE' },
        { id: 'l1Fee', title: 'L1_FEE_ETH' },
        { id: 'status', title: 'STATUS' },
    ],
    append: true
});

// Ensure directory exists
if (!fs.existsSync(path.dirname(csvPath))) {
    fs.mkdirSync(path.dirname(csvPath), { recursive: true });
}

async function runEOATest() {
    console.log("🚀 Starting Baseline 1: EOA Transfer Test");

    if (!PUBLIC_RPC || !RELAYER_KEY) throw new Error("Missing Config");
    
    const account = privateKeyToAccount(RELAYER_KEY);
    const client = createPublicClient({ chain: sepolia, transport: http(PUBLIC_RPC) });
    const wallet = createWalletClient({ chain: sepolia, transport: http(PUBLIC_RPC), account });

    if (!TOKEN_ADDRESS) throw new Error("Missing Token Address (aPNTs)");

    console.log(`   👤 Sender: ${account.address}`);
    console.log(`   🎯 Receiver: ${RECEIVER}`);
    console.log(`   💎 Token: ${TOKEN_ADDRESS}`);

    try {
        const amount = parseEther("0.1"); // Small amount
        
        // 1. Prepare
        const { request } = await client.simulateContract({
            account,
            address: TOKEN_ADDRESS,
            abi: erc20Abi,
            functionName: 'transfer',
            args: [RECEIVER, amount]
        });

        const start = Date.now();
        
        // 2. Submit
        const hash = await wallet.writeContract(request);
        console.log(`   ⏳ Transaction Sent: ${hash}`);

        // 3. Wait
        const receipt = await client.waitForTransactionReceipt({ hash });
        const duration = Date.now() - start;

        // 4. Analyze
        const gasUsed = receipt.gasUsed;
        const gasPrice = receipt.effectiveGasPrice;
        const cost = BigInt(gasUsed) * BigInt(gasPrice);

        console.log(`   ✅ Success!`);
        console.log(`      Gas Used: ${gasUsed.toString()}`);
        console.log(`      Cost: ${formatEther(cost)} ETH`);

        // 5. Save Data
        await csvWriter.writeRecords([{
            timestamp: new Date().toISOString(),
            group: 'Baseline 1',
            type: 'EOA Transfer',
            txHash: hash,
            gasUsed: gasUsed.toString(),
            gasPrice: gasPrice.toString(),
            l1Fee: formatEther(cost), // For EOA, Fee = Gas Cost
            status: 'Success'
        }]);
        console.log("   📝 Data recorded to CSV.");
        
        return hash;

    } catch (error: any) {
        console.error(`   ❌ Test Failed: ${error.message}`);
        await csvWriter.writeRecords([{
            timestamp: new Date().toISOString(),
            group: 'Baseline 1',
            type: 'EOA Transfer',
            txHash: 'FAILED',
            gasUsed: '0',
            gasPrice: '0',
            l1Fee: '0',
            status: `Error: ${error.message}`
        }]);
    }
}

// Execute if running directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    runEOATest().catch(console.error);
}

export { runEOATest };
