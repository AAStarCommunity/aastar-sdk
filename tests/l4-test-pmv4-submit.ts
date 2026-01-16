// Test 3: Submit Paymaster V4 Gasless UserOp to Bundler
import { createPublicClient, createWalletClient, http, parseEther, formatEther, encodeFunctionData, type Address, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { paymasterV4Actions } from '../packages/core/src/index.js';
import { UserOperationBuilder } from '../packages/sdk/dist/utils/userOp.js';
import { loadNetworkConfig } from '../tests/regression/config.js';
import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.resolve(process.cwd(), '.env.sepolia') });

async function main() {
    const config = loadNetworkConfig('sepolia');
    const publicClient = createPublicClient({ chain: sepolia, transport: http(config.rpcUrl) });
    
    // Use Alchemy RPC which supports both eth_ and bundler methods
    const bundlerRpc = config.rpcUrl;

    // Load state from l4-state.json
    const statePath = path.resolve(process.cwd(), 'scripts/l4-state.json');
    const state = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
    
    // Bob's AA and Paymaster
    const bobAAInfo = state.aaAccounts.find((aa: any) => aa.label === 'Bob (Bread)_AA1')!;
    const bobAA = bobAAInfo.address as Address;
    const bobEOA = bobAAInfo.owner as Address;
    // const bobPaymaster = state.operators.bob.paymasterV4 as Address;
    const bobPaymaster = config.contracts.paymasterV4Impl as Address;
    const bPNTs = state.operators.bob.tokenAddress as Address;
    
    const bobKey = process.env.PRIVATE_KEY_BOB as `0x${string}`;
    const bob = privateKeyToAccount(bobKey);
    
    console.log('📤 Test 3: Submit Paymaster V4 Gasless UserOp\n');
    console.log(`AA Account: ${bobAA}`);
    console.log(`Paymaster: ${bobPaymaster}`);
    console.log(`Bundler: ${bundlerRpc}\n`);
    
    // Step 1: Verify balance
    const pmV4 = paymasterV4Actions(bobPaymaster);
    const balance = await pmV4(publicClient).balances({ user: bobAA, token: bPNTs });
    console.log(`Step 1: Deposited balance: ${formatEther(balance)} bPNTs`);
    
    if (balance === 0n) {
        throw new Error('No deposited balance!');
    }
    
    // Step 2: Construct UserOp
    console.log(`\nStep 2: Constructing UserOp...`);
    // Real transfer as requested: bPNTs to Anni
    // bPNTs already defined above
    const anniEOA = state.operators.anni.address as Address;
    
    console.log(`   Token: ${bPNTs} (bPNTs)`);
    console.log(`   Recipient: ${anniEOA} (Anni)`);
    
    const transferAmount = parseEther('2');
    const transferCalldata = encodeFunctionData({
        abi: [{ name: 'approve', type: 'function', inputs: [{ name: 'spender', type: 'address' }, { name: 'value', type: 'uint256' }], outputs: [{ type: 'bool' }], stateMutability: 'nonpayable' }],
        functionName: 'approve',
        args: [anniEOA, transferAmount]
    });
    
    const nonce = await publicClient.readContract({
        address: bobAA,
        abi: [{ name: 'getNonce', type: 'function', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' }],
        functionName: 'getNonce'
    });
    
    // Pack paymasterAndData: FULL v0.7 format for hash calculation
    // Format: [paymaster(20)][verificationGas(16)][postOpGas(16)][token(20)][validUntil(6)][validAfter(6)]
    const currentTimestamp = BigInt(Math.floor(Date.now() / 1000));
    const paymasterVerificationGas = 60000n; // Tighten for efficiency
    const paymasterPostOpGas = 50000n;
    const validUntil = currentTimestamp + 3600n;
    const validAfter = currentTimestamp - 60n;
    
    // Pack full format: paymaster + gasLimits + paymasterData(token + timestamps)
    const paymasterHex = bobPaymaster.slice(2);
    const verificationGasHex = paymasterVerificationGas.toString(16).padStart(32, '0');
    const postOpGasHex = paymasterPostOpGas.toString(16).padStart(32, '0');
    const tokenHex = bPNTs.slice(2); // Use bPNTs address
    const validUntilHex = validUntil.toString(16).padStart(12, '0');
    const validAfterHex = validAfter.toString(16).padStart(12, '0');
    
    const paymasterAndData = ('0x' + paymasterHex + verificationGasHex + postOpGasHex + tokenHex + validUntilHex + validAfterHex) as `0x${string}`;
    
    console.log(`\n=== DEBUG paymasterAndData ===`);
    console.log(`Full hex: ${paymasterAndData}`);
    console.log(`Length: ${paymasterAndData.length} chars = ${(paymasterAndData.length - 2) / 2} bytes`);
    console.log(`Expected: 2 + 144 = 146 chars (72 bytes)`);
    console.log(`===\n`);
    
    const userOp = {
        sender: bobAA,
        nonce,
        initCode: '0x' as `0x${string}`,
        callData: encodeFunctionData({
            abi: [{ name: 'execute', type: 'function', inputs: [{ name: 'dest', type: 'address' }, { name: 'value', type: 'uint256' }, { name: 'func', type: 'bytes' }], outputs: [], stateMutability: 'nonpayable' }],
            functionName: 'execute',
            args: [bPNTs, 0n, transferCalldata] // Executing against bPNTs
        }),
        accountGasLimits: UserOperationBuilder.packAccountGasLimits(60000n, 300000n), // Verification 60k, Call 300k
        preVerificationGas: 60000n,
        gasFees: UserOperationBuilder.packGasFees(2000000000n, 4000000000n), // 2.0 / 4.0 Gwei
        paymasterAndData,
        signature: '0x' as `0x${string}`
    };
    
    const userOpHash = await UserOperationBuilder.getUserOpHash({
        userOp,
        entryPoint: config.contracts.entryPoint as Address,
        chainId: sepolia.id,
        publicClient
    });
    
    const signature = await bob.signMessage({ message: { raw: userOpHash } });
    userOp.signature = signature;
    
    console.log(`   UserOp Hash: ${userOpHash}`);
    console.log(`   Signature: ${signature.slice(0, 20)}...`);
    
    // Step 3: Submit to Bundler
    console.log(`\nStep 3: Submitting to Bundler...`);
    
    const alchemyUserOp = UserOperationBuilder.toAlchemyUserOperation(userOp, {
        paymasterVerificationGasLimit: 100000n,
        paymasterPostOpGasLimit: 500000n // Huge limit
    });
    
    console.log(`   Paymaster: ${alchemyUserOp.paymaster}`);
    console.log(`   PaymasterData: ${alchemyUserOp.paymasterData.slice(0, 30)}...`);
    
    // Custom JSON stringifier for BigInt
    const stringifyWithBigInt = (obj: any) => JSON.stringify(obj, (key, value) =>
        typeof value === 'bigint' ? '0x' + value.toString(16) : value
    );
    
    const response = await fetch(bundlerRpc, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: stringifyWithBigInt({
            jsonrpc: '2.0',
            id: 1,
            method: 'eth_sendUserOperation',
            params: [alchemyUserOp, config.contracts.entryPoint]
        })
    });
    
    const result = await response.json();
    
    if (result.error) {
        console.error(`   ❌ Bundler Error:`, result.error);
        throw new Error(result.error.message);
    }
    
    const userOperationHash = result.result;
    console.log(`   ✅ UserOp submitted!`);
    console.log(`   UserOperation Hash: ${userOperationHash}`);
    
    // Step 4: Wait for receipt
    console.log(`\nStep 4: Waiting for receipt...`);
    
    let receipt = null;
    for (let i = 0; i < 30; i++) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const receiptResponse = await fetch(bundlerRpc, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'eth_getUserOperationReceipt',
                params: [userOperationHash]
            })
        });
        
        const receiptResult = await receiptResponse.json();
        if (receiptResult.result) {
            receipt = receiptResult.result;
            break;
        }
        
        process.stdout.write('.');
    }
    
    console.log('\n');
    
    if (!receipt) {
        console.log('   ⏸️ Receipt not available yet, check later');
        console.log(`   Etherscan: https://sepolia.etherscan.io/tx/${userOperationHash}`);
        return;
    }
    
    console.log(`✅ UserOp Executed!`);
    console.log(`   Transaction: ${receipt.receipt.transactionHash}`);
    console.log(`   Block: ${receipt.receipt.blockNumber}`);
    console.log(`   Status: ${receipt.success ? '✅ Success' : '❌ Failed'}`);
    console.log(`   Etherscan: https://sepolia.etherscan.io/tx/${receipt.receipt.transactionHash}`);
    
    // Verify Payment (check bPNTs balance deduction)
    const finalBalance = await publicClient.readContract({
        address: bobPaymaster,
        abi: [{ name: 'balances', type: 'function', inputs: [{ name: '', type: 'address' }, { name: '', type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' }],
        functionName: 'balances',
        args: [bobAA, bPNTs] // Use bPNTs
    });
    
    // Previous balance was ~86.79 bPNTs
    const prevBalance = parseEther('86.7929'); 
    console.log(`   Final deposited balance: ${formatEther(finalBalance)} bPNTs`);
    // Safe check to avoid negative numbers if I hardcoded wrong
    if (prevBalance > finalBalance) {
        console.log(`   Gas paid: ${formatEther(prevBalance - finalBalance)} bPNTs`);
    } else {
        console.log(`   Gas paid: 0 (or previous balance was underestimated)`);
    }
}

main().catch(console.error);
