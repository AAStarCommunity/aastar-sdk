#!/usr/bin/env node
/**
 * Generate .env.v3 from SuperPaymaster deployment config
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPERPM_CONFIG = path.resolve(__dirname, '../../SuperPaymaster/script/v3/config.json');
const ENV_TEMPLATE = path.resolve(__dirname, '../../SuperPaymaster/.env.example');
const OUTPUT_FILE = path.resolve(__dirname, '../.env.v3');

async function main() {
    console.log('📝 Generating .env.v3 from SuperPaymaster deployment...\n');
    
    // Load config
    if (!fs.existsSync(SUPERPM_CONFIG)) {
        console.error(`❌ Config not found: ${SUPERPM_CONFIG}`);
        console.log('💡 Please ensure SuperPaymaster is deployed locally or on Sepolia');
        process.exit(1);
    }
    
    const config = JSON.parse(fs.readFileSync(SUPERPM_CONFIG, 'utf-8'));
    console.log('✅ Loaded contract addresses from config.json');
    
    // Generate env content
    const envLines: string[] = [
        '# Auto-generated from SuperPaymaster deployment',
        '# Generated at: ' + new Date().toISOString(),
        '',
        '# Network RPCs (PLEASE FILL THESE IN)',
        'SEPOLIA_RPC_URL=',
        'OPTIMISM_RPC_URL=',
        'ALCHEMY_BUNDLER_RPC_URL=',
        '',
        '# Pimlico',
        'PIMLICO_API_KEY=pim_98Pb9bdb42J4KoD24UZt8v',
        '',
        '# Private Keys (PLEASE FILL THESE IN - DO NOT COMMIT)',
        'PRIVATE_KEY_JASON=',
        'OWNER_PRIVATE_KEY=',
        'OWNER2_PRIVATE_KEY=',
        '',
        '# ETH Price for USD calculation',
        'ETH_USD_PRICE=3500',
        '',
        '# Contract Addresses (from deployment)',
        `SUPER_PAYMASTER_ADDRESS=${config.superPaymaster || config.paymasterV4Proxy}`,
        `PAYMASTER_V4_ADDRESS=${config.paymasterV4Proxy}`,
        `MYSBT_ADDRESS=${config.sbt}`,
        `APNTS_ADDRESS=${config.aPNTs}`,
        `BPNTS_ADDRESS=${config.gToken}`,
        `GTOKEN_ADDRESS=${config.gToken}`,
        `GTOKEN_STAKING_ADDRESS=${config.staking}`,
        `REGISTRY_ADDRESS=${config.registry}`,
        `REPUTATION_SYSTEM_ADDRESS=${config.reputationSystem}`,
        `OPERATOR_ADDRESS=`, // Will be set by user's operator
        '',
        '# EntryPoint',
        `ENTRYPOINT_ADDRESS=${config.entryPoint}`,
        '',
        '# Test Accounts (PLEASE FILL THESE IN)',
        '# These should be the deployed SimpleAccount addresses',
        'TEST_SIMPLE_ACCOUNT_A=',
        'TEST_SIMPLE_ACCOUNT_B=',
        'TEST_SIMPLE_ACCOUNT_C=',
        '',
        '# SimpleAccount Factory',
        `SIMPLE_ACCOUNT_FACTORY=${config.simpleAccountFactory}`,
        '',
        '# Experiment Settings',
        'EXPERIMENT_RUNS=30',
        'EXPERIMENT_NETWORK=sepolia',
        ''
    ];
    
    // Write to file
    fs.writeFileSync(OUTPUT_FILE, envLines.join('\n'));
    console.log(`\n✅ Generated: ${OUTPUT_FILE}`);
    
    // Show what needs to be filled
    console.log('\n⚠️  REQUIRED: Please manually fill in the following:');
    console.log('   1. SEPOLIA_RPC_URL (Alchemy/Infura)');
    console.log('   2. OPTIMISM_RPC_URL (for mainnet experiments)');
    console.log('   3. ALCHEMY_BUNDLER_RPC_URL');
    console.log('   4. PRIVATE_KEY_JASON (your EOA private key)');
    console.log('   5. OWNER_PRIVATE_KEY (Account A owner)');
    console.log('   6. OWNER2_PRIVATE_KEY (Account C owner)');
    console.log('   7. OPERATOR_ADDRESS (your operator address)');
    console.log('   8. TEST_SIMPLE_ACCOUNT_A/B/C (deployed account addresses)');
    
    console.log('\n💡 TIP: Check SuperPaymaster project for deployed test accounts');
    console.log('   Or run: cd ../SuperPaymaster && ./run_full_anvil_test.sh');
    
    // Show summary
    console.log('\n📊 Extracted Contract Addresses:');
    console.log(`   SuperPaymaster: ${config.superPaymaster || config.paymasterV4Proxy}`);
    console.log(`   PaymasterV4: ${config.paymasterV4Proxy}`);
    console.log(`   MySBT: ${config.sbt}`);
    console.log(`   aPNTs: ${config.aPNTs}`);
    console.log(`   GToken: ${config.gToken}`);
    console.log(`   EntryPoint: ${config.entryPoint}`);
}

main().catch(console.error);
