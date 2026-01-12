import { createPublicClient, createWalletClient, http, parseEther, type Address } from 'viem';
import { sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { config } from 'dotenv';
import { 
    CommunityClient, 
    UserClient, 
    PaymasterOperatorClient, 
    ProtocolClient,
} from '@aastar/sdk'; // Should export from main package eventually, but now maybe from individual packages?
// Currently monorepo packages are: @aastar/core, @aastar/enduser, @aastar/operator.
// We need to import from them directly or ensure @aastar/sdk aggregates them.
// Let's assume we import from packages directly for now to test internal linking.

import { 
    REGISTRY_ADDRESS, 
    SUPER_PAYMASTER_ADDRESS, 
    MYSBT_ADDRESS, 
    GTOKEN_ADDRESS 
} from '@aastar/core';

// Correct imports based on package structure
import { CommunityClient as CommunityClientImpl, UserClient as UserClientImpl } from '@aastar/enduser';
import { PaymasterOperatorClient as OperatorClientImpl, ProtocolClient as ProtocolClientImpl } from '@aastar/operator';

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
    const communityClient = new CommunityClientImpl({
        client: walletClient,
        publicClient: publicClient,
        registryAddress: REGISTRY_ADDRESS,
        sbtAddress: MYSBT_ADDRESS,
        // factoryAddress: ... (Optional for this demo if we don't deploy token)
    });

    try {
        const txHash = await communityClient.registerAsCommunity();
        console.log(`  ✓ Register as Community TX: ${txHash}`);
        // Note: For real demo we'd wait for receipt, but here we just show API works
    } catch (e: any) {
        console.log(`  ⚠️  Register checks: ${e.message.split('\n')[0]}`);
    }

    // ==========================================
    // 2. User Client Demo (using same account as user for simplicity)
    // ==========================================
    console.log('\n2️⃣ User Client');
    const userClient = new UserClientImpl({
        client: walletClient,
        publicClient: publicClient,
        accountAddress: account.address, // Acting as the AA account for read ops (conceptually) or owner
        sbtAddress: MYSBT_ADDRESS,
        registryAddress: REGISTRY_ADDRESS
    });

    try {
        const sbtBalance = await userClient.getSBTBalance();
        console.log(`  ✓ SBT Balance: ${sbtBalance}`);
        
        const gtokenBalance = await userClient.getTokenBalance(GTOKEN_ADDRESS);
        console.log(`  ✓ GToken Balance: ${gtokenBalance}`);

        // Demo Transfer (Gas Estimate implicitly via L1 action or execution)
        // Here we just print the code intent
        console.log(`  ℹ️  Transfer Intent: 0.01 GT to Random Address`);
        // await userClient.transferToken(GTOKEN_ADDRESS, '0x...', parseEther('0.01'));
    } catch (e: any) {
        console.log(`  ❌ User Ops Failed: ${e.message}`);
    }

    // ==========================================
    // 3. Operator Client Demo
    // ==========================================
    console.log('\n3️⃣ Paymaster Operator Client');
    const operatorClient = new OperatorClientImpl({
        client: walletClient,
        publicClient: publicClient,
        superPaymasterAddress: SUPER_PAYMASTER_ADDRESS,
        registryAddress: REGISTRY_ADDRESS
    });

    try {
        const depositInfo = await operatorClient.getDepositDetails();
        console.log(`  ✓ Paymaster Deposit: ${depositInfo.deposit}`);
        
        // Deposit Demo
        // await operatorClient.deposit(parseEther('0.001'));
    } catch (e: any) {
        console.log(`  ❌ Operator Ops Failed: ${e.message}`);
    }

    // ==========================================
    // 4. Protocol Client Demo
    // ==========================================
    console.log('\n4️⃣ Protocol Client (Infra)');
    // Assuming DVT address is known or we use a placeholder for compilation check
    const DVT_PLACEHOLDER = '0x0000000000000000000000000000000000000000'; 
    const protocolClient = new ProtocolClientImpl({
        client: walletClient,
        publicClient: publicClient,
        dvtValidatorAddress: DVT_PLACEHOLDER, 
        registryAddress: REGISTRY_ADDRESS
    });

    try {
        console.log(`  ℹ️  Initialized Protocol Client for DVT: ${DVT_PLACEHOLDER}`);
        // Validating API existence
        // await protocolClient.createProposal(...);
    } catch (e: any) {
        console.log(`  ❌ Protocol Ops Failed: ${e.message}`);
    }

    console.log('\n✅ L2 Demo Execution Finished!');
}

main().catch(console.error);
