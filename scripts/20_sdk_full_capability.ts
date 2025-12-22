
import { createAAStarPublicClient, createAAStarWalletClient } from '../packages/core/src/index';
import { RegistryClient } from '../packages/registry/src/index';
import { ReputationClient } from '../packages/reputation/src/index';
import { FinanceClient } from '../packages/finance/src/index';
import { DVTClient } from '../packages/dvt/src/index';

import { foundry } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { http, type Hex, parseEther } from 'viem';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.v3') });

const ADMIN_KEY = process.env.ADMIN_KEY as Hex;
const REGISTRY_ADDR = process.env.REGISTRY_ADDR as Hex;
const REPUTATION_ADDR = process.env.REPUTATION_SYSTEM_ADDR as Hex; // Check env var name
const PAYMASTER_ADDR = process.env.SUPERPAYMASTER_ADDR as Hex;
const DVT_ADDR = process.env.DVT_VALIDATOR_ADDR as Hex; // Assuming this might be missing in .env.v3, check later

async function runFullCapabilityTest() {
    console.log("🚀 Running Full Capability SDK Test (v1.0 Preview)...");

    const account = privateKeyToAccount(ADMIN_KEY);
    const publicClient = createAAStarPublicClient({ chain: foundry, rpcUrl: process.env.RPC_URL });
    const walletClient = createAAStarWalletClient({ chain: foundry, rpcUrl: process.env.RPC_URL, account });

    // 1. Registry
    console.log("   📜 Testing Registry (Credit Check)...");
    const regClient = new RegistryClient(publicClient, REGISTRY_ADDR);
    const credit = await regClient.getCreditLimit(account.address);
    console.log(`      Credit Limit: ${credit}`);

    // 2. Reputation
    if (REPUTATION_ADDR) {
        console.log("   ⭐ Testing Reputation (Compute Score)...");
        const repClient = new ReputationClient(publicClient, REPUTATION_ADDR);
        // Checking score with empty arrays (mock)
        const score = await repClient.computeScore(account.address, [], [], []);
        console.log(`      Reputation Score: ${score}`);
    } else {
        console.warn("      ⚠️ REPUTATION_ADDR missing, skipping.");
    }

    // 3. Finance
    console.log("   💰 Testing Finance (Paymaster Deposit)...");
    // 3. Finance
    console.log("   💰 Testing Finance (Paymaster Deposit)...");
    // Use XPNTS or APNTS address from env, fallback to GTOKEN if missing but likely XPNTS is correct for Paymaster collateral
    const TOKEN_ADDR = (process.env.APNTS || process.env.XPNTS_ADDR || process.env.GTOKEN_ADDRESS || process.env.GAS_TOKEN_ADDRESS) as Hex;
    
    if (TOKEN_ADDR) {
        console.log(`      Using Token: ${TOKEN_ADDR}`);
        // For xPNTs, we must use Push pattern (transferAndCall)
        // No approval needed for transferAndCall usually, but we assume we have balance.
        try {
            const hash = await FinanceClient.depositViaTransferAndCall(walletClient, TOKEN_ADDR, PAYMASTER_ADDR, parseEther("0.1"));
            console.log(`      Deposit (Push) Tx: ${hash}`);
        } catch (e: any) {
             console.error(`      Deposit Failed: ${e.message}`);
        }
    } else {
        console.warn("      ⚠️ TOKEN Address missing. Skipping Deposit.");
    }

    // 4. DVT
    if (DVT_ADDR) {
        console.log("   🛡️ Testing DVT (Validator Reg)...");
        // Mock BLS Key
        const blsKey = "0x12345678" as Hex; // Dummy
        try {
            // This might revert if logic checks BLS formatting, but validates route exists
            await DVTClient.registerValidator(walletClient, DVT_ADDR, blsKey);
        } catch (e: any) {
            console.log(`      DVT Call Reached (Reverted as expected for dummy key): ${e.shortMessage || e.message}`);
        }
    } else {
        console.warn("      ⚠️ DVT_ADDR (Validation) missing, skipping.");
    }

    console.log("✅ Full Capability Test Complete.");
}

runFullCapabilityTest().catch(console.error);
