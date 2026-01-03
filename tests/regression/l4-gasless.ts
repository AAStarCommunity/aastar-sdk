import * as fs from 'fs';
import * as path from 'path';
import { type Address, type Hash, parseEther, formatEther, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { loadNetworkConfig, type NetworkConfig } from './config';
import { PaymasterOperatorClient } from '../../packages/operator/dist/index.js';
import { tokenActions, superPaymasterActions } from '../../packages/core/dist/index.js';
import { fileURLToPath } from 'url';

// Load L4 State
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STATE_FILE = path.resolve(__dirname, '../../scripts/l4-state.json');

interface OperatorState {
    tokenAddress?: Address;
    paymasterAddress?: Address;
    superPaymasterAddress?: Address;
}

interface L4State {
    jason: OperatorState;
    bob: OperatorState;
    anni: OperatorState;
}

function loadState(): L4State {
    if (!fs.existsSync(STATE_FILE)) {
        throw new Error(`L4 State file not found at ${STATE_FILE}. Please run 'pnpm tsx scripts/l4-setup.ts' first.`);
    }
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
}

export async function runGaslessTests(config: NetworkConfig) {
    console.log('\n═══════════════════════════════════════════════');
    console.log('⛽ Running L4 Gasless Verification Tests');
    console.log('═══════════════════════════════════════════════\n');

    const state = loadState();

    // --- Scenario A: Jason (AAStar) - PaymasterV4 ---
    await runPaymasterV4Scenario('Jason (AAStar)', 'jason', state.jason, config);

    // --- Scenario B: Bob (Bread) - PaymasterV4 ---
    await runPaymasterV4Scenario('Bob (Bread)', 'bob', state.bob, config);

    // --- Scenario C: Anni (Demo) - SuperPaymasterV3 ---
    await runSuperPaymasterScenario('Anni (Demo)', 'anni', state.anni, config);
}

async function runPaymasterV4Scenario(
    name: string, 
    keyName: string, 
    opState: OperatorState, 
    config: NetworkConfig
) {
    console.log(`\n👤 === Scenario: ${name} with PaymasterV4 ===`);
    
    const keyEnv = `PRIVATE_KEY_${keyName.toUpperCase()}`;
    const key = process.env[keyEnv] as `0x${string}`;
    if (!key) {
        console.log(`  ⚠️  Skipping ${name}: Missing ${keyEnv}`);
        return;
    }

    const account = privateKeyToAccount(key);
    const tokenAddr = opState.tokenAddress;
    const pmAddr = opState.paymasterAddress;

    if (!tokenAddr || !pmAddr) {
        console.log(`  ⚠️  Skipping: Missing Token or Paymaster in state.`);
        return; 
    }

    console.log(`  ℹ️  Token: ${tokenAddr}`);
    console.log(`  ℹ️  Paymaster: ${pmAddr}`);

    try {
        // Create proper WalletClient
        const client = createWalletClient({
            chain: config.chain,
            transport: http(config.rpcUrl),
            account
        });

        // Step 1: Mint xPNTs using SDK tokenActions
        console.log(`  ➡️  Minting xPNTs...`);
        const token = tokenActions();
        const mintHash = await token(client).mint({
            token: tokenAddr,
            to: account.address,
            amount: parseEther('10'),
            account
        });
        console.log(`     #️⃣  Hash: ${mintHash}`);
        console.log(`  ✅ Minted 10 xPNTs`);

        // Step 2: Check Paymaster EntryPoint deposit
        // TODO: Add EntryPoint deposit check and auto-deposit if needed

        // Step 3: Construct UserOperation (TODO)
        console.log(`  ⚠️  PaymasterV4 UserOp - Implementation TODO`);

    } catch (e: any) {
        console.log(`  ❌ Scenario Failed: ${e.message.split('\n')[0]}`);
    }
}

async function runSuperPaymasterScenario(
    name: string, 
    keyName: string, 
    opState: OperatorState, 
    config: NetworkConfig
) {
    console.log(`\n👤 === Scenario: ${name} with SuperPaymasterV3 ===`);
    
    const keyEnv = `PRIVATE_KEY_${keyName.toUpperCase()}`;
    const key = process.env[keyEnv] as `0x${string}`;
    if (!key) {
        console.log(`  ⚠️  Skipping ${name}: Missing ${keyEnv}`);
        return;
    }

    const account = privateKeyToAccount(key);
    const tokenAddr = opState.tokenAddress;
    const spmAddr = opState.superPaymasterAddress || config.contracts.superPaymaster;

    console.log(`  ℹ️  Token (cPNTs): ${tokenAddr}`);
    console.log(`  ℹ️  SuperPaymaster: ${spmAddr}`);

    if (!tokenAddr) {
        console.log(`  ⚠️  Skipping: Missing Token in state.`);
        return;
    }

    try {
        // Create proper WalletClient
        const client = createWalletClient({
            chain: config.chain,
            transport: http(config.rpcUrl),
            account
        });

        // Step 1: Mint cPNTs using SDK tokenActions
        console.log(`  ➡️  Minting cPNTs...`);
        const token = tokenActions();
        
        const mintHash = await token(client).mint({
            token: tokenAddr,
            to: account.address,
            amount: parseEther('50'),
            account
        });
        console.log(`     #️⃣  Hash: ${mintHash}`);
        console.log(`  ✅ Minted 50 cPNTs`);

        // Step 2: Approve cPNTs for SuperPaymaster (传统模式)
        console.log(`  ➡️  Approving cPNTs for SuperPaymaster...`);
        const approveHash = await token(client).approve({
            token: tokenAddr,
            spender: spmAddr,
            amount: parseEther('50'),
            account
        });
        console.log(`  ✅ Approved 50 cPNTs`);

        // Step 3: Deposit using Legacy Pull mode
        console.log(`  ➡️  Depositing cPNTs to SuperPaymaster (Legacy mode)...`);
        const spm = superPaymasterActions(spmAddr);
        const depositHash = await spm(client).deposit({
            amount: parseEther('10'),
            account
        });
        console.log(`     #️⃣  Hash: ${depositHash}`);
        console.log(`  ✅ Deposited 10 cPNTs to SuperPaymaster`);

        // Step 4: Construct UserOperation (TODO)
        console.log(`  ⚠️  SuperPaymasterV3 UserOp - Implementation TODO`);

    } catch (e: any) {
        console.log(`  ❌ Scenario Failed: ${e.message.split('\n')[0]}`);
    }
}
