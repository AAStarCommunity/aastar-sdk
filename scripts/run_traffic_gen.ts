
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { type Hex } from 'viem';
import { TrafficGenerator } from '../packages/analytics/src/generators/TrafficGenerator.js';
import { getNetworkConfig } from './00_utils.js';

// Setup
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Args: --network <name>
const networkArg = process.argv.indexOf('--network');
const networkName = networkArg > -1 ? process.argv[networkArg + 1] : 'sepolia';

console.log(`🌍 Network: ${networkName}`);

// Load Environment
const envPath = path.resolve(__dirname, `../.env.${networkName}`);
if (!fs.existsSync(envPath)) {
    throw new Error(`Missing env file: ${envPath}`);
}
dotenv.config({ path: envPath });

// Fallback: Load root .env if PRIVATE_KEY is missing
if (!process.env.PRIVATE_KEY) {
    const rootEnvPath = path.resolve(__dirname, '../.env');
    if (fs.existsSync(rootEnvPath)) {
        dotenv.config({ path: rootEnvPath }); 
    }
}

function validateEnv(network: string) {
    const required = ['PRIVATE_KEY', 'PIMLICO_API_KEY'];
    if (network === 'sepolia') required.push('SEPOLIA_RPC_URL');
    if (network === 'op-sepolia') required.push('OPTIMISM_SEPOLIA_RPC_URL');
    
    const missing = required.filter(k => !process.env[k]);
    if (missing.length > 0) {
        console.error(`❌ Error: Missing required environment variables for ${network}:`);
        missing.forEach(m => console.error(`   - ${m}`));
        process.exit(1);
    }
}

validateEnv(networkName);

// Load State
const statePath = path.resolve(__dirname, `l4-state.${networkName}.json`);
if (!fs.existsSync(statePath)) {
    throw new Error(`Missing state file: ${statePath}`);
}
const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));

// Extract Accounts
const ACCOUNT_AA1 = state.aaAccounts.find((a: any) => a.label.includes('Jason') && a.salt === "0")?.address as Hex;
const ACCOUNT_AA2 = state.aaAccounts.find((a: any) => a.label.includes('Jason') && a.salt === "1")?.address as Hex;
const SUPER_PAYMASTER_ADDR = state.operators.anni.superPaymaster as Hex;

if (!ACCOUNT_AA1 || !ACCOUNT_AA2 || !SUPER_PAYMASTER_ADDR) {
    throw new Error("Missing required accounts in state file");
}

async function main() {
    console.log("🚦 Initializing Traffic Generation...");

    const config = getNetworkConfig(networkName);
    const resolvedRpcUrl = config.rpc || (process.env.ALCHEMY_API_KEY ? `https://${networkName === 'sepolia' ? 'eth-sepolia' : 'opt-sepolia'}.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}` : "");
    const privateKey = process.env.PRIVATE_KEY as Hex;
    const bundlerUrl = process.env.BUNDLER_URL || `https://api.pimlico.io/v2/${networkName === 'sepolia' ? 'sepolia' : 'optimism-sepolia'}/rpc?apikey=${process.env.PIMLICO_API_KEY}`;

    console.log(`   RPC Configured: ${!!config.rpc}`);
    console.log(`   Alchemy Key Present: ${!!process.env.ALCHEMY_API_KEY}`);
    console.log(`   Resolved RPC: ${resolvedRpcUrl ? 'Yes' : 'No'}`);
    console.log(`   Private Key Present: ${!!privateKey}`);

    if (!resolvedRpcUrl || !privateKey) {
        throw new Error("Missing RPC_URL or PRIVATE_KEY. Check .env." + networkName);
    }

    const generator = new TrafficGenerator({
        network: networkName,
        rpcUrl: resolvedRpcUrl,
        bundlerUrl,
        privateKey
    });

    // Debug Check
    await generator.checkAccount(ACCOUNT_AA1);
    await generator.checkAccount(ACCOUNT_AA2);

    console.log("-----------------------------------------");
    
    // Only run Standard AA on Sepolia (funded)
    if (networkName === 'sepolia') {
        console.log("🏁 Phase 1: Standard AA (Pimlico)");
        console.log("   Account: " + ACCOUNT_AA1);
        await generator.runStandardAA(5, ACCOUNT_AA1);
    } else {
        console.log("⏭️  Skipping Standard AA (Pimlico) on " + networkName);
    }

    console.log("-----------------------------------------");
    console.log("🏁 Phase 2: SuperPaymaster (Gasless)");
    console.log("   Account: " + ACCOUNT_AA2);
    console.log("   Paymaster: " + SUPER_PAYMASTER_ADDR);
    await generator.runSuperPaymaster(5, ACCOUNT_AA2, SUPER_PAYMASTER_ADDR);

    console.log("-----------------------------------------");
    console.log("✅ Traffic Generation Complete.");
}

main().catch(console.error);
