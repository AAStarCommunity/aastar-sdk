const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.resolve(__dirname, '../../SuperPaymaster/deployments/config.anvil.json');
const ENV_PATH = path.resolve(__dirname, '../.env.anvil');

if (!fs.existsSync(CONFIG_PATH)) {
    console.error(`❌ Config not found: ${CONFIG_PATH}`);
    process.exit(1);
}

const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
let envContent = fs.readFileSync(ENV_PATH, 'utf8');

const mapping = {
    'registry': 'REGISTRY_ADDRESS',
    'gToken': 'GTOKEN_ADDRESS',
    'staking': 'STAKING_ADDRESS',
    'superPaymaster': 'SUPERPAYMASTER_ADDRESS',
    'aPNTs': 'APNTS_TOKEN_ADDRESS',
    'simpleAccountFactory': 'SIMPLE_ACCOUNT_FACTORY',
    'entryPoint': 'ENTRY_POINT_ADDRESS',
    'paymaster': 'PAYMASTER_IMPL_ADDRESS'
};

console.log('🔄 Syncing Anvil configuration to .env.anvil...');

Object.entries(mapping).forEach(([configKey, envKey]) => {
    const value = config[configKey];
    if (value) {
        const regex = new RegExp(`^${envKey}=.*`, 'm');
        if (regex.test(envContent)) {
            envContent = envContent.replace(regex, `${envKey}=${value}`);
        } else {
            envContent += `\n${envKey}=${value}`;
        }
        console.log(`   ✅ ${envKey}=${value}`);
    } else {
        console.warn(`   ⚠️  Warning: ${configKey} not found in config.json`);
    }
});

fs.writeFileSync(ENV_PATH, envContent);
console.log('🎉 .env.anvil updated successfully!');
