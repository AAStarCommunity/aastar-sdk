#!/usr/bin/env node
/**
 * Complete .env.anvil with data from SuperPaymaster project
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ENV_FILE = path.resolve(__dirname, '../.env.anvil');
const SUPERPM_ENV = path.resolve(__dirname, '../../SuperPaymaster/.env.anvil.bak');
const TEST_ACCOUNTS = path.resolve(__dirname, '../../SuperPaymaster/test-accounts/accounts.json');

async function main() {
    console.log('🔧 Completing .env.anvil configuration...\n');
    
    // Load current env
    let envContent = fs.readFileSync(ENV_FILE, 'utf-8');
    
    // Load SuperPaymaster env for RPC URLs and keys
    const superpmEnv = fs.readFileSync(SUPERPM_ENV, 'utf-8');
    
    // Extract values
    const sepoliaRPC = superpmEnv.match(/SEPOLIA_RPC_URL="(.+)"/)?.[1];
    const ownerKey = superpmEnv.match(/OWNER_PRIVATE_KEY="(.+)"/)?.[1];
    const owner2Key = superpmEnv.match(/OWNER2_PRIVATE_KEY="(.+)"/)?.[1];
    const deployerKey = superpmEnv.match(/DEPLOYER_PRIVATE_KEY="(.+)"/)?.[1] || superpmEnv.match(/PRIVATE_KEY="(.+)"/)?.[1];
    
    console.log('✅ Extracted from SuperPaymaster .env:');
    console.log(`   Sepolia RPC: ${sepoliaRPC?.substring(0, 50)}...`);
    console.log(`   Keys found: ${!!ownerKey}, ${!!owner2Key}, ${!!deployerKey}`);
    
    // Load test accounts
    let accountA, accountB, accountC;
    if (fs.existsSync(TEST_ACCOUNTS)) {
        const accounts = JSON.parse(fs.readFileSync(TEST_ACCOUNTS, 'utf-8'));
        // Assume first 3 accounts are A, B, C
        accountA = accounts[0]?.simpleAccount;
        accountB = accounts[1]?.simpleAccount;
        accountC = accounts[2]?.simpleAccount;
        console.log('\n✅ Extracted test accounts:');
        console.log(`   Account A: ${accountA}`);
        console.log(`   Account B: ${accountB}`);
        console.log(`   Account C: ${accountC}`);
    }
    
    // Replace placeholders
    if (sepoliaRPC) {
        envContent = envContent.replace(/SEPOLIA_RPC_URL=\s*$/m, `SEPOLIA_RPC_URL=${sepoliaRPC}`);
        envContent = envContent.replace(/ALCHEMY_BUNDLER_RPC_URL=\s*$/m, `ALCHEMY_BUNDLER_RPC_URL=${sepoliaRPC}`);
    }
    
    // For Optimism, use a default or leave empty
    envContent = envContent.replace(/OPTIMISM_RPC_URL=\s*$/m, 'OPTIMISM_RPC_URL=https://mainnet.optimism.io');
    
    if (deployerKey) {
        envContent = envContent.replace(/PRIVATE_KEY_JASON=\s*$/m, `PRIVATE_KEY_JASON=${deployerKey}`);
    }
    
    if (ownerKey) {
        envContent = envContent.replace(/OWNER_PRIVATE_KEY=\s*$/m, `OWNER_PRIVATE_KEY=${ownerKey}`);
    }
    
    if (owner2Key) {
        envContent = envContent.replace(/OWNER2_PRIVATE_KEY=\s*$/m, `OWNER2_PRIVATE_KEY=${owner2Key}`);
    }
    
    // Set operator to deployer/owner address for now
    if (deployerKey) {
        const { privateKeyToAccount } = await import('viem/accounts');
        const account = privateKeyToAccount(deployerKey as `0x${string}`);
        envContent = envContent.replace(/OPERATOR_ADDRESS=\s*$/m, `OPERATOR_ADDRESS=${account.address}`);
        console.log(`\n✅ Set OPERATOR_ADDRESS to: ${account.address}`);
    }
    
    // Set test accounts
    if (accountA) {
        envContent = envContent.replace(/TEST_SIMPLE_ACCOUNT_A=\s*$/m, `TEST_SIMPLE_ACCOUNT_A=${accountA}`);
    }
    if (accountB) {
        envContent = envContent.replace(/TEST_SIMPLE_ACCOUNT_B=\s*$/m, `TEST_SIMPLE_ACCOUNT_B=${accountB}`);
    }
    if (accountC) {
        envContent = envContent.replace(/TEST_SIMPLE_ACCOUNT_C=\s*$/m, `TEST_SIMPLE_ACCOUNT_C=${accountC}`);
    }
    
    // Write back
    fs.writeFileSync(ENV_FILE, envContent);
    console.log(`\n✅ Updated: ${ENV_FILE}`);
    console.log('\n🎉 Configuration complete! Run validation:');
    console.log('   npx ts-node scripts/validate_environment.ts');
}

main().catch(console.error);
