// Test 1: Paymaster V4 Deposit Model - depositFor AA user (no SBT required)
import { createPublicClient, createWalletClient, http, parseEther, formatEther, type Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { paymasterActions, tokenActions } from '../packages/core/src/index.js';
import { loadNetworkConfig } from '../tests/regression/config.js';
import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.resolve(process.cwd(), '.env.sepolia') });

async function main() {
    const config = loadNetworkConfig('sepolia');
    const publicClient = createPublicClient({ chain: sepolia, transport: http(config.rpcUrl) });

    // Load accounts
    const bobKey = process.env.PRIVATE_KEY_BOB as `0x${string}`;
    const bob = privateKeyToAccount(bobKey);
    const bobClient = createWalletClient({ account: bob, chain: sepolia, transport: http(config.rpcUrl) });
    
    // Load state from l4-state.json
    const statePath = path.resolve(process.cwd(), 'scripts/l4-state.json');
    const state = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
    
    // Bob's Paymaster V4 and AA user
    const bobPaymaster = state.operators.bob.paymasterV4 as Address;
    const bPNTs = state.operators.bob.tokenAddress as Address;
    const bobAA1 = state.aaAccounts.find((aa: any) => aa.label === 'Bob (Bread)_AA1')!.address as Address;
    
    const pmV4 = paymasterActions(bobPaymaster);
    
    console.log('📦 Test 1: Paymaster V4 Deposit Model\n');
    console.log(`Paymaster V4: ${bobPaymaster}`);
    console.log(`Test AA User: ${bobAA1}`);
    console.log(`Gas Token: bPNTs (${bPNTs})\n`);
    
    // Step 1: Check if token is supported (tokenPrices should be > 0)
    console.log('Step 1: Checking token price...');
    const tokenPrice = await pmV4(publicClient).tokenPrices({ token: bPNTs });
    console.log(`   Token Price: ${tokenPrice} (${tokenPrice > 0 ? '✅ Supported' : '❌ Not Supported'})`);
    
    if (tokenPrice === 0n) {
        console.log('   ⚠️ Token not supported! Owner needs to call setTokenPrice()');
        console.log(`   Calling setTokenPrice(${bPNTs}, 20000000) ... (0.02 USD with 8 decimals)`);
        const setPriceHash = await pmV4(bobClient).setTokenPrice({ 
            token: bPNTs, 
            price: 20000000n, // $0.02 with 8 decimals
            account: bob 
        });
        await publicClient.waitForTransactionReceipt({ hash: setPriceHash });
        console.log('   ✅ Token price set!\n');
    }
    
    //  Step 2: Check AA user's current balance
    console.log('\nStep 2: Checking AA user balance...');
    const currentBalance = await pmV4(publicClient).balances({ user: bobAA1, token: bPNTs });
    console.log(`   Current Balance: ${formatEther(currentBalance)} bPNTs`);
    
    // Step 3: depositFor AA user
    const depositAmount = parseEther('100');
    console.log(`\nStep 3: Depositing ${formatEther(depositAmount)} bPNTs for AA user...`);
    
    // Bob needs bPNTs balance and approval
    const token = tokenActions();
    const bobBalance = await token(publicClient).balanceOf({ token: bPNTs, account: bob.address });
    console.log(`   Bob's bPNTs Balance: ${formatEther(bobBalance)}`);
    
    if (bobBalance < depositAmount) {
        throw new Error(`Bob needs at least ${formatEther(depositAmount)} bPNTs`);
    }
    
    const allowance = await token(publicClient).allowance({ token: bPNTs, owner: bob.address, spender: bobPaymaster });
    console.log(`   Bob's Allowance: ${formatEther(allowance)}`);
    
    if (allowance < depositAmount) {
        console.log('   Approving Paymaster...');
        const approveHash = await token(bobClient).approve({ 
            token: bPNTs, 
            spender: bobPaymaster, 
            amount: parseEther('1000'), 
            account: bob 
        });
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
        console.log('   ✅ Approved!');
    }
    
    console.log('   Calling depositFor...');
    const depositHash = await pmV4(bobClient).depositFor({ 
        user: bobAA1, 
        token: bPNTs, 
        amount: depositAmount, 
        account: bob 
    });
    await publicClient.waitForTransactionReceipt({ hash: depositHash });
    console.log(`   ✅ Deposited! Tx: ${depositHash}\n`);
    
    // Step 4: Verify new balance
    console.log('Step 4: Verifying new balance...');
    const newBalance = await pmV4(publicClient).balances({ user: bobAA1, token: bPNTs });
    console.log(`   New Balance: ${formatEther(newBalance)} bPNTs`);
    console.log(`   Delta: +${formatEther(newBalance - currentBalance)} bPNTs\n`);
    
    console.log('✅ Test 1 Complete!');
    console.log(`\nSummary:`);
    console.log(`   - AA User ${bobAA1} now has ${formatEther(newBalance)} bPNTs deposited`);
    console.log(`   - User can perform gasless transactions without SBT`);
    console.log(`   - UserOp paymasterAndData should include bPNTs address at offset 52`);
}

main().catch(console.error);
