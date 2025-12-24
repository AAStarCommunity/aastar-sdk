import { createObjectCsvWriter } from 'csv-writer';
import { createPublicClient, createWalletClient, http, parseEther, formatEther, toHex, encodeFunctionData, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config({ path: path.resolve(process.cwd(), '.env.v3') });

const OUTPUT_FILE = 'sdk_experiment_data.csv';
const RUNS = parseInt(process.env.EXPERIMENT_RUNS || '5');
const NETWORK = process.env.EXPERIMENT_NETWORK || 'local';

const RPC_URL = NETWORK === 'local' ? 'http://localhost:8545' : process.env.SEPOLIA_RPC_URL;
const EOA_KEY = process.env.PRIVATE_KEY_JASON;
const RECEIVER = "0x93E67dbB7B2431dE61a9F6c7E488e7F0E2eD2B3e";

const chain = NETWORK === 'local' ? 
    { id: 31337, name: 'Anvil', network: 'anvil', nativeCurrency: { decimals: 18, name: 'Ether', symbol: 'ETH' }, rpcUrls: { default: { http: [RPC_URL] }, public: { http: [RPC_URL] } } } :
    { id: 11155111, name: 'Sepolia', network: 'sepolia', nativeCurrency: { decimals: 18, name: 'Ether', symbol: 'ETH' }, rpcUrls: { default: { http: [RPC_URL] }, public: { http: [RPC_URL] } } };

async function main() {
    console.log(`🧪 PhD Experiment Runner (Network: ${NETWORK}, Runs: ${RUNS})`);
    
    const publicClient = createPublicClient({ chain, transport: http(RPC_URL) });
    const eoaAccount = privateKeyToAccount(EOA_KEY);
    const walletClient = createWalletClient({ account: eoaAccount, chain, transport: http(RPC_URL) });
    
    const results = [];
    const csvWriter = createObjectCsvWriter({
        path: OUTPUT_FILE,
        header: [
            {id: 'runId', title: 'Run ID'},
            {id: 'group', title: 'Group'},
            {id: 'gasUsed', title: 'Gas Used'},
            {id: 'effectiveGasPrice', title: 'Effective Gas Price (wei)'},
            {id: 'totalCostWei', title: 'Total Cost (wei)'},
            {id: 'totalCostUSD', title: 'Total Cost (USD)'},
            {id: 'latencyMs', title: 'Latency (ms)'},
            {id: 'status', title: 'Status'},
            {id: 'txHash', title: 'Transaction Hash'},
            {id: 'timestamp', title: 'Timestamp'}
        ]
    });

    for (let i = 0; i < RUNS; i++) {
        console.log(`\n📊 Run ${i + 1}/${RUNS}`);
        
        try {
            const start = Date.now();
            const hash = await walletClient.sendTransaction({
                to: RECEIVER,
                value: parseEther("0.0001")
            });
            
            const receipt = await publicClient.waitForTransactionReceipt({ hash });
            const latency = Date.now() - start;
            
            const result = {
                runId: i + 1,
                group: 'EOA',
                gasUsed: receipt.gasUsed.toString(),
                effectiveGasPrice: receipt.effectiveGasPrice.toString(),
                totalCostWei: (receipt.gasUsed * receipt.effectiveGasPrice).toString(),
                totalCostUSD: ((Number(receipt.gasUsed * receipt.effectiveGasPrice) / 1e18) * 3500).toFixed(6),
                latencyMs: latency,
                status: receipt.status === 'success' ? 'Success' : 'Failed',
                txHash: receipt.transactionHash,
                timestamp: new Date().toISOString()
            };
            
            results.push(result);
            console.log(`   ✅ EOA: ${result.status} (${latency}ms, ${receipt.gasUsed} gas)`);
        } catch (e) {
            console.error(`   ❌ Failed: ${e.message}`);
        }
        
        if (i < RUNS - 1) await new Promise(r => setTimeout(r, 2000));
    }

    await csvWriter.writeRecords(results);
    console.log(`\n✅ Complete! Data saved to ${OUTPUT_FILE}`);
    console.log(`   Total Runs: ${results.length}`);
    
    if (results.length > 0) {
        const avgGas = results.reduce((sum, r) => sum + BigInt(r.gasUsed), 0n) / BigInt(results.length);
        const avgLatency = Math.round(results.reduce((sum, r) => sum + r.latencyMs, 0) / results.length);
        console.log(`\n📈 Summary:`);
        console.log(`   Avg Gas: ${avgGas}`);
        console.log(`   Avg Latency: ${avgLatency}ms`);
    }
}

main().catch(console.error);
