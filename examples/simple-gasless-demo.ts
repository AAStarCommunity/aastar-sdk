import { createPublicClient, createWalletClient, http, encodeFunctionData, parseEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { PaymasterV4Client } from '../packages/paymaster/src/V4/index.js';
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
    const callData = encodeFunctionData({
        abi: [{ name: 'execute', type: 'function', inputs: [{ name: 'dest', type: 'address' }, { name: 'value', type: 'uint256' }, { name: 'func', type: 'bytes' }], outputs: [], stateMutability: 'nonpayable' }],
        functionName: 'execute',
        args: [
            APP_CONFIG.gasToken as `0x${string}`, 
            0n, 
            encodeFunctionData({
                abi: [{ name: 'transfer', type: 'function', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }], stateMutability: 'nonpayable' }],
                functionName: 'transfer',
                args: [account.address, parseEther('0.01')]
            })
        ]
    });

    // 3. ✨ ONE-LINER SUBMISSION ✨
    // (Auto: Gas Estimation, 1.2x Efficiency Guard, Signing, Submission)
    const txHash = await PaymasterV4Client.submitGaslessUserOperation(
        client,
        wallet,
        APP_CONFIG.aaAccount as `0x${string}`,
        APP_CONFIG.entryPoint as `0x${string}`,
        APP_CONFIG.paymaster as `0x${string}`,
        APP_CONFIG.gasToken as `0x${string}`,
        APP_CONFIG.bundlerUrl,
        callData,
        {
            maxFeePerGas: 10000000000n, // 10 Gwei (Optional, usually fetched from network)
            maxPriorityFeePerGas: 1000000000n // 1 Gwei
        }
    );

    console.log(`\n🎉 Done! UserOp Hash: ${txHash}`);
    console.log(`🔗 Tracking: https://sepolia.etherscan.io/tx/${txHash} (After bundle)`);
}

main().catch(console.error);
