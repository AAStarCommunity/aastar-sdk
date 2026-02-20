// Test 2: Paymaster V4 Gasless Transaction - Transfer using deposited bPNTs
import { createPublicClient, createWalletClient, http, parseEther, formatEther, encodeFunctionData, type Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import {  sepolia } from 'viem/chains';
import { paymasterActions, tokenActions } from '../packages/core/src/index.js';
import { UserOperationBuilder } from '../packages/sdk/dist/utils/userOp.js';
import { loadNetworkConfig } from '../tests/regression/config.js';
import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.resolve(process.cwd(), '.env.sepolia') });

async function main() {
    const config = loadNetworkConfig('sepolia');
    const publicClient = createPublicClient({ chain: sepolia, transport: http(config.rpcUrl) });

    // Load state from l4-state.json
    const statePath = path.resolve(process.cwd(), 'scripts/l4-state.json');
    const state = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
    
    // Bob's AA and Paymaster
    const bobAAInfo = state.aaAccounts.find((aa: any) => aa.label === 'Bob (Bread)_AA1')!;
    const bobAA = bobAAInfo.address as Address;
    const bobEOA = bobAAInfo.owner as Address;
    const bobPaymaster = state.operators.bob.paymasterV4 as Address;
    const bPNTs = state.operators.bob.tokenAddress as Address;
    
    // Bob's private key (owner of AA)
    const bobKey = process.env.PRIVATE_KEY_BOB as `0x${string}`;
    const bob = privateKeyToAccount(bobKey);
    
    console.log('📦 Test 2: Paymaster V4 Gasless Transaction\n');
    console.log(`AA Account: ${bobAA}`);
    console.log(`Paymaster V4: ${bobPaymaster}`);
    console.log(`Gas Token: bPNTs (${bPNTs})\n`);
    
    // Step 1: Verify deposited balance
    const pmV4 = paymasterActions(bobPaymaster);
    const depositedBalance = await pmV4(publicClient).balances({ user: bobAA, token: bPNTs });
    console.log(`Step 1: Verifying deposited balance...`);
    console.log(`   Deposited Balance: ${formatEther(depositedBalance)} bPNTs`);
    
    if (depositedBalance === 0n) {
        throw new Error('No deposited balance! Run l4-test-pmv4-deposit.ts first');
    }
    
    // Step 2: Construct UserOp for a simple dPNT transfer
    console.log(`\nStep 2: Constructing gasless UserOp...`);
    
    const dPNTs = state.operators.anni.tokenAddress as Address; // Use Anni's token as test recipient token
    const transferAmount = parseEther('2');
    const recipient = bobEOA; // Send to Bob's EOA
    
    // Encode ERC20 transfer calldata
    const transferCalldata = encodeFunctionData({
        abi: [{
            name: 'transfer',
            type: 'function',
            inputs: [
                { name: 'to', type: 'address' },
                { name: 'amount', type: 'uint256' }
            ],
            outputs: [{ type: 'bool' }],
            stateMutability: 'nonpayable'
        }],
        functionName: 'transfer',
        args: [recipient, transferAmount]
    });
    
    // Build UserOp
    const builder = new UserOperationBuilder(
        config.contracts.entryPoint as Address,
        publicClient,
        sepolia.id
    );
    
    const nonce = await publicClient.readContract({
        address: bobAA,
        abi: [{
            name: 'getNonce',
            type: 'function',
            inputs: [],
            outputs: [{ type: 'uint256' }],
            stateMutability: 'view'
        }],
        functionName: 'getNonce'
    });
    
    // Pack paymasterAndData: [paymaster(20)][validUntil(6)][validAfter(6)][token(20)]
    const currentTimestamp = BigInt(Math.floor(Date.now() / 1000));
    const paymasterAndData = UserOperationBuilder.packPaymasterV4DepositData(
        bobPaymaster,
        currentTimestamp + 3600n, // validUntil: 1 hour from now
        currentTimestamp - 60n,    // validAfter: 1 minute ago
        bPNTs   // payment token at offset 52
    );
    
    const userOp = {
        sender: bobAA,
        nonce,
        initCode: '0x' as `0x${string}`, // Empty for already deployed AA
        callData: encodeFunctionData({
            abi: [{
                name: 'execute',
                type: 'function',
                inputs: [
                    { name: 'dest', type: 'address' },
                    { name: 'value', type: 'uint256' },
                    { name: 'func', type: 'bytes' }
                ],
                outputs: [],
                stateMutability: 'nonpayable'
            }],
            functionName: 'execute',
            args: [dPNTs, 0n, transferCalldata]
        }),
        accountGasLimits: UserOperationBuilder.packAccountGasLimits(200000n, 200000n),
        preVerificationGas: 0n,
        gasFees: UserOperationBuilder.packGasFees(1n, 1n),
        paymasterAndData,
        signature: (`0x${'11'.repeat(65)}`) as `0x${string}`
    };

    const pvg1 = (UserOperationBuilder.estimatePreVerificationGasV07({ ...userOp, preVerificationGas: 0n }) * 120n) / 100n + 5000n;
    userOp.preVerificationGas = (UserOperationBuilder.estimatePreVerificationGasV07({ ...userOp, preVerificationGas: pvg1 }) * 120n) / 100n + 5000n;
    
    console.log(`   UserOp constructed`);
    console.log(`   - Sender: ${userOp.sender}`);
    console.log(`   - Nonce: ${userOp.nonce}`);
    console.log(`   - Paymaster: ${bobPaymaster}`);
    console.log(`   - Payment Token: ${bPNTs} (at offset 52)`);
    console.log(`   - paymasterAndData length: ${paymasterAndData.length} bytes`);
    
    // Step 3: Get UserOp hash and sign
    console.log(`\nStep 3: Signing UserOp...`);
    
    // Create a copy of userOp with empty signature for hash calculation
    const userOpForHash = { ...userOp, signature: '0x' as `0x${string}` };
    
    const userOpHash = await UserOperationBuilder.getUserOpHash({
        userOp: userOpForHash,
        entryPoint: config.contracts.entryPoint as Address,
        chainId: sepolia.id,
        publicClient
    });
    console.log(`   UserOp Hash: ${userOpHash}`);
    
    const signature = await bob.signMessage({ message: { raw: userOpHash } });
    userOp.signature = signature;
    console.log(`   Signature: ${signature.slice(0, 20)}...`);
    
    // Step 4: Convert to Alchemy format and display
    console.log(`\nStep 4: UserOp ready for submission`);
    const alchemyUserOp = UserOperationBuilder.toAlchemyUserOperation(userOp);
    
    console.log(`\n✅ Test 2 Complete!`);
    console.log(`\nSummary:`);
    console.log(`   - AA user ${bobAA} constructed gasless UserOp`);
    console.log(`   - Transfer 2 dPNTs to ${recipient}`);
    console.log(`   - Uses deposited ${formatEther(depositedBalance)} bPNTs for gas payment`);
    console.log(`   - No SBT required (Deposit-Only model)`);
    console.log(`\nNext Step: Submit to Bundler via eth_sendUserOperation`);
    console.log(JSON.stringify(alchemyUserOp, (key, value) => 
        typeof value === 'bigint' ? value.toString() : value
    , 2));
}

main().catch(console.error);
