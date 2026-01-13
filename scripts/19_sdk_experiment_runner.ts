import { createObjectCsvWriter } from 'csv-writer';
import { http, Hex } from 'viem';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { 
    createEndUserClient, 
    parseKey, 
    CORE_ADDRESSES 
} from '../packages/sdk/src/index.ts';
import { getNetworkConfig } from './00_utils.js';
import { runEOAExperiment, runPimlicoExperiment, runAOAExperiment, runSuperExperiment } from './test_groups.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Dynamic Env Loading
const NETWORK = process.env.EXPERIMENT_NETWORK || 'anvil';
const envFile = NETWORK === 'sepolia' ? '.env.sepolia' : '.env.anvil';
const envPath = path.resolve(process.cwd(), envFile);

console.log(`Loading Env from: ${envPath}`);
dotenv.config({ path: envPath });

const OUTPUT_FILE = 'sdk_experiment_data.csv';
const RUNS = parseInt(process.env.EXPERIMENT_RUNS || '3');

async function main() {
    console.log(`🧪 PhD Experiment Runner (Network: ${NETWORK}, Runs: ${RUNS})`);
    const { chain, rpc } = getNetworkConfig(NETWORK);
    
    // Key Fallback
    const pk = (process.env.PRIVATE_KEY_JASON || process.env.ADMIN_KEY || process.env.USER_KEY) as Hex;
    if (!pk) throw new Error("Missing Private Key (PRIVATE_KEY_JASON or ADMIN_KEY)");

    const config = {
        chain,
        rpc,
        privateKey: pk,
        accountAddress: (process.env.TEST_SIMPLE_ACCOUNT_B || "0x0000000000000000000000000000000000000000") as Hex,
        superPaymaster: CORE_ADDRESSES.superPaymaster
    };

    // Use SDK to probe account if missing
    if (config.accountAddress === "0x0000000000000000000000000000000000000000") {
        console.log("⚠️ No test account found. Using owner directly as EOA for now or trying to deploy SA...");
        const user = createEndUserClient({ transport: http(rpc), account: pk });
        const { accountAddress } = await user.createSmartAccount({
            owner: user.account.address,
            salt: 0n
        });
        config.accountAddress = accountAddress;
        console.log(`   📍 SA Address: ${accountAddress}`);
    }

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

        // Group 2: Standard AA
        try {
            console.log("   --- Group 2: AA (Standard) ---");
            const res = await runPimlicoExperiment(config);
            allResults.push({ ...res, runId: i + 1, timestamp: new Date().toISOString() });
            console.log(`   ✅ AA: ${res.gasUsed} gas, ${res.latencyMs}ms`);
        } catch (e: any) { console.error(`   ❌ AA Failed: ${e.message}`); }

        // Group 3: AOA (Paymaster V4)
        try {
            console.log("   --- Group 3: AOA (V4) ---");
            const res = await runAOAExperiment(config);
            allResults.push({ ...res, runId: i + 1, timestamp: new Date().toISOString() });
            console.log(`   ✅ AOA: ${res.gasUsed} gas, ${res.latencyMs}ms`);
        } catch (e: any) { console.error(`   ❌ AOA Failed: ${e.message}`); }

        // Group 4: SuperPaymaster
        try {
            console.log("   --- Group 4: SuperPaymaster ---");
            const res = await runSuperExperiment(config);
            allResults.push({ ...res, runId: i + 1, timestamp: new Date().toISOString() });
            console.log(`   ✅ Super: ${res.gasUsed} gas, ${res.latencyMs}ms`);
        } catch (e: any) { console.error(`   ❌ Super Failed: ${e.message}`); }
        
        await csvWriter.writeRecords(allResults.slice(-4)); // Write batch
    }

    console.log(`\n✅ Complete! Data saved to ${OUTPUT_FILE}`);
}

main().catch(console.error);
