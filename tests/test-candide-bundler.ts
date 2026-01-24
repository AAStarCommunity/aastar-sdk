import { createPublicClient, createWalletClient, http, parseEther, encodeFunctionData, parseAbi, type Address, type Hex } from 'viem';
import { sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { PaymasterClient } from '../packages/paymaster/src/V4/PaymasterClient.js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

import { loadNetworkConfig } from './regression/config.js';

// Environment and network config handled by loadNetworkConfig

async function main() {
    console.log('🚀 Testing Candide Bundler - Gasless Transaction\n');
    console.log('='.repeat(70));
    
    const args = process.argv.slice(2);
    const networkArgIndex = args.indexOf('--network');
    const networkName = (networkArgIndex >= 0 ? args[networkArgIndex + 1] : 'sepolia') as any;
    const config = await loadNetworkConfig(networkName);
    
    const candideBundler = process.env.CANDIDE_BUNDLER_URL || config.bundlerUrl;
    const rpcUrl = config.rpcUrl;
    
    console.log('\n📋 Configuration:');
    console.log('   RPC URL:', rpcUrl);
    console.log('   Candide Bundler:', candideBundler);
    
    const publicClient = createPublicClient({
        chain: config.chain,
        transport: http(rpcUrl)
    });
    
    const account = privateKeyToAccount(process.env.PRIVATE_KEY_JASON as Hex);
    const wallet = createWalletClient({
        account,
        chain: config.chain,
        transport: http(rpcUrl)
    });
    
    // Load state
    const statePath = path.resolve(process.cwd(), `scripts/l4-state.${networkName}.json`);
    if (!fs.existsSync(statePath)) throw new Error(`State file not found: ${statePath}`);
    const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    
    const aaAddress = state.aaAccounts.find((a: any) => a.label === 'Jason (AAStar)_AA1')?.address as Address;
    const paymasterAddress = state.operators.jason.paymasterV4 as Address;
    const tokenAddress = state.operators.jason.tokenAddress as Address;
    const entryPoint = config.contracts.entryPoint;
    const recipient = state.operators?.bob?.address || state.operators?.anni?.address as Address;
    
    console.log('\n📊 Test Accounts:');
    console.log('   AA Address:', aaAddress);
    console.log('   Paymaster:', paymasterAddress);
    console.log('   Token:', tokenAddress);
    console.log('   Recipient:', recipient);
    
    // Prepare transaction
    const transferCalldata = encodeFunctionData({
        abi: parseAbi(['function transfer(address to, uint256 amount) returns (bool)']),
        functionName: 'transfer',
        args: [recipient, parseEther('0.1')]
    });
    
    const executeCalldata = encodeFunctionData({
        abi: parseAbi(['function execute(address dest, uint256 value, bytes func)']),
        functionName: 'execute',
        args: [tokenAddress, 0n, transferCalldata]
    });
    
    console.log('\n📤 Submitting Gasless Transaction via Candide Bundler...');
    console.log('   Action: Transfer 0.1 dPNT to Bob');
    console.log('   Using: Paymaster V4 (token-based payment)');
    
    try {
        const txHash = await PaymasterClient.submitGaslessUserOperation(
            publicClient,
            wallet,
            aaAddress,
            entryPoint,
            paymasterAddress,
            tokenAddress,
            candideBundler,
            executeCalldata
        );
        
        console.log('\n✅ Transaction Submitted!');
        console.log('   UserOp Hash:', txHash);
        
        console.log('\n⏳ Waiting for confirmation...');
        const receipt = await publicClient.waitForTransactionReceipt({ 
            hash: txHash,
            timeout: 120000 
        });
        
        console.log('\n✅ Transaction Confirmed!');
        console.log('   Block Number:', receipt.blockNumber);
        console.log('   Gas Used:', receipt.gasUsed);
        console.log('   Status:', receipt.status === 'success' ? '✅ Success' : '❌ Failed');
        
        console.log('\n' + '='.repeat(70));
        console.log('🎉 Candide Bundler Test PASSED!');
        console.log('='.repeat(70));
        
    } catch (e: any) {
        console.log('\n❌ Transaction Failed');
        console.log('   Error:', e.message.slice(0, 300));
        
        if (e.cause) {
            console.log('\n   Cause:', JSON.stringify(e.cause, null, 2).slice(0, 500));
        }
        
        console.log('\n' + '='.repeat(70));
        console.log('❌ Candide Bundler Test FAILED');
        console.log('='.repeat(70));
        
        throw e;
    }
}

main().catch(console.error);
