#!/usr/bin/env node
/**
 * Environment Validation Script
 * 
 * Checks if all necessary environment variables are set for the experiment runner
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { createPublicClient, http } from 'viem';
import { sepolia, optimism } from 'viem/chains';

dotenv.config({ path: path.resolve(process.cwd(), '.env.v3') });

interface ValidationResult {
    name: string;
    status: 'OK' | 'MISSING' | 'INVALID';
    value?: string;
    message?: string;
}

const results: ValidationResult[] = [];

function check(name: string, value: string | undefined, required: boolean = true): void {
    if (!value) {
        results.push({
            name,
            status: required ? 'MISSING' : 'OK',
            message: required ? 'Required but not set' : 'Optional (not set)'
        });
    } else {
        results.push({
            name,
            status: 'OK',
            value: value.substring(0, 20) + (value.length > 20 ? '...' : '')
        });
    }
}

async function validateRPC(name: string, url: string | undefined): Promise<void> {
    if (!url) {
        results.push({ name, status: 'MISSING', message: 'RPC URL not set' });
        return;
    }
    
    try {
        const chain = name.includes('SEPOLIA') ? sepolia : optimism;
        const client = createPublicClient({ chain, transport: http(url) });
        const blockNumber = await client.getBlockNumber();
        results.push({
            name,
            status: 'OK',
            value: `Connected (Block: ${blockNumber})`
        });
    } catch (e: any) {
        results.push({
            name,
            status: 'INVALID',
            message: `Failed to connect: ${e.message}`
        });
    }
}

async function main() {
    console.log('🔍 Validating Experiment Environment...\n');
    
    // Network RPCs
    console.log('📡 Network RPCs:');
    await validateRPC('SEPOLIA_RPC_URL', process.env.SEPOLIA_RPC_URL);
    await validateRPC('OPTIMISM_RPC_URL', process.env.OPTIMISM_RPC_URL);
    check('ALCHEMY_BUNDLER_RPC_URL', process.env.ALCHEMY_BUNDLER_RPC_URL);
    check('PIMLICO_API_KEY', process.env.PIMLICO_API_KEY);
    
    // Private Keys
    console.log('\n🔑 Private Keys:');
    check('PRIVATE_KEY_JASON', process.env.PRIVATE_KEY_JASON);
    check('OWNER_PRIVATE_KEY', process.env.OWNER_PRIVATE_KEY);
    check('OWNER2_PRIVATE_KEY', process.env.OWNER2_PRIVATE_KEY);
    
    // Contract Addresses
    console.log('\n📝 Contract Addresses:');
    check('SUPER_PAYMASTER_ADDRESS', process.env.SUPER_PAYMASTER_ADDRESS);
    check('PAYMASTER_V4_ADDRESS', process.env.PAYMASTER_V4_ADDRESS);
    check('MYSBT_ADDRESS', process.env.MYSBT_ADDRESS);
    check('APNTS_ADDRESS', process.env.APNTS_ADDRESS);
    check('BPNTS_ADDRESS', process.env.BPNTS_ADDRESS);
    check('OPERATOR_ADDRESS', process.env.OPERATOR_ADDRESS);
    
    // Test Accounts
    console.log('\n👤 Test Accounts:');
    check('TEST_SIMPLE_ACCOUNT_A', process.env.TEST_SIMPLE_ACCOUNT_A);
    check('TEST_SIMPLE_ACCOUNT_B', process.env.TEST_SIMPLE_ACCOUNT_B);
    check('TEST_SIMPLE_ACCOUNT_C', process.env.TEST_SIMPLE_ACCOUNT_C);
    
    // Print Results
    console.log('\n' + '='.repeat(70));
    console.log('VALIDATION RESULTS');
    console.log('='.repeat(70));
    
    const grouped = {
        OK: results.filter(r => r.status === 'OK'),
        MISSING: results.filter(r => r.status === 'MISSING'),
        INVALID: results.filter(r => r.status === 'INVALID')
    };
    
    console.log(`\n✅ OK: ${grouped.OK.length}`);
    grouped.OK.forEach(r => console.log(`   ${r.name}: ${r.value || 'Set'}`));
    
    if (grouped.MISSING.length > 0) {
        console.log(`\n⚠️  MISSING: ${grouped.MISSING.length}`);
        grouped.MISSING.forEach(r => console.log(`   ${r.name}: ${r.message}`));
    }
    
    if (grouped.INVALID.length > 0) {
        console.log(`\n❌ INVALID: ${grouped.INVALID.length}`);
        grouped.INVALID.forEach(r => console.log(`   ${r.name}: ${r.message}`));
    }
    
    // Summary
    console.log('\n' + '='.repeat(70));
    const critical = grouped.MISSING.filter(r => 
        r.name.includes('RPC') || 
        r.name.includes('PRIVATE_KEY') || 
        r.name === 'SUPER_PAYMASTER_ADDRESS'
    );
    
    if (critical.length > 0) {
        console.log('❌ CRITICAL ISSUES FOUND - Cannot proceed with experiments');
        console.log('   Please set the following in .env.v3:');
        critical.forEach(r => console.log(`   - ${r.name}`));
        process.exit(1);
    } else if (grouped.MISSING.length > 0 || grouped.INVALID.length > 0) {
        console.log('⚠️  NON-CRITICAL ISSUES - Some experiments may fail');
        console.log('   Consider reviewing the MISSING/INVALID items above');
    } else {
        console.log('✅ ALL CHECKS PASSED - Ready for experiments!');
    }
}

main().catch(console.error);
