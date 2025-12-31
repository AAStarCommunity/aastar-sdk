import { createObjectCsvWriter } from 'csv-writer';
import { createPublicClient, http, Hex } from 'viem';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { getNetworkConfig } from './00_utils.js';
import { runEOAExperiment, runPimlicoExperiment, runAOAExperiment, runSuperExperiment, TestMetrics } from './test_groups.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Dynamic Env Loading
const NETWORK = process.env.EXPERIMENT_NETWORK || 'sepolia';
const envPath = NETWORK === 'sepolia' 
    ? path.resolve(__dirname, '../.env.sepolia') 
    : path.resolve(__dirname, '../../env/.env.anvil');

console.log(`Loading Env from: ${envPath}`);
dotenv.config({ path: envPath });

const OUTPUT_FILE = 'sdk_experiment_data.csv';
const RUNS = parseInt(process.env.EXPERIMENT_RUNS || '3');

async function main() {
    console.log(`🧪 PhD Experiment Runner (Network: ${NETWORK}, Runs: ${RUNS})`);
    const { chain, rpc } = getNetworkConfig(NETWORK);
    
    // Fallback for keys
    const pk = (process.env.PRIVATE_KEY_JASON || process.env.ADMIN_KEY || process.env.USER_KEY) as Hex;
    if (!pk) throw new Error("Missing Private Key (PRIVATE_KEY_JASON or ADMIN_KEY)");

const config = {
        chain,
        rpc,
        bundlerRpc: process.env.ALCHEMY_BUNDLER_RPC_URL,
        pimlicoRpc: `https://api.pimlico.io/v2/sepolia/rpc?apikey=${process.env.PIMLICO_API_KEY}`,
        privateKey: pk,
        accountAddress: (process.env.TEST_SIMPLE_ACCOUNT_A || "0x0000000000000000000000000000000000000000") as Hex, 
        pimToken: "0xFC3e86566895Fb007c6A0d3809eb2827DF94F751" 
    };

    // Load or Generate Test Accounts using SDK API
    if (config.accountAddress === "0x0000000000000000000000000000000000000000") {
        const { TestAccountManager } = await import('../packages/enduser/src/index.js');
        const savedAccount = TestAccountManager.getTestAccount('A');
        
        if (savedAccount) {
            console.log("✅ Using saved test account from .env.sepolia");
            console.log(`   🔑 Test Account A: ${savedAccount.aaAddress}`);
            config.accountAddress = savedAccount.aaAddress;
            config.privateKey = savedAccount.ownerKey;
        } else {
            console.log("⚠️ No saved test accounts found. Generating ephemeral account...");
            console.log("💡 Tip: Run 'pnpm tsx scripts/setup_test_accounts.ts' to create persistent test accounts.");
        try {
            const { generatePrivateKey, privateKeyToAccount } = await import('viem/accounts');
            const { EndUserClient } = await import('../packages/enduser/src/index.js');
            const { createWalletClient, createPublicClient, http, parseEther } = await import('viem');
            
            // Setup Clients
            const account = privateKeyToAccount(pk);
            const publicClient = createPublicClient({ chain, transport: http(rpc) });
            const walletClient = createWalletClient({ account, chain, transport: http(rpc) });
            const endUser = new EndUserClient(publicClient, walletClient);


            // Generate Owner
            const ephemeralKey = generatePrivateKey();
            const ephemeralOwner = privateKeyToAccount(ephemeralKey);
            console.log(`   🔑 Ephemeral Owner: ${ephemeralOwner.address}`);

            // Use SUPPLIER account for deployment and funding
            const supplierKey = process.env.PRIVATE_KEY_SUPPLIER || pk;
            const supplierAccount = privateKeyToAccount(supplierKey as Hex);
            const supplierWallet = createWalletClient({ account: supplierAccount, chain, transport: http(rpc) });
            const endUserWithSupplier = new EndUserClient(publicClient, supplierWallet);

            // Deploy Real AA Account
            console.log(`   🏭 Deploying AA Account on-chain...`);
            const deployResult = await endUserWithSupplier.deploySmartAccount({ 
                owner: ephemeralOwner.address, 
                salt: BigInt(Math.floor(Math.random() * 100000)),
                fundWithETH: parseEther("0.01") // Fund with 0.01 ETH
            });
            console.log(`   ✅ Deployed SA: ${deployResult.accountAddress}`);
            console.log(`   📝 Deploy Tx: ${deployResult.deployTxHash}`);

            // Update Config
            config.privateKey = ephemeralKey;
            config.accountAddress = deployResult.accountAddress;
            
            // Fund EOA Owner for Group 1
            const eoaBalance = await publicClient.getBalance({ address: ephemeralOwner.address });
            if (eoaBalance < parseEther("0.005")) {
                 console.log("   ⛽ Funding EOA Owner...");
                 const tx = await supplierWallet.sendTransaction({
                    to: ephemeralOwner.address,
                    value: parseEther("0.005")
                });
                await publicClient.waitForTransactionReceipt({ hash: tx });
                console.log("   ✅ Funded EOA.");
            }

            // Fund PIM Token
            const pimTokenAddr = (process.env.PIM_TOKEN_ADDRESS || config.pimToken) as Hex;
            if (pimTokenAddr) {
                const erc20Abi = [{"constant":true,"inputs":[{"name":"_owner","type":"address"}],"name":"balanceOf","outputs":[{"name":"balance","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"}, {"constant":false,"inputs":[{"name":"_to","type":"address"},{"name":"_value","type":"uint256"}],"name":"transfer","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"}];
                
                // Check SA PIM balance
                const pimBalance = await publicClient.readContract({ 
                    address: pimTokenAddr, abi: erc20Abi, functionName: 'balanceOf', args: [saInfo.accountAddress] 
                }) as bigint;

                if (pimBalance < parseEther("100")) {
                     console.log("   ⛽ Funding SA with PIM Tokens...");
                     try { // Ignore errors if admin has no PIM
                        const tx = await walletClient.writeContract({
                            address: pimTokenAddr, abi: erc20Abi, functionName: 'transfer', args: [saInfo.accountAddress, parseEther("100")],
                            chain
                        });
                        await publicClient.waitForTransactionReceipt({ hash: tx });
                        console.log("   ✅ PIM Funded.");
                     } catch(e) { 
                        console.log("   ⚠️ Failed to fund PIM (Admin might lack tokens). Continuing..."); 
                     }
                }
            }

        } catch (e: any) {
            console.error(`   ❌ Auto-generation failed: ${e.message}`);
        }
    }

    const csvWriter = createObjectCsvWriter({
        path: OUTPUT_FILE,
        header: [
            {id: 'runId', title: 'Run ID'},
            {id: 'group', title: 'Group'},
            {id: 'gasUsed', title: 'Gas Used'},
            {id: 'effectiveGasPrice', title: 'Effective Gas Price (wei)'},
            {id: 'totalCostWei', title: 'Total Cost (wei)'},
            {id: 'latencyMs', title: 'Latency (ms)'},
            {id: 'status', title: 'Status'},
            {id: 'txHash', title: 'Transaction Hash'},
            {id: 'timestamp', title: 'Timestamp'}
        ]
    });

    const allResults: any[] = [];

    for (let i = 0; i < RUNS; i++) {
        console.log(`\n📊 Run ${i + 1}/${RUNS}`);
        
        // Group 1: EOA
        try {
            console.log("   --- Group 1: EOA ---");
            const res = await runEOAExperiment(config);
            allResults.push({ ...res, runId: i + 1, timestamp: new Date().toISOString() });
            console.log(`   ✅ EOA: ${res.gasUsed} gas, ${res.latencyMs}ms`);
        } catch (e: any) { console.error(`   ❌ EOA Failed: ${e.message}`); }

        // Group 2: Pimlico
        if (config.accountAddress && config.accountAddress !== "0x0000000000000000000000000000000000000000") {
            try {
                console.log("   --- Group 2: Pimlico ---");
                const res = await runPimlicoExperiment({ ...config });
                allResults.push({ ...res, runId: i + 1, timestamp: new Date().toISOString() });
                console.log(`   ✅ Pimlico: ${res.gasUsed} gas, ${res.latencyMs}ms`);
            } catch (e: any) { console.error(`   ❌ Pimlico Failed: ${e.message}`); }
        } else {
            console.log("   ⚠️ Skipping Pimlico (Missing TEST_SIMPLE_ACCOUNT_A)");
        }

        // Group 3: AOA (Paymaster V4)
        const paymasterV4 = process.env.PAYMASTER_V4_ADDRESS || process.env.PAYMASTER_ADDRESS;
        if (config.accountAddress && paymasterV4 && config.accountAddress !== "0x0000000000000000000000000000000000000000") {
            try {
                console.log("   --- Group 3: AOA (V4) ---");
                const res = await runAOAExperiment({ ...config, accountAddress: process.env.TEST_SIMPLE_ACCOUNT_B || config.accountAddress, paymasterV4 });
                allResults.push({ ...res, runId: i + 1, timestamp: new Date().toISOString() });
                console.log(`   ✅ AOA: ${res.gasUsed} gas, ${res.latencyMs}ms`);
            } catch (e: any) { console.error(`   ❌ AOA Failed: ${e.message}`); }
        } else {
            console.log("   ⚠️ Skipping AOA (Missing Account or Paymaster Config)");
        }

        // Group 4: SuperPaymaster
        const superPaymaster = process.env.SUPER_PAYMASTER_ADDRESS || process.env.SUPER_PAYMASTER;
        if (config.accountAddress && superPaymaster && config.accountAddress !== "0x0000000000000000000000000000000000000000") {
            try {
                console.log("   --- Group 4: SuperPaymaster ---");
                const res = await runSuperExperiment({ ...config, accountAddress: process.env.TEST_SIMPLE_ACCOUNT_C || config.accountAddress, superPaymaster });
                allResults.push({ ...res, runId: i + 1, timestamp: new Date().toISOString() });
                console.log(`   ✅ Super: ${res.gasUsed} gas, ${res.latencyMs}ms`);
            } catch (e: any) { console.error(`   ❌ Super Failed: ${e.message}`); }
        } else {
            console.log("   ⚠️ Skipping SuperPaymaster (Missing Account or Paymaster Config)");
        }
        
        await csvWriter.writeRecords(allResults.slice(-4)); // Write batch
    }

    console.log(`\n✅ Complete! Data saved to ${OUTPUT_FILE}`);
}

main().catch(console.error);
