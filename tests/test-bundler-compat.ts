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
    console.log('🧪 Testing PaymasterClient Bundler Compatibility\n');
    console.log('='.repeat(60));
    
    // Setup
    const rpcUrl = process.env.RPC_URL!;
    const alchemyBundler = process.env.BUNDLER_URL!;
    const pimlicoBundler = process.env.PIMLICO_BUNDLER_URL!;
    
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
    
    console.log('\n📋 Test Configuration:');
    console.log('   AA Address:', aaAddress);
    console.log('   Paymaster:', paymasterAddress);
    console.log('   Token:', tokenAddress);
    console.log('   Recipient:', recipient);
    console.log('   Alchemy Bundler:', alchemyBundler);
    console.log('   Pimlico Bundler:', pimlicoBundler);
    
    // Prepare calldata
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
    
    // Test 1: Alchemy Bundler
    console.log('\n' + '='.repeat(60));
    console.log('📊 Test 1: Alchemy Bundler');
    console.log('='.repeat(60));
    try {
        const txHash = await PaymasterClient.submitGaslessUserOperation(
            publicClient,
            wallet,
            aaAddress,
            entryPoint,
            paymasterAddress,
            tokenAddress,
            alchemyBundler,
            executeCalldata
        );
        
        console.log('✅ Alchemy Test PASSED');
        console.log('   Transaction Hash:', txHash);
        
        // Wait for confirmation
        const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 60000 });
        console.log('   Block:', receipt.blockNumber);
        console.log('   Status:', receipt.status);
        
    } catch (e: any) {
        console.log('❌ Alchemy Test FAILED');
        console.log('   Error:', e.message.slice(0, 200));
    }
    
    // Wait a bit
    await new Promise(r => setTimeout(r, 3000));
    
    // Test 2: Pimlico Bundler
    console.log('\n' + '='.repeat(60));
    console.log('📊 Test 2: Pimlico Bundler');
    console.log('='.repeat(60));
    try {
        const txHash = await PaymasterClient.submitGaslessUserOperation(
            publicClient,
            wallet,
            aaAddress,
            entryPoint,
            paymasterAddress,
            tokenAddress,
            pimlicoBundler,
            executeCalldata
        );
        
        console.log('✅ Pimlico Test PASSED');
        console.log('   Transaction Hash:', txHash);
        
        // Wait for confirmation
        const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 60000 });
        console.log('   Block:', receipt.blockNumber);
        console.log('   Status:', receipt.status);
        
    } catch (e: any) {
        console.log('❌ Pimlico Test FAILED');
        console.log('   Error:', e.message.slice(0, 200));
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ Bundler Compatibility Test Complete');
    console.log('='.repeat(60));
}

main().catch(console.error);
