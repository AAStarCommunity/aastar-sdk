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
    CommunityClient,
    UserLifecycle 
} from '@aastar/sdk';

// Load .env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') }); 

async function main() {
    console.log("🚀 Starting Scenario 2: Community & User Registration");

    const RPC_URL = process.env.RPC_URL || 'https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY';
    const CONTRACTS = {
        registry: process.env.REGISTRY_ADDRESS as `0x${string}`,
        factory: process.env.XPNTS_FACTORY_ADDRESS as `0x${string}`, // xPNTs Factory
        gToken: process.env.GTOKEN_ADDRESS as `0x${string}`,
        gTokenStaking: process.env.GTOKEN_STAKING_ADDRESS as `0x${string}`,
        sbt: process.env.SBT_ADDRESS as `0x${string}`,
        reputation: process.env.REPUTATION_ADDRESS as `0x${string}`,
        entryPoint: '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789' as `0x${string}`
    };

    const publicClient = createPublicClient({ transport: http(RPC_URL) });

    // 1. Actors
    const supplierKey = process.env.PRIVATE_KEY_SUPPLIER as Hex;
    if (!supplierKey) throw new Error("Missing PRIVATE_KEY_SUPPLIER");
    const supplierClient = createWalletClient({ 
        account: privateKeyToAccount(supplierKey), 
        transport: http(RPC_URL) 
    });

    // Community Leader (Alice) - Use Operator Key for consistency or generate
    const aliceKey = process.env.PRIVATE_KEY_OPERATOR as Hex || generatePrivateKey();
    const aliceAccount = privateKeyToAccount(aliceKey);
    const aliceClient = createWalletClient({ account: aliceAccount, transport: http(RPC_URL) });

    // End User (Bob) - Use User Key
    const bobKey = process.env.PRIVATE_KEY_USER as Hex || generatePrivateKey();
    const bobAccount = privateKeyToAccount(bobKey);
    const bobClient = createWalletClient({ account: bobAccount, transport: http(RPC_URL) });

    console.log(`\n👥 Actors:`);
    console.log(`   Community Leader (Alice): ${aliceAccount.address}`);
    console.log(`   End User (Bob):           ${bobAccount.address}`);

    // 2. Fund Alice and Bob (Using Faucet)
    console.log(`\n🚰 Funding Actors...`);
    await SepoliaFaucetAPI.fundETH(supplierClient, publicClient, aliceAccount.address, parseEther('0.05'));
    await SepoliaFaucetAPI.mintTestTokens(supplierClient, publicClient, CONTRACTS.gToken, aliceAccount.address, parseEther('1000'));
    
    await SepoliaFaucetAPI.fundETH(supplierClient, publicClient, bobAccount.address, parseEther('0.02'));
    await SepoliaFaucetAPI.mintTestTokens(supplierClient, publicClient, CONTRACTS.gToken, bobAccount.address, parseEther('100'));

    // 3. Create Community (Alice)
    console.log(`\njb Start Community Creation...`);
    const communityClient = new CommunityClient({
        client: aliceClient,
        publicClient,
        registryAddress: CONTRACTS.registry,
        factoryAddress: CONTRACTS.factory,
        gTokenAddress: CONTRACTS.gToken,
        gTokenStakingAddress: CONTRACTS.gTokenStaking,
        sbtAddress: CONTRACTS.sbt,
        reputationAddress: CONTRACTS.reputation
    });

    const commName = `DemoDAO_${Math.floor(Math.random() * 1000)}`;
    console.log(`   📝 Registering "${commName}"...`);
    const setupRes = await communityClient.setupCommunity({
        name: commName,
        tokenName: `${commName} Token`,
        tokenSymbol: "DEMO",
        description: "A Demo Community",
        stakeAmount: parseEther('30') // Stake 30 GTokens
    });
    console.log(`   ✅ Community Created! Token: ${setupRes.tokenAddress}`);


    // 4. User Registration (Bob joining Alice's Community)
    console.log(`\n📝 User Registration (Bob -> AliceDAO)...`);
    
    // Note: In a real app, Bob uses AA, but here we use EOA for simplicity of registration demonstration
    // If using AA, need to deploy AA first (omitted for brevity, see l4-setup or complete demo)
    const userLifecycle = new UserLifecycle({
        client: bobClient,
        publicClient,
        accountAddress: bobAccount.address, // EOA acting as Account
        registryAddress: CONTRACTS.registry,
        sbtAddress: CONTRACTS.sbt,
        gTokenAddress: CONTRACTS.gToken,
        gTokenStakingAddress: CONTRACTS.gTokenStaking
    });

    // Check Eligibility
    const isEligible = await userLifecycle.checkEligibility(aliceAccount.address);
    console.log(`   🧐 Bob eligible to join? ${isEligible}`);

    if (isEligible) {
        const onboardRes = await userLifecycle.onboard(
            aliceAccount.address, // Community Address (Alice)
            parseEther('0.4') // Stake Amount
        );
        console.log(`   ✅ Onboard Tx: ${onboardRes.txHash}`);
    } else {
        console.log("   ❌ Not eligible (already member?)");
    }

    console.log("\n🎉 Scenario 2 Complete!");
}

main().catch(console.error);
