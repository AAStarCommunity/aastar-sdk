/**
 * L4 PaymasterV4 Transfer Test
 * 
 * Test: AA account transfers ERC20 tokens using Bob's PaymasterV4
 * Requirements:
 * - Sender: Bob's AA account (has ENDUSER role + MySBT)
 * - Paymaster: Bob's PaymasterV4
 * - Gas Token: Bob's bPNT token
 * - Transfer: 2 bPNT tokens to receiver
 */

import { createPublicClient, createWalletClient, http, parseEther, formatEther, type Address, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { loadNetworkConfig } from '../tests/regression/config';
import { UserOpScenarioBuilder, UserOpScenarioType } from '../packages/sdk/src/index.js';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
    console.log('\n🧪 L4 PaymasterV4 Transfer Test\n');
    
    // 1. Load configuration
    const config = await loadNetworkConfig('sepolia');
    const publicClient = createPublicClient({
        chain: config.chain,
        transport: http(config.rpcUrl)
    });

    // 2. Load l4-state.json
    const statePath = path.join(__dirname, 'l4-state.json');
    const state = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
    
    console.log('📋 Test Configuration:');
    console.log(`   Network: ${state.network}`);
    console.log(`   Timestamp: ${state.timestamp}`);
    
    // 3. Get Bob's resources
    const bobOperator = state.operators.bob;
    const bobAA = state.aaAccounts.find((aa: any) => aa.label === 'Bob (Bread)_AA1');
    
    if (!bobOperator || !bobAA) {
        throw new Error('Bob resources not found in l4-state.json');
    }
    
    console.log('\n👤 Bob Resources:');
    console.log(`   Operator: ${bobOperator.address}`);
    console.log(`   AA Account: ${bobAA.address}`);
    console.log(`   Token (bPNT): ${bobOperator.tokenAddress}`);
    console.log(`   PaymasterV4: ${bobOperator.paymasterV4}`);
    
    // 4. Get Bob's owner account
    const bobOwnerKey = process.env.PRIVATE_KEY_BOB;
    if (!bobOwnerKey) {
        throw new Error('PRIVATE_KEY_BOB not found in .env.sepolia');
    }
    const bobOwner = privateKeyToAccount(bobOwnerKey as `0x${string}`);
    
    // 5. Get receiver (use Jason's AA2 as receiver)
    const receiverAA = state.aaAccounts.find((aa: any) => aa.label === 'Jason (AAStar)_AA2');
    if (!receiverAA) {
        throw new Error('Receiver not found');
    }
    
    console.log(`\n📬 Receiver: ${receiverAA.address} (${receiverAA.label})`);
    
    // 6. Check balances before transfer
    console.log('\n💰 Balances Before Transfer:');
    const senderBalance = await publicClient.readContract({
        address: bobOperator.tokenAddress,
        abi: parseAbi(['function balanceOf(address) view returns (uint256)']),
        functionName: 'balanceOf',
        args: [bobAA.address]
    }) as bigint;
    
    const receiverBalance = await publicClient.readContract({
        address: bobOperator.tokenAddress,
        abi: parseAbi(['function balanceOf(address) view returns (uint256)']),
        functionName: 'balanceOf',
        args: [receiverAA.address]
    }) as bigint;
    
    console.log(`   Sender (${bobAA.label}): ${formatEther(senderBalance)} bPNT`);
    console.log(`   Receiver (${receiverAA.label}): ${formatEther(receiverBalance)} bPNT`);
    
    // 7. Build UserOperation using SDK
    console.log('\n🔨 Building UserOperation...');
    const transferAmount = parseEther('2');
    
    const { userOp, opHash } = await UserOpScenarioBuilder.buildTransferScenario(
        UserOpScenarioType.GASLESS_V4,
        {
            sender: bobAA.address,
            ownerAccount: bobOwner,
            recipient: receiverAA.address,
            tokenAddress: bobOperator.tokenAddress,
            amount: transferAmount,
            entryPoint: config.contracts.entryPoint,
            chainId: config.chain.id,
            publicClient,
            paymaster: bobOperator.paymasterV4
        }
    );
    
    console.log('✅ UserOperation Built:');
    console.log(`   Hash: ${opHash}`);
    console.log(`   Sender: ${userOp.sender}`);
    console.log(`   Nonce: ${userOp.nonce}`);
    console.log(`   Paymaster: ${bobOperator.paymasterV4}`);
    console.log(`   Signature: ${userOp.signature.slice(0, 66)}...`);
    
    // 8. Submit UserOperation to Alchemy Bundler
    console.log('\n📤 Submitting UserOperation to Alchemy Bundler...');
    
    const bundlerUrl = process.env.SEPOLIA_BUNDLER_RPC;
    if (!bundlerUrl) {
        throw new Error('SEPOLIA_BUNDLER_RPC not found in .env.sepolia');
    }
    
    try {
        const response = await fetch(bundlerUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'eth_sendUserOperation',
                params: [
                    {
                        sender: userOp.sender,
                        nonce: userOp.nonce,
                        factory: userOp.factory,
                        factoryData: userOp.factoryData,
                        callData: userOp.callData,
                        callGasLimit: userOp.callGasLimit,
                        verificationGasLimit: userOp.verificationGasLimit,
                        preVerificationGas: userOp.preVerificationGas,
                        maxFeePerGas: userOp.maxFeePerGas,
                        maxPriorityFeePerGas: userOp.maxPriorityFeePerGas,
                        paymaster: userOp.paymaster,
                        paymasterVerificationGasLimit: userOp.paymasterVerificationGasLimit,
                        paymasterPostOpGasLimit: userOp.paymasterPostOpGasLimit,
                        paymasterData: userOp.paymasterData,
                        signature: userOp.signature
                    },
                    config.contracts.entryPoint
                ]
            })
        });
        
        const result = await response.json();
        
        if (result.error) {
            console.error('❌ Bundler Error:', result.error);
            throw new Error(result.error.message);
        }
        
        const userOpHash = result.result;
        console.log('✅ UserOperation Submitted!');
        console.log(`   UserOp Hash: ${userOpHash}`);
        
        // 9. Wait for receipt
        console.log('\n⏳ Waiting for UserOperation receipt...');
        let receipt = null;
        let attempts = 0;
        const maxAttempts = 30;
        
        while (!receipt && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            const receiptResponse = await fetch(bundlerUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'eth_getUserOperationReceipt',
                    params: [userOpHash]
                })
            });
            
            const receiptResult = await receiptResponse.json();
            if (receiptResult.result) {
                receipt = receiptResult.result;
            }
            attempts++;
            process.stdout.write('.');
        }
        
        console.log('');
        
        if (!receipt) {
            throw new Error('UserOperation receipt not found after 60 seconds');
        }
        
        console.log('✅ UserOperation Executed!');
        console.log(`   Success: ${receipt.success}`);
        console.log(`   Tx Hash: ${receipt.receipt.transactionHash}`);
        console.log(`   Block: ${receipt.receipt.blockNumber}`);
        console.log(`   Gas Used: ${receipt.actualGasUsed}`);
        
        // 10. Check balances after transfer
        console.log('\n💰 Balances After Transfer:');
        const senderBalanceAfter = await publicClient.readContract({
            address: bobOperator.tokenAddress,
            abi: parseAbi(['function balanceOf(address) view returns (uint256)']),
            functionName: 'balanceOf',
            args: [bobAA.address]
        }) as bigint;
        
        const receiverBalanceAfter = await publicClient.readContract({
            address: bobOperator.tokenAddress,
            abi: parseAbi(['function balanceOf(address) view returns (uint256)']),
            functionName: 'balanceOf',
            args: [receiverAA.address]
        }) as bigint;
        
        console.log(`   Sender (${bobAA.label}): ${formatEther(senderBalanceAfter)} bPNT (${formatEther(senderBalanceAfter - senderBalance)})`);
        console.log(`   Receiver (${receiverAA.label}): ${formatEther(receiverBalanceAfter)} bPNT (+${formatEther(receiverBalanceAfter - receiverBalance)})`);
        
        console.log('\n✅ Test Completed Successfully! 🎉\n');
        
    } catch (error: any) {
        console.error('\n❌ Test Failed:', error.message);
        throw error;
    }
}

main().catch(console.error);
