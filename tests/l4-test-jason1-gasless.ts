import { createPublicClient, createWalletClient, http, parseEther, formatEther, type Address, encodeFunctionData, createClient, concat, type Hex, decodeErrorResult } from 'viem';
import { bundlerActions } from 'viem/account-abstraction';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { PaymasterClient, PaymasterOperator } from '../packages/paymaster/src/V4/index.js';
import { loadNetworkConfig } from './regression/config.js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.sepolia' });

async function main() {
    const config = await loadNetworkConfig('sepolia');
    const rpcUrl = process.env.RPC_URL || 'https://eth-sepolia.g.alchemy.com/v2/your-key';
    
    // 1. Roles & Accounts
    const anniAccount = privateKeyToAccount(process.env.PRIVATE_KEY_ANNI as `0x${string}`);
    const jasonAccount = privateKeyToAccount(process.env.PRIVATE_KEY_JASON as `0x${string}`);
    
    const publicClient = createPublicClient({ chain: sepolia, transport: http(rpcUrl) });
    const anniWallet = createWalletClient({ account: anniAccount, chain: sepolia, transport: http(rpcUrl) });

    const entryPoint = config.contracts.entryPoint as Address;

    // Resolve Addresses dynamically from Config
    const anniPM = config.contracts.paymasterV4Impl as Address;
    const dPNTs = config.contracts.aPNTs as Address; 
    
    // Calculate AA Address (Don't hardcode)
    const simpleAccountFactory = config.contracts.simpleAccountFactory;
    const jasonAA1 = await getAccountAddress(publicClient, entryPoint, simpleAccountFactory, jasonAccount.address, 0n);

    console.log('🚀 [FINAL VERIFICATION] JASON AA1 Gasless via ANNI PM');
    console.log(`Sender (Jason AA1): ${jasonAA1}`);
    console.log(`Sponsor (Anni PM): ${anniPM} (from config)`);
    console.log(`Gas Token: ${dPNTs} (from config)\n`);


    // --- STEP 1: ONE-CLICK READINESS & Fix ---
    console.log('🔍 Step 1: SDK Readiness Check...');
    const report = await PaymasterOperator.checkGaslessReadiness(
        publicClient,
        entryPoint,
        anniPM,
        jasonAA1,
        dPNTs
    );

    if (!report.isReady) {
        console.log('   ⚠️ Issues Detected:', report.issues.join(', '));
        console.log('\n🛠️ Step 2: Automated Self-Healing (Operator Action)...');
        const steps = await PaymasterOperator.prepareGaslessEnvironment(
            anniWallet,
            publicClient,
            entryPoint,
            anniPM,
            dPNTs,
            { tokenPriceUSD: 100000000n } // $1.00
        );

        for (const s of steps) {
            console.log(`      🚀 [${s.step}] Fixed. Hash: ${s.hash}`);
            await publicClient.waitForTransactionReceipt({ hash: s.hash as `0x${string}` });
        }
    } else {
        console.log('   ✅ SDK Readiness Check: PERFECT.');
    }

    // --- STEP 3: USER DEPOSIT ---
    const userDeposit = await PaymasterClient.getDepositedBalance(publicClient, anniPM, jasonAA1, dPNTs);
    if (userDeposit < parseEther('50')) {
        console.log(`\n🏦 Seeding User Deposit (Current: ${formatEther(userDeposit)} dPNTs)...`);
        
        const approveHash = await anniWallet.writeContract({
            address: dPNTs,
            abi: [{ name: 'approve', type: 'function', inputs: [{ name: 'spender', type: 'address' }, { name: 'value', type: 'uint256' }], outputs: [{ type: 'bool' }], stateMutability: 'nonpayable' }],
            functionName: 'approve',
            args: [anniPM, parseEther('200')]
        });
        await publicClient.waitForTransactionReceipt({ hash: approveHash });

        // User deposit action is usually done by Client, but funded by Operator in this script
        const depHash = await PaymasterClient.depositFor(anniWallet, anniPM, jasonAA1, dPNTs, parseEther('100'));
        await publicClient.waitForTransactionReceipt({ hash: depHash as `0x${string}` });
        console.log('   ✅ User deposit seeded (100 dPNTs).');
    }

    // --- STEP 4: GASLESS EXECUTION ---
    console.log('\n📤 Step 4: Submitting Gasless Transaction...');
    const transferCalldata = encodeFunctionData({
        abi: [{ name: 'execute', type: 'function', inputs: [{ name: 'dest', type: 'address' }, { name: 'value', type: 'uint256' }, { name: 'func', type: 'bytes' }], outputs: [], stateMutability: 'nonpayable' }],
        functionName: 'execute',
        args: [
            dPNTs, 
            0n, 
            encodeFunctionData({
                abi: [{ name: 'transfer', type: 'function', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }], stateMutability: 'nonpayable' }],
                functionName: 'transfer',
                args: [anniAccount.address, parseEther('0.1')] // Tiny transfer back
            })
        ]
    });

    const jasonWallet = createWalletClient({ account: jasonAccount, chain: sepolia, transport: http(rpcUrl) });

    const userOpHash = await PaymasterClient.submitGaslessUserOperation(
        publicClient,
        jasonWallet,
        jasonAA1,
        entryPoint,
        anniPM,
        dPNTs,
        process.env.BUNDLER_URL!,
        transferCalldata
    );

    console.log(`   ✅ UserOp Hash: ${userOpHash}`);
    console.log('   ⏳ Waiting for block confirmation...');

    // Polling for receipt using Bundler Client
    const bundlerClient = createPublicClient({ 
        chain: sepolia, 
        transport: http(process.env.BUNDLER_URL!) 
    }).extend(bundlerActions);

    console.log('   ⏳ Waiting for execution (can take up to 60s)...');
    try {
        const receipt = await bundlerClient.waitForUserOperationReceipt({ 
            hash: userOpHash,
            timeout: 120000 // 2 minutes timeout
        });
        
        console.log(`\n🎉 SUCCESS! Transaction confirmed: ${receipt.receipt.transactionHash}`);
        console.log(`🔗 Etherscan: https://sepolia.etherscan.io/tx/${receipt.receipt.transactionHash}`);
    } catch (e) {
        console.log('\n⌛ Still pending or timed out... check on jiffyscan later.');
        console.error(e);
    }
}

main().catch(console.error);

async function getAccountAddress(
    client: any, 
    entryPoint: Address, 
    factory: Address, 
    owner: Address, 
    salt: bigint
): Promise<Address> {
    const initCode = concat([
        factory,
        encodeFunctionData({
            abi: [{ name: 'createAccount', type: 'function', inputs: [{ name: 'owner', type: 'address' }, { name: 'salt', type: 'uint256' }], outputs: [{ type: 'address' }], stateMutability: 'nonpayable' }],
            functionName: 'createAccount',
            args: [owner, salt]
        })
    ]);

    try {
        await client.call({
            to: entryPoint,
            data: encodeFunctionData({
                abi: [{ name: 'getSenderAddress', type: 'function', inputs: [{ name: 'initCode', type: 'bytes' }], outputs: [], stateMutability: 'nonpayable' }],
                functionName: 'getSenderAddress',
                args: [initCode]
            })
        });
    } catch (e: any) {
        const error = decodeErrorResult({
            abi: [{ name: 'SenderAddressResult', type: 'error', inputs: [{ name: 'sender', type: 'address' }] }],
            data: e.data || e.cause?.data || e.response?.data
        });
        return error.args[0] as Address;
    }
    return '0x' as Address; // Should not reach here
}
