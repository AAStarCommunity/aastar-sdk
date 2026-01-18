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
    console.log('🚀 Candide Gasless Transaction with Paymaster V4\n');
    console.log('='.repeat(70));
    
    const bundlerUrl = process.env.CANDIDE_BUNDLER_URL!;
    const rpcUrl = process.env.RPC_URL!;
    const entryPoint = '0x0000000071727De22E5E9d8BAf0edAc6f37da032' as Address;
    
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
    
    const statePath = path.resolve(__dirname, '../scripts/l4-state.json');
    const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    
    const aaAddress = state.aaAccounts.find((a: any) => a.label === 'Jason (AAStar)_AA1')?.address as Address;
    const paymasterAddress = state.operators.jason.paymasterV4 as Address;
    const tokenAddress = state.operators.jason.tokenAddress as Address;
    const recipient = state.operators.bob.address as Address;
    
    console.log('\n📋 Configuration:');
    console.log('   AA Address:', aaAddress);
    console.log('   Paymaster:', paymasterAddress);
    console.log('   Token:', tokenAddress);
    console.log('   Recipient:', recipient);
    console.log('   Bundler:', bundlerUrl);
    
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
    
    console.log('\n📤 Submitting Gasless Transaction via Candide...');
    try {
        const txHash = await PaymasterClient.submitGaslessUserOperation(
            publicClient,
            wallet,
            aaAddress,
            entryPoint,
            paymasterAddress,
            tokenAddress,
            bundlerUrl,
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
        console.log('   Block:', receipt.blockNumber);
        console.log('   Gas Used:', receipt.gasUsed);
        console.log('   Status:', receipt.status);
        
        console.log('\n' + '='.repeat(70));
        console.log('🎉 CANDIDE GASLESS TRANSACTION SUCCESSFUL!');
        console.log('='.repeat(70));
        
    } catch (e: any) {
        console.log('\n❌ Transaction Failed');
        console.log('   Error:', e.message.slice(0, 500));
        throw e;
    }
}

main().catch(console.error);
