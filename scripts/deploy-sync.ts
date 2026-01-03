import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const SDK_ENV_PATH = path.resolve(__dirname, '../.env.sepolia');
const SUPERPAYMASTER_DIR = path.resolve(__dirname, '../../SuperPaymaster');
const SP_CONFIG_PATH = path.resolve(SUPERPAYMASTER_DIR, 'config.sepolia.json');
const SP_ENV_PATH = path.resolve(SUPERPAYMASTER_DIR, '.env.sepolia');

// Load SDK Env
dotenv.config({ path: SDK_ENV_PATH });

// Check Flags
const FORCE_REDEPLOY = process.argv.includes('--redeploy');

async function main() {
    console.log('🔄 Deployment Sync Manager');

    // 1. Check existing addresses in SDK .env (Basic Check)
    const existingRegistry = process.env.REGISTRY_ADDRESS;
    const existingSP = process.env.SUPER_PAYMASTER_ADDRESS;
    
    // We consider it "deployed" if we have meaningful addresses.
    // However, the source of truth is SuperPaymaster/config.sepolia.json.
    // If that file exists and has addresses, we can just sync.
    // If not, or if --redeploy is passed, we deploy.

    let shouldDeploy = FORCE_REDEPLOY;
    
    if (!fs.existsSync(SP_CONFIG_PATH)) {
        console.log('⚠️  Config file missing in SuperPaymaster. Triggering deployment.');
        shouldDeploy = true;
    } else {
        const spConfig = JSON.parse(fs.readFileSync(SP_CONFIG_PATH, 'utf-8'));
        if (!spConfig.superPaymaster || !spConfig.registry) {
             console.log('⚠️  Incomplete config in SuperPaymaster. Triggering deployment.');
             shouldDeploy = true;
        }
    }
    
    // 2. Execute Deployment if needed
    if (shouldDeploy) {
        console.log('🚀 Executing Deployment via Forge Script...');
        
        // Ensure .env exists in SuperPaymaster (Sync downwards if needed)
        // We copy SDK env to SuperPaymaster to ensure keys match
        fs.copyFileSync(SDK_ENV_PATH, SP_ENV_PATH);
        
        try {
            // Run Forge Script
            const cmd = `export CONFIG_FILE=config.sepolia.json && source .env.sepolia && export PRIVATE_KEY=$PRIVATE_KEY_JASON && forge script contracts/script/DeployV3FullSepolia.s.sol:DeployV3FullSepolia --rpc-url $RPC_URL --broadcast --legacy`;
            execSync(cmd, { cwd: SUPERPAYMASTER_DIR, stdio: 'inherit', shell: '/bin/bash' });
            console.log('✅ Deployment Complete');
        } catch (e) {
            console.error('❌ Deployment Failed');
            process.exit(1);
        }
    } else {
        console.log('✅ Found existing configuration. Skipping deployment (Use --redeploy to force).');
    }

    // 3. Sync Upwards (Propagate config.sepolia.json -> SDK .env.sepolia)
    console.log('📥 Syncing addresses to SDK .env.sepolia...');
    if (fs.existsSync(SP_CONFIG_PATH)) {
        const spConfig = JSON.parse(fs.readFileSync(SP_CONFIG_PATH, 'utf-8'));
        
        let envContent = fs.readFileSync(SDK_ENV_PATH, 'utf-8');
        
        // Update Helper
        const updateEnv = (key: string, val: string) => {
            if (!val) return;
            const regex = new RegExp(`^${key}=.*`, 'm');
            if (regex.test(envContent)) {
                envContent = envContent.replace(regex, `${key}=${val}`);
            } else {
                envContent += `\n${key}=${val}`;
            }
            console.log(`   - ${key}: ${val}`);
        };

        updateEnv('REGISTRY_ADDRESS', spConfig.registry);
        updateEnv('GTOKEN_ADDRESS', spConfig.gToken);
        updateEnv('GTOKEN_STAKING_ADDRESS', spConfig.staking);
        updateEnv('SBT_ADDRESS', spConfig.sbt);
        updateEnv('REPUTATION_ADDRESS', spConfig.reputationSystem);
        updateEnv('SUPER_PAYMASTER_ADDRESS', spConfig.superPaymaster);
        updateEnv('XPNTS_FACTORY_ADDRESS', spConfig.xPNTsFactory);
        updateEnv('PAYMASTER_FACTORY_ADDRESS', spConfig.paymasterFactory);
        
        fs.writeFileSync(SDK_ENV_PATH, envContent);
        console.log('✅ Sync Complete');
    } else {
        console.error('❌ Config file still missing after deployment attempt.');
        process.exit(1);
    }
}

main();
