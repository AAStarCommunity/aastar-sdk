import { createPublicClient, createWalletClient, http, parseEther, encodeFunctionData, parseAbi, type Address, type Hex } from 'viem';
import { sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { createSmartAccountClient } from 'permissionless';
import { toSimpleSmartAccount } from 'permissionless/accounts';
import { createPimlicoClient } from 'permissionless/clients/pimlico';
import { entryPoint07Address } from 'viem/account-abstraction';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env.sepolia') });

async function main() {
    console.log('🚀 Complete Pimlico Gasless Transaction Test\n');
    console.log('='.repeat(70));
    
    const apiKey = process.env.PIMLICO_API_KEY!;
    if (!apiKey) throw new Error('Missing PIMLICO_API_KEY');
    
    const pimlicoUrl = `https://api.pimlico.io/v2/sepolia/rpc?apikey=${apiKey}`;
    
    // Load state
    const statePath = path.resolve(__dirname, '../scripts/l4-state.json');
    const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    
    const paymasterAddress = state.operators.jason.paymasterV4 as Address;
    const tokenAddress = state.operators.jason.tokenAddress as Address;
    const recipient = state.operators.bob.address as Address;
    
    console.log('\n📋 Configuration:');
    console.log('   Paymaster:', paymasterAddress);
    console.log('   Token:', tokenAddress);
    console.log('   Recipient:', recipient);
    console.log('   Pimlico URL:', pimlicoUrl);
    
    // 1. Create Public Client
    const publicClient = createPublicClient({
        chain: sepolia,
        transport: http(process.env.RPC_URL!)
    });
    
    // 2. Create Pimlico Paymaster Client
    const paymasterClient = createPimlicoClient({
        entryPoint: {
            address: entryPoint07Address,
            version: '0.7'
        },
        transport: http(pimlicoUrl)
    });
    
    // 3. Create Owner Account (EOA that controls the AA)
    const owner = privateKeyToAccount(process.env.PRIVATE_KEY_JASON as Hex);
    
    // 4. Create SimpleSmartAccount
    console.log('\n🔧 Creating SimpleSmartAccount...');
    const simpleAccount = await toSimpleSmartAccount({
        client: publicClient,
        owner: owner,
        entryPoint: {
            address: entryPoint07Address,
            version: '0.7'
        }
    });
    
    console.log('   ✅ SmartAccount Created');
    console.log('   Address:', simpleAccount.address);
    
    // 5. Create Smart Account Client
    console.log('\n🔧 Creating SmartAccountClient...');
    const smartAccountClient = createSmartAccountClient({
        account: simpleAccount,
        chain: sepolia,
        bundlerTransport: http(pimlicoUrl),
        paymaster: paymasterClient,
        userOperation: {
            estimateFeesPerGas: async () => {
                const gasPrice = await paymasterClient.getUserOperationGasPrice();
                return gasPrice.fast;
            }
        }
    });
    
    console.log('   ✅ SmartAccountClient Created');
    
    // 6. Prepare Transaction (Transfer 0.1 dPNT)
    console.log('\n📝 Preparing Transaction...');
    const transferCalldata = encodeFunctionData({
        abi: parseAbi(['function transfer(address to, uint256 amount) returns (bool)']),
        functionName: 'transfer',
        args: [recipient, parseEther('0.1')]
    });
    
    // 7. Send Transaction
    console.log('\n📤 Sending Gasless Transaction via Pimlico...');
    try {
        const txHash = await smartAccountClient.sendTransaction({
            to: tokenAddress,
            data: transferCalldata,
            value: 0n
        });
        
        console.log('✅ Transaction Sent!');
        console.log('   Hash:', txHash);
        
        console.log('\n⏳ Waiting for confirmation...');
        const receipt = await publicClient.waitForTransactionReceipt({ 
            hash: txHash,
            timeout: 60000 
        });
        
        console.log('✅ Transaction Confirmed!');
        console.log('   Block:', receipt.blockNumber);
        console.log('   Gas Used:', receipt.gasUsed);
        console.log('   Status:', receipt.status);
        
        console.log('\n' + '='.repeat(70));
        console.log('🎉 Pimlico Gasless Transaction Successful!');
        console.log('='.repeat(70));
        
    } catch (e: any) {
        console.log('❌ Transaction Failed');
        console.log('   Error:', e.message);
        if (e.cause) {
            console.log('   Cause:', JSON.stringify(e.cause, null, 2));
        }
        throw e;
    }
}

main().catch(console.error);
