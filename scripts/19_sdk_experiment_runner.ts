import { createObjectCsvWriter } from 'csv-writer';
import { createPublicClient, http, Hex } from 'viem';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { getNetworkConfig } from './00_utils.js';
import { runEOAExperiment, runPimlicoExperiment, runAOAExperiment, runSuperExperiment, TestMetrics } from './test_groups.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../env/.env.v3') });

const OUTPUT_FILE = 'sdk_experiment_data.csv';
const RUNS = parseInt(process.env.EXPERIMENT_RUNS || '3');
const NETWORK = process.env.EXPERIMENT_NETWORK || 'sepolia';

async function main() {
    console.log(`🧪 PhD Experiment Runner (Network: ${NETWORK}, Runs: ${RUNS})`);
    const { chain, rpc } = getNetworkConfig(NETWORK);
    
    const config = {
        chain,
        rpc,
        bundlerRpc: process.env.ALCHEMY_BUNDLER_RPC_URL,
        pimlicoRpc: `https://api.pimlico.io/v2/sepolia/rpc?apikey=${process.env.PIMLICO_API_KEY}`,
        privateKey: process.env.PRIVATE_KEY_JASON as Hex,
        accountAddress: process.env.TEST_SIMPLE_ACCOUNT_A as Hex, // Default for Pimlico
        pimToken: "0xFC3e86566895Fb007c6A0d3809eb2827DF94F751" // PIM on Sepolia
    };

    const csvWriter = createObjectCsvWriter({
        path: OUTPUT_FILE,
        header: [
            {id: 'runId', title: 'Run ID'},
            {id: 'group', title: 'Group'},
            {id: 'gasUsed', title: 'Gas Used'},
            {id: 'effectiveGasPrice', title: 'Effective Gas Price (wei)'},
            {id: 'totalCostWei', title: 'Total Cost (wei)'},
            {id: 'latencyMs', title: 'Latency (ms)'},
            {id: 'status', title: 'Status'},
            {id: 'txHash', title: 'Transaction Hash'},
            {id: 'timestamp', title: 'Timestamp'}
        ]
    });

    const allResults: any[] = [];

    for (let i = 0; i < RUNS; i++) {
        console.log(`\n📊 Run ${i + 1}/${RUNS}`);
        
        // Group 1: EOA
        try {
            console.log("   --- Group 1: EOA ---");
            const res = await runEOAExperiment(config);
            allResults.push({ ...res, runId: i + 1, timestamp: new Date().toISOString() });
            console.log(`   ✅ EOA: ${res.gasUsed} gas, ${res.latencyMs}ms`);
        } catch (e: any) { console.error(`   ❌ EOA Failed: ${e.message}`); }

        // Group 2: Pimlico
        try {
            console.log("   --- Group 2: Pimlico ---");
            const res = await runPimlicoExperiment({ ...config, accountAddress: process.env.TEST_SIMPLE_ACCOUNT_A });
            allResults.push({ ...res, runId: i + 1, timestamp: new Date().toISOString() });
            console.log(`   ✅ Pimlico: ${res.gasUsed} gas, ${res.latencyMs}ms`);
        } catch (e: any) { console.error(`   ❌ Pimlico Failed: ${e.message}`); }

        // Group 3: AOA (Paymaster V4)
        try {
            console.log("   --- Group 3: AOA (V4) ---");
            const res = await runAOAExperiment({ ...config, accountAddress: process.env.TEST_SIMPLE_ACCOUNT_B, paymasterV4: process.env.PAYMASTER_V4_ADDRESS });
            allResults.push({ ...res, runId: i + 1, timestamp: new Date().toISOString() });
            console.log(`   ✅ AOA: ${res.gasUsed} gas, ${res.latencyMs}ms`);
        } catch (e: any) { console.error(`   ❌ AOA Failed: ${e.message}`); }

        // Group 4: SuperPaymaster
        try {
            console.log("   --- Group 4: SuperPaymaster ---");
            const res = await runSuperExperiment({ ...config, accountAddress: process.env.TEST_SIMPLE_ACCOUNT_C, superPaymaster: process.env.SUPER_PAYMASTER_ADDRESS });
            allResults.push({ ...res, runId: i + 1, timestamp: new Date().toISOString() });
            console.log(`   ✅ Super: ${res.gasUsed} gas, ${res.latencyMs}ms`);
        } catch (e: any) { console.error(`   ❌ Super Failed: ${e.message}`); }
        
        await csvWriter.writeRecords(allResults.slice(-4)); // Write batch
    }

    console.log(`\n✅ Complete! Data saved to ${OUTPUT_FILE}`);
}

main().catch(console.error);
