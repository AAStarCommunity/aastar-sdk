import { createPublicClient, createWalletClient, http, parseEther, formatEther, type Address, encodeFunctionData, createClient, concat, type Hex, decodeErrorResult } from 'viem';
import { bundlerActions } from 'viem/account-abstraction';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { PaymasterClient, PaymasterOperator } from '../packages/paymaster/src/V4/index.js';
import { loadNetworkConfig } from './regression/config.js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// dotenv loaded by loadNetworkConfig

async function main() {
    const args = process.argv.slice(2);
    const networkArgIndex = args.indexOf('--network');
    const networkName = (networkArgIndex >= 0 ? args[networkArgIndex + 1] : 'sepolia') as any;
    const config = await loadNetworkConfig(networkName);
    const rpcUrl = process.env.RPC_URL || config.rpcUrl;
    
    // 1. Roles & Accounts
    const anniAccount = privateKeyToAccount(process.env.PRIVATE_KEY_ANNI as `0x${string}`);
    const jasonAccount = privateKeyToAccount(process.env.PRIVATE_KEY_JASON as `0x${string}`);
    
    const publicClient = createPublicClient({ chain: config.chain, transport: http(rpcUrl) });
    const anniWallet = createWalletClient({ account: anniAccount, chain: config.chain, transport: http(rpcUrl) });
    const jasonWallet = createWalletClient({ account: jasonAccount, chain: config.chain, transport: http(rpcUrl) });

    const entryPoint = config.contracts.entryPoint as Address;

    // Load AA addresses from l4-state.json
    const statePath = path.resolve(process.cwd(), `scripts/l4-state.${networkName}.json`);
    const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    const jasonAA1 = state.aaAccounts.find((aa: any) => aa.label === 'Jason (AAStar)_AA1')?.address as Address;
    
    // CRITICAL: Anni doesn't have PaymasterV4, only SuperPaymaster. 
    // So we cannot test "Anni sponsoring Jason" with PaymasterV4.
    // Instead, use Jason's own PaymasterV4 for this test.
    const jasonPM = state.operators.jason.paymasterV4 as Address;
    
    // Resolve Addresses from Config and State
    const dPNTs = config.contracts.aPNTs as Address;

    console.log('🚀 [FIXED] JASON AA1 Gasless via JASON OWN PM');
    console.log(`Sender (Jason AA1): ${jasonAA1}`);
    console.log(`Sponsor (Jason PM): ${jasonPM} (from l4-state.json)`);
    console.log(`Gas Token: ${dPNTs} (from config)\n`);


    // --- STEP 1: ONE-CLICK READINESS & Fix ---
    console.log('🔍 Step 1: SDK Readiness Check...');
    const report = await PaymasterOperator.checkGaslessReadiness(
        publicClient,
        entryPoint,
        jasonPM,
        jasonAA1,
        dPNTs
    );

    if (!report.isReady) {
        console.log('   ⚠️ Issues Detected:', report.issues.join(', '));
        console.log('\n🛠️ Step 2: Automated Self-Healing (Operator Action)...');
        const steps = await PaymasterOperator.prepareGaslessEnvironment(
            jasonWallet, // Corrected: Must be owner of jasonPM
            publicClient,
            entryPoint,
            jasonPM, 
            dPNTs,
            { tokenPriceUSD: 100000000n } // $1.00
        );

        for (const s of steps) {
            console.log(`      🚀 [${s.step}] Fixed. Hash: ${s.hash}`);
            await publicClient.waitForTransactionReceipt({ hash: s.hash as `0x${string}` });
        }
    } else {
        console.log('   ✅ SDK Readiness Check: PERFECT.');
    }

    // --- STEP 3: USER DEPOSIT ---
    // --- STEP 2.5: CHECK PRICE ---
    const price = await PaymasterOperator.getCachedPrice(publicClient, jasonPM);
    console.log(`   💲 Token Price on PM: ${price.price} (updated at ${price.updatedAt})`);
    
    // --- STEP 3: USER DEPOSIT ---
    const userDeposit = await PaymasterClient.getDepositedBalance(publicClient, jasonPM, jasonAA1, dPNTs);
    if (userDeposit < parseEther('500')) {
        console.log(`\n🏦 Seeding User Deposit (Current: ${formatEther(userDeposit)} dPNTs)...`);
        
        const approveHash = await anniWallet.writeContract({
            address: dPNTs,
            abi: [{ name: 'approve', type: 'function', inputs: [{ name: 'spender', type: 'address' }, { name: 'value', type: 'uint256' }], outputs: [{ type: 'bool' }], stateMutability: 'nonpayable' }],
            functionName: 'approve',
            args: [jasonPM, parseEther('2000')] 
        });
        await publicClient.waitForTransactionReceipt({ hash: approveHash });

        const depHash = await PaymasterClient.depositFor(anniWallet, jasonPM, jasonAA1, dPNTs, parseEther('1000'));
        await publicClient.waitForTransactionReceipt({ hash: depHash as `0x${string}` });
        console.log('   ✅ User deposit seeded (1000 dPNTs).');
    }

    // --- STEP 4: GASLESS EXECUTION ---
    console.log('\n📤 Step 4: Submitting Gasless Transaction...');
    const transferCalldata = encodeFunctionData({
        abi: [{ name: 'execute', type: 'function', inputs: [{ name: 'dest', type: 'address' }, { name: 'value', type: 'uint256' }, { name: 'func', type: 'bytes' }], outputs: [], stateMutability: 'nonpayable' }],
        functionName: 'execute',
        args: [
            dPNTs, 
            0n, 
            encodeFunctionData({
                abi: [{ name: 'transfer', type: 'function', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }], stateMutability: 'nonpayable' }],
                functionName: 'transfer',
                args: [anniAccount.address, parseEther('0.1')] // Tiny transfer back
            })
        ]
    });



    const userOpHash = await PaymasterClient.submitGaslessUserOperation(
        publicClient,
        jasonWallet,
        jasonAA1,
        entryPoint,
        jasonPM,
        dPNTs,
        config.bundlerUrl!, // Changed from process.env.BUNDLER_URL!
        transferCalldata
    );

    console.log(`   ✅ UserOp Hash: ${userOpHash}`);
    console.log('   ⏳ Waiting for block confirmation...');

    // Polling for receipt using Bundler Client
    const bundlerClient = createPublicClient({ 
        chain: config.chain, 
        transport: http(config.bundlerUrl!) 
    }).extend(bundlerActions);

    console.log('   ⏳ Waiting for execution (can take up to 60s)...');
    try {
        const receipt = await bundlerClient.waitForUserOperationReceipt({ 
            hash: userOpHash,
            timeout: 120000 // 2 minutes timeout
        });
        
        const explorerUrl = config.chain.blockExplorers?.default.url || 'https://etherscan.io';
        console.log(`\n🎉 SUCCESS! Transaction confirmed: ${receipt.receipt.transactionHash}`);
        console.log(`🔗 Explorer: ${explorerUrl}/tx/${receipt.receipt.transactionHash}`);
    } catch (e) {
        console.log('\n⌛ Still pending or timed out... check on jiffyscan later.');
        console.error(e);
    }
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
