import { 
    createPublicClient, 
    createWalletClient, 
    http, 
    parseEther, 
    formatEther, 
    type Hex
} from 'viem';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// In a real project, use: import { SepoliaFaucetAPI, OperatorLifecycle, ... } from '@aastar/sdk';
// For local monorepo testing, we rely on tsconfig paths or relative imports if needed.
// Here we assume running from root with path mapping or linked package.
import { 
    SepoliaFaucetAPI, 
    OperatorLifecycle,
    type OperatorConfig
} from '@aastar/sdk';

// Load .env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') }); // Load local .env

async function main() {
    console.log("🚀 Starting Scenario 1: Operator Setup & Token Airdrop");

    // 0. Config
    const RPC_URL = process.env.RPC_URL || 'https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY';
    const CHAIN_ID = 11155111; // Sepolia
    
    // Core Contracts (Sepolia Defaults - Replace with env vars in prod)
    const CONTRACTS = {
        registry: process.env.REGISTRY_ADDRESS as `0x${string}` || '0x...', 
        gToken: process.env.GTOKEN_ADDRESS as `0x${string}` || '0x...',
        superPaymaster: process.env.SUPER_PAYMASTER_ADDRESS as `0x${string}` || '0x...',
        entryPoint: '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789' as `0x${string}`,
        paymasterFactory: '0x0000000000000000000000000000000000000000' as `0x${string}`, // Not used in this scenario
        priceFeed: '0x694AA1769357215DE4FAC081bf1f309aDC325306' as `0x${string}` // ETH/USD
    };

    // Clients
    const publicClient = createPublicClient({
        transport: http(RPC_URL)
    });

    // 1. Actors
    // Supplier (Faucet Admin) - Required to fund the Operator
    const supplierKey = process.env.PRIVATE_KEY_SUPPLIER as Hex;
    if (!supplierKey) throw new Error("Missing PRIVATE_KEY_SUPPLIER in .env");
    const supplierAccount = privateKeyToAccount(supplierKey);
    const supplierClient = createWalletClient({
        account: supplierAccount,
        transport: http(RPC_URL)
    });

    // Operator (New or Existing)
    const operatorKey = process.env.PRIVATE_KEY_OPERATOR as Hex || generatePrivateKey();
    const operatorAccount = privateKeyToAccount(operatorKey);
    const operatorClient = createWalletClient({
        account: operatorAccount,
        transport: http(RPC_URL)
    });

    console.log(`\n👥 Actors:`);
    console.log(`   Faucet Admin: ${supplierAccount.address}`);
    console.log(`   Operator:     ${operatorAccount.address}`);

    // 2. Faucet: Fund Operator (Airdrop)
    console.log(`\n🚰 Step 1: Faucet Funding...`);
    
    // Fund ETH
    await SepoliaFaucetAPI.fundETH(
        supplierClient, 
        publicClient, 
        operatorAccount.address, 
        parseEther('0.05')
    );

    // Mint GTokens (Gas Tokens)
    if (CONTRACTS.gToken && CONTRACTS.gToken !== '0x...') {
        await SepoliaFaucetAPI.mintTestTokens(
            supplierClient,
            publicClient,
            CONTRACTS.gToken,
            operatorAccount.address,
            parseEther('1000')
        );
    } else {
        console.warn("   ⚠️ GToken address not configured, skipping GToken mint.");
    }

    // 3. Operator Lifecycle: Setup Node
    console.log(`\n⚙️  Step 2: Setup Operator Node...`);
    
    const operatorLifecycle = new OperatorLifecycle({
        client: operatorClient,
        publicClient,
        superPaymasterAddress: CONTRACTS.superPaymaster,
        gTokenAddress: CONTRACTS.gToken,
        registryAddress: CONTRACTS.registry,
        entryPointAddress: CONTRACTS.entryPoint,
        gTokenStakingAddress: process.env.GTOKEN_STAKING_ADDRESS as `0x${string}`,
        ethUsdPriceFeedAddress: CONTRACTS.priceFeed
    });

    // Register as SuperPaymaster Operator
    try {
        console.log("   📝 Registering as SuperPaymaster Operator...");
        // This handles stake approval and registration
        const hashes = await operatorLifecycle.setupNode({
            type: 'SUPER',
            stakeAmount: parseEther('50'), // 50 GTokens Stake
            depositAmount: parseEther('0') // Initial deposit
        });
        console.log(`   ✅ Setup Transactions:`, hashes);
    } catch (e: any) {
        console.log(`   ℹ️  Setup info: ${e.message}`);
    }

    // 4. Update Price (DVT Mock)
    // In a real scenario, this keeps the Oracle fresh
    console.log(`\n🔄 Step 3: Update Price Feed (DVT Mock)...`);
    // Note: This usually requires a specific DVT signer role. 
    // For demo, we assume Supplier might have rights or skip if not generic.
    // implementation skipped for brevity/permission assumptions
    console.log("   (Skipped in generic demo - requires DVT Signer key)");

    console.log("\n🎉 Operator Setup Complete!");
    console.log(`   Keys for .env: PRIVATE_KEY=${operatorKey}`);
}

main().catch(console.error);
