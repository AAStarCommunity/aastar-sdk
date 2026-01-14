import * as dotenv from 'dotenv';
import * as path from 'path';
import { http, parseEther, formatEther, type Hex, type Address, createClient } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { bundlerActions } from 'viem/account-abstraction';
import { sepolia } from 'viem/chains';
import { SepoliaFaucetAPI } from '../packages/core/src/actions/index.js';

// 1. Dynamic Env Loading
dotenv.config({ path: '.env.sepolia' });

async function main() {
    process.stdout.write('🌟 Starting Faucet + SuperPaymaster Verification (Refactored SDK Edition)...\n');

    // 2. Dynamically import SDK to ensure ENV vars are picked up correctly
    const { 
        createAdminClient, 
        createEndUserClient, 
        CORE_ADDRESSES,
        SuperPaymasterClient,
        parseKey 
    } = await import('../packages/sdk/src/index.ts');

    const rpcUrl = process.env.RPC_URL || 'https://eth-sepolia.g.alchemy.com/v2/your-key';
    const bundlerUrl = process.env.BUNDLER_URL!;

    // 3. Setup Admins
    const supplierPk = process.env.PRIVATE_KEY_SUPPLIER as `0x${string}`;
    if (!supplierPk) throw new Error("No Supplier Private Key found");
    const supplierAccount = privateKeyToAccount(supplierPk);
    
    const faucetPk = (process.env.PRIVATE_KEY_ANNI || process.env.PRIVATE_KEY) as `0x${string}`;
    if (!faucetPk) throw new Error("No Faucet Admin Private Key found");
    const adminAccount = privateKeyToAccount(faucetPk); 

    // Create Admin Client (Supplier)
    const admin = createAdminClient({ 
        chain: sepolia,
        transport: http(rpcUrl), 
        account: supplierAccount 
    });

    console.log(`👨‍✈️ Supplier (Funds): ${supplierAccount.address}`);
    console.log(`👩‍✈️ Faucet Admin (Perms): ${adminAccount.address}`);

    // Check Faucet Admin Balance and Fund if needed
    const adminBal = await admin.getBalance({ address: adminAccount.address });
    if (adminBal < parseEther('0.1')) {
        console.log(`   ⚠️ Faucet Admin low on ETH (${formatEther(adminBal)}). Funding from Supplier...`);
        const hash = await admin.sendTransaction({
            to: adminAccount.address,
            value: parseEther('0.1')
        });
        await admin.waitForTransactionReceipt({ hash });
        console.log(`   ✅ Funded Faucet Admin. Tx: ${hash}`);
    } else {
        console.log(`   ✅ Faucet Admin has sufficient ETH (${formatEther(adminBal)}).`);
    }

    // 4. Identity Setup (User-provided AA or Freshly Generated)
    const testAA = process.env.TEST_SIMPLE_ACCOUNT_A as Address;
    let aaAddress: Address;
    let newUserAccount: any;
    
    if (testAA) {
        console.log(`🤖 Using User-Provided AA Account: ${testAA}`);
        aaAddress = testAA;
        // If we use an existing AA, we need its owner's PK to sign UserOps
        const userPk = process.env.PRIVATE_KEY_USER as `0x${string}`;
        if (!userPk) throw new Error("PRIVATE_KEY_USER required to sign for TEST_SIMPLE_ACCOUNT_A");
        newUserAccount = privateKeyToAccount(userPk);
    } else {
        const newPk = generatePrivateKey();
        newUserAccount = privateKeyToAccount(newPk);
        console.log(`👤 Generated Fresh User EOA: ${newUserAccount.address}`);
    }

    // Create EndUser Client (User)
    const user = createEndUserClient({
        chain: sepolia,
        transport: http(rpcUrl),
        account: newUserAccount,
        addresses: {
            simpleAccountFactory: (process.env.SIMPLE_ACCOUNT_FACTORY || process.env["SimpleAccountFactoryv0.7"]) as Address
        }
    });

    if (!testAA) {
        // Predict AA Address for fresh generation
        const { accountAddress: predicted } = await user.createSmartAccount({
            owner: newUserAccount.address,
            salt: 0n
        });
        aaAddress = predicted;
        console.log(`🤖 Predicted AA Address: ${aaAddress}`);

        // Pre-deploy smart account using Supplier's ETH (matches l4-setup behavior for reliability)
        console.log(`🏭 Pre-deploying Smart Account...`);
        const deployer = createEndUserClient({
            chain: sepolia,
            transport: http(rpcUrl),
            account: supplierAccount,
            addresses: {
                simpleAccountFactory: (process.env.SIMPLE_ACCOUNT_FACTORY || process.env["SimpleAccountFactoryv0.7"]) as Address
            }
        });
        
        const { deployTxHash } = await deployer.deploySmartAccount({
            owner: newUserAccount.address,
            salt: 0n
        });
        console.log(`   ✅ Account Deployed. Tx: ${deployTxHash}`);
    }

    // 5. 🚰 Faucet Preparation
    console.log('\n--- 🚰 Running SepoliaFaucetAPI ---');
    
    // Using faucetPk for WalletClient in prepareTestAccount (needs Mint permissions)
    const adminWalletForFaucet = createAdminClient({ 
        chain: sepolia,
        transport: http(rpcUrl),
        account: adminAccount 
    });

    await SepoliaFaucetAPI.prepareTestAccount(adminWalletForFaucet, admin, {
        targetAA: aaAddress,
        token: CORE_ADDRESSES.aPNTs, 
        registry: CORE_ADDRESSES.registry,
        superPaymaster: CORE_ADDRESSES.superPaymaster,
        ethAmount: parseEther('0.02'),
        community: adminAccount.address 
    });

    // 6. Submit Gasless Transaction
    console.log('\n--- 🚀 Submitting Gasless Transaction ---');
    
    try {
        const userOpHash = await SuperPaymasterClient.submitGaslessTransaction(
            admin, 
            user,  
            aaAddress,
            CORE_ADDRESSES.entryPoint as Address,
            bundlerUrl,
            {
                token: CORE_ADDRESSES.aPNTs as Address,
                recipient: adminAccount.address, 
                amount: parseEther('1'),
                operator: adminAccount.address, 
                paymasterAddress: CORE_ADDRESSES.superPaymaster as Address,
                autoEstimate: true // Ensure fresh estimation
            }
        );

        console.log(`✅ UserOp Hash: ${userOpHash}`);
        
        const bundlerClient = createClient({
            chain: sepolia,
            transport: http(bundlerUrl)
        }).extend(bundlerActions);

        console.log('⏳ Waiting for execution...');
        const receipt = await bundlerClient.waitForUserOperationReceipt({ hash: userOpHash });
        console.log(`🎉 Success! Tx: https://sepolia.etherscan.io/tx/${receipt.receipt.transactionHash}`);
    } catch (e: any) {
        console.error('❌ Gasless UserOp Failed:', e.message || e);
        if (e.data) console.error('   Debug Data:', JSON.stringify(e.data));
    }
}

main().catch(console.error);
