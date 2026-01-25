
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { HistoricalFetcher } from './libs/HistoricalFetcher.js';
// import { TrafficGenerator } from '../packages/analytics/src/generators/TrafficGenerator.js'; 

const NETWORK = process.argv.find(arg => arg.startsWith('--network='))?.split('=')[1] || 'sepolia';
const ENV_FILE = path.resolve(process.cwd(), `.env.${NETWORK}`);
console.log(`Loading Env: ${ENV_FILE}`);
dotenv.config({ path: ENV_FILE });

async function main() {
    console.log(`\n🎼 Analytics Coordinator - Network: ${NETWORK}`);
    
    // 1. Load State
    const stateFile = path.resolve(process.cwd(), `scripts/l4-state.${NETWORK}.json`);
    if (!fs.existsSync(stateFile)) {
        console.error(`❌ State file not found: ${stateFile}`);
        process.exit(1);
    }
    const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    console.log(`✅ Loaded State: ${Object.keys(state.accounts || {}).length} accounts`);

    // 2. Fetch History
    const fetcher = new HistoricalFetcher(NETWORK);
    
    // Fetch for AA Accounts
    // Fetch for AA Accounts
    if (Array.isArray(state.aaAccounts)) {
        console.log(`\n🔍 Found ${state.aaAccounts.length} AA Accounts`);
        for (const acct of state.aaAccounts) {
            const addr = acct.address;
            const label = acct.label || 'Unknown_AA';
            if (addr) {
                const txs = await fetcher.fetchTransactions(addr);
                await fetcher.saveHistory(addr, txs, label);
            }
        }
    }

    // Fetch for Operators/Paymasters
    if (state.operators) {
        console.log(`\n🔍 Found ${Object.keys(state.operators).length} Operators`);
        for (const [name, data] of Object.entries(state.operators)) {
            const opData = data as any;
            // Fetch Operator Address
            if (opData.address) {
                const txs = await fetcher.fetchTransactions(opData.address);
                await fetcher.saveHistory(opData.address, txs, `${name}_EOA`);
            }
            // Fetch Paymaster V4
            if (opData.paymasterV4) {
                const txs = await fetcher.fetchTransactions(opData.paymasterV4);
                await fetcher.saveHistory(opData.paymasterV4, txs, `${name}_PaymasterV4`);
            }
            // Fetch SuperPaymaster
            if (opData.superPaymaster) {
                const txs = await fetcher.fetchTransactions(opData.superPaymaster);
                await fetcher.saveHistory(opData.superPaymaster, txs, `${name}_SuperPaymaster`);
            }
        }
    }

    // 3. Traffic Generation (Optional)
    if (process.argv.includes('--gen-traffic')) {
        console.log("\n🚦 Traffic Generation Requested (Implementation Validating...)");
        // const generator = new TrafficGenerator({...});
        // await generator.runEOA(5);
    }

    console.log("\n✅ Coordination Complete. Run gas-analyzer-v4.ts to generate report.");
}

main().catch(console.error);
