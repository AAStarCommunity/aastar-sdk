import { createPublicClient, createWalletClient, http, parseEther, type Address } from 'viem';
import { sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { config } from 'dotenv';
import { 
    createCommunityClient, 
    createEndUserClient, 
    createOperatorClient,
    AAStarError 
} from '@aastar/sdk'; 

// Import constants from core or define them
import { 
    REGISTRY_ADDRESS, 
    SUPER_PAYMASTER_ADDRESS, 
    SBT_ADDRESS, 
    GTOKEN_ADDRESS 
} from '@aastar/core';

config({ path: '.env.sepolia' });

// Setup clients
const rpcUrl = process.env.SEPOLIA_RPC_URL || 'https://rpc.sepolia.org';
const privateKey = process.env.ADMIN_KEY as `0x${string}`; // Using Admin as main actor for demo
if (!privateKey) throw new Error('ADMIN_KEY not found in .env.sepolia');

const account = privateKeyToAccount(privateKey);
const publicClient = createPublicClient({ chain: sepolia, transport: http(rpcUrl) });
const walletClient = createWalletClient({ account, chain: sepolia, transport: http(rpcUrl) });

async function main() {
    console.log('🚀 L2 Business Clients Demo\n');
    console.log('='.repeat(60));
    console.log(`📍 Actor: ${account.address}`);
    console.log('='.repeat(60) + '\n');

    // ==========================================
    // 1. Initialize Clients (Using Factory Pattern)
    // Note: Factories now take transport/chain, not client instances directly.
    
    console.log('\n[2] Initializing SDK Clients...');
    
    // Community Client
    const communityClient = createCommunityClient({
        transport: http(rpcUrl),
        chain: sepolia, // or use defined chain
        account: account, // Community Admin
        addresses: {
            registry: REGISTRY_ADDRESS,
            sbt: SBT_ADDRESS
        }
    });

    try {
        console.log('   Checking Community Info...');
        // SDK v2 method: getCommunityInfo
        const info = await communityClient.getCommunityInfo(account.address);
        console.log('   Community Info:', info);
    } catch (e: any) {
        console.log('   (Community check skipped/failed)', e.message);
    }

    // User Client
    const userClient = createEndUserClient({
        transport: http(rpcUrl),
        chain: sepolia,
        account: account, // User Account
        addresses: {
            registry: REGISTRY_ADDRESS,
            sbt: SBT_ADDRESS
        }
    });

    try {
        const { accountAddress } = await userClient.createSmartAccount({ owner: account.address });
        console.log(`   AA Account Address: ${accountAddress}`);
        
        // Check Token Balance (Manual Read)
        // UserClient doesn't include TokenActions by default to keep it slim?
        // Let's use public client read
        /* 
        const bal = await userClient.readContract({
             address: GTOKEN_ADDRESS,
             abi: erc20Abi,
             functionName: 'balanceOf',
             args: [accountAddress]
        });
        console.log(`   GToken Balance: ${bal}`);
        */
        console.log(`  ℹ️  Transfer Intent: 0.01 GT to Random Address`);
        // await userClient.transferToken({ token: GTOKEN_ADDRESS, to: '0x...', amount: parseEther('0.01') });
    } catch (e: any) {
        console.log(`  ❌ User Ops Failed: ${e.message}`);
    }

    // ==========================================
    // 3. Operator Client Demo
    // ==========================================
    console.log('\n3️⃣ Paymaster Operator Client');
    const operatorClient = createOperatorClient({
        transport: http(rpcUrl),
        chain: sepolia,
        account: account,
        addresses: {
            registry: REGISTRY_ADDRESS,
            superPaymaster: SUPER_PAYMASTER_ADDRESS
        }
    });

    try {
        // const sbtBalance = await userClient.sbtBalanceOf(account.address); // Not directly on client in v0.17?
        // console.log(`  ✓ SBT Balance: ${sbtBalance}`);
        
        // const gtokenBalance = await userClient.tokenBalanceOf({ token: GTOKEN_ADDRESS, account: account.address }); // Missing
        // console.log(`  ✓ GToken Balance: ${gtokenBalance}`);
        const status = await operatorClient.getOperatorStatus(account.address);
        console.log('   Operator Status:', status);
        
        const deposit = await operatorClient.getDepositDetails();
        console.log('   SuperPaymaster Deposit:', deposit);
    } catch (e: any) {
        console.log(`  ❌ Operator Ops Failed: ${e.message}`);
    }

    // ==========================================
    // 4. Protocol Client Demo
    // ==========================================
    // Note: ProtocolClient might not have a dedicated factory yet, or logic is via AdminClient?
    // Using AdminClient for now as it covers protocol level actions
    console.log('\n4️⃣ Protocol Client (via AdminClient)');
    
    // const adminClient = createAdminClient({ ... });
    // console.log("  ℹ️ Protocol/Admin actions would go here");

    console.log('\n✅ L2 Demo Execution Finished!');
}

main().catch(console.error);
