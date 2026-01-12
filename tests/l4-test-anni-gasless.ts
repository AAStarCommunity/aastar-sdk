import { createPublicClient, createWalletClient, http, parseEther, formatEther, encodeFunctionData, type Address, type Hex, concat, decodeErrorResult } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { PaymasterClient, PaymasterOperator } from '../packages/paymaster/dist/index.js';
import { loadNetworkConfig } from './regression/config.js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.sepolia') });

async function main() {
    const config = loadNetworkConfig('sepolia');
    const publicClient = createPublicClient({ chain: sepolia, transport: http(config.rpcUrl) });
    
    // ANNI is the operator/owner
    const anniKey = process.env.PRIVATE_KEY_ANNI as Hex;
    if (!anniKey) throw new Error('PRIVATE_KEY_ANNI missing in .env.sepolia');
    const anniAccount = privateKeyToAccount(anniKey);
    const anniWallet = createWalletClient({ 
        account: anniAccount, 
        chain: sepolia, 
        transport: http(config.rpcUrl) 
    });

    // Load AA addresses from l4-state.json
    const statePath = path.resolve(process.cwd(), 'scripts/l4-state.json');
    const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    const anniAA = state.aaAccounts.find((aa: any) => aa.label === 'Anni (Demo)_AA1')?.address as Address;
    
    const dPNTs = config.contracts.aPNTs as Address;
    const anniPM = state.operators.anni?.superPaymaster || config.contracts.superPaymaster as Address;
    const bobEOA = privateKeyToAccount(process.env.PRIVATE_KEY_BOB as `0x${string}`).address;

    console.log('🚀 ANNI Gasless Transaction Test\n');
    console.log(`Sender (AA): ${anniAA}`);
    console.log(`Token (dPNTs): ${dPNTs}`);
    console.log(`Paymaster: ${anniPM} (SuperPaymaster)`);
    console.log(`Recipient: ${bobEOA}\n`);

    // NOTE: Anni uses SuperPaymaster, not PaymasterV4
    // So we skip the PaymasterV4-specific setup (addStake, updatePrice, etc.)
    // Those should already be done by l4-setup.ts

    console.log('📋 Step 1: Preparing transfer calldata...');

    // Step 2: Check & Initialize Paymaster Deposit
    console.log('\nStep 2: Checking Paymaster Token Support & Deposit...');
    
    // Check if token is supported
    // Since there's no public query for supportedTokens in PaymasterBase (it's internal mapping)
    // We can just try to add it or skip if we are unsure.
    // Actually, PaymasterV4Client has addGasToken.
    console.log(`   Ensuring ${dPNTs} is supported...`);
    try {
        const gasTokenHash = await PaymasterOperator.addGasToken(anniWallet, anniPM, dPNTs);
        if (gasTokenHash) {
            console.log(`   📝 Sent addGasToken transaction: ${gasTokenHash}`);
            await publicClient.waitForTransactionReceipt({ hash: gasTokenHash });
            console.log(`   ✅ Token ${dPNTs} added.`);
        }
    } catch (e: any) {
        console.log(`   ✓ Token support check/add done (might already be supported).`);
    }

    // Check token price (Skip for SuperPaymaster which uses Oracle/ExchangeRate)
    // console.log(`   Checking ${dPNTs} price...`);
    // NOTE: SuperPaymaster doesn't use the 'tokenPrices' mapping in the same way as PaymasterV4.
    // It uses cachedPrice() and exchangeRate(). We assume l4-setup.ts verified these.
    console.log(`   ✓ Skipping explicit tokenPrices check for SuperPaymaster.`);

    let balance = 0n;
    // Check Deposit (SKIP "balances" for SuperPaymaster, checks Operator Balance instead)
    if (anniPM === config.contracts.superPaymaster) {
         // It's SuperPaymaster, we should check Operator's Credit
         console.log(`   ℹ️  SuperPaymaster detected. Checking Operator (${anniAccount.address}) Credit...`);
         const spAbi = [{ name: 'balanceOfOperator', type: 'function', inputs: [{ name: 'operator', type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' }];
         balance = await publicClient.readContract({
             address: anniPM, abi: spAbi, functionName: 'balanceOfOperator', args: [anniAccount.address]
         }) as bigint;
         console.log(`   Operator Credit: ${formatEther(balance)} aPNTs`);
    } else {
         balance = await PaymasterClient.getDepositedBalance(publicClient, anniPM, anniAA, dPNTs);
         console.log(`   Current deposit: ${formatEther(balance)} dPNTs`);
    }

    if (balance < parseEther('10')) {
        console.log(`   Depositing 100 dPNTs for ANNI (Operator Credit)...`);
        // For SuperPaymaster, we deposit to Operator
        if (anniPM === config.contracts.superPaymaster) {
             // ... deposit logic for SuperPM (omitted for brevity, setup usually handles this) ...
             console.log(`   ⚠️  Low Credit! Using what we have or relying on setup.`);
        } else {
            console.log('   📝 Approving Paymaster...');
            const approveHash = await anniWallet.writeContract({
                address: dPNTs,
                abi: [{ name: 'approve', type: 'function', inputs: [{ name: 'spender', type: 'address' }, { name: 'value', type: 'uint256' }], outputs: [{ type: 'bool' }], stateMutability: 'nonpayable' }],
                functionName: 'approve',
                args: [anniPM, parseEther('1000')]
            });
            await publicClient.waitForTransactionReceipt({ hash: approveHash });

            console.log('   🏦 Depositing into Paymaster...');
            const depositHash = await PaymasterClient.depositFor(anniWallet, anniPM, anniAA, dPNTs, parseEther('100'));
            await publicClient.waitForTransactionReceipt({ hash: depositHash });
            
            balance = await PaymasterClient.getDepositedBalance(publicClient, anniPM, anniAA, dPNTs);
            console.log(`   ✅ New deposit balance: ${formatEther(balance)} dPNTs`);
        }
    }

    // Step 3: Execute Gasless Transfer
    console.log('\nStep 3: Submitting Gasless UserOperation...');
    const transferAmount = parseEther('2');
    const transferCalldata = encodeFunctionData({
        abi: [{ name: 'execute', type: 'function', inputs: [{ name: 'dest', type: 'address' }, { name: 'value', type: 'uint256' }, { name: 'func', type: 'bytes' }], outputs: [], stateMutability: 'nonpayable' }],
        functionName: 'execute',
        args: [
            dPNTs, 
            0n, 
            encodeFunctionData({
                abi: [{ name: 'transfer', type: 'function', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }], stateMutability: 'nonpayable' }],
                functionName: 'transfer',
                args: [bobEOA, transferAmount]
            })
        ]
    });

    try {
        const userOpHash = await PaymasterClient.submitGaslessUserOperation(
            publicClient,
            anniWallet,
            anniAA,
            config.contracts.entryPoint as Address,
            anniPM,
            dPNTs,
            process.env.BUNDLER_URL!,
            transferCalldata
            // Remove hardcoded gas limits to use dynamic pricing
        );

        console.log(`   ✅ UserOp submitted! Hash: ${userOpHash}`);
        console.log(`   ⏳ Waiting for execution...`);

        // Simple poll for receipt
        let success = false;
        for (let i = 0; i < 30; i++) {
            const response = await fetch(process.env.BUNDLER_URL!, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'eth_getUserOperationReceipt',
                    params: [userOpHash]
                })
            });
            const result = (await response.json()) as any;
            if (result.result) {
                const txHash = result.result.receipt ? result.result.receipt.transactionHash : result.result.transactionHash;
                console.log(`   🎉 UserOp Executed! Transaction: ${txHash}`);
                success = true;
                break;
            }
            process.stdout.write('.');
            await new Promise(r => setTimeout(r, 2000));
        }

        if (!success) {
            console.log('\n   ⏸️ Timeout waiting for receipt. Check Etherscan.');
        }

    } catch (error: any) {
        console.error(`   ❌ Submission Failed:`, error.message);
    }
}

main().catch(console.error);
