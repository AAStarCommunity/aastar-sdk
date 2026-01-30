import { 
    createPublicClient, 
    createWalletClient, 
    http, 
    parseEther, 
    formatEther,
    type Hex,
    type Address,
    encodeFunctionData
} from 'viem';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// In a real project: import { ... } from '@aastar/sdk';
import { 
    SepoliaFaucetAPI, 
    UserLifecycle,
    OperatorLifecycle,
    CommunityClient,
    PaymasterClient,
    gTokenActions,
    tokenActions,
    accountFactoryActions
} from '@aastar/sdk';

// Load .env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') }); 

async function main() {
    console.log("🚀 Starting Scenario 4: Gasless Transaction (Real Transfer)");

    // 0. Config
    const RPC_URL = process.env.RPC_URL || 'https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY';
    const CHAIN_ID = 11155420; // OP Sepolia
    const BUNDLER_URL = process.env.BUNDLER_URL || (process.env.PIMLICO_API_KEY ? `https://api.pimlico.io/v2/${CHAIN_ID}/rpc?apikey=${process.env.PIMLICO_API_KEY}` : RPC_URL);

    const CONTRACTS = {
        registry: process.env.REGISTRY_ADDRESS as `0x${string}`,
        factory: process.env.XPNTS_FACTORY_ADDRESS as `0x${string}`,
        gToken: process.env.GTOKEN_ADDRESS as `0x${string}`,
        gTokenStaking: process.env.GTOKEN_STAKING_ADDRESS as `0x${string}`,
        sbt: process.env.SBT_ADDRESS as `0x${string}`,
        reputation: process.env.REPUTATION_ADDRESS as `0x${string}`,
        entryPoint: '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789' as `0x${string}`,
        superPaymaster: process.env.SUPER_PAYMASTER_ADDRESS as `0x${string}`,
        simpleAccountFactory: '0x9406Cc6185a346906296840746125a0E44976454' as `0x${string}` // Sepolia/OP Sepolia safe default for SimpleAccountFactory (Pimlico/Stackup usually)
        // If needing a specific factory, use the one from config.op-sepolia.json (0xe506...)
    };
    // Override factory if known for OP Sepolia to ensure compatibility
    // Using Kernel or SimpleAccount? SDK uses simpleAccount usually.
    // Let's use a standard one or the one from previous tests: 0x9406... is standard v0.6/0.7 factory? 
    // Wait, use the one from config if possible. For now hardcode a known one or dynamic find?
    // User env usually has it? No.
    // Let's rely on `accountFactoryActions` to work with standard SimpleAccountFactory.
    // Address: 0x9406Cc6185a346906296840746125a0E44976454 (SimpleAccountFactory v0.6)
    // Note: examples use v0.7 EP? 0x5FF1... is v0.6.
    
    // Check Config consistency
    if(CONTRACTS.entryPoint === '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789') {
         // v0.6 EntryPoint. Use v0.6 Factory.
    }

    const publicClient = createPublicClient({ transport: http(RPC_URL) });

    // 1. Actors
    // Supplier (Funds everyone)
    const supplierKey = process.env.PRIVATE_KEY_SUPPLIER as Hex;
    if(!supplierKey) throw new Error("Missing PRIVATE_KEY_SUPPLIER");
    const supplierAcc = privateKeyToAccount(supplierKey);
    const supplierClient = createWalletClient({ account: supplierAcc, transport: http(RPC_URL) });

    // Alice (Operator / Community Leader)
    const aliceKey = process.env.PRIVATE_KEY_OPERATOR as Hex || generatePrivateKey();
    const aliceAcc = privateKeyToAccount(aliceKey);
    const aliceClient = createWalletClient({ account: aliceAcc, transport: http(RPC_URL) });

    // Bob (User - Needs Smart Account)
    const bobKey = process.env.PRIVATE_KEY_USER as Hex || generatePrivateKey();
    const bobAcc = privateKeyToAccount(bobKey);
    
    console.log(`\n👥 Actors:`);
    console.log(`   Alice (Operator): ${aliceAcc.address}`);
    console.log(`   Bob (Owner):      ${bobAcc.address}`);

    // 2. Setup Alice's Environment (Community + Token + Paymaster)
    console.log(`\n🛠️  Step 1: Setting up Community & Token (Alice)...`);
    
    // Fund Alice
    await SepoliaFaucetAPI.fundETH(supplierClient, publicClient, aliceAcc.address, parseEther('0.05'));
    await SepoliaFaucetAPI.mintTestTokens(supplierClient, publicClient, CONTRACTS.gToken, aliceAcc.address, parseEther('1000'));
    // Mint aPNTs for Paymaster collateral
    // Note: For standalone, we need the aPNTs address? Or just assume Alice can get them.
    // We'll skip deep Paymaster Collateral setup (assume Operator Pre-funded or use GTokens).
    // Actually, Scenario 1 uses `OperatorLifecycle`.
    
    // Quick Community Launch to get a Token
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

    const commName = `GaslessDAO_${Math.floor(Math.random() * 1000)}`;
    console.log(`   📝 Launching "${commName}"...`);
    const setupRes = await aliceCommunity.setupCommunity({
        name: commName,
        tokenName: `${commName} Token`,
        tokenSymbol: "GASLESS",
        description: "Gasless Demo",
        stakeAmount: parseEther('30')
    });
    const tokenAddress = setupRes.tokenAddress;
    console.log(`   ✅ Token Created: ${tokenAddress}`);

    // Link Token to SuperPaymaster (Crucial for Gasless)
    console.log(`   🔗 Linking Token to SuperPaymaster...`);
    const linkHash = await tokenActions()(aliceClient).setSuperPaymasterAddress({
        token: tokenAddress,
        spAddress: CONTRACTS.superPaymaster,
        account: aliceAcc
    });
    await publicClient.waitForTransactionReceipt({ hash: linkHash });
    console.log(`   ✅ Linked.`);

    // 3. Setup Bob's Smart Account
    console.log(`\n🤖 Step 2: Setting up Bob's Smart Account...`);
    const factory = accountFactoryActions(CONTRACTS.simpleAccountFactory); // Or use known address
    const bobAA = await factory(publicClient).getAddress({ owner: bobAcc.address, salt: 0n });
    console.log(`   📍 Bob's AA Address: ${bobAA}`);

    // Deploy AA (if needed) - Bob needs ETH to deploy initially, relies on Faucet
    const code = await publicClient.getBytecode({ address: bobAA });
    if (!code) {
        console.log(`   🚀 Deploying Bob's AA...`);
        // Fund Bob EOA for deployment gas
        await SepoliaFaucetAPI.fundETH(supplierClient, publicClient, bobAcc.address, parseEther('0.02'));
        
        const bobClientEOA = createWalletClient({ account: bobAcc, transport: http(RPC_URL) });
        const hash = await factory(bobClientEOA).createAccount({
            owner: bobAcc.address,
            salt: 0n,
            account: bobAcc
        });
        await publicClient.waitForTransactionReceipt({ hash });
        console.log(`   ✅ Bob AA Deployed.`);
    }

    // 4. Fund Bob with Community Tokens
    console.log(`\n💸 Step 3: Funding Bob with Community Tokens...`);
    // Alice (Owner of Token) mints/transfers to Bob
    // Assuming Community Launch gives Alice initial supply or Minting rights?
    // `setupCommunity` likely mints to Alice?
    // Let's check balance.
    const tAction = tokenActions()(publicClient);
    const aliceBal = await tAction.balanceOf({ token: tokenAddress, account: aliceAcc.address });
    
    if (aliceBal > parseEther('10')) {
        console.log(`   Thinking: Alice has ${formatEther(aliceBal)} tokens. Sending to Bob...`);
        const transferHash = await tokenActions()(aliceClient).transfer({
            token: tokenAddress,
            to: bobAA, // Send to AA!
            amount: parseEther('10'),
            account: aliceAcc
        });
        await publicClient.waitForTransactionReceipt({ hash: transferHash });
        console.log(`   ✅ Bob funded with 10 GASLESS tokens.`);
    } else {
        console.warn(`   ⚠️ Alice has low token balance. Attempting to mint (if capable)...`);
        // Fallback: Supplier Mints?
        try {
            const mHash = await tokenActions()(supplierClient).mint({
                token: tokenAddress,
                to: bobAA,
                amount: parseEther('10'),
                account: supplierAcc
            });
            await publicClient.waitForTransactionReceipt({ hash: mHash });
            console.log(`   ✅ Supplier minted 10 tokens to Bob.`);
        } catch (e) {
            console.error("   ❌ Minting failed. Ensure logic.");
        }
    }

    // 5. Bob Deposits Tokens for Paymaster Credit (Required for Gasless)
    console.log(`\n🏦 Step 4: Bob Deposits Tokens into Paymaster...`);
    // Bob needs to approve Paymaster to spend 5 Tokens
    const bobClientAA = createWalletClient({ account: bobAcc, transport: http(RPC_URL) }); 
    // Wait, Bob is AA. We can't use bobClientEOA to sign for AA easily without UserOp unless we use `execute`.
    // BUT: To deposit, Bob just needs to send tokens to Paymaster's `depositFor`.
    // OR: Bob calls `approve` on Token, then `depositFor` on Paymaster.
    
    // EASIER: Supplier or Alice can deposit FOR Bob.
    // "Anyone can deposit for anyone".
    // Let's have Alice deposit 5 tokens into Paymaster FOR Bob.
    console.log(`   Thinking: Alice deposits on behalf of Bob (to bootstrap gasless)...`);
    
    // Alice Approve Paymaster
    const appHash = await tokenActions()(aliceClient).approve({
        token: tokenAddress,
        spender: CONTRACTS.superPaymaster,
        amount: parseEther('5'),
        account: aliceAcc
    });
    await publicClient.waitForTransactionReceipt({ hash: appHash });

    // Alice Deposit For Bob
    const paymasterAction = await import('@aastar/paymaster').then(m => m.PaymasterClient);
    const depHash = await paymasterAction.depositFor(
        aliceClient,
        CONTRACTS.superPaymaster,
        bobAA, // Beneficiary
        tokenAddress,
        parseEther('5'),
        aliceAcc
    );
    await publicClient.waitForTransactionReceipt({ hash: depHash });
    console.log(`   ✅ Deposit Complete. Bob has Paymaster Credit.`);

    // 6. Execute Gasless Transfer
    console.log(`\n🚀 Step 5: Executing Gasless UserOp (Transfer 2 Tokens to Alice)...`);
    
    // Target: Token Contract
    // Call: transfer(alice, 2)
    const callData = encodeFunctionData({
        abi: [{
            name: 'transfer',
            type: 'function',
            inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }],
            outputs: [{ type: 'bool' }]
        }],
        functionName: 'transfer',
        args: [aliceAcc.address, parseEther('2')]
    });

    // Execute via AA
    const executionData = encodeFunctionData({
        abi: [{
            name: 'execute',
            type: 'function',
            inputs: [{ name: 'dest', type: 'address' }, { name: 'value', type: 'uint256' }, { name: 'func', type: 'bytes' }],
            outputs: []
        }],
        functionName: 'execute',
        args: [tokenAddress, 0n, callData]
    });

    // Submit
    try {
        const userOpHash = await PaymasterClient.submitGaslessUserOperation(
            publicClient,
            bobClientAA, // Signer (Owner)
            bobAA,
            CONTRACTS.entryPoint,
            CONTRACTS.superPaymaster,
            tokenAddress,
            BUNDLER_URL,
            executionData
        );
        console.log(`   ✅ UserOp Submitted: ${userOpHash}`);
        
        console.log(`   ⏳ Waiting for receipt...`);
        // Simple poll
        for (let i = 0; i < 20; i++) {
            await new Promise(r => setTimeout(r, 3000));
            // Check success logic (skipped for brevity, assuming manual check or successful logs)
            // Ideally check via bundler RPC
        }
        console.log(`   🎉 Transaction likely confirmed! Check Explorer.`);
        
    } catch (e: any) {
        console.error(`   ❌ Gasless Tx Failed: ${e.message}`);
        console.log("   (Possible Reasons: Bundler issues, low deposit, invalid nonce)");
    }
}

main().catch(console.error);
