
import { createObjectCsvWriter } from 'csv-writer';
import { createAAStarPublicClient } from '../packages/core/src/index';
import { getPaymasterMiddleware } from '../packages/superpaymaster/src/index';
import { sepolia } from 'viem/chains';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.v3') });

const OUTPUT_FILE = 'sdk_experiment_data.csv';
const RUNS = 5; // Reduced for quick verification

async function runExperiment() {
    console.log("🧪 Starting SDK Experiment Run...");
    
    // Setup
    const paymasterAddress = process.env.SUPERPAYMASTER_ADDR as `0x${string}`;
    // Using Admin Key to derive operator address for test
    const operatorAddress = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"; 

    // Initialize SDK
    const client = createAAStarPublicClient({ chain: sepolia, rpcUrl: process.env.RPC_URL });
    const middleware = getPaymasterMiddleware({
        paymasterAddress,
        operator: operatorAddress
    });

    const csvWriter = createObjectCsvWriter({
        path: OUTPUT_FILE,
        header: [
            {id: 'runId', title: 'Run ID'},
            {id: 'type', title: 'Type'},
            {id: 'latency', title: 'Latency (ms)'},
            {id: 'length', title: 'Data Length'},
            {id: 'status', title: 'Status'}
        ]
    });

    const records: any[] = [];

    // Loop
    for (let i = 0; i < RUNS; i++) {
        const start = Date.now();
        console.log(`   🏃 Run ${i+1}/${RUNS}`);

        try {
            // Simulate Payload Generation
            const userOp = { sender: '0x123...', nonce: 0n };
            const result = await middleware.sponsorUserOperation({ userOperation: userOp });
            
            const latency = Date.now() - start;
            
            records.push({
                runId: i + 1,
                type: 'SDK_Generation',
                latency,
                length: result.paymasterAndData.length,
                status: 'Success'
            });
        } catch (e: any) {
             records.push({
                runId: i + 1,
                type: 'SDK_Generation',
                latency: Date.now() - start,
                length: 0,
                status: 'Failed: ' + e.message
            });
        }
    }

    await csvWriter.writeRecords(records);
    console.log(`✅ Experiment Complete. Data saved to ${OUTPUT_FILE}`);
}

runExperiment().catch(console.error);
