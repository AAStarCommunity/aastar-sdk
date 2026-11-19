import { createPublicClient, createWalletClient, http, encodeFunctionData, parseEther, formatEther, createClient } from 'viem';
import { bundlerActions } from 'viem/account-abstraction';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { PaymasterClient } from '../packages/paymaster/src/V4/index.js';
import * as fs from 'fs';
import * as path from 'path';
import { loadGaslessNetworkConfig } from '../tests/regression/config.js';
// dotenv loaded by loadNetworkConfig

// ...
async function main() {
    const args = process.argv.slice(2);
    const networkArgIndex = args.indexOf('--network');
    const networkName = (networkArgIndex >= 0 ? args[networkArgIndex + 1] : 'sepolia') as any;
    const config = await loadGaslessNetworkConfig(networkName);

    const statePath = path.resolve(process.cwd(), `scripts/l4-state.${networkName}.json`);
    if (!fs.existsSync(statePath)) throw new Error(`State file not found: ${statePath}. Please run l4-setup first.`);
    
    const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    const aaAddress = state.aaAccounts?.[0]?.address;
    const pmAddress = state.operators?.jason?.paymasterV4;

    if (!aaAddress) throw new Error("No AA account found in state.");
    if (!pmAddress) throw new Error("Jason Paymaster V4 not found in state.");

    const APP_CONFIG = {
        rpcUrl: process.env.RPC_URL || config.rpcUrl,
        bundlerUrl: config.bundlerUrl!,
        entryPoint: config.contracts.entryPoint, 
        paymaster: pmAddress, 
        gasToken: config.contracts.aPNTs, 
        aaAccount: aaAddress 
    };
    console.log('🚀 Developers only need these few lines:');

    // 1. Setup Client & Wallet
    const account = privateKeyToAccount(process.env.PRIVATE_KEY_JASON as `0x${string}`);
    const wallet = createWalletClient({ account, chain: config.chain, transport: http(APP_CONFIG.rpcUrl) });
    const client = createPublicClient({ chain: config.chain, transport: http(APP_CONFIG.rpcUrl) });

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
        callData, { maxUserOpCostWei: config.maxUserOpCostWei }
        // Gas prices auto-fetched from network if not specified
    );

    // 4. Wait for Execution (Optional but recommended for confirmation)
    console.log(`\n⏳ Waiting for execution...`);
    const bundlerClient = createClient({
        chain: config.chain,
        transport: http(APP_CONFIG.bundlerUrl)
    }).extend(bundlerActions);

    try {
        const receipt = await PaymasterClient.waitForUserOperation(bundlerClient, txHash);

        if (receipt.timeout) {
            console.log(`\n⚠️  Polling Timeout: Receipt not available yet.`);
            console.log(`ℹ️  UserOp Hash: ${txHash}`);
            const explorerUrl = config.explorerUrl || config.chain.blockExplorers?.default.url || 'https://etherscan.io';
            console.log(`🔗 Check status: ${explorerUrl}/tx/${txHash}`);
            return;
        }

        const explorerUrl = config.explorerUrl || config.chain.blockExplorers?.default.url || 'https://etherscan.io';
        console.log(`\n🎉 Done! Transaction Hash: ${receipt.receipt.transactionHash}`);
        console.log(`🔗 Tracking: ${explorerUrl}/tx/${receipt.receipt.transactionHash}`);

        // 5. Decode Protocol Fee (for User Visibility)
        const feeInfo = PaymasterClient.getFeeFromReceipt(receipt.receipt, APP_CONFIG.paymaster as `0x${string}`);
        if (feeInfo) {
            console.log(`\n🧾 [Instant Bill] Cost: ${formatEther(feeInfo.tokenCost)} dPNTs`);
            console.log(`   (Sponsored ETH: ${formatEther(feeInfo.actualGasCostWei)} ETH)`);
        } else {
            console.log('\n⚠️ Could not decode fee from logs.');
        }
    } catch (error: any) {
        if (error.name === 'TimeoutError' || error.message?.includes('timed out')) {
            console.log(`\n⚠️  Polling Timeout: The UserOperation was submitted but the receipt is not yet available.`);
            console.log(`💡 UserOp Hash: ${txHash}`);
            const explorerUrl = config.chain.blockExplorers?.default.url || 'https://etherscan.io';
            console.log(`🔗 You can check the status later at: ${explorerUrl}/tx/${txHash}`);
            console.log(`   or via Bundler Explorer using the hash above.`);
        } else {
            console.error('\n❌ Error waiting for receipt:', error.shortMessage || error.message);
        }
    }
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
