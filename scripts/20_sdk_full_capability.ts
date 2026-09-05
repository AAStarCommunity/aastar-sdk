
import { createAAStarPublicClient, registryActions } from '../packages/core/src/index.js';
import { createAdminClient } from '../packages/sdk/src/index.js';
import { ReputationClient } from '../packages/identity/src/index.js';
import { FinanceClient } from '../packages/tokens/src/index.js';

import { foundry } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { http, type Hex, parseEther, toFunctionSelector } from 'viem';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.anvil') });

const ADMIN_KEY = process.env.ADMIN_KEY as Hex;
const RPC_URL = process.env.RPC_URL || 'http://127.0.0.1:8545';
const REGISTRY_ADDR = process.env.REGISTRY_ADDR as Hex;
const REPUTATION_ADDR = process.env.REPUTATION_SYSTEM_ADDR as Hex; // Check env var name
const PAYMASTER_ADDR = process.env.SUPERPAYMASTER_ADDR as Hex;
const DVT_ADDR = process.env.DVT_VALIDATOR_ADDR as Hex; // Assuming this might be missing in .env.anvil, check later

async function runFullCapabilityTest() {
    console.log("🚀 Running Full Capability SDK Test (v1.0 Preview)...");

    const account = privateKeyToAccount(ADMIN_KEY);
    const publicClient = createAAStarPublicClient({ chain: foundry, rpcUrl: RPC_URL });
    const walletClient = createAdminClient({ 
        chain: foundry, 
        transport: http(RPC_URL), 
        account,
        addresses: {
            registry: REGISTRY_ADDR,
            superPaymaster: PAYMASTER_ADDR,
            gTokenStaking: process.env.GTOKEN_STAKING_ADDR as Hex
        }
    });

    // 1. Registry
    console.log("   📜 Testing Registry (Credit Check)...");
    const regActions = registryActions(REGISTRY_ADDR)(publicClient);
    const credit = await regActions.getCreditLimit({ user: account.address });
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
    //
    // The previous version of this block called `DVTClient.registerValidator` with a dummy key,
    // caught the revert, and printed "DVT Call Reached (Reverted as expected for dummy key)".
    //
    // It printed that whether or not the function existed — and it did not: `registerValidator`
    // is on no contract in this repo. A missing selector and a rejected key both arrive as a
    // revert, so the script reported the first as evidence of the second. **Success and failure
    // produced identical output**, which is why a fictional ABI survived here for so long.
    //
    // So this no longer sends anything. It asks the question the old block believed it was asking:
    // does the deployed contract actually carry the selector we are about to use? That is
    // answerable from the bytecode, with no gas and no ambiguity.
    if (DVT_ADDR) {
        console.log("   🛡️ Testing DVT (registerWithProof selector present on the deployed code)...");
        const selector = toFunctionSelector('registerWithProof(bytes,bytes,bytes)');
        const code = await publicClient.getCode({ address: DVT_ADDR });
        if (!code || code === '0x') {
            console.error(`      ❌ no contract code at ${DVT_ADDR}`);
        } else if (code.includes(selector.slice(2))) {
            console.log(`      ✅ selector ${selector} present in ${(code.length - 2) / 2} bytes of code`);
        } else {
            // The failure the old block could not distinguish, now stated as itself.
            console.error(`      ❌ selector ${selector} NOT in the deployed bytecode — the ABI and the chain disagree`);
        }
    } else {
        console.warn("      ⚠️ DVT_ADDR (Validation) missing, skipping.");
    }

    console.log("✅ Full Capability Test Complete.");
}

runFullCapabilityTest().catch(console.error);
