
import { 
    createPublicClient, 
    createWalletClient, 
    http, 
    parseEther, 
    formatEther, 
    type Address, 
    type Hex,
    parseAbi
} from 'viem';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

import { 
    UserLifecycle, 
    OperatorLifecycle, 
    ProtocolGovernance,
    type GaslessConfig
} from '@aastar/sdk';

import { loadNetworkConfig } from '../tests/regression/config.js';
import { 
    registryActions, 
    tokenActions, 
    gTokenActions, 
    paymasterActions 
} from '@aastar/core';

// Helper to print step header
function logStep(step: number, msg: string) {
    console.log(`\n🔹 Step ${step}: ${msg}`);
}

async function main() {
    console.log("🚀 Starting L3 Complete Lifecycle Demo (Real Transactions)...");

    // 0. Configuration
    const networkArg = process.argv.find(arg => arg.startsWith('--network='))?.split('=')[1] || 'sepolia';
    const config = loadNetworkConfig(networkArg as any);
    
    // Load .env
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const envPath = path.resolve(__dirname, `../.env.${networkArg}`);
    dotenv.config({ path: envPath, override: true });

    if (!process.env.PRIVATE_KEY_SUPPLIER) throw new Error("Missing PRIVATE_KEY_SUPPLIER");

    const publicClient = createPublicClient({
        chain: config.chain,
        transport: http(config.rpcUrl)
    });

    const supplierAcc = privateKeyToAccount(process.env.PRIVATE_KEY_SUPPLIER as Hex);
    const supplierClient = createWalletClient({
        account: supplierAcc,
        chain: config.chain,
        transport: http(config.rpcUrl)
    });

    console.log(`📡 Network: ${config.name}`);
    console.log(`⛽ Supplier: ${supplierAcc.address}`);
    console.log(`🏭 Registry: ${config.contracts.registry}`);

    // ==========================================
    // ACTOR 1: OPERATOR (JASON CLONE)
    // ==========================================
    logStep(1, "Creating New Operator (Alice)...");
    const aliceKey = generatePrivateKey();
    const aliceAcc = privateKeyToAccount(aliceKey);
    console.log(`   👤 Alice (Operator): ${aliceAcc.address}`);

    const aliceClient = createWalletClient({
        account: aliceAcc,
        chain: config.chain,
        transport: http(config.rpcUrl)
    });

    // Fund Alice
    const minEth = parseEther('0.02');
    let aliceBal = await publicClient.getBalance({ address: aliceAcc.address });
    if (aliceBal < minEth) {
        console.log(`   💸 Sending 0.02 ETH to Alice...`);
        const h = await supplierClient.sendTransaction({ to: aliceAcc.address, value: minEth });
        await publicClient.waitForTransactionReceipt({ hash: h });
    }

    // Fund GToken (for stake)
    // Note: Assuming Supplier is GToken owner or has mint capabilities for test
    // Usually supplier has OWNER role of GToken on testnet
    const gToken = gTokenActions()(supplierClient);
    console.log(`   🪙 Minting 100 GTokens to Alice...`);
    const hMint = await gToken.mint({
        token: config.contracts.gToken,
        to: aliceAcc.address,
        amount: parseEther('100'),
        account: supplierAcc
    });
    await publicClient.waitForTransactionReceipt({ hash: hMint });

    // Initialize OperatorLifecycle
    const aliceL3 = new OperatorLifecycle({
        client: aliceClient,
        publicClient,
        superPaymasterAddress: config.contracts.superPaymaster,
        gTokenAddress: config.contracts.gToken,
        gTokenStakingAddress: config.contracts.gTokenStaking,
        registryAddress: config.contracts.registry,
        entryPointAddress: config.contracts.entryPoint,
        paymasterFactoryAddress: config.contracts.paymasterFactory,
        ethUsdPriceFeedAddress: config.contracts.priceFeed,
        xpntsFactoryAddress: config.contracts.xPNTsFactory
    });

    // Check Readiness
    const status = await aliceL3.checkReadiness();
    console.log(`   📊 Status Before: Configured=${status.isConfigured}, Balance=${formatEther(status.balance)}`);

    // Onboard as Super Operator
    logStep(2, "Alice Onboarding as SuperPaymaster Operator...");
    // 1. Get ROLE_COMMUNITY first (Prerequisite)
    // In real flow, this is DAO decided. Here Supplier grants it.
    const registryReader = registryActions(config.contracts.registry)(publicClient);
    const registryWriter = registryActions(config.contracts.registry)(supplierClient);
    
    const ROLE_COMMUNITY = await registryReader.ROLE_COMMUNITY();
    console.log(`   🛡️  Granting ROLE_COMMUNITY to Alice...`);
    const hGrant = await registryWriter.grantRole({ roleId: ROLE_COMMUNITY, user: aliceAcc.address });
    await publicClient.waitForTransactionReceipt({ hash: hGrant });

    // 2. Setup Node
    console.log(`   ⚙️  Setting up Node (Deposit + Register)...`);
    const hSetup = await aliceL3.setupNode({
        type: 'SUPER',
        stakeAmount: parseEther('50'),
        depositAmount: parseEther('10') // Initial collateral
    });
    console.log(`   ✅ Setup Hashes: ${hSetup.join(', ')}`);
    // Wait for txs
    for(const hash of hSetup) await publicClient.waitForTransactionReceipt({ hash });

    // Verify
    const statusAfter = await aliceL3.checkReadiness();
    console.log(`   📊 Status After: Configured=${statusAfter.isConfigured}`);

    // ==========================================
    // ACTOR 2: END USER (BOB)
    // ==========================================
    logStep(3, "Creating New User (Bob)...");
    const bobKey = generatePrivateKey();
    const bobAcc = privateKeyToAccount(bobKey);
    // Ideally we deploy an AA account here. 
    // For simplicity of this demo script (which focuses on Lifecycle API), 
    // we use the EOA as the 'account' but wrap it in UserLifecycle which works for EOAs too (mostly)
    // BUT UserClient usually requires SimpleAccount structure for `execute`.
    // Let's use `l4-setup` logic to create an AA account for Bob.
    
    // We'll use the Factory from config
    const { accountFactoryActions } = await import('@aastar/core');
    const factoryActions = accountFactoryActions(config.contracts.simpleAccountFactory);
    const bobClient = createWalletClient({ account: bobAcc, chain: config.chain, transport: http(config.rpcUrl) });
    
    console.log(`   👤 Bob (EOA): ${bobAcc.address}`);
    const salt = 0n;
    const bobAA = await factoryActions(publicClient).getAddress({ owner: bobAcc.address, salt });
    console.log(`   🤖 Bob (AA): ${bobAA}`);
    
    // Deploy AA if needed
    const code = await publicClient.getBytecode({ address: bobAA });
    if (!code || code.length <= 2) {
        // Fund EOA first
        const hF = await supplierClient.sendTransaction({ to: bobAcc.address, value: parseEther('0.02') });
        await publicClient.waitForTransactionReceipt({ hash: hF });

        console.log(`   🚀 Deploying Bob's AA Account...`);
        const hDeploy = await factoryActions(bobClient).createAccount({
            owner: bobAcc.address, salt, account: bobAcc
        });
        await publicClient.waitForTransactionReceipt({ hash: hDeploy });
    }

    // Fund Bob's AA for initial stake
    console.log(`   💸 Funding Bob's AA with 0.02 ETH + 10 GTokens...`);
    await supplierClient.sendTransaction({ to: bobAA, value: parseEther('0.02') }); // Gas for approve
    await gToken.mint({ token: config.contracts.gToken, to: bobAA, amount: parseEther('10'), account: supplierAcc });

    // Initialize UserLifecycle
    const bobL3 = new UserLifecycle({
        client: bobClient, // Signer
        publicClient,
        accountAddress: bobAA, // The AA Address
        registryAddress: config.contracts.registry,
        sbtAddress: config.contracts.sbt,
        gTokenAddress: config.contracts.gToken,
        gTokenStakingAddress: config.contracts.gTokenStaking,
        entryPointAddress: config.contracts.entryPoint
    });
    // Inject bundler client if needed for gasless, but we will rely on BaseClient defaults for now or configure later
    // L3 needs bundlerUrl for gasless.
    (bobL3.config as any).bundlerClient = (config as any).bundlerUrl ? createWalletClient({ // hack for now, strictly should createBundlerClient
         chain: config.chain, transport: http('https://api.pimlico.io/v1/sepolia/rpc?apikey=' + process.env.PIMLICO_API_KEY) // Fallback
    }) : undefined;


    // ==========================================
    // EXECUTION: ONBOARDING
    // ==========================================
    logStep(4, "Bob Onboarding to Alice's Community...");
    
    // 1. Check Eligibility
    const canJoin = await bobL3.checkEligibility(aliceAcc.address);
    console.log(`   🧐 Eligible: ${canJoin}`);

    if (canJoin) {
        // 2. Onboard (Approve + Register + Mint)
        // Alice needs to be a Community first? Alice is Operator.
        // Registry validates `community` param. Usually Operator address is the Community ID.
        // We verified Alice has ROLE_COMMUNITY above.
        
        console.log(`   📝 Bob calling onboard()...`);
        const res = await bobL3.onboard(aliceAcc.address, parseEther('0.4'));
        console.log(`   ✅ Onboard Result: Success=${res.success}, Tx=${res.txHash}`);
    }

    // ==========================================
    // EXECUTION: GASLESS TX
    // ==========================================
    logStep(5, "Bob Executing Gasless Transaction...");
    
    // 1. Enable Gasless
    await bobL3.enableGasless({
        paymasterUrl: 'https://...ignored_for_super...', // SuperPaymaster uses on-chain logic
        policy: 'CREDIT' // Trigger SuperPaymaster path
    });

    // 2. Prepare Tx (e.g., self-transfer 0 ETH just to test execution)
    // Note: To work, Paymaster needs to relay this.
    // SuperPaymaster needs Bob to have Credit or Token.
    // Basic Reputation check:
    const rep = await bobL3.getMyReputation();
    console.log(`   🌟 Bob's Reputation: Score=${rep.score}, CreditLimit=${formatEther(rep.creditLimit)}`);
    
    // If no credit, execution might fail unless Sponsored Policy allows.
    // For demo, we assume the initial Stake (0.4 GT) gave some initial credit or Alice sponsors.
    // Let's rely on standard policy.
    
    try {
        const txHash = await bobL3.executeGaslessTx({
            target: bobAA,
            value: 0n,
            data: '0x',
            operator: aliceAcc.address // Specify Alice as the preferred operator
        });
        console.log(`   🚀 Gasless Tx Sent: ${txHash}`);
        
        const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
        console.log(`   ✅ Tx Confirmed in Block ${receipt.blockNumber}`);
    } catch (e: any) {
        console.log(`   ⚠️ Gasless Tx Failed (Expected if no credit/bundler): ${e.message}`);
        // Continuing demo to show Exit...
    }

    // ==========================================
    // EXECUTION: EXIT
    // ==========================================
    logStep(6, "Exit Phase...");

    console.log(`   🚪 Bob leaving community...`);
    const hExit = await bobL3.leaveCommunity(aliceAcc.address);
    await publicClient.waitForTransactionReceipt({ hash: hExit });
    console.log(`   ✅ Bob Left (SBT Burned): ${hExit}`);

    console.log(`   🏦 Alice withdrawing funds...`);
    const hWithdraw = await aliceL3.withdrawAllFunds();
    console.log(`   ✅ Withdrawal Txs: ${hWithdraw.join(', ')}`);
    
    console.log("\n🎉 L3 Demo Complete!");
}

main().catch(console.error);
