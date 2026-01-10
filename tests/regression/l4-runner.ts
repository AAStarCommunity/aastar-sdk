#!/usr/bin/env ts-node
import { loadNetworkConfig, validateConfig, type NetworkName } from './config';
import { runTransactionTests } from './l4-transactions';
import { runGaslessTests } from './l4-gasless';

/**
 * L4 Regression Test Runner
 * 
 * Usage:
 *   pnpm tsx tests/regression/l4-runner.ts --network=sepolia
 */

async function main() {
    // Parse CLI args
    const args = process.argv.slice(2);
    const networkArg = args.find(arg => arg.startsWith('--network='));
    
    if (!networkArg) {
        console.error('❌ Missing --network argument');
        console.log('\nUsage: pnpm tsx tests/regression/l4-runner.ts --network=<network>');
        process.exit(1);
    }

    const network = networkArg.split('=')[1] as NetworkName;
    const validNetworks: NetworkName[] = ['sepolia', 'op-sepolia', 'op-mainnet', 'mainnet', 'anvil'];
    
    if (!validNetworks.includes(network)) {
        console.error(`❌ Invalid network: ${network}`);
        console.log(`Valid networks: ${validNetworks.join(', ')}`);
        process.exit(1);
    }

    console.log('═══════════════════════════════════════════════');
    console.log(`⛽ AAStar SDK L4 Gasless Verification (${network})`);
    console.log('═══════════════════════════════════════════════\n');

    // Load config
    const config = loadNetworkConfig(network);
    validateConfig(config);

    // Run L4 Transaction Tests (Writer)
    await runTransactionTests(config);
    
    // Run L4 Gasless Verification
    await runGaslessTests(config);

    console.log('═══════════════════════════════════════════════');
    console.log('✅ L4 Verification Complete');
    console.log('═══════════════════════════════════════════════\n');
}

main().catch((error) => {
    console.error('\n❌ L4 Verification Failed:');
    console.error(error);
    process.exit(1);
});
