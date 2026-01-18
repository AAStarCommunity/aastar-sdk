import { createPublicClient, createWalletClient, http, parseEther, encodeFunctionData, parseAbi, type Address, type Hex, concat, pad, toHex, keccak256, encodeAbiParameters, toBytes } from 'viem';
import { sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env.sepolia') });

// Simple UserOp hash function for v0.7
function getUserOpHash(userOp: any, entryPoint: Address, chainId: bigint): Hex {
    const initCode = (userOp.factory && userOp.factoryData) ? concat([userOp.factory, userOp.factoryData]) : '0x' as Hex;
    const paymasterAndData = (userOp.paymaster && userOp.paymasterData) 
        ? concat([
            userOp.paymaster,
            pad(toHex(userOp.paymasterVerificationGasLimit || 0), { size: 16 }),
            pad(toHex(userOp.paymasterPostOpGasLimit || 0), { size: 16 }),
            userOp.paymasterData
          ])
        : '0x' as Hex;
        
    const hashedUserOp = keccak256(encodeAbiParameters(
        ['address', 'uint256', 'bytes32', 'bytes32', 'bytes32', 'uint256', 'bytes32', 'bytes32'].map(t => ({ type: t } as any)),
        [
            userOp.sender,
            BigInt(userOp.nonce),
            keccak256(toBytes(initCode)),
            keccak256(toBytes(userOp.callData as Hex)),
            concat([pad(toHex(userOp.verificationGasLimit), { size: 16 }), pad(toHex(userOp.callGasLimit), { size: 16 })]),
            toHex(userOp.preVerificationGas),
            concat([pad(toHex(userOp.maxPriorityFeePerGas), { size: 16 }), pad(toHex(userOp.maxFeePerGas), { size: 16 })]),
            keccak256(toBytes(paymasterAndData))
        ]
    ));
    return keccak256(encodeAbiParameters(
        ['bytes32', 'address', 'uint256'].map(t => ({ type: t } as any)),
        [hashedUserOp, entryPoint, chainId]
    ));
}

async function main() {
    console.log('🚀 Testing Candide Bundler with SimpleAccount (No Paymaster)\n');
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
    
    // Load state
    const statePath = path.resolve(__dirname, '../scripts/l4-state.json');
    const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    
    const aaAddress = state.aaAccounts.find((a: any) => a.label === 'Jason (AAStar)_AA1')?.address as Address;
    const tokenAddress = state.operators.jason.tokenAddress as Address;
    const recipient = state.operators.bob.address as Address;
    
    console.log('\n📋 Configuration:');
    console.log('   AA Address:', aaAddress);
    console.log('   Token:', tokenAddress);
    console.log('   Recipient:', recipient);
    console.log('   Bundler:', bundlerUrl);
    
    // Check if account exists
    const code = await publicClient.getCode({ address: aaAddress });
    if (!code || code === '0x') {
        console.log('\n❌ SimpleAccount not deployed at', aaAddress);
        console.log('   Please deploy the account first');
        return;
    }
    console.log('✅ SimpleAccount exists');
    
    // Get nonce
    const nonce = await publicClient.readContract({
        address: aaAddress,
        abi: parseAbi(['function getNonce() view returns (uint256)']),
        functionName: 'getNonce'
    });
    console.log('   Nonce:', nonce);
    
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
    
    // Get gas price
    const feeData = await publicClient.estimateFeesPerGas();
    const maxFeePerGas = (feeData.maxFeePerGas ?? 30000000000n) * 150n / 100n;
    const maxPriorityFeePerGas = (feeData.maxPriorityFeePerGas ?? 1000000000n) * 150n / 100n;
    
    // Create UserOperation (NO PAYMASTER - pay with ETH)
    // Note: No factory/factoryData since account is already deployed
    const userOp = {
        sender: aaAddress,
        nonce: toHex(nonce),
        callData: executeCalldata,
        callGasLimit: toHex(200000n),
        verificationGasLimit: toHex(300000n),
        preVerificationGas: toHex(100000n),
        maxFeePerGas: toHex(maxFeePerGas),
        maxPriorityFeePerGas: toHex(maxPriorityFeePerGas),
        signature: '0x'
    };
    
    console.log('\n📝 UserOperation (No Paymaster):');
    console.log(JSON.stringify(userOp, null, 2));
    
    // Sign UserOperation
    const userOpHash = getUserOpHash(userOp, entryPoint, BigInt(sepolia.id));
    const signature = await wallet.signMessage({ message: { raw: userOpHash } });
    userOp.signature = signature;
    
    console.log('\n✍️  Signature:', signature);
    
    // Submit to Candide
    console.log('\n📤 Submitting to Candide Bundler...');
    try {
        const response = await fetch(bundlerUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'eth_sendUserOperation',
                params: [userOp, entryPoint]
            })
        });
        
        const result = await response.json();
        console.log('\n📊 Candide Response:');
        console.log(JSON.stringify(result, null, 2));
        
        if (result.result) {
            console.log('\n✅ UserOperation Submitted!');
            console.log('   UserOp Hash:', result.result);
            
            console.log('\n⏳ Waiting for confirmation...');
            // Wait for receipt
            let receipt = null;
            for (let i = 0; i < 30; i++) {
                await new Promise(r => setTimeout(r, 2000));
                const receiptResponse = await fetch(bundlerUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        id: 1,
                        method: 'eth_getUserOperationReceipt',
                        params: [result.result]
                    })
                });
                const receiptResult = await receiptResponse.json();
                if (receiptResult.result) {
                    receipt = receiptResult.result;
                    break;
                }
            }
            
            if (receipt) {
                console.log('\n✅ Transaction Confirmed!');
                console.log('   Block:', receipt.receipt.blockNumber);
                console.log('   Tx Hash:', receipt.receipt.transactionHash);
                console.log('   Success:', receipt.success);
                
                console.log('\n' + '='.repeat(70));
                console.log('🎉 Candide Bundler Test PASSED!');
                console.log('='.repeat(70));
            } else {
                console.log('\n⏱️  Timeout waiting for receipt');
            }
        } else if (result.error) {
            console.log('\n❌ Candide Error:', result.error.message);
            console.log('   Code:', result.error.code);
        }
        
    } catch (e: any) {
        console.log('\n❌ Error:', e.message);
        throw e;
    }
}

main().catch(console.error);
