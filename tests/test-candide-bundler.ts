import { createPublicClient, createWalletClient, http, parseEther, encodeFunctionData, parseAbi, type Address, type Hex } from 'viem';
import { sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { PaymasterClient } from '../packages/paymaster/src/V4/PaymasterClient.js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env.sepolia') });

async function main() {
    console.log('🚀 Testing Candide Bundler - Gasless Transaction\n');
    console.log('='.repeat(70));
    
    const candideBundler = process.env.CANDIDE_BUNDLER_URL!;
    const rpcUrl = process.env.RPC_URL!;
    
    console.log('\n📋 Configuration:');
    console.log('   RPC URL:', rpcUrl);
    console.log('   Candide Bundler:', candideBundler);
    console.log('   (Public endpoint, no API key required!)');
    
    const publicClient = createPublicClient({
        chain: sepolia,
        transport: http(rpcUrl)
    });
    
    const account = privateKeyToAccount(process.env.PRIVATE_KEY_JASON as Hex);
    const wallet = createWalletClient({
        account,
        chain: sepolia,
        transport: http(rpcUrl)
    });
    
    // Load state
    const statePath = path.resolve(__dirname, '../scripts/l4-state.json');
    const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    
    const aaAddress = state.aaAccounts.find((a: any) => a.label === 'Jason (AAStar)_AA1')?.address as Address;
    const paymasterAddress = state.operators.jason.paymasterV4 as Address;
    const tokenAddress = state.operators.jason.tokenAddress as Address;
    const entryPoint = '0x0000000071727De22E5E9d8BAf0edAc6f37da032' as Address;
    const recipient = state.operators.bob.address as Address;
    
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
