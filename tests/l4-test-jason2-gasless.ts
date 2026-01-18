import { createPublicClient, createWalletClient, http, parseEther, formatEther, type Address, encodeFunctionData, concat, type Hex, decodeErrorResult } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
// import { PaymasterClient, PaymasterOperator } from '../packages/paymaster/src/V4/index.ts';
import { loadNetworkConfig } from './regression/config.js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: '.env.sepolia' });

async function main() {
    const config = await loadNetworkConfig('sepolia');
    const rpcUrl = process.env.RPC_URL || 'https://eth-sepolia.g.alchemy.com/v2/your-key';
    
    // Dynamic import to avoid config mismatch
    const { PaymasterClient, PaymasterOperator } = await import('../packages/paymaster/src/V4/index.js');

    
    // 1. Roles & Accounts
    const anniAccount = privateKeyToAccount(process.env.PRIVATE_KEY_ANNI as `0x${string}`);
    const jasonAccount = privateKeyToAccount(process.env.PRIVATE_KEY_JASON as `0x${string}`);
    
    const publicClient = createPublicClient({ chain: sepolia, transport: http(rpcUrl) });
    const anniWallet = createWalletClient({ account: anniAccount, chain: sepolia, transport: http(rpcUrl) });
    const jasonWallet = createWalletClient({ account: jasonAccount, chain: sepolia, transport: http(rpcUrl) });

    // Load AA addresses from l4-state.json
    const statePath = path.resolve(process.cwd(), 'scripts/l4-state.json');
    const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    const jasonAA2 = state.aaAccounts.find((aa: any) => aa.label === 'Jason (AAStar)_AA2')?.address as Address;
    const jasonPM = state.operators["Jason (AAStar)"].pmV4 as Address;
    
    const dPNTs = config.contracts.aPNTs as Address;
    const entryPoint = config.contracts.entryPoint as Address;

    console.log('🚀 JASON AA2 Gasless Transaction via JASON OWN Paymaster');
    console.log(`Jason AA2: ${jasonAA2}`);
    console.log(`Operator (Jason): ${jasonAccount.address}`);
    console.log(`Paymaster: ${jasonPM}`);
    console.log(`Token: ${dPNTs}\n`);

    // --- STEP 1: PRE-FLIGHT CHECK ---
    console.log('🔍 Step 1: Running SDK Readiness Check...');
    const report = await PaymasterOperator.checkGaslessReadiness(
        publicClient,
        entryPoint,
        jasonPM,
        jasonAA2,
        dPNTs
    );

    if (!report.isReady) {
        console.log('   ⚠️ Readiness Check Issues Found:');
        report.issues.forEach(issue => console.log(`      - ${issue}`));
        
        // --- STEP 2: AUTOMATED PREPARATION ---
        console.log('\n🛠️ Step 2: Running Automated Environment Preparation...');
        const results = await PaymasterOperator.prepareGaslessEnvironment(
            jasonWallet,
            publicClient,
            entryPoint,
            jasonPM,
            dPNTs,
            {
                tokenPriceUSD: 100000000n, // $1.00
                minStake: parseEther('0.1'),
                minDeposit: parseEther('0.2')
            }
        );

        if (results.length > 0) {
            console.log(`   📝 Sent ${results.length} preparation transactions.`);
            for (const s of results) {
                console.log(`      - ${s.step}: ${s.hash}`);
                await publicClient.waitForTransactionReceipt({ hash: s.hash as `0x${string}` });
            }
            console.log('   ✅ Environment Prepared.');
        } else {
            console.log('   ✓ Environment already partially prepared (transactions skipped).');
        }
    } else {
        console.log('   ✅ SDK Readiness Check Passed! All systems go.');
    }

    // --- STEP 3: USER DEPOSIT (If missing) ---
    console.log('\n💰 Step 3: Checking User Paymaster Deposit...');
    let userDeposit = await PaymasterClient.getDepositedBalance(publicClient, jasonPM, jasonAA2, dPNTs);
    console.log(`   Jason AA2 Deposit: ${formatEther(userDeposit)} dPNTs`);

    if (userDeposit < parseEther('10')) {
        console.log('   🏦 Deposit too low. Seeding 50 dPNTs from Anni EOA...');
        // Anni EOA (Operator/Community) approves and deposits for Jason
        const approveHash = await anniWallet.writeContract({
            address: dPNTs,
            abi: [{ name: 'approve', type: 'function', inputs: [{ name: 'spender', type: 'address' }, { name: 'value', type: 'uint256' }], outputs: [{ type: 'bool' }], stateMutability: 'nonpayable' }],
            functionName: 'approve',
            args: [jasonPM, parseEther('100')]
        });
        await publicClient.waitForTransactionReceipt({ hash: approveHash });

        const depositHash = await PaymasterClient.depositFor(anniWallet, jasonPM, jasonAA2, dPNTs, parseEther('50'));
        await publicClient.waitForTransactionReceipt({ hash: depositHash });
        console.log('   ✅ 50 dPNTs deposited.');
    }

    // --- STEP 4: GASLESS TRANSACTION ---
    console.log('\n📤 Step 4: Submitting Gasless UserOperation...');
    const transferCalldata = encodeFunctionData({
        abi: [{ name: 'execute', type: 'function', inputs: [{ name: 'dest', type: 'address' }, { name: 'value', type: 'uint256' }, { name: 'func', type: 'bytes' }], outputs: [], stateMutability: 'nonpayable' }],
        functionName: 'execute',
        args: [
            dPNTs, 
            0n, 
            encodeFunctionData({
                abi: [{ name: 'transfer', type: 'function', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }], stateMutability: 'nonpayable' }],
                functionName: 'transfer',
                args: [anniAccount.address, parseEther('1')] // Transfer 1 dPNT back to Anni
            })
        ]
    });

    try {
        const userOpHash = await PaymasterClient.submitGaslessUserOperation(
            publicClient,
            jasonWallet,
            jasonAA2,
            entryPoint,
            jasonPM,
            dPNTs,
            config.bundlerUrl!,
            transferCalldata
            // {
            //    // Let SDK determine dynamic gas prices
            // }
        );

        console.log(`   ✅ UserOp submitted! Hash: ${userOpHash}`);
        console.log('   ⏳ Waiting for execution...');

        let receipt = null;
        for (let i = 0; i < 20; i++) {
            const res = await fetch(process.env.BUNDLER_URL!, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'eth_getUserOperationReceipt',
                    params: [userOpHash]
                })
            });
            const data = await res.json();
            if (data.result) {
                receipt = data.result;
                break;
            }
            await new Promise(r => setTimeout(r, 5000));
        }

        if (receipt) {
            console.log(`   🎉 UserOp Executed! Transaction: ${receipt.receipt.transactionHash}`);
            console.log(`   ⛽ Gas Used: ${BigInt(receipt.actualGasUsed).toString()}`);
            console.log(`   💸 Fee Paid: ${formatEther(BigInt(receipt.actualGasCost))} ETH (sponsored by dPNTs)`);
        } else {
            console.log('   ❌ Polling timeout. Check Etherscan for status.');
        }

    } catch (e: any) {
        console.error('   ❌ Submission Failed:', e.message);
    }
}

main().catch(console.error);
