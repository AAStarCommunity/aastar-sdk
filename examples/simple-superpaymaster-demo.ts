import { createPublicClient, createWalletClient, http, parseEther, createClient } from 'viem';
import { bundlerActions } from 'viem/account-abstraction';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { SuperPaymasterClient, PaymasterClient } from '../packages/paymaster/src/V4/index.js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { loadNetworkConfig } from '../tests/regression/config.js';

// Environment loading handled by loadNetworkConfig

/**
 * 🚀 Simple SuperPaymaster Demo
 * 
 * Demonstrates how to submit a Gasless Transaction using the SuperPaymasterClient.
 * This client handles dynamic gas estimation and "Smart Tuning" to satisfy Bundler efficiency rules.
 */
async function main() {
    console.log('🌟 Starting SuperPaymaster Demo...');

    // 1. Load Configuration
    const args = process.argv.slice(2);
    const networkArgIndex = args.indexOf('--network');
    const networkName = (networkArgIndex >= 0 ? args[networkArgIndex + 1] : 'sepolia') as any;

    const config = await loadNetworkConfig(networkName);
    
    // Default Addresses (Fallback)
    let tokenAddress = '0x71f9Dd79f3B0EF6f186e9C6DdDf3145235D9BBd9';
    let operatorAddress = '0xEcAACb915f7D92e9916f449F7ad42BD0408733c9'; 
    let aaAccountAddress = '0xBC7626E94a215F6614d1B6aFA740787A2E50aaA4';
    
    // Load from State File if available
    const statePath = path.resolve(process.cwd(), `scripts/l4-state.${networkName}.json`);
    if (fs.existsSync(statePath)) {
        try {
            const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
            if (state.operators?.anni?.address) operatorAddress = state.operators.anni.address;
            if (state.aaAccounts?.[2]?.address) aaAccountAddress = state.aaAccounts[2].address; // Anni is usually 3rd
            // cPNTs logic might be missing, defaulting to config.contracts.aPNTs if safer
             if (config.contracts.aPNTs) tokenAddress = config.contracts.aPNTs;
        } catch (e) { console.warn("State load failed", e); }
    }

    const APP_CONFIG = {
        rpcUrl: process.env.RPC_URL || 'https://eth-sepolia.g.alchemy.com/v2/your-key',
        bundlerUrl: config.bundlerUrl!,
        entryPoint: config.contracts.entryPoint,
        superPaymaster: config.contracts.superPaymaster, 
        token: tokenAddress, 
        operator: operatorAddress,
        aaAccount: aaAccountAddress, 
        recipient: '0xF7Bf79AcB7F3702b9DbD397d8140ac9DE6Ce642C' // Random Recipient
    };

    if (!APP_CONFIG.bundlerUrl) throw new Error("Missing BUNDLER_URL in .env.sepolia");

    // 2. Setup Clients
    // NOTE: If using KMS, replace 'privateKeyToAccount' with your custom KMS signer
    const account = privateKeyToAccount(process.env.PRIVATE_KEY_ANNI as `0x${string}`); 
    const wallet = createWalletClient({ account, chain: config.chain, transport: http(APP_CONFIG.rpcUrl) });
    const client = createPublicClient({ chain: config.chain, transport: http(APP_CONFIG.rpcUrl) });

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
        chain: config.chain,
        transport: http(APP_CONFIG.bundlerUrl)
    }).extend(bundlerActions);

    const receipt = await bundlerClient.waitForUserOperationReceipt({ 
        hash: userOpHash 
    });

    console.log(`\n🎉 Transaction Mined!`);
    const explorerUrl = config.chain.blockExplorers?.default.url || 'https://etherscan.io';
    console.log(`🔗 ${explorerUrl}/tx/${receipt.receipt.transactionHash}`);

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
