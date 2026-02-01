import { 
    createPublicClient, 
    createWalletClient, 
    http, 
    parseEther, 
    formatEther,
    type Hex,
    encodeFunctionData
} from 'viem';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import { 
    SepoliaFaucetAPI, 
    UserLifecycle,
    CommunityClient,
    OperatorLifecycle,
    gTokenActions
} from '@aastar/sdk';

// Load .env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') }); 

async function main() {
    console.log("🚀 Starting Scenario 4: Gasless Transaction (Standard API)");

    // 0. Config
    const RPC_URL = process.env.RPC_URL || 'https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY';
    const CHAIN_ID = 11155420; // OP Sepolia
    const BUNDLER_URL = process.env.BUNDLER_URL || (process.env.PIMLICO_API_KEY ? `https://api.pimlico.io/v2/${CHAIN_ID}/rpc?apikey=${process.env.PIMLICO_API_KEY}` : RPC_URL);

    // Contracts (Loaded from env)
    const CONTRACTS = {
        registry: process.env.REGISTRY_ADDRESS as `0x${string}`,
        factory: process.env.XPNTS_FACTORY_ADDRESS as `0x${string}`,
        gToken: process.env.GTOKEN_ADDRESS as `0x${string}`,
        gTokenStaking: process.env.GTOKEN_STAKING_ADDRESS as `0x${string}`,
        sbt: process.env.SBT_ADDRESS as `0x${string}`,
        reputation: process.env.REPUTATION_ADDRESS as `0x${string}`,
        entryPoint: '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789' as `0x${string}`,
        superPaymaster: process.env.SUPER_PAYMASTER_ADDRESS as `0x${string}`,
        paymasterFactory: process.env.PAYMASTER_FACTORY_ADDRESS as `0x${string}` || '0x0000000000000000000000000000000000000000',
        priceFeed: process.env.PRICE_FEED_ADDRESS as `0x${string}` || '0x0000000000000000000000000000000000000000',
        simpleAccountFactory: '0x9406Cc6185a346906296840746125a0E44976454' as `0x${string}`
    };

    const publicClient = createPublicClient({ transport: http(RPC_URL) });

    // 1. Actors
    const supplierKey = process.env.PRIVATE_KEY_SUPPLIER as Hex;
    if(!supplierKey) throw new Error("Missing PRIVATE_KEY_SUPPLIER");
    const supplierAcc = privateKeyToAccount(supplierKey);
    const supplierClient = createWalletClient({ account: supplierAcc, transport: http(RPC_URL) });

    const aliceKey = process.env.PRIVATE_KEY_OPERATOR as Hex || generatePrivateKey();
    const aliceAcc = privateKeyToAccount(aliceKey);
    const aliceClient = createWalletClient({ account: aliceAcc, transport: http(RPC_URL) });

    const bobKey = process.env.PRIVATE_KEY_USER as Hex || generatePrivateKey();
    const bobAcc = privateKeyToAccount(bobKey);
    const bobClient = createWalletClient({ account: bobAcc, transport: http(RPC_URL) });
    
    console.log(`\n👥 Actors:`);
    console.log(`   Alice (Operator): ${aliceAcc.address}`);
    console.log(`   Bob (End User):   ${bobAcc.address}`);

    // 2. Setup Alice (Community & Operator)
    console.log(`\n🛠️  Step 1: Setting up Community & Operator (Alice)...`);
    
    // Fund Alice
    await SepoliaFaucetAPI.fundETH(supplierClient, publicClient, aliceAcc.address, parseEther('0.1'));
    await SepoliaFaucetAPI.mintTestTokens(supplierClient, publicClient, CONTRACTS.gToken, aliceAcc.address, parseEther('1000'));
    
    // Launch Community
    const aliceCommunity = new CommunityClient({
        client: aliceClient,
        publicClient,
        registryAddress: CONTRACTS.registry,
        factoryAddress: CONTRACTS.factory,
        gTokenAddress: CONTRACTS.gToken,
        gTokenStakingAddress: CONTRACTS.gTokenStaking,
        sbtAddress: CONTRACTS.sbt,
        reputationAddress: CONTRACTS.reputation
    });

    const commName = `GaslessDAO-${Math.floor(Math.random() * 1000)}`;
    const setupRes = await aliceCommunity.setupCommunity({
        name: commName,
        tokenName: "GaslessToken",
        tokenSymbol: "GASLESS",
        stakeAmount: parseEther('30')
    });
    console.log(`   ✅ Community Launched: ${setupRes.tokenAddress}`);

    // Register as Operator (The right way)
    const aliceOperator = new OperatorLifecycle({
        client: aliceClient,
        publicClient,
        superPaymasterAddress: CONTRACTS.superPaymaster,
        gTokenAddress: CONTRACTS.gToken,
        registryAddress: CONTRACTS.registry,
        entryPointAddress: CONTRACTS.entryPoint,
        gTokenStakingAddress: CONTRACTS.gTokenStaking,
        paymasterFactoryAddress: CONTRACTS.paymasterFactory,
        ethUsdPriceFeedAddress: CONTRACTS.priceFeed,
        xpntsFactoryAddress: CONTRACTS.factory
    });

    console.log("   ⚙️  Configuring Operator Node...");
    await aliceOperator.setupNode({
        type: 'SUPER',
        stakeAmount: parseEther('50'), 
        depositAmount: parseEther('100') // Pre-deposit 100 GT for gas
    });
    // Configure to accept the new token
    await aliceOperator.configureOperator(setupRes.tokenAddress, aliceAcc.address, parseEther('1'));
    console.log("   ✅ Operator Ready.");

    // 3. Setup Bob (User)
    console.log(`\n🤖 Step 2: Setting up User (Bob)...`);
    const { accountFactoryActions } = await import('@aastar/sdk');
    const factory = accountFactoryActions(CONTRACTS.simpleAccountFactory);
    const bobAA = await factory(publicClient).getAddress({ owner: bobAcc.address, salt: 0n });
    console.log(`   📍 Bob's AA: ${bobAA}`);

    // Deploy AA
    const code = await publicClient.getBytecode({ address: bobAA });
    if (!code) {
        await SepoliaFaucetAPI.fundETH(supplierClient, publicClient, bobAcc.address, parseEther('0.02'));
        const h = await factory(createWalletClient({ account: bobAcc, transport: http(RPC_URL) })).createAccount({
            owner: bobAcc.address, salt: 0n, account: bobAcc
        });
        await publicClient.waitForTransactionReceipt({ hash: h });
        console.log(`   ✅ Bob AA Deployed.`);
    }

    // Initialize UserLifecycle
    const bobUser = new UserLifecycle({
        client: bobClient, // Signer
        publicClient,
        accountAddress: bobAA, // AA
        registryAddress: CONTRACTS.registry,
        sbtAddress: CONTRACTS.sbt,
        gTokenAddress: CONTRACTS.gToken,
        gTokenStakingAddress: CONTRACTS.gTokenStaking,
        entryPointAddress: CONTRACTS.entryPoint,
        gasless: {
            paymasterUrl: CONTRACTS.superPaymaster, // Or Bundler PIMLICO handling
            policy: 'CREDIT'
        }
    });

    // Inject bundler client for gasless
    (bobUser.config as any).bundlerClient = createWalletClient({ 
         account: bobAcc, 
         chain: undefined,
         transport: http(BUNDLER_URL) 
    });

    // 4. Onboard
    console.log(`\n📝 Step 3: Bob Onboarding...`);
    // Need GToken for staking (0.4)
    await SepoliaFaucetAPI.mintTestTokens(supplierClient, publicClient, CONTRACTS.gToken, bobAA, parseEther('10'));
    
    // UserLifecycle.onboard handles Approve + Stake + MintSBT
    const onboardRes = await bobUser.onboard(aliceAcc.address, parseEther('0.4'));
    console.log(`   ✅ Onboard Result: ${onboardRes.success}, Hash: ${onboardRes.txHash}`);

    // 5. Gasless Transfer
    console.log(`\n🚀 Step 4: Executing Gasless Transfer...`);
    
    // Transfer 2 GTokens to Alice
    const callData = encodeFunctionData({
        abi: [{ name: 'transfer', type: 'function', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [] }],
        functionName: 'transfer',
        args: [aliceAcc.address, parseEther('2')]
    });

    try {
        const txHash = await bobUser.executeGaslessTx({
            target: CONTRACTS.gToken,
            value: 0n,
            data: callData,
            operator: aliceAcc.address
        });
        console.log(`   ✅ Gasless Tx Hash: ${txHash}`);
        
        // Wait for receipt 
        // (Note: executeGaslessTx returns UserOp hash usually, wait logic depends on implementation)
        // If it returns a hash, we can verify via bundler or generic wait.
        console.log(`   ⏳ Waiting for confirmation...`);
        // Just a simple timeout or check balance for demo
        await new Promise(r => setTimeout(r, 5000));
        
        const bal = await gTokenActions()(publicClient).balanceOf({ token: CONTRACTS.gToken, account: aliceAcc.address });
        console.log(`   📊 Alice Balance check: ${formatEther(bal)}`);
        
    } catch (e: any) {
        console.warn(`   ⚠️ Gasless failed: ${e.message}`);
    }

    console.log("\n🎉 Scenario 4 Complete!");
}

main().catch(console.error);
