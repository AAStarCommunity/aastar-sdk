import { createPublicClient, createWalletClient, http, encodeFunctionData, parseEther, formatEther, createClient } from 'viem';
import { bundlerActions } from 'viem/account-abstraction';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { PaymasterClient } from '../packages/paymaster/src/V4/index.js';
import * as dotenv from 'dotenv';
import { loadNetworkConfig } from '../tests/regression/config.js';

dotenv.config({ path: '.env.sepolia' });

// ...
async function main() {
    const config = await loadNetworkConfig('sepolia');
    const APP_CONFIG = {
        rpcUrl: process.env.RPC_URL || 'https://eth-sepolia.g.alchemy.com/v2/your-key',
        bundlerUrl: process.env.BUNDLER_URL!,
        entryPoint: config.contracts.entryPoint, // Dynamically loaded v0.7 EP
        paymaster: '0x82862b7c3586372DF1c80Ac60adA57e530b0eB82', // Anni PM
        gasToken: '0x424DA26B172994f98D761a999fa2FD744CaF812b', // dPNTs
        aaAccount: '0xECD9C07f648B09CFb78906302822Ec52Ab87dd70' // Jason AA1
    };
    console.log('🚀 Developers only need these few lines:');

    // 1. Setup Client & Wallet
    const account = privateKeyToAccount(process.env.PRIVATE_KEY_JASON as `0x${string}`);
    const wallet = createWalletClient({ account, chain: sepolia, transport: http(APP_CONFIG.rpcUrl) });
    const client = createPublicClient({ chain: sepolia, transport: http(APP_CONFIG.rpcUrl) });

    // 2. Define Your Action (e.g. Transfer Token)
    // 💡 New Semantic Helpers: No more raw ABI encoding!
    
    // A. Inner Action: Transfer 0.01 dPNTs to Owner
    const innerCall = PaymasterClient.encodeTokenTransfer(account.address, parseEther('0.01'));

    // B. Outer Action: Execute via AA (SimpleAccount.execute)
    const callData = PaymasterClient.encodeExecution(
        APP_CONFIG.gasToken as `0x${string}`, 
        0n,                                    
        innerCall
    );

    // 3. ✨ ONE-LINER SUBMISSION ✨
    // (Auto: Gas Estimation, 1.2x Efficiency Guard, Signing, Submission)
    const txHash = await PaymasterClient.submitGaslessUserOperation(
        client,
        wallet,
        APP_CONFIG.aaAccount as `0x${string}`,
        APP_CONFIG.entryPoint as `0x${string}`,
        APP_CONFIG.paymaster as `0x${string}`,
        APP_CONFIG.gasToken as `0x${string}`,
        APP_CONFIG.bundlerUrl,
        callData
        // Gas prices auto-fetched from network if not specified
    );

    // 4. Wait for Execution (Optional but recommended for confirmation)
    console.log(`\n⏳ Waiting for execution...`);
    const bundlerClient = createClient({
        chain: sepolia,
        transport: http(APP_CONFIG.bundlerUrl)
    }).extend(bundlerActions);

    const receipt = await bundlerClient.waitForUserOperationReceipt({ 
        hash: txHash 
    });

    console.log(`\n🎉 Done! Transaction Hash: ${receipt.receipt.transactionHash}`);
    console.log(`🔗 Tracking: https://sepolia.etherscan.io/tx/${receipt.receipt.transactionHash}`);

    // 5. Decode Protocol Fee (for User Visibility)
    const feeInfo = PaymasterClient.getFeeFromReceipt(receipt.receipt, APP_CONFIG.paymaster as `0x${string}`);
    if (feeInfo) {
        console.log(`\n🧾 [Instant Bill] Cost: ${formatEther(feeInfo.tokenCost)} dPNTs`);
        console.log(`   (Sponsored ETH: ${formatEther(feeInfo.actualGasCostWei)} ETH)`);
    } else {
        console.log('\n⚠️ Could not decode fee from logs.');
    }
}

main().catch(console.error);
