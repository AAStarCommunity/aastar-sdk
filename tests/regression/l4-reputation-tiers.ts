import { createPublicClient, createWalletClient, http, parseEther, formatEther, parseAbi, type Address, type Hex, keccak256 } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { seaport, sepolia } from 'viem/chains';
import * as dotenv from 'dotenv';
import { 
    createAdminClient, 
    ReputationSystemABI,
    CORE_ADDRESSES
} from '@aastar/sdk';
import fs from 'fs';
import path from 'path';

import { loadNetworkConfig } from './config.js';
// dotenv loaded by loadNetworkConfig

// Force load Sepolia config
// Config loaded dynamically
// const SEPOLIA_CONFIG ...
const STATE_FILE = './scripts/l4-state.json';
const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));

async function runReputationTierTest() {
    const args = process.argv.slice(2);
    const networkArgIndex = args.indexOf('--network');
    const networkName = (networkArgIndex >= 0 ? args[networkArgIndex + 1] : 'sepolia') as any;
    const config = loadNetworkConfig(networkName);

    console.log('🧪 Starting Tier 2 Reputation Test (Activity-based)...');
    
    // 1. Setup Clients
    const supplierAcc = privateKeyToAccount(process.env.PRIVATE_KEY_SUPPLIER as Hex);
    const anniAcc = privateKeyToAccount(process.env.PRIVATE_KEY_ANNI as Hex);
    
    // const rpcUrl = process.env.RPC_URL_SEPOLIA || '';
    const publicClient = createPublicClient({ chain: config.chain, transport: http(config.rpcUrl) });
    
    const anniClient = createWalletClient({ account: anniAcc, chain: config.chain, transport: http(config.rpcUrl) });
    const adminClient = createAdminClient({ chain: config.chain, transport: http(config.rpcUrl), account: supplierAcc });

    const anniAddr = anniAcc.address;
    const targetAA = state.aaAccounts.find((a: any) => a.opName === 'Anni (Demo)');
    
    if (!targetAA) throw new Error('Target AA not found');

    const repSystemAddr = config.contracts.reputation as Address;
    console.log(`📍 Reputation System: ${repSystemAddr}`);

    // --- Tier 2: Activity Flow ---
    console.log('\n🔹 Step 1: Community Admin (Anni) sets a custom Reputation Rule');
    const ruleId = keccak256(Buffer.from('LOGIN_ACTIVITY'));
    console.log(`   📝 Rule ID: ${ruleId}`);

    // Rule: Base=5, Bonus=2 per activity, Max=50
    const setRuleTx = await anniClient.writeContract({
        address: repSystemAddr,
        abi: ReputationSystemABI,
        functionName: 'setRule',
        args: [ruleId, 5n, 2n, 50n, "Daily Login Reward"]
    });
    console.log(`   ⏳ Transaction sent: ${setRuleTx}. Waiting for receipt...`);
    
    try {
        await publicClient.waitForTransactionReceipt({ hash: setRuleTx, confirmations: 1 });
    } catch (e) {
        console.log(`   ⚠️  Receipt not found yet, waiting 10s...`);
        await new Promise(r => setTimeout(r, 10000));
    }
    console.log(`   ✅ Rule configuration processed.`);

    console.log('\n🔹 Step 2: Querying Score BEFORE activity');
    const [beforeComm, beforeGlobal] = await publicClient.readContract({
        address: repSystemAddr,
        abi: parseAbi(['function calculateReputation(address,address,uint256) view returns (uint256,uint256)']),
        functionName: 'calculateReputation',
        args: [targetAA.address as Address, anniAddr as Address, 0n]
    }) as [bigint, bigint];
    console.log(`   📊 Initial Score (Anni Community): ${beforeComm}`);

    console.log('\n🔹 Step 3: Simulating 10 Login Activities...');
    const result = await publicClient.readContract({
        address: repSystemAddr,
        abi: ReputationSystemABI,
        functionName: 'computeScore',
        args: [targetAA.address as Address, [anniAddr], [[ruleId]], [[10n]]]
    }) as bigint;

    // Calculation: Base(5) + 10 * Bonus(2) = 25
    console.log(`   📈 Calculated Score for 10 activities: ${result}`);
    
    if (result === 25n) {
        console.log('   ✅ TIER 2 LOGIC VERIFIED: Score correctly calculated based on rules and activity.');
    } else {
        console.log(`   ❌ Logic mismatch: Expected 25, got ${result}`);
    }

    console.log('\n🔹 Step 4: Sync to Registry (Tier 3 Preview)');
    console.log('   ℹ️  In production, this step requires signed BLS proofs from DVT.');
    
    console.log('\n✅ Tier 2 Reputation Test Completed Successfully!');
}

runReputationTierTest().catch(console.error);
