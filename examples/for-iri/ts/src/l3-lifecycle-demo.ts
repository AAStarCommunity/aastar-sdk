import {
    createPublicClient,
    createWalletClient,
    http,
    parseEther,
    formatEther,
    type Address,
    type Hex,
} from 'viem';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

import { 
    UserLifecycle, 
    OperatorLifecycle, 
    CommunityClient,
    SuperPaymasterClient
} from '@aastar/sdk';

// Load .env from the examples root
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

/**
 * L3 Complete Lifecycle Demo
 * 
 * This demo walk through the complete lifecycle of the AAstar Protocol:
 * 1. Community Setup (Alice)
 * 2. Operator Onboarding (Alice)
 * 3. User Onboarding (Bob)
 * 4. Gasless Transaction (Bob sponsored by Alice)
 * 5. Lifecycle Exit (Bob & Alice)
 */

async function main() {
    console.log("🚀 Starting AAstar L3 Complete Lifecycle Demo...");

    const RPC_URL = process.env.RPC_URL || 'https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY';
    const BUNDLER_URL = process.env.BUNDLER_URL || RPC_URL;
    
    // Contract addresses should be set in your .env file
    const CONTRACTS = {
        registry: process.env.REGISTRY_ADDRESS as Hex,
        superPaymaster: process.env.SUPER_PAYMASTER_ADDRESS as Hex,
        gToken: process.env.GTOKEN_ADDRESS as Hex,
        gTokenStaking: process.env.GTOKEN_STAKING_ADDRESS as Hex,
        sbt: process.env.SBT_ADDRESS as Hex,
        reputation: process.env.REPUTATION_ADDRESS as Hex,
        xPNTsFactory: process.env.XPNTS_FACTORY_ADDRESS as Hex,
        paymasterFactory: process.env.PAYMASTER_FACTORY_ADDRESS as Hex,
        entryPoint: (process.env.ENTRY_POINT_ADDRESS || '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789') as Hex,
        priceFeed: process.env.PRICE_FEED_ADDRESS as Hex,
        aPNTs: process.env.APNTS_TOKEN_ADDRESS as Hex,
    };

    const publicClient = createPublicClient({ transport: http(RPC_URL) });

    // 1. Actors Setup
    // Alice (Community Leader & Operator)
    const aliceKey = process.env.PRIVATE_KEY_OPERATOR as Hex || generatePrivateKey();
    const aliceAcc = privateKeyToAccount(aliceKey);
    const aliceClient = createWalletClient({ account: aliceAcc, transport: http(RPC_URL) });

    // Bob (End User)
    const bobKey = process.env.PRIVATE_KEY_USER as Hex || generatePrivateKey();
    const bobAcc = privateKeyToAccount(bobKey);
    const bobClient = createWalletClient({ account: bobAcc, transport: http(RPC_URL) });

    console.log(`\n👥 Actors:`);
    console.log(`   Alice (Operator): ${aliceAcc.address}`);
    console.log(`   Bob (End User):   ${bobAcc.address}`);

    // ==========================================
    // STEP 1: ALICE LAUNCHES COMMUNITY
    // ==========================================
    console.log(`\n🔹 Step 1: Alice Launching Community...`);
    const aliceCommunity = new CommunityClient({
        client: aliceClient,
        publicClient,
        registryAddress: CONTRACTS.registry,
        factoryAddress: CONTRACTS.xPNTsFactory,
        gTokenAddress: CONTRACTS.gToken,
        gTokenStakingAddress: CONTRACTS.gTokenStaking,
        sbtAddress: CONTRACTS.sbt,
        reputationAddress: CONTRACTS.reputation
    });

    const communityName = `TutorialDAO_${Math.floor(Math.random() * 1000)}`;
    const setupRes = await aliceCommunity.setupCommunity({
        name: communityName,
        tokenName: `${communityName} Token`,
        tokenSymbol: "TUT",
        description: "A Tutorial Community",
        stakeAmount: parseEther('30')
    });
    console.log(`   ✅ Community Created! xPNTs Token: ${setupRes.tokenAddress}`);

    // ==========================================
    // STEP 2: ALICE ONBOARDS AS OPERATOR
    // ==========================================
    console.log(`\n🔹 Step 2: Alice Onboarding as SuperPaymaster Operator...`);
    const aliceOperator = new OperatorLifecycle({
        client: aliceClient,
        publicClient,
        superPaymasterAddress: CONTRACTS.superPaymaster,
        gTokenAddress: CONTRACTS.gToken,
        gTokenStakingAddress: CONTRACTS.gTokenStaking,
        registryAddress: CONTRACTS.registry,
        entryPointAddress: CONTRACTS.entryPoint,
        paymasterFactoryAddress: CONTRACTS.paymasterFactory,
        ethUsdPriceFeedAddress: CONTRACTS.priceFeed,
        xpntsFactoryAddress: CONTRACTS.xPNTsFactory
    });

    // One-click setup for Operator
    // This handles: Stake GToken + Register Role + Deposit aPNTs (if configured)
    await aliceOperator.setupNode({
        type: 'SUPER',
        stakeAmount: parseEther('50'),
        depositAmount: parseEther('100') // Deposit initial gas pool
    });
    
    // Configure which token to accept and where to send profits
    await aliceOperator.configureOperator(
        setupRes.tokenAddress, // The xPNTs token Alice just created
        aliceAcc.address,      // Treasury address
        parseEther('1')        // Exchange rate
    );
    console.log(`   ✅ Alice is now a SuperPaymaster Operator!`);

    // ==========================================
    // STEP 3: BOB ONBOARDS TO COMMUNITY
    // ==========================================
    console.log(`\n🔹 Step 3: Bob Onboarding to ${communityName}...`);
    const bobL3 = new UserLifecycle({
        client: bobClient,
        publicClient,
        accountAddress: bobAcc.address, // For this demo, Bob uses EOA
        registryAddress: CONTRACTS.registry,
        sbtAddress: CONTRACTS.sbt,
        gTokenAddress: CONTRACTS.gToken,
        gTokenStakingAddress: CONTRACTS.gTokenStaking,
        entryPointAddress: CONTRACTS.entryPoint
    });

    const canJoin = await bobL3.checkEligibility(aliceAcc.address);
    if (canJoin) {
        const onboardRes = await bobL3.onboard(aliceAcc.address, parseEther('0.4'));
        console.log(`   ✅ Bob Joined! SBT Minted. Tx: ${onboardRes.txHash}`);
    }

    // ==========================================
    // STEP 4: BOB EXECUTES GASLESS TRANSACTION
    // ==========================================
    console.log(`\n🔹 Step 4: Bob Executing Gasless Transaction (Sponsored by Alice)...`);
    
    try {
        const userOpHash = await SuperPaymasterClient.submitGaslessTransaction(
            publicClient,
            bobClient,
            bobAcc.address, // In production, this would be Bob's AA address
            CONTRACTS.entryPoint,
            BUNDLER_URL,
            {
                token: CONTRACTS.gToken,
                recipient: aliceAcc.address,
                amount: parseEther('0.1'),
                operator: aliceAcc.address, // Alice sponsors this!
                paymasterAddress: CONTRACTS.superPaymaster
            }
        );
        console.log(`   ✅ Gasless UserOp Submitted! Hash: ${userOpHash}`);
    } catch (e: any) {
        console.warn(`   ⚠️ Gasless Tx failed (this requires a working Bundler): ${e.message}`);
    }

    // ==========================================
    // STEP 5: EXIT PHASE
    // ==========================================
    console.log(`\n🔹 Step 5: Exit Phase...`);
    
    // Bob leaves community
    const leaveTx = await bobL3.leaveCommunity(aliceAcc.address);
    console.log(`   👋 Bob left community. Tx: ${leaveTx}`);

    // Alice withdraws and exits (subject to protocol lock duration)
    try {
        const exitTxs = await aliceOperator.withdrawAllFunds();
        console.log(`   🏦 Alice initiated exit. Txs: ${exitTxs.join(', ')}`);
    } catch (e: any) {
        console.log(`   ℹ️ Alice exit locked or pending: ${e.message}`);
    }

    console.log("\n🎉 Demo Complete!");
}

main().catch(console.error);
