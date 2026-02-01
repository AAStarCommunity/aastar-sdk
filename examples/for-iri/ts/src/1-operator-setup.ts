import { 
    createPublicClient, 
    createWalletClient, 
    http, 
    parseEther, 
    type Hex
} from 'viem';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import { 
    SepoliaFaucetAPI, 
    OperatorLifecycle
} from '@aastar/sdk';

// Load .env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') }); 

async function main() {
    console.log("🚀 Starting Scenario 1: Standard Operator Setup");

    // 0. Config
    const RPC_URL = process.env.RPC_URL || 'https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY';
    
    const CONTRACTS = {
        registry: process.env.REGISTRY_ADDRESS as `0x${string}`,
        gToken: process.env.GTOKEN_ADDRESS as `0x${string}`,
        superPaymaster: process.env.SUPER_PAYMASTER_ADDRESS as `0x${string}`,
        entryPoint: '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789' as `0x${string}`,
        paymasterFactory: '0x0000000000000000000000000000000000000000' as `0x${string}`,
        priceFeed: process.env.PRICE_FEED_ADDRESS as `0x${string}` 
    };

    const publicClient = createPublicClient({ transport: http(RPC_URL) });

    // 1. Actors
    const supplierKey = process.env.PRIVATE_KEY_SUPPLIER as Hex;
    if (!supplierKey) throw new Error("Missing PRIVATE_KEY_SUPPLIER");
    const supplierAccount = privateKeyToAccount(supplierKey);
    const supplierClient = createWalletClient({ account: supplierAccount, transport: http(RPC_URL) });

    const operatorKey = process.env.PRIVATE_KEY_OPERATOR as Hex || generatePrivateKey();
    const operatorAccount = privateKeyToAccount(operatorKey);
    const operatorClient = createWalletClient({ account: operatorAccount, transport: http(RPC_URL) });

    console.log(`\n👥 Operator: ${operatorAccount.address}`);

    // 2. Fund Operator
    console.log(`\n🚰 Step 1: Funding Operator...`);
    await SepoliaFaucetAPI.fundETH(supplierClient, publicClient, operatorAccount.address, parseEther('0.05'));
    await SepoliaFaucetAPI.mintTestTokens(supplierClient, publicClient, CONTRACTS.gToken, operatorAccount.address, parseEther('1000'));

    // 3. Operator Lifecycle
    console.log(`\n⚙️  Step 2: Setup Operator Node...`);
    
    const operatorLifecycle = new OperatorLifecycle({
        client: operatorClient,
        publicClient,
        superPaymasterAddress: CONTRACTS.superPaymaster,
        gTokenAddress: CONTRACTS.gToken,
        gTokenStakingAddress: process.env.GTOKEN_STAKING_ADDRESS as `0x${string}`,
        registryAddress: CONTRACTS.registry,
        entryPointAddress: CONTRACTS.entryPoint,
        paymasterFactoryAddress: CONTRACTS.paymasterFactory,
        ethUsdPriceFeedAddress: CONTRACTS.priceFeed
    });

    try {
        // Full Setup in one go
        console.log("   📝 Registering & Staking...");
        const hashes = await operatorLifecycle.setupNode({
            type: 'SUPER',
            stakeAmount: parseEther('50'),
            depositAmount: parseEther('100') // Also deposit for gas immediately
        });
        console.log(`   ✅ Setup Hashes:`, hashes);
        
        // Configure (Self-Treasury, generic rate)
        // Note: Real operators usually link a specific Token first.
        // For this basic demo, we skip token link unless we create one.
        // Assuming we rely on Default or existing token if any.
        // Or simply skip configure if no token is created.
        console.log("   (Skipping explicit 'configureOperator' as no new Token created in this scenario)");

    } catch (e: any) {
        console.log(`   ℹ️  Setup info: ${e.message}`);
    }

    console.log("\n🎉 Standard Operator Setup Complete!");
}

main().catch(console.error);
