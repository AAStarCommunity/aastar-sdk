#!/usr/bin/env node

/**
 * Sync Sepolia deployment config from SuperPaymaster to aastar-sdk
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const DEPLOYED_JSON = path.resolve(__dirname, '../SuperPaymaster/script/v3/config/deployed.json');
const ENV_SEPOLIA = path.resolve(__dirname, '.env.sepolia');

console.log('🔄 Syncing Sepolia deployment config...\n');

// Read deployed.json
const deployed = JSON.parse(fs.readFileSync(DEPLOYED_JSON, 'utf8'));
console.log('📖 Read deployed.json:', deployed);

// Read current .env.sepolia
let envContent = fs.readFileSync(ENV_SEPOLIA, 'utf8');

// Mapping from deployed.json to .env.sepolia
const addressMappings = {
    'GTOKEN_ADDRESS': deployed.gToken,
    'STAKING_ADDRESS': deployed.staking,
    'GTOKENSTAKING_ADDRESS': deployed.staking, // Alias
    'REGISTRY_ADDRESS': deployed.registry,
    'MYSBT_ADDRESS': deployed.sbt,
    'REPUTATION_SYSTEM_ADDRESS': deployed.reputationSystem,
    'APNTS_ADDRESS': deployed.aPNTs,
    'SUPER_PAYMASTER': deployed.superPaymaster,
    'SUPERPAYMASTER_ADDRESS': deployed.superPaymaster, // Alias
    'XPNTS_FACTORY_ADDRESS': deployed.xPNTsFactory,
    'PAYMASTER_V4_PROXY': deployed.paymasterV4Proxy,
    'PAYMASTER_FACTORY_ADDRESS': deployed.paymasterFactory,
    'ENTRYPOINT_ADDRESS': deployed.entryPoint,
    'DVT_VALIDATOR_ADDRESS': deployed.dvtValidator,
    'BLS_AGGREGATOR_ADDRESS': deployed.blsAggregator,
    'BLS_VALIDATOR_ADDRESS': deployed.blsValidator || '0x0DCd1Bf9A1b36cE34237eEaFef220932846BCD82',
};

console.log('\n📝 Updating addresses in .env.sepolia...\n');

// Update each address
for (const [key, value] of Object.entries(addressMappings)) {
    if (!value) {
        console.log(`⚠️  Skipping ${key} (not in deployed.json)`);
        continue;
    }
    
    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (envContent.match(regex)) {
        envContent = envContent.replace(regex, `${key}=${value}`);
        console.log(`✅ Updated ${key}=${value}`);
    } else {
        // Add if not exists
        envContent += `\n${key}=${value}`;
        console.log(`➕ Added ${key}=${value}`);
    }
}

// Write back
fs.writeFileSync(ENV_SEPOLIA, envContent);

console.log('\n✅ Sync completed!\n');
console.log('📋 Updated addresses:');
for (const [key, value] of Object.entries(addressMappings)) {
    if (value) console.log(`   ${key}: ${value}`);
}
