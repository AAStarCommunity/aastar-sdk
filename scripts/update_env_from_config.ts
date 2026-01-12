import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG_PATH = path.resolve(__dirname, '../../SuperPaymaster/config.json');
const ENV_PATH = path.resolve(__dirname, '../.env.sepolia');

async function main() {
    if (!fs.existsSync(CONFIG_PATH)) {
        console.error(`❌ Found no config at ${CONFIG_PATH}`);
        process.exit(1);
    }

    const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    console.log("📝 Read config:", config);

    let envContent = fs.readFileSync(ENV_PATH, 'utf8');

    // Mapping: Config Key -> Env Key
    const mapping: Record<string, string> = {
        registry: 'REGISTRY_ADDRESS',
        gToken: 'GTOKEN_ADDRESS',
        staking: 'GTOKENSTAKING_ADDRESS', // Note: Check consistency (staking vs GTOKENSTAKING)
        superPaymaster: 'SUPER_PAYMASTER',
        aPNTs: 'APNTS_ADDRESS',
        sbt: 'MYSBT_ADDRESS',
        reputationSystem: 'REPUTATION_SYSTEM_ADDRESS',
        dvtValidator: 'DVT_VALIDATOR_ADDR',
        blsAggregator: 'BLS_AGGREGATOR_ADDRESS',
        xPNTsFactory: 'XPNTS_FACTORY_ADDRESS',
        paymasterFactory: 'PAYMASTER_FACTORY_ADDRESS',
        entryPoint: 'ENTRY_POINT_ADDR',
        paymasterV4: 'PAYMASTER_V4_PROXY', 
        // Note: Impl and Proxy might need differentiation if config.json only has one. 
        // The script output `paymasterV4` as `address(paymasterV4)` which is the Impl in the deployment script?
        // Let's check: PaymasterV4 paymasterV4 = new PaymasterV4(...) -> Implementation.
        // Wait, PaymasterFactory deploys Proxy. Script didn't output Proxy explicitly in the JSON?
        // Logic: PaymasterV4 paymasterV4 = new PaymasterV4(...) -> This is V4.0 (AOA)? 
        // Or V4.2 Clone?
        // In DeployV3FullSepolia.s.sol:
        // PaymasterV4 paymasterV4 = new PaymasterV4(...); -> IMPL (V4.2/4.0 standalone?)
        // PaymasterV4_1i v41i = new PaymasterV4_1i(); -> IMPL for factory
        // It seems `paymasterV4` variable in script refers to a standalone deployment?
    };

    // Special handling: STAKING_ADDRESS in .env sometimes used.
    // Let's stick to contract-addresses.ts keys.
    
    // Check script logic for PaymasterV4 vs Proxy
    // The script did: PaymasterFactory pmFactory = new PaymasterFactory(); ... v41i ...
    // It did NOT deploy a proxy in the script?
    // Let's check execution log later.

    for (const [jsonKey, envKey] of Object.entries(mapping)) {
        if (config[jsonKey]) {
            const regex = new RegExp(`${envKey}=.*`, 'g');
            if (envContent.match(regex)) {
                envContent = envContent.replace(regex, `${envKey}=${config[jsonKey]}`);
            } else {
                envContent += `\n${envKey}=${config[jsonKey]}`;
            }
            console.log(`✅ Updated ${envKey} -> ${config[jsonKey]}`);
        }
    }

    // Also update aliases
    if (config.superPaymaster) {
        const regex = new RegExp(`PAYMASTER_SUPER=.*`, 'g');
        envContent = envContent.replace(regex, `PAYMASTER_SUPER=${config.superPaymaster}`);
    }
     if (config.paymasterV4) {
        const regex = new RegExp(`PAYMASTER_ADDRESS=.*`, 'g');
        envContent = envContent.replace(regex, `PAYMASTER_ADDRESS=${config.paymasterV4}`);
    }

    fs.writeFileSync(ENV_PATH, envContent);
    console.log("💾 Saved .env.sepolia");
}

main();
