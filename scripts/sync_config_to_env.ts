import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG_PATH = path.resolve(__dirname, '../../SuperPaymaster/script/v3/config.json');
const ENV_FILES = [
    path.resolve(__dirname, '../.env.v3'),
    path.resolve(__dirname, '../.env.anvil')
];

function sync() {
    console.log('🔄 Syncing config.json to environment files...');

    if (!fs.existsSync(CONFIG_PATH)) {
        console.error(`❌ Config file not found: ${CONFIG_PATH}`);
        process.exit(1);
    }

    const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    
    // ... (updates object is defined above)
    const updates: Record<string, string> = {
        'RPC_URL': 'http://127.0.0.1:8545',
        'BUNDLER_RPC': 'http://127.0.0.1:8545',
        'ADMIN_KEY': '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
        'PRIVATE_KEY_SUPPLIER': '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
        'REGISTRY_ADDR': config.registry,
        'REGISTRY_ADDRESS': config.registry,
        'GTOKEN_ADDR': config.gToken,
        'GTOKEN_ADDRESS': config.gToken,
        'STAKING_ADDR': config.staking,
        'GTOKEN_STAKING': config.staking,
        'GTOKENSTAKING_ADDRESS': config.staking,
        'SBT_ADDR': config.sbt,
        'MYSBT_ADDRESS': config.sbt,
        'SUPER_PAYMASTER': config.superPaymaster,
        'SUPERPAYMASTER_ADDR': config.superPaymaster,
        'PAYMASTER_ADDRESS': config.superPaymaster,
        'XPNTS_ADDR': config.aPNTs,
        'APNTS': config.aPNTs,
        'APNTS_ADDRESS': config.aPNTs,
        'APNTS_TOKEN': config.aPNTs,
        'XPNTS_FACTORY_ADDR': config.xPNTsFactory,
        'PAYMASTER_FACTORY_ADDR': config.paymasterFactory,
        'ENTRY_POINT_ADDR': config.entryPoint,
        'MOCK_ENTRY_POINT': config.entryPoint,
        'REPUTATION_SYSTEM_ADDR': config.reputationSystem,
        'DVT_VALIDATOR_ADDR': config.dvtValidator,
        'BLS_AGGREGATOR_ADDR': config.blsAggregator,
        'BLS_VALIDATOR_ADDR': config.blsValidator || config.blsValidatorStrategy,
        'PAYMASTER_V4_ADDRESS': config.paymasterV4,
        'RECEIVER': '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', 
        'ALICE_AA_ACCOUNT': '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', 
        'ACCOUNT_C': '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
    };

    ENV_FILES.forEach(envPath => {
        let envContent = '';
        if (fs.existsSync(envPath)) {
            envContent = fs.readFileSync(envPath, 'utf-8');
        }

        const keysToRemove = new Set(Object.keys(updates));
        const lines = envContent.split('\n');
        const filteredLines = lines.filter(line => {
            if (!line.trim() || line.startsWith('#')) return true;
            const key = line.split('=')[0].trim();
            return !keysToRemove.has(key);
        });

        const newLines = [...filteredLines];
        if (newLines.length > 0 && newLines[newLines.length-1].trim() !== '') {
            newLines.push(''); // Add spacing
        }
        for (const [key, value] of Object.entries(updates)) {
            if (!value) continue;
            newLines.push(`${key}=${value}`);
        }

        fs.writeFileSync(envPath, newLines.join('\n').trim() + '\n');
        console.log(`✅ ${path.basename(envPath)} updated successfully.`);
    });
}

sync();
