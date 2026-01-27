import {
    createClient,
    createPublicClient,
    createWalletClient,
    http,
    parseEther,
    formatEther,
    type Address,
    type Hex,
    parseAbi,
    encodeFunctionData,
    keccak256,
    encodeAbiParameters,
    toBytes
} from 'viem';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { bundlerActions } from 'viem/account-abstraction';
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
    paymasterActions,
    superPaymasterActions
} from '@aastar/core';

// Helper to print step header
function logStep(step: number, msg: string) {
    console.log(`\n🔹 Step ${step}: ${msg}`);
}

// Helper to wait for tx with timeout and detailed logging
async function waitTx(hash: Hex, description = "Tx") {
    console.log(`      ⏳ Waiting for ${description} (${hash})...`);
    try {
        const receipt = await publicClient.waitForTransactionReceipt({ 
            hash, 
            timeout: 120_000, // 2 minutes
            confirmations: 1 
        });
        if (receipt.status === 'reverted') {
            console.error(`      ❌ ${description} Reverted! Hash: ${hash}`);
            throw new Error(`${description} Reverted`);
        }
        console.log(`      ✅ ${description} Confirmed in block ${receipt.blockNumber}`);
        return receipt;
    } catch (e: any) {
        console.error(`      ⚠️ Timeout or Error waiting for ${description}: ${e.message}`);
        throw e;
    }
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
    // @ts-ignore
    global.publicClient = publicClient; // Hack for helper access

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
    const minEth = parseEther('0.1'); // Increased for full lifecycle on Sepolia
    let aliceBal = await publicClient.getBalance({ address: aliceAcc.address });
    if (aliceBal < minEth) {
        console.log(`   💸 Sending 0.1 ETH to Alice...`);
        const h = await supplierClient.sendTransaction({ to: aliceAcc.address, value: minEth });
        await waitTx(h, "Fund Alice ETH");
    }

    // Fund GToken (for stake)
    const gToken = gTokenActions()(supplierClient);
    console.log(`   🪙 Minting 100 GTokens to Alice...`);
    const hMintG = await gToken.mint({
        token: config.contracts.gToken,
        to: aliceAcc.address,
        amount: parseEther('100'),
        account: supplierAcc
    });
    await waitTx(hMintG, "Mint GToken");

    // Fund aPNTs (for deposit/collateral)
    const aPNTsToken = tokenActions()(supplierClient);
    console.log(`   🪙 Minting 4,000 aPNTs to Alice...`);
    const hMintA = await aPNTsToken.mint({
        token: config.contracts.aPNTs,
        to: aliceAcc.address,
        amount: parseEther('4000'),
        account: supplierAcc
    });
    await waitTx(hMintA, "Mint aPNTs");

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

    // Initialize CommunityClient for Alice (Community Leader)
    const { CommunityClient } = await import('@aastar/sdk');
    const aliceCommunity = new CommunityClient({
        client: aliceClient,
        publicClient,
        registryAddress: config.contracts.registry,
        factoryAddress: config.contracts.xPNTsFactory,
        gTokenAddress: config.contracts.gToken,
        gTokenStakingAddress: config.contracts.gTokenStaking,
        sbtAddress: config.contracts.sbt,
        reputationAddress: config.contracts.reputation
    });

    logStep(2, "Alice Launching Community (One-Click Setup)...");
    const communityName = `AliceDAO_${aliceAcc.address.slice(2, 8)}`;
    let tokenAddress: Address = '0x0000000000000000000000000000000000000000';
    let hLaunch: Hex[] = [];

    // Retry Loop for Step 2 (Flaky on OP Sepolia)
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            console.log(`   🔄 Attempt ${attempt}/3 to launch community...`);
            const res = await aliceCommunity.setupCommunity({
                name: communityName,
                tokenName: `${communityName} Token`,
                tokenSymbol: "ALICE",
                description: "Demo Community",
                stakeAmount: parseEther('30') // Default
            });
            tokenAddress = res.tokenAddress;
            hLaunch = res.hashes;
            console.log(`   ✅ Community Launched! Hashes: ${hLaunch.join(', ')}`);
            for(const hash of hLaunch) await waitTx(hash, "Community Launch");
            break; // Success
        } catch (e: any) {
            console.warn(`   ⚠️ Attempt ${attempt} failed: ${e.message}`);
            if (attempt === 3) throw e;
            await new Promise(r => setTimeout(r, 2000));
        }
    }


    // Onboard as SuperPaymaster Operator
    // Link xPNTsToken to SuperPaymaster (Required before configureOperator)
    console.log("   🔗 Linking Token to SuperPaymaster...");
    const xPNTsToken = tokenActions()(aliceClient);
    const hLink = await xPNTsToken.setSuperPaymasterAddress({
        token: tokenAddress,
        spAddress: config.contracts.superPaymaster,
        account: aliceAcc
    });
    await waitTx(hLink, "Link Token to SuperPM");

    // Step 3: Alice Onboarding as SuperPaymaster Operator
    logStep(3, "Alice Onboarding as SuperPaymaster Operator...");
    
    // 2. Setup Node
    console.log(`   ⚙️  Setting up Node (Deposit + Register)...`);
    const hSetup = await aliceL3.setupNode({
        type: 'SUPER',
        stakeAmount: parseEther('50'),
        depositAmount: 0n // Defer deposit to handle latency
    });
    for(const hash of hSetup) await waitTx(hash, "Setup Node (Register)");

    // Wait for Role to be indexed (Fix for 'Unauthorized' error on Deposit)
    console.log("   ⏳ Waiting for SuperPM Role to index...");
    const registryActions = await import('@aastar/core').then(m => m.registryActions);
    const registryContract = registryActions(config.contracts.registry)(publicClient);
    const ROLE_SUPER = await registryContract.ROLE_PAYMASTER_SUPER();
    
    for(let i=0; i<10; i++) {
        const hasRole = await registryContract.hasRole({ roleId: ROLE_SUPER, user: aliceAcc.address });
        if(hasRole) {
            console.log("   ✅ Role Verified on-chain.");
            break;
        }
        await new Promise(r => setTimeout(r, 2000));
    }

    // Now Deposit
    console.log("   💰 Depositing Collateral (4000 aPNTs)...");
    const hDeposit = await aliceL3.depositCollateral(parseEther('4000'));
    await waitTx(hDeposit, "Deposit Collateral");

    // Force Configure Operator (Ensure isConfigured = true)
    console.log("   ⚙️  Forcing Operator Configuration...");
    const hConfig = await aliceL3.configureOperator(
        tokenAddress, 
        aliceAcc.address, 
        parseEther('1')
    );
    await waitTx(hConfig, "Configure Operator");

    // Force Update Price to prevent Stale Price Error (Using DVT)
    console.log("   🔄 Refreshing Oracle Price (DVT)...");
    try {
        const superPM = config.contracts.superPaymaster;
        
        // Prepare DVT Update
        const newPrice = 330000000000n; // $3300.00
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        
        // Sign the price update (Supplier = DVT Validator in this env)
        const chainId = supplierClient.chain.id;
        const messageHash = keccak256(encodeAbiParameters(
            [{ type: 'uint256' }, { type: 'uint256' }, { type: 'address' }, { type: 'uint256' }],
            [newPrice, timestamp, superPM, BigInt(chainId)]
        ));
        
        const signature = await supplierClient.signMessage({ 
            message: { raw: toBytes(messageHash) },
            account: supplierAcc
        });

        // Use superPaymasterActions if available, or direct write
        const hPrice = await superPaymasterActions(superPM)(supplierClient).updatePriceDVT({
            price: newPrice,
            updatedAt: timestamp,
            proof: signature,
            account: supplierAcc
        });

        await waitTx(hPrice, "Update Price DVT");
        console.log("   ✅ Price Updated via DVT!");
    } catch (e: any) {
        console.log(`   ⚠️ Price update failed: ${e.message}`);
    }

    // Verify
    const statusAfter = await aliceL3.checkReadiness();
    console.log(`   📊 Status After: Configured=${statusAfter.isConfigured}`);

    // ==========================================
    // ACTOR 2: END USER (BOB)
    // ==========================================
    logStep(3, "Creating New User (Bob)...");
    const bobKey = generatePrivateKey();
    const bobAcc = privateKeyToAccount(bobKey);
    
    // We'll use the Factory from config
    const { accountFactoryActions } = await import('@aastar/core');
    const factoryActions = accountFactoryActions(config.contracts.simpleAccountFactory);
    const bobClient = createWalletClient({ account: bobAcc, chain: config.chain, transport: http(config.rpcUrl) });
    
    console.log(`   👤 Bob (EOA): ${bobAcc.address}`);
    const salt = 0n;
    const bobAA = await factoryActions(publicClient).getAddress({ owner: bobAcc.address, salt });
    console.log(`   🤖 Bob (AA): ${bobAA}`);
    
    // Deploy AA if needed
    // 🚀 Ensure Bob's EOA has enough for gas
    const bobEOABalance = await publicClient.getBalance({ address: bobAcc.address });
    if (bobEOABalance < parseEther('0.05')) {
        console.log(`   💸 Funding Bob's EOA for gas...`);
        const hF = await supplierClient.sendTransaction({ to: bobAcc.address, value: parseEther('0.05') });
        await waitTx(hF, "Fund Bob EOA");
    }

    // Deploy AA if needed
    const code = await publicClient.getBytecode({ address: bobAA });
    if (!code || code.length <= 2) {
        console.log(`   🚀 Deploying Bob's AA Account...`);
        const hDeploy = await factoryActions(bobClient).createAccount({
            owner: bobAcc.address, salt, account: bobAcc
        });
        await waitTx(hDeploy, "Deploy Bob AA");
    }

    // Fund Bob's AA for initial stake
    console.log(`   💸 Funding Bob's AA with 0.1 ETH + 20 GTokens...`);
    const hFBob = await supplierClient.sendTransaction({ to: bobAA, value: parseEther('0.1'), gas: 100000n });
    await waitTx(hFBob, "Fund Bob AA ETH");
    const hMintBob = await gToken.mint({ token: config.contracts.gToken, to: bobAA, amount: parseEther('20'), account: supplierAcc });
    await waitTx(hMintBob, "Fund Bob AA GToken");

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
    // Inject bundler client if needed for gasless
    (bobL3.config as any).bundlerClient = (config as any).bundlerUrl ? createWalletClient({ 
         chain: config.chain, transport: http('https://api.pimlico.io/v1/sepolia/rpc?apikey=' + process.env.PIMLICO_API_KEY)
    }) : undefined;


    // ==========================================
    // EXECUTION: ONBOARDING
    // ==========================================
    logStep(5, "Bob Onboarding to Alice's Community...");
    
    // 1. Check Alice's Status again (Registry Level)
    const registry = await import('@aastar/core').then(m => m.registryActions(config.contracts.registry)(publicClient));
    const ROLE_COMMUNITY = await registry.ROLE_COMMUNITY();
    const aliceHasCommRole = await registry.hasRole({ roleId: ROLE_COMMUNITY, user: aliceAcc.address });
    console.log(`   🔸 Alice Community Role: ${aliceHasCommRole}`);

    // Check Bob's GToken balance
    const bobGTokenBalance = await gTokenActions()(publicClient).balanceOf({ token: config.contracts.gToken, account: bobAA });
    console.log(`   🔸 Bob's AA GToken Balance: ${formatEther(bobGTokenBalance)}`);

    // 2. Check Eligibility
    const canJoin = await bobL3.checkEligibility(aliceAcc.address);
    console.log(`   🧐 Eligible: ${canJoin}`);

    if (canJoin) {
        console.log(`   📝 Bob calling onboard()...`);
        const res = await bobL3.onboard(aliceAcc.address, parseEther('0.4'));
        console.log(`   ✅ Onboard Result: Success=${res.success}, Tx=${res.txHash}`);
        if(res.txHash) await waitTx(res.txHash, "Onboard");
    }

    // ==========================================
    // EXECUTION: GASLESS TX
    // ==========================================
    logStep(6, "Bob Executing Gasless Transaction...");
    
    // Use SuperPaymasterClient directly (same as simple-superpaymaster-demo.ts)
    const { SuperPaymasterClient } = await import('../packages/paymaster/src/V4/SuperPaymasterClient.js');

    try {
        const userOpHash = await SuperPaymasterClient.submitGaslessTransaction(
            publicClient,
            bobClient,
            bobAA,
            config.contracts.entryPoint,
            config.bundlerUrl!,
            {
                token: config.contracts.gToken,
                recipient: aliceAcc.address,
                amount: parseEther('1'), // Transfer 1.0 GToken back to Alice
                operator: aliceAcc.address, // Alice sponsors this tx
                paymasterAddress: config.contracts.superPaymaster
            }
        );
        
        console.log(`   ✅ UserOp Hash: ${userOpHash}`);
        
        // Wait for execution
        const bundlerClient = createClient({
            chain: config.chain,
            transport: http(config.bundlerUrl!)
        }).extend(bundlerActions);

        const receipt = await bundlerClient.waitForUserOperationReceipt({ 
            hash: userOpHash 
        });
        
        console.log(`   ✅ Gasless Tx Success! Tx Hash: ${receipt.receipt.transactionHash}`);
    } catch (e: any) {
        console.log(`   ⚠️ Gasless Tx Failed: ${e.message}`);
    // Continuing demo to show Exit...
    }

    // ==========================================
    // EXECUTION: EXIT
    // ==========================================
    logStep(7, "Exit Phase...");

    console.log(`   🚪 Bob leaving community...`);
    const hExit = await bobL3.leaveCommunity(aliceAcc.address);
    await waitTx(hExit, "Bob Leave Community");
    console.log(`   ✅ Bob Left (SBT Burned): ${hExit}`);

    console.log(`   🏦 Alice withdrawing funds & exiting role...`);
    try {
        const hWithdraw = await aliceL3.withdrawAllFunds();
        console.log(`   ✅ Exit/Withdrawal Txs Submitted: ${hWithdraw.join(', ')}`);
        
        // Wait and check status
        for (const hash of hWithdraw) {
             try {
                const r = await waitTx(hash, "Exit/Withdraw");
                console.log(`      Found Receipt: ${r.transactionHash} (Status: ${r.status})`);
             } catch (e: any) {
                 console.log(`      Tx Reverted/Failed: ${hash}`);
             }
        }
    } catch (e: any) {
        console.log(`   ⚠️ Withdrawal/Exit Failed (Expected if Locked): ${e.message}`);
        console.log(`   ℹ️ Note: Registry roles typically have a lock period (e.g. 30 days) before exit is final.`);
    }
    
    console.log("\n🎉 L3 Demo Complete!");
}

main().catch(console.error);
