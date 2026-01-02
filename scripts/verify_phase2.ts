import * as dotenv from 'dotenv';
import path from 'path';

// Setup Env
const envPath = '.env'; 
const fullPath = path.resolve(process.cwd(), '../SuperPaymaster', envPath);
dotenv.config({ path: fullPath });

console.log(`🔍 Loading env from: ${fullPath}`);

import { createPublicClient, http, WalletClient, createWalletClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';

async function main() {
    console.log("🚀 Verifying SDK Phase 2 Business APIs...\n");
    
    // Dynamic import of SDK
    const { createEndUserClient, ExperimentClient } = await import('../packages/sdk/src/index.js');
    const { ContractConfigManager } = await import('../packages/core/src/index.js');

    const rpcUrl = process.env.SEPOLIA_RPC_URL || 'https://rpc.ankr.com/eth_sepolia';
    const pk = process.env.OWNER_PRIVATE_KEY || process.env.PRIVATE_KEY || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
    if (!pk) throw new Error("Missing PRIVATE_KEY");

    const account = privateKeyToAccount(pk as `0x${string}`);
    const publicClient = createPublicClient({ chain: sepolia, transport: http(rpcUrl) });
    const walletClient = createWalletClient({ 
        account, 
        chain: sepolia, 
        transport: http(rpcUrl) 
    });

    const endUser = createEndUserClient({
        chain: sepolia,
        transport: http(rpcUrl),
        account
    });

    // 1. Test Address Prediction
    console.log("1. Testing Smart Account Prediction...");
    const { accountAddress, isDeployed } = await endUser.createSmartAccount({
        owner: account.address,
        salt: 1337n
    });
    console.log(`   ✅ Predicted: ${accountAddress} (Deployed: ${isDeployed})`);

    // 2. Test Requirement Checker
    console.log("\n2. Testing Join Requirements...");
    const requirements = await endUser.checkJoinRequirements(account.address);
    console.log(`   Status: Enough GT? ${requirements.hasEnoughGToken} | Has SBT? ${requirements.hasSBT}`);
    if (requirements.missingRequirements.length > 0) {
        console.log(`   Missing: ${requirements.missingRequirements.join(', ')}`);
    }

    // 3. Test Benchmarking
    console.log("\n3. Testing Experiment Tracking...");
    const exp = new ExperimentClient("Verification-Scenario", "AA");
    // Mock a tx record
    exp.recordTx("0x000...mock", { gasUsed: 100000n, effectiveGasPrice: 2000000000n }, 'Success', { step: 'onboard' });
    console.log(`   ✅ Records: ${exp.getRecords().length}`);

    console.log("\n🎉 Phase 2 Verification Success!");
}

main().catch(console.error);
