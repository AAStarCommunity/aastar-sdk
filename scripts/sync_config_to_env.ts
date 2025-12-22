import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG_PATH = path.resolve(__dirname, '../../SuperPaymaster/script/v3/config.json');
const ENV_PATH = path.resolve(__dirname, '../.env.v3');

function sync() {
    console.log('🔄 Syncing config.json to .env.v3...');

    if (!fs.existsSync(CONFIG_PATH)) {
        console.error(`❌ Config file not found: ${CONFIG_PATH}`);
        process.exit(1);
    }

    const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    let envContent = '';

    if (fs.existsSync(ENV_PATH)) {
        envContent = fs.readFileSync(ENV_PATH, 'utf-8');
    }

    const updates: Record<string, string> = {
        'RPC_URL': 'http://127.0.0.1:8545',
        'BUNDLER_RPC': 'http://127.0.0.1:8545',
        'ADMIN_KEY': '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
        'REGISTRY_ADDR': config.registry,
        'GTOKEN_ADDR': config.gToken,
        'STAKING_ADDR': config.staking,
        'SBT_ADDR': config.sbt,
        'SUPER_PAYMASTER': config.superPaymaster,
        'XPNTS_ADDR': config.aPNTs,
        'XPNTS_FACTORY_ADDR': config.xPNTsFactory,
        'PAYMASTER_FACTORY_ADDR': config.paymasterFactory,
        'ENTRYpoint_ADDR': config.entryPoint,
        'REPUTATION_SYSTEM_ADDR': config.reputationSystem,
        'DVT_VALIDATOR_ADDR': config.dvtValidator,
        'BLS_AGGREGATOR_ADDR': config.blsAggregator,
        // Legacy Aliases
        'SUPERPAYMASTER_ADDR': config.superPaymaster,
        'APNTS': config.aPNTs,
        'MOCK_ENTRY_POINT': config.entryPoint,
        'PRIVATE_KEY_SUPPLIER': '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
        'GTOKEN_ADDRESS': config.gToken,
        'GTOKEN_STAKING': config.staking,
        'REGISTRY_ADDRESS': config.registry,
        'MYSBT_ADDRESS': config.sbt,
        'PAYMASTER_ADDRESS': config.superPaymaster,
        'RECEIVER': '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', 
        'ALICE_AA_ACCOUNT': '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', // Anvil #0
        'ACCOUNT_C': '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
    };

    const lines = envContent.split('\n');
    const newLines = [...lines];

    for (const [key, value] of Object.entries(updates)) {
        if (!value) continue;
        const index = newLines.findIndex(line => line.startsWith(`${key}=`));
        if (index !== -1) {
            newLines[index] = `${key}=${value}`;
        } else {
            newLines.push(`${key}=${value}`);
        }
    }

    fs.writeFileSync(ENV_PATH, newLines.join('\n').trim() + '\n');
    console.log('✅ .env.v3 updated successfully.');
}

sync();
