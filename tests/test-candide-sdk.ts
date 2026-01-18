import { createPublicClient, http, parseEther, encodeFunctionData, parseAbi, type Address, type Hex } from 'viem';
import { sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { SafeAccountV0_3_0 as SafeAccount, MetaTransaction } from 'abstractionkit';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env.sepolia') });

async function main() {
    console.log('🚀 Testing Candide with AbstractionKit SDK\n');
    console.log('='.repeat(70));
    
    const bundlerUrl = process.env.CANDIDE_BUNDLER_URL!;
    const rpcUrl = process.env.RPC_URL!;
    const privateKey = process.env.PRIVATE_KEY_JASON!;
    
    console.log('\n📋 Configuration:');
    console.log('   Bundler URL:', bundlerUrl);
    console.log('   RPC URL:', rpcUrl);
    
    // Load state
    const statePath = path.resolve(__dirname, '../scripts/l4-state.json');
    const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    
    const tokenAddress = state.operators.jason.tokenAddress as Address;
    const recipient = state.operators.bob.address as Address;
    
    console.log('   Token:', tokenAddress);
    console.log('   Recipient:', recipient);
    
    // Create Safe Account using abstractionkit
    const account = privateKeyToAccount(privateKey as Hex);
    const ownerPublicAddress = account.address;
    
    console.log('\n🔧 Creating Safe Account...');
    const smartAccount = SafeAccount.initializeNewAccount([ownerPublicAddress]);
    console.log('   Safe Account Address:', smartAccount.accountAddress);
    
    // Create transaction: Transfer 0.1 dPNT
    const transferCalldata = encodeFunctionData({
        abi: parseAbi(['function transfer(address to, uint256 amount) returns (bool)']),
        functionName: 'transfer',
        args: [recipient, parseEther('0.1')]
    });
    
    const transaction: MetaTransaction = {
        to: tokenAddress,
        value: 0n,
        data: transferCalldata
    };
    
    console.log('\n📝 Creating UserOperation...');
    try {
        const userOperation = await smartAccount.createUserOperation(
            [transaction],
            rpcUrl,
            bundlerUrl
        );
        
        console.log('✅ UserOperation Created');
        console.log('   Sender:', userOperation.sender);
        console.log('   Nonce:', userOperation.nonce);
        console.log('   CallData length:', userOperation.callData.length);
        
        // Sign the UserOperation
        console.log('\n✍️  Signing UserOperation...');
        userOperation.signature = smartAccount.signUserOperation(
            userOperation,
            [privateKey],
            BigInt(sepolia.id)
        );
        
        console.log('✅ UserOperation Signed');
        
        // Submit the UserOperation
        console.log('\n📤 Submitting UserOperation to Candide Bundler...');
        const sendUserOperationResponse = await smartAccount.sendUserOperation(
            userOperation,
            bundlerUrl
        );
        
        console.log('✅ UserOperation Submitted!');
        console.log('   UserOp Hash:', sendUserOperationResponse.userOperationHash);
        
        console.log('\n⏳ Waiting for confirmation...');
        const userOperationReceiptResult = await sendUserOperationResponse.included();
        
        console.log('\n📋 UserOperation Receipt:');
        console.log(JSON.stringify(userOperationReceiptResult, null, 2));
        
        if (userOperationReceiptResult.success) {
            console.log('\n' + '='.repeat(70));
            console.log('🎉 Candide Transaction Successful!');
            console.log('   Transaction Hash:', userOperationReceiptResult.receipt.transactionHash);
            console.log('='.repeat(70));
        } else {
            console.log('\n' + '='.repeat(70));
            console.log('❌ UserOperation Execution Failed');
            console.log('='.repeat(70));
        }
        
    } catch (e: any) {
        console.log('\n❌ Error:', e.message);
        if (e.cause) {
            console.log('   Cause:', JSON.stringify(e.cause, null, 2).slice(0, 500));
        }
        throw e;
    }
}

main().catch(console.error);
