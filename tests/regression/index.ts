#!/usr/bin/env ts-node
import { loadNetworkConfig, validateConfig, type NetworkName } from './config';
import { runL1Tests } from './l1-tests';
import { runL2Tests } from './l2-tests';
import { runL3Tests } from './l3-tests';
import { runTransactionTests } from './l4-transactions';
import { runGaslessTests } from './l4-gasless';

/**
 * SDK Regression Test Runner
 * 
 * Usage:
 *   pnpm test:regression --network=sepolia
 *   pnpm test:regression --network=anvil
 *   pnpm test:regression --network=op-sepolia
 */

async function main() {
    // Parse CLI args
    const args = process.argv.slice(2);
    const networkArg = args.find(arg => arg.startsWith('--network='));
    
    if (!networkArg) {
        console.error('❌ Missing --network argument');
        console.log('\nUsage: pnpm test:regression --network=<network>');
        console.log('Networks: anvil, sepolia, op-sepolia, op-mainnet, mainnet');
        process.exit(1);
    }

    const network = networkArg.split('=')[1] as NetworkName;
    const validNetworks: NetworkName[] = ['anvil', 'sepolia', 'op-sepolia', 'op-mainnet', 'mainnet'];
    
    if (!validNetworks.includes(network)) {
        console.error(`❌ Invalid network: ${network}`);
        console.log(`Valid networks: ${validNetworks.join(', ')}`);
        process.exit(1);
    }

    console.log('═══════════════════════════════════════════════');
    console.log('🧪 AAStar SDK Regression Test Suite');
    console.log('═══════════════════════════════════════════════\n');

    // Load config
    const config = loadNetworkConfig(network);
    validateConfig(config);

    // Display Contract Versions
    const { displayContractVersions } = await import('./display-versions.js');
    await displayContractVersions(config);

    console.log('\n═══════════════════════════════════════════════');
    console.log('Starting Test Suite...');
    console.log('═══════════════════════════════════════════════');

    // Run tests
    await runL1Tests(config);
    await runL2Tests(config);
    await runL3Tests(config);
    // Run L4 Transaction Tests (Writer)
    await runTransactionTests(config);
    
    // Run L4 Gasless Verification
    await runGaslessTests(config);

    console.log('═══════════════════════════════════════════════');
    console.log('✅ Test Suite Complete');
    console.log('═══════════════════════════════════════════════\n');
}

main().catch((error) => {
    console.error('\n❌ Test Suite Failed:');
    console.error(error);
    process.exit(1);
});
