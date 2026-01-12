import { createPublicClient, http, parseAbi, type Address } from 'viem';
import type { NetworkConfig } from './config';

/**
 * Display contract versions at the start of regression tests
 */
export async function displayContractVersions(config: NetworkConfig) {
    console.log('\n📋 Contract Configuration & Versions:');
    console.log('═══════════════════════════════════════════════\n');

    const client = createPublicClient({
        chain: config.chain,
        transport: http(config.rpcUrl)
    });

    const versionAbi = parseAbi(['function version() external view returns (string)']);

    // Helper to fetch version
    const getVersion = async (address: Address, name: string): Promise<string> => {
        try {
            const ver = await client.readContract({
                address,
                abi: versionAbi,
                functionName: 'version',
            }) as string;
            return ver;
        } catch (e) {
            return 'N/A';
        }
    };

    // Core Contracts
    console.log('🏛️  Core Contracts:');
    const registryVer = await getVersion(config.contracts.registry, 'Registry');
    console.log(`   - [Registry] ${config.contracts.registry}`);
    console.log(`     Version: ${registryVer}`);

    const gtokenVer = await getVersion(config.contracts.gToken, 'GToken');
    console.log(`   - [GToken] ${config.contracts.gToken}`);
    console.log(`     Version: ${gtokenVer}`);

    const stakingVer = await getVersion(config.contracts.gTokenStaking, 'GTokenStaking');
    console.log(`   - [GTokenStaking] ${config.contracts.gTokenStaking}`);
    console.log(`     Version: ${stakingVer}`);

    const sbtVer = await getVersion(config.contracts.sbt, 'MySBT');
    console.log(`   - [MySBT] ${config.contracts.sbt}`);
    console.log(`     Version: ${sbtVer}`);

    const repVer = await getVersion(config.contracts.reputation, 'ReputationSystem');
    console.log(`   - [ReputationSystem] ${config.contracts.reputation}`);
    console.log(`     Version: ${repVer}`);

    // Paymaster Infrastructure
    console.log('\n⚡ Paymaster Infrastructure:');
    const spmVer = await getVersion(config.contracts.superPaymaster, 'SuperPaymaster');
    console.log(`   - [SuperPaymasterV3] ${config.contracts.superPaymaster}`);
    console.log(`     Version: ${spmVer}`);

    if (config.contracts.paymasterFactory) {
        const factoryVer = await getVersion(config.contracts.paymasterFactory, 'PaymasterFactory');
        console.log(`   - [PaymasterFactory] ${config.contracts.paymasterFactory}`);
        console.log(`     Version: ${factoryVer}`);

        // Check Factory Default Version
        try {
            const defaultVer = await client.readContract({
                address: config.contracts.paymasterFactory,
                abi: parseAbi(['function defaultVersion() external view returns (string)']),
                functionName: 'defaultVersion',
            }) as string;
            console.log(`     Default Impl: ${defaultVer}`);
        } catch (e) {
            console.log(`     Default Impl: N/A`);
        }
    }

    // Token Factory
    console.log('\n🏭 Token Factory:');
    const xpntsFactoryVer = await getVersion(config.contracts.xPNTsFactory, 'xPNTsFactory');
    console.log(`   - [xPNTsFactory] ${config.contracts.xPNTsFactory}`);
    console.log(`     Version: ${xpntsFactoryVer}`);

    console.log('\n═══════════════════════════════════════════════\n');
}
