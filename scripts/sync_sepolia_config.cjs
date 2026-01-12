#!/usr/bin/env node

/**
 * Sync Sepolia Configuration from SuperPaymaster to SDK
 * 
 * This script reads the latest contract addresses from SuperPaymaster's
 * config.sepolia.json and updates the SDK's .env.sepolia file.
 */

const fs = require('fs');
const path = require('path');

// Paths
const SUPERPAYMASTER_CONFIG = path.join(__dirname, '../../SuperPaymaster/config.sepolia.json');
const SDK_ENV_SEPOLIA = path.join(__dirname, '../.env.sepolia');

console.log('\n🔄 Syncing Sepolia Configuration from SuperPaymaster to SDK...\n');

// Read SuperPaymaster config
if (!fs.existsSync(SUPERPAYMASTER_CONFIG)) {
    console.error('❌ SuperPaymaster config.sepolia.json not found!');
    process.exit(1);
}

const config = JSON.parse(fs.readFileSync(SUPERPAYMASTER_CONFIG, 'utf8'));
console.log('✅ Loaded SuperPaymaster config:', Object.keys(config).length, 'addresses');

// Read existing SDK .env.sepolia
let envContent = fs.existsSync(SDK_ENV_SEPOLIA) 
    ? fs.readFileSync(SDK_ENV_SEPOLIA, 'utf8') 
    : '';

// Helper function to update or add env variable
function updateEnvVar(content, key, value) {
    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (regex.test(content)) {
        return content.replace(regex, `${key}=${value}`);
    } else {
        return content + `\n${key}=${value}`;
    }
}

// Sync addresses from SuperPaymaster config
const addressMap = {
    'gToken': 'GTOKEN_ADDRESS',
    'staking': 'STAKING_ADDRESS',
    'registry': 'REGISTRY_ADDRESS',
    'sbt': 'MYSBT_ADDRESS',
    'reputationSystem': 'REPUTATION_SYSTEM_ADDRESS',
    'aPNTs': 'APNTS_ADDRESS',
    'xPNTsFactory': 'XPNTS_FACTORY_ADDRESS',
    'paymasterV4Proxy': 'PAYMASTER_V4_PROXY',
    'paymasterV4': 'PAYMASTER_V4_IMPL',
    'paymasterFactory': 'PAYMASTER_FACTORY',
    'superPaymaster': 'SUPER_PAYMASTER',
    'blsValidator': 'BLS_VALIDATOR_ADDR',
    'blsAggregator': 'BLS_AGGREGATOR_ADDR',
    'dvtValidator': 'DVT_VALIDATOR_ADDR'
};

console.log('\n📝 Updating addresses in .env.sepolia...\n');

for (const [configKey, envKey] of Object.entries(addressMap)) {
    if (config[configKey]) {
        envContent = updateEnvVar(envContent, envKey, config[configKey]);
        console.log(`  ✓ ${envKey} = ${config[configKey]}`);
    }
}

// Also update the legacy names for compatibility
if (config.superPaymaster) {
    envContent = updateEnvVar(envContent, 'PAYMASTER_ADDRESS', config.superPaymaster);
    envContent = updateEnvVar(envContent, 'SUPERPAYMASTER_ADDRESS', config.superPaymaster);
    envContent = updateEnvVar(envContent, 'PAYMASTER_SUPER', config.superPaymaster);
}

if (config.staking) {
    envContent = updateEnvVar(envContent, 'GTOKENSTAKING_ADDRESS', config.staking);
}

if (config.registry) {
    envContent = updateEnvVar(envContent, 'REGISTRY', config.registry);
}

// Write updated content back
fs.writeFileSync(SDK_ENV_SEPOLIA, envContent.trim() + '\n', 'utf8');

console.log('\n✅ Sepolia configuration synced successfully!\n');
console.log('📍 Updated file:', SDK_ENV_SEPOLIA);
console.log('\n🎯 Ready to run Sepolia regression tests!\n');
