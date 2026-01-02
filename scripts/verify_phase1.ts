import * as dotenv from 'dotenv';
import path from 'path';

// Load Env at the very top
const envPath = process.env.TARGET_ENV_FILE || '.env.sepolia';
const fullPath = path.resolve(process.cwd(), '../SuperPaymaster', envPath);
console.log(`Loading env from: ${fullPath}`);
dotenv.config({ path: fullPath });

import { createPublicClient, http, formatEther } from 'viem';
import { sepolia } from 'viem/chains';

async function main() {
    console.log("🔍 Verifying SDK Phase 1 Components...\n");

    // Dynamic imports to ensure dotenv.config() above has finished
    const { ContractConfigManager, StateValidator, ExperimentDataManager } = await import('../packages/core/src/index.js');
    const { ExperimentClient } = await import('../packages/sdk/src/index.js');

    // 1. Verify ContractConfigManager
    console.log("1. Testing ContractConfigManager...");
    try {
        const config = ContractConfigManager.getConfig();
        console.log("   ✅ Config Loaded:");
        console.log(`      Registry: ${config.registry}`);
        console.log(`      SuperPaymaster: ${config.superPaymaster}`);
    } catch (e: any) {
        console.error("   ❌ Config Failed:", e.message);
        process.exit(1);
    }

    // 2. Verify StateValidator (Sepolia)
    console.log("\n2. Testing StateValidator (Sepolia)...");
    const rpcUrl = process.env.SEPOLIA_RPC_URL || 'https://rpc.ankr.com/eth_sepolia';
    if (!rpcUrl) throw new Error("Missing SEPOLIA_RPC_URL");

    const client = createPublicClient({ chain: sepolia, transport: http(rpcUrl) });
    const targetAddr = '0xB6D378417772658872e4827052844C73356E8888'; // Example EOA

    const balances = await StateValidator.getAccountBalances({
        rpcUrl,
        chain: sepolia,
        addresses: [targetAddr],
        gTokenAddress: ContractConfigManager.getConfig().gToken,
        aPNTsAddress: ContractConfigManager.getConfig().entryPoint // Just testing call
    });
    console.log("   ✅ Balances Fetched:", balances[0]);

    // 3. Verify ExperimentClient (Data Collection)
    console.log("\n3. Testing ExperimentClient...");
    const manager = new ExperimentDataManager('./temp_data');
    const expClient = new ExperimentClient("Verify-Phase1", "Baseline", manager as any);

    const mockReceipt = {
        gasUsed: 21000n,
        effectiveGasPrice: 1000000000n // 1 Gwei
    };
    
    expClient.recordTx("0x123...mock", mockReceipt as any, 'Success', { note: "Test run" });
    manager.exportToCSV('test_results.csv');
    console.log("   ✅ Data Recorded & Exported.");

    console.log("\n🎉 Phase 1 Verification Passed!");
}

main().catch(console.error);
