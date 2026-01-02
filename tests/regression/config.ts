import * as dotenv from 'dotenv';
import * as path from 'path';
import type { Address, Chain } from 'viem';
import { sepolia, optimismSepolia, optimism, mainnet } from 'viem/chains';
import { anvil } from 'viem/chains';

export type NetworkName = 'anvil' | 'sepolia' | 'op-sepolia' | 'op-mainnet' | 'mainnet';

export interface ContractAddresses {
    registry: Address;
    gToken: Address;
    gTokenStaking: Address;
    superPaymaster: Address;
    sbt: Address;
    reputation: Address;
    xPNTsFactory: Address;
    dvtValidator?: Address;
    blsAggregator?: Address;
}

export interface NetworkConfig {
    name: NetworkName;
    chain: Chain;
    rpcUrl: string;
    contracts: ContractAddresses;
    testAccount: {
        privateKey: `0x${string}`;
        address: Address;
    };
}

/**
 * Load environment configuration for a specific network
 */
export function loadNetworkConfig(network: NetworkName): NetworkConfig {
    // Load ENV file
    const envFile = `.env.${network}`;
    const envPath = path.resolve(process.cwd(), envFile);
    
    console.log(`📄 Loading config from: ${envPath}`);
    dotenv.config({ path: envPath });

    // Get chain
    const chains: Record<NetworkName, Chain> = {
        'anvil': anvil,
        'sepolia': sepolia,
        'op-sepolia': optimismSepolia,
        'op-mainnet': optimism,
        'mainnet': mainnet
    };

    const chain = chains[network];

    // Validate required ENV vars (with fallbacks for SuperPaymaster naming)
    const required = [
        'RPC_URL',
        'TEST_PRIVATE_KEY',
        'TEST_ACCOUNT_ADDRESS'
    ];

    for (const key of required) {
        if (!process.env[key]) {
            throw new Error(`Missing required ENV var: ${key} in ${envFile}`);
        }
    }

    // Helper to get address with fallback naming
    const getAddress = (primary: string, fallback?: string): Address => {
        const addr = process.env[primary] || (fallback && process.env[fallback]);
        if (!addr) {
            throw new Error(`Missing address: ${primary}${fallback ? ` or ${fallback}` : ''} in ${envFile}`);
        }
        return addr as Address;
    };

    return {
        name: network,
        chain,
        rpcUrl: process.env.RPC_URL!,
        contracts: {
            // Support both naming conventions
            registry: getAddress('REGISTRY_ADDRESS'),
            gToken: getAddress('GTOKEN_ADDRESS'),
            gTokenStaking: getAddress('GTOKEN_STAKING_ADDRESS', 'STAKING_ADDRESS'),
            superPaymaster: getAddress('SUPER_PAYMASTER_ADDRESS', 'PAYMASTER_SUPER'),
            sbt: getAddress('SBT_ADDRESS', 'MYSBT_ADDRESS'),
            reputation: getAddress('REPUTATION_ADDRESS', 'REPUTATION_SYSTEM'),
            xPNTsFactory: getAddress('XPNTS_FACTORY_ADDRESS', 'XPNTS_FACTORY'),
            dvtValidator: process.env.DVT_VALIDATOR_ADDRESS as Address | undefined,
            blsAggregator: process.env.BLS_AGGREGATOR_ADDRESS as Address | process.env.BLS_AGGREGATOR as Address | undefined
        },
        testAccount: {
            privateKey: process.env.TEST_PRIVATE_KEY as `0x${string}`,
            address: process.env.TEST_ACCOUNT_ADDRESS as Address
        }
    };
}

/**
 * Validate network configuration
 */
export function validateConfig(config: NetworkConfig): void {
    console.log(`✅ Network: ${config.name}`);
    console.log(`✅ Chain ID: ${config.chain.id}`);
    console.log(`✅ RPC: ${config.rpcUrl}`);
    console.log(`✅ Test Account: ${config.testAccount.address}`);
    console.log(`✅ Contract Suite:`);
    console.log(`   - Registry: ${config.contracts.registry}`);
    console.log(`   - GToken: ${config.contracts.gToken}`);
    console.log(`   - SuperPaymaster: ${config.contracts.superPaymaster}`);
}
