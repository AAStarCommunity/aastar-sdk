#!/usr/bin/env ts-node
import { loadNetworkConfig, validateConfig, type NetworkName } from './config';
import { runL1Tests } from './l1-tests';
import { runL2Tests } from './l2-tests';
import { runL3Tests } from './l3-tests';
import { runNewApiTests } from './new-api-methods'; // New API Tests

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

    // Run tests and AGGREGATE results — the suite must fail (non-zero exit) when any
    // tier has failing tests. Previously these returns were ignored and the runner always
    // exited 0, so the harness printed "PASSED" even with L1 0/11 — a false green.
    const results = [
        await runL1Tests(config),
        await runL2Tests(config),
        await runL3Tests(config),
        await runNewApiTests(config), // Execute New API Tests
    ];

    const passed = results.reduce((sum, r) => sum + (r?.passed ?? 0), 0);
    const total = results.reduce((sum, r) => sum + (r?.total ?? 0), 0);
    const failed = total - passed;

    console.log('═══════════════════════════════════════════════');
    console.log(`📊 OVERALL: ${passed}/${total} passed${failed > 0 ? `, ${failed} FAILED` : ''}`);
    if (failed > 0) {
        console.error(`❌ Regression FAILED: ${failed} test(s) did not pass`);
        process.exit(1);
    }
    console.log('✅ Test Suite Complete');
    console.log('═══════════════════════════════════════════════\n');
}

main().catch((error) => {
    console.error('\n❌ Test Suite Failed:');
    console.error(error);
    process.exit(1);
});
