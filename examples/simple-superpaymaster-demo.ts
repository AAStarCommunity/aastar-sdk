import { createPublicClient, createWalletClient, http, parseEther, createClient } from 'viem';
import { bundlerActions } from 'viem/account-abstraction';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { SuperPaymasterClient, PaymasterClient } from '../packages/paymaster/src/V4/index.js';
import * as dotenv from 'dotenv';
import { loadNetworkConfig } from '../tests/regression/config.js';

dotenv.config({ path: '.env.sepolia' });

/**
 * 🚀 Simple SuperPaymaster Demo
 * 
 * Demonstrates how to submit a Gasless Transaction using the SuperPaymasterClient.
 * This client handles dynamic gas estimation and "Smart Tuning" to satisfy Bundler efficiency rules.
 */
async function main() {
    console.log('🌟 Starting SuperPaymaster Demo...');

    // 1. Load Configuration
    // In a real app, these would be constants or environment variables
    const config = await loadNetworkConfig('sepolia');
    const APP_CONFIG = {
        rpcUrl: process.env.RPC_URL || 'https://eth-sepolia.g.alchemy.com/v2/your-key',
        bundlerUrl: process.env.BUNDLER_URL!,
        entryPoint: config.contracts.entryPoint,
        superPaymaster: config.contracts.superPaymaster, 
        token: '0x71f9Dd79f3B0EF6f186e9C6DdDf3145235D9BBd9', // cPNTs (Anni's Token)
        operator: '0xEcAACb915f7D92e9916f449F7ad42BD0408733c9', // Anni's Operator Address
        aaAccount: '0xBC7626E94a215F6614d1B6aFA740787A2E50aaA4', // Anni's AA Account (User)
        recipient: '0xF7Bf79AcB7F3702b9DbD397d8140ac9DE6Ce642C' // Random Recipient
    };

    if (!APP_CONFIG.bundlerUrl) throw new Error("Missing BUNDLER_URL in .env.sepolia");

    // 2. Setup Clients
    // NOTE: If using KMS, replace 'privateKeyToAccount' with your custom KMS signer
    const account = privateKeyToAccount(process.env.PRIVATE_KEY_ANNI as `0x${string}`); 
    const wallet = createWalletClient({ account, chain: sepolia, transport: http(APP_CONFIG.rpcUrl) });
    const client = createPublicClient({ chain: sepolia, transport: http(APP_CONFIG.rpcUrl) });

    console.log(`👤 User: ${account.address}`);
    console.log(`🏦 Paymaster: ${APP_CONFIG.superPaymaster}`);
    console.log(`🔧 Operator: ${APP_CONFIG.operator}`);

    // 3. ✨ Submit Gasless Transaction ✨
    // The SuperPaymasterClient handles all the heavy lifting:
    // - Estimates Gas via Bundler
    // - Tunes Gas Limits (Efficiency Guard)
    // - Packs Paymaster Data (with Operator)
    // - Signs & Submits
    
    console.log('\n🚀 Submitting Transaction...');
    const userOpHash = await SuperPaymasterClient.submitGaslessTransaction(
        client,
        wallet,
        APP_CONFIG.aaAccount as `0x${string}`,
        APP_CONFIG.entryPoint as `0x${string}`,
        APP_CONFIG.bundlerUrl,
        {
            token: APP_CONFIG.token as `0x${string}`,
            recipient: APP_CONFIG.recipient as `0x${string}`,
            amount: parseEther('1'), // Transfer 1.0 Token
            operator: APP_CONFIG.operator as `0x${string}`,
            paymasterAddress: APP_CONFIG.superPaymaster as `0x${string}`
        }
    );

    console.log(`✅ UserOp Hash: ${userOpHash}`);

    // 4. Wait for Execution
    console.log(`⏳ Waiting for execution...`);
    const bundlerClient = createClient({
        chain: sepolia,
        transport: http(APP_CONFIG.bundlerUrl)
    }).extend(bundlerActions);

    const receipt = await bundlerClient.waitForUserOperationReceipt({ 
        hash: userOpHash 
    });

    console.log(`\n🎉 Transaction Mined!`);
    console.log(`🔗 https://sepolia.etherscan.io/tx/${receipt.receipt.transactionHash}`);

    // 5. Check Cost (Optional)
    const feeInfo = PaymasterClient.getFeeFromReceipt(receipt.receipt, APP_CONFIG.superPaymaster as `0x${string}`);
    if (feeInfo) {
        // Note: SuperPaymaster might settle in xPNTs or aPNTs depending on config
        console.log(`🧾 Cost: ${formatEther(feeInfo.tokenCost)} (Base Units)`);
    }
}

main().catch((err) => {
    console.error('\n❌ Error:', err);
    process.exit(1);
});
