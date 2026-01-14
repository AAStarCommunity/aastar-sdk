import { createPublicClient, createWalletClient, http, parseEther, type Address } from 'viem';
import { sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { config } from 'dotenv';
import { 
    createCommunityClient, 
    // Protocol Client creation might be direct or via generic client with actions
} from '@aastar/sdk'; 

// Import constants from core or define them
import { 
    REGISTRY_ADDRESS, 
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
    // 1. Community Client Demo
    // ==========================================
    console.log('1️⃣ Community Client');
    const communityClient = createCommunityClient({
        walletClient: walletClient, // Note: factory uses 'walletClient' prop
        publicClient: publicClient,
        registryAddress: REGISTRY_ADDRESS,
        sbtAddress: SBT_ADDRESS,
    });

    try {
        const txHash = await communityClient.registerAsCommunity("TestCommunity");
        console.log(`  ✓ Register as Community TX: ${txHash}`);
    } catch (e: any) {
        console.log(`  ⚠️  Register checks: ${e.message.split('\n')[0]}`);
    }

    // ==========================================
    // 2. User Client Demo
    // ==========================================
    console.log('\n2️⃣ User Client');
    const userClient = createUserClient({
        walletClient: walletClient,
        publicClient: publicClient,
        accountAddress: account.address, 
        sbtAddress: SBT_ADDRESS,
        registryAddress: REGISTRY_ADDRESS
    });

    try {
        const sbtBalance = await userClient.sbtBalanceOf(account.address);
        console.log(`  ✓ SBT Balance: ${sbtBalance}`);
        
        const gtokenBalance = await userClient.tokenBalanceOf({ token: GTOKEN_ADDRESS, account: account.address });
        console.log(`  ✓ GToken Balance: ${gtokenBalance}`);

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
        walletClient: walletClient,
        publicClient: publicClient,
        superPaymasterAddress: SUPER_PAYMASTER_ADDRESS,
        registryAddress: REGISTRY_ADDRESS
    });

    try {
        const depositInfo = await operatorClient.superPaymasterGetDeposit(operatorClient.account!.address);
        console.log(`  ✓ Paymaster Deposit: ${depositInfo}`);
        
        // await operatorClient.superPaymasterDeposit(parseEther('0.001'));
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
