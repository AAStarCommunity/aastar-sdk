import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Paths
const SUPER_PAYMASTER_ABIS = path.resolve('../SuperPaymaster/abis');
const SDK_CORE_ABIS = path.resolve('./packages/core/src/abis');
const SUPER_PAYMASTER_CONFIG_DIR = path.resolve('../SuperPaymaster/deployments');
const SDK_ROOT = path.resolve('.');

const NETWORK = process.env.NETWORK || 'anvil';

function getFileHash(filePath: string): string {
    if (!fs.existsSync(filePath)) return '';
    const fileBuffer = fs.readFileSync(filePath);
    const hashSum = crypto.createHash('sha256');
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
}

function verifySync() {
    console.log('🔍 Pre-Test Synchronization Check...');
    let errors = 0;

    // 1. Verify ABI Consistency
    console.log('   Checking ABI Consistency...');
    if (!fs.existsSync(SUPER_PAYMASTER_ABIS)) {
         console.error(`❌ SuperPaymaster ABI directory not found: ${SUPER_PAYMASTER_ABIS}. Did you run build?`);
         process.exit(1);
    }

    const abiFiles = fs.readdirSync(SUPER_PAYMASTER_ABIS).filter(f => f.endsWith('.json'));
    
    for (const file of abiFiles) {
        const sourcePath = path.join(SUPER_PAYMASTER_ABIS, file);
        const destPath = path.join(SDK_CORE_ABIS, file);

        const sourceHash = getFileHash(sourcePath);
        const destHash = getFileHash(destPath);

        if (!destHash) {
             console.error(`   ❌ Missing in SDK: ${file}`);
             errors++;
        } else if (sourceHash !== destHash) {
             console.error(`   ❌ Mismatch: ${file} (SDK is out of sync)`);
             errors++;
        } else {
            // console.log(`   ✅ ${file} synced.`);
        }
    }
    
    // 2. Verify Config Consistency
    console.log(`   Checking Config Consistency (${NETWORK})...`);
    const sourceConfig = path.join(SUPER_PAYMASTER_CONFIG_DIR, `config.${NETWORK}.json`);
    const destConfig = path.join(SDK_ROOT, `config.${NETWORK}.json`);

    const sourceConfigHash = getFileHash(sourceConfig);
    const destConfigHash = getFileHash(destConfig);

    if (!sourceConfigHash) {
        console.warn(`   ⚠️  Source config not found for ${NETWORK} in SuperPaymaster. Skipping config check.`);
    } else {
        if (!destConfigHash) {
            console.error(`   ❌ Missing in SDK: config.${NETWORK}.json`);
            errors++;
        } else if (sourceConfigHash !== destConfigHash) {
            console.error(`   ❌ Config mismatch for ${NETWORK}`);
            errors++;
        } else {
            console.log(`   ✅ config.${NETWORK}.json synced.`);
        }
    }

    if (errors > 0) {
        console.error(`\n❌ Synchronization Check Failed: ${errors} errors found.`);
        console.error('   Please ensure you have run the sync steps (or enable ABI sync in the regression script).');
        process.exit(1);
    } else {
        console.log('✅ All ABIs and Configurations are strictly synchronized.');
    }
}

verifySync();
