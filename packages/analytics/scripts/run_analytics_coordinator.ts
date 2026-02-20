
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { HistoricalFetcher } from './libs/HistoricalFetcher.js';
import { EventFetcher } from './libs/EventFetcher.js';
// import { TrafficGenerator } from '../packages/analytics/src/generators/TrafficGenerator.js'; 

function getArgValue(key: string): string | undefined {
    const eqArg = process.argv.find((a) => a.startsWith(`${key}=`));
    if (eqArg) return eqArg.slice(`${key}=`.length);

    const idx = process.argv.findIndex((a) => a === key);
    if (idx < 0) return undefined;
    const next = process.argv[idx + 1];
    if (!next || next.startsWith('--')) return undefined;
    return next;
}

function splitCsv(v: string | undefined): string[] {
    if (!v) return [];
    return v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
}

const NETWORK = getArgValue('--network') || 'sepolia';
const ENV_FILE = path.resolve(process.cwd(), `.env.${NETWORK}`);
console.log(`Loading Env: ${ENV_FILE}`);
dotenv.config({ path: ENV_FILE });

function validateEnv(required: string[], network: string) {
    if (network === 'sepolia') required.push('SEPOLIA_RPC_URL');
    if (network === 'op-sepolia') required.push('OP_SEPOLIA_RPC_URL');

    const missing = required.filter((k) => !process.env[k]);
    if (missing.length > 0) {
        console.error(`❌ Error: Missing required environment variables for ${network}:`);
        missing.forEach((m) => console.error(`   - ${m}`));
        process.exit(1);
    }
}

const addressesArg = getArgValue('--addresses');
const labelsArg = getArgValue('--labels');
const hasGenTraffic = process.argv.includes('--gen-traffic');

validateEnv(hasGenTraffic ? ['PRIVATE_KEY', 'ETHERSCAN_API_KEY'] : ['ETHERSCAN_API_KEY'], NETWORK);

async function main() {
    console.log(`\n🎼 Analytics Coordinator - Network: ${NETWORK}`);
    
    const targetsFromArgs = splitCsv(addressesArg).map((address, idx) => ({
        address,
        label: splitCsv(labelsArg)[idx] || `Target_${address.substring(0, 8)}`
    }));

    let state: any | undefined = undefined;
    if (targetsFromArgs.length === 0) {
        const stateFile = path.resolve(process.cwd(), `scripts/l4-state.${NETWORK}.json`);
        if (!fs.existsSync(stateFile)) {
            console.error(`❌ State file not found: ${stateFile}`);
            process.exit(1);
        }
        state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
        console.log(`✅ Loaded State: ${Object.keys(state.accounts || {}).length} accounts`);
    }

    // 2. Fetch History
    const fetcher = new HistoricalFetcher(NETWORK);
    
    if (targetsFromArgs.length > 0) {
        console.log(`\n🔍 Targets (CLI): ${targetsFromArgs.length}`);
        for (const t of targetsFromArgs) {
            const txs = await fetcher.fetchTransactions(t.address);
            await fetcher.saveHistory(t.address, txs, t.label);
        }
    } else if (Array.isArray(state?.aaAccounts)) {
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
    if (state?.operators) {
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

    // 2b. Fetch Events (Optional but Recommended for AA)
    if (process.argv.includes('--fetch-events')) {
        console.log("\n📡 Event Fetching Requested (--fetch-events)");
        const eventFetcher = new EventFetcher(NETWORK);

        const exportCsvPath = getArgValue('--export-txhashes-csv');
        const txHashRows: Array<{ Label: string; TxHash: string; BlockNumber: string; TimeStamp: string }> = [];

        if (targetsFromArgs.length > 0) {
            for (const t of targetsFromArgs) {
                const logs = await eventFetcher.fetchUserOps(t.address, 'sender');
                await eventFetcher.saveEvents(t.address, logs, t.label);
                for (const e of logs) {
                    txHashRows.push({
                        Label: t.label,
                        TxHash: e.transactionHash,
                        BlockNumber: e.blockNumber,
                        TimeStamp: e.timeStamp
                    });
                }
            }
        } else if (Array.isArray(state?.aaAccounts)) {
            for (const acct of state.aaAccounts) {
                if (acct.address) {
                    const logs = await eventFetcher.fetchUserOps(acct.address, 'sender');
                    await eventFetcher.saveEvents(acct.address, logs, acct.label || 'Unknown_AA');
                    for (const e of logs) {
                        txHashRows.push({
                            Label: acct.label || 'Unknown_AA',
                            TxHash: e.transactionHash,
                            BlockNumber: e.blockNumber,
                            TimeStamp: e.timeStamp
                        });
                    }
                }
            }
        }

        // Fetch for Paymasters (as PAYMASTER)
        if (state?.operators) {
            for (const [name, data] of Object.entries(state.operators)) {
                const opData = data as any;
                 if (opData.paymasterV4) {
                    const logs = await eventFetcher.fetchUserOps(opData.paymasterV4, 'paymaster');
                    await eventFetcher.saveEvents(opData.paymasterV4, logs, `${name}_PaymasterV4`);
                }
                if (opData.superPaymaster) {
                    const logs = await eventFetcher.fetchUserOps(opData.superPaymaster, 'paymaster');
                    await eventFetcher.saveEvents(opData.superPaymaster, logs, `${name}_SuperPaymaster`);
                }
            }
        }

        if (exportCsvPath && txHashRows.length > 0) {
            const byTxHash = new Map<string, { Label: string; TxHash: string; BlockNumber: string; TimeStamp: string }>();
            for (const r of txHashRows) {
                if (!byTxHash.has(r.TxHash)) byTxHash.set(r.TxHash, r);
            }
            const unique = [...byTxHash.values()].sort((a, b) => Number(b.BlockNumber) - Number(a.BlockNumber));
            const header = 'Label,TxHash,BlockNumber,TimeStamp';
            const lines = unique.map((r) => `${r.Label},${r.TxHash},${r.BlockNumber},${r.TimeStamp}`);
            const outAbs = path.isAbsolute(exportCsvPath) ? exportCsvPath : path.resolve(process.cwd(), exportCsvPath);
            fs.mkdirSync(path.dirname(outAbs), { recursive: true });
            fs.writeFileSync(outAbs, [header, ...lines].join('\n') + '\n');
            console.log(`   💾 Exported tx hashes: ${outAbs} (${unique.length})`);
        }
    }

    // 3. Traffic Generation (Optional)
    if (process.argv.includes('--gen-traffic')) {
        console.log("\n🚦 Traffic Generation Requested");
        // Lazy import to avoid load-time dependency issues if unused
        const { TrafficGenerator } = await import('../packages/analytics/src/generators/TrafficGenerator.js');
        
        // Find how many runs (default 20 as requested)
        const runsArg = process.argv.find(arg => arg.startsWith('--runs='));
        const runs = runsArg ? parseInt(runsArg.split('=')[1]) : 20;
        
        let rawKey = process.env.PRIVATE_KEY;
        if (!rawKey) {
            // Fallback: Manual regex parse
            try {
                const envContent = fs.readFileSync(ENV_FILE, 'utf8');
                const match = envContent.match(/^PRIVATE_KEY=(.*)$/m);
                if (match) rawKey = match[1].trim();
            } catch (e) {
                console.warn("⚠️ Failed to manually parse env file");
            }
        }

        // Clean up quotes if present
        if (rawKey && (rawKey.startsWith('"') || rawKey.startsWith("'"))) {
            rawKey = rawKey.slice(1, -1);
        }

        const privateKey = (rawKey && rawKey.startsWith('0x') ? rawKey : `0x${rawKey}`) as `0x${string}`;
        
        console.log(`\n🔑 Loaded Key: ${privateKey ? privateKey.substring(0, 6) + '...' : 'undefined'}`);

        const generator = new TrafficGenerator({
            network: NETWORK,
            rpcUrl: process.env.RPC_URL || process.env[`${NETWORK.toUpperCase()}_RPC_URL`] || process.env.SEPOLIA_RPC_URL || '',
            privateKey: privateKey || '0x0000000000000000000000000000000000000000000000000000000000000000'
        });

        if (generator) {
             await generator.runEOA(runs);
        }
    }

    console.log("\n✅ Coordination Complete. Run gas-analyzer-v4.ts to generate report.");
}

main().catch(console.error);
