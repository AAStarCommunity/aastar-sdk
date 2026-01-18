import * as dotenv from 'dotenv';
console.log('🔍 DATA SOURCE: tests/regression/config.ts (TS Source)');
/**
 * Network Configuration Loader for Regression Tests
 * 
 * Contract addresses are loaded from SuperPaymaster deployments directory
 * to ensure consistency across all testing layers (L1/L2/L3/L4).
 */

import { type Address, type Hex, type Chain } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia, optimismSepolia, optimism, mainnet } from 'viem/chains';
import { anvil, localhost } from 'viem/chains';
import * as path from 'path';
import * as fs from 'fs';

// Anvil Default Private Key (Account #0)
const ANVIL_DEFAULT_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

export type NetworkName = 'anvil' | 'sepolia' | 'op-sepolia' | 'op-mainnet' | 'mainnet';

/**
 * Load contract addresses from config files
 * Priority: SDK root config.{network}.json > SuperPaymaster deployments > .env
 */
function loadDeployments(network: NetworkName): Record<string, Address> {
    // Priority 1: SDK root config.{network}.json
    const sdkConfigPath = path.resolve(process.cwd(), `config.${network}.json`);
    
    if (fs.existsSync(sdkConfigPath)) {
        try {
            const config = JSON.parse(fs.readFileSync(sdkConfigPath, 'utf8'));
            console.log(`✅ Loaded contract addresses from: ${sdkConfigPath}`);
            console.log(`   Keys found: ${Object.keys(config).join(', ')}`);
            return config as Record<string, Address>;
        } catch (error) {
            console.warn(`⚠️  Failed to parse SDK config: ${error}`);
        }
    }
    
    // Priority 2: SuperPaymaster deployments (fallback)
    const SUPERPAYMASTER_ROOT = path.resolve(process.cwd(), '../SuperPaymaster');
    const deploymentsPath = path.join(SUPERPAYMASTER_ROOT, `deployments/config.${network}.json`);
    
    if (fs.existsSync(deploymentsPath)) {
        try {
            const deployments = JSON.parse(fs.readFileSync(deploymentsPath, 'utf8'));
            console.log(`✅ Loaded contract addresses from: ${deploymentsPath} (fallback)`);
            console.log(`   Keys found: ${Object.keys(deployments).join(', ')}`);
            return deployments as Record<string, Address>;
        } catch (error) {
            console.warn(`⚠️  Failed to parse SuperPaymaster deployments: ${error}`);
        }
    }
    
    // Priority 3: .env (final fallback)
    console.warn(`⚠️  No config files found for network: ${network}`);
    console.warn(`   Checked: ${sdkConfigPath}`);
    console.warn(`   Checked: ${deploymentsPath}`);
    console.warn(`   Using addresses from .env`);
    return {};
}

export interface ContractAddresses {
    registry: Address;
    gToken: Address;
    gTokenStaking: Address;
    superPaymaster: Address;
    sbt: Address;
    reputation: Address;
    paymasterFactory: Address;
    xPNTsFactory: Address;
    aPNTs: Address; // Global aPNTs token for SuperPaymaster deposits
    dvtValidator?: Address;
    blsAggregator?: Address;
    blsValidator?: Address;
    entryPoint: Address;
    paymasterV4Impl?: Address;
    simpleAccountFactory: Address;
    priceFeed: Address;
}

export interface NetworkConfig {
    name: NetworkName;
    chain: Chain;
    rpcUrl: string;
    bundlerUrl: string; // Added bundlerUrl
    contracts: ContractAddresses;
    testAccount: {
        privateKey: `0x${string}`;
        address: Address;
    };
    supplierAccount?: { // Added supplierAccount
        privateKey: Hex;
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
    
    // Debug ENV loading
    console.log(`    🔍 DEBUG: PRIVATE_KEY_SUPPLIER present? ${!!process.env.PRIVATE_KEY_SUPPLIER}`);
    if (process.env.PRIVATE_KEY_SUPPLIER) {
        console.log(`    🔍 DEBUG: Supplier Key Length: ${process.env.PRIVATE_KEY_SUPPLIER.length}`);
    }

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
        'TEST_PRIVATE_KEY'
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

    // Load contract addresses from SuperPaymaster deployments (with .env fallback)
    const deployments = loadDeployments(network);
    
    const getContractAddress = (deploymentKey: string, envKey: string, envFallback?: string): Address => {
        // 1. Try deployments first
        if (deployments[deploymentKey]) {
            // console.log(`    Address found in deployments: ${deploymentKey} -> ${deployments[deploymentKey]}`);
            return deployments[deploymentKey];
        } else {
            console.warn(`    ⚠️  Missing in deployments: ${deploymentKey}`);
        }
        // 2. Fallback to .env
        const addr = process.env[envKey] || (envFallback && process.env[envFallback]);
        if (!addr) {
            console.error(`    ❌ Missing contract address: ${deploymentKey} (env: ${envKey} or ${envFallback})`);
            throw new Error(`Missing contract address: ${deploymentKey} (env: ${envKey}${envFallback ? ` or ${envFallback}` : ''}) in ${envFile}`);
        }
        console.log(`    ✅ Found in ENV: ${deploymentKey} -> ${addr}`);
        return addr as Address;
    };

    let supplierPrivateKey = process.env.PRIVATE_KEY_SUPPLIER as Hex | undefined;
    if (!supplierPrivateKey && network === 'anvil') {
        supplierPrivateKey = ANVIL_DEFAULT_KEY;
        console.log(`    ⚠️  Using Anvil Default Key for Supplier`);
    }

    return {
        name: network,
        chain,
        rpcUrl: process.env.RPC_URL!,
        bundlerUrl: process.env.BUNDLER_URL || process.env.RPC_URL!,
        contracts: {
            registry: getContractAddress('registry', 'REGISTRY_ADDRESS'),
            gToken: getContractAddress('gToken', 'GTOKEN_ADDRESS'),
            gTokenStaking: getContractAddress('staking', 'GTOKEN_STAKING_ADDRESS', 'STAKING_ADDRESS'),
            sbt: getContractAddress('sbt', 'SBT_ADDRESS', 'MYSBT_ADDRESS'),
            reputation: getContractAddress('reputationSystem', 'REPUTATION_ADDRESS', 'REPUTATION_SYSTEM'),
            superPaymaster: getContractAddress('superPaymaster', 'SUPER_PAYMASTER_ADDRESS', 'PAYMASTER_SUPER'),
            paymasterFactory: getContractAddress('paymasterFactory', 'PAYMASTER_FACTORY_ADDRESS', 'PAYMASTER_FACTORY'),
            xPNTsFactory: getContractAddress('xPNTsFactory', 'XPNTS_FACTORY_ADDRESS', 'XPNTS_FACTORY'),
            aPNTs: getContractAddress('aPNTs', 'APNTS_ADDRESS', 'APNTS_TOKEN'),
            blsAggregator: getContractAddress('blsAggregator', 'BLS_AGGREGATOR_ADDRESS', 'BLS_AGGREGATOR'),
            blsValidator: getContractAddress('blsValidator', 'BLS_VALIDATOR_ADDRESS', 'BLS_VALIDATOR'),
            dvtValidator: getContractAddress('dvtValidator', 'DVT_VALIDATOR_ADDRESS', 'DVT_VALIDATOR'),
            entryPoint: getContractAddress('entryPoint', 'ENTRY_POINT_ADDRESS'),
            paymasterV4Impl: getContractAddress('paymasterV4Impl', 'PAYMASTER_V4_IMPL', 'PAYMASTER_ADDRESS'),
            priceFeed: getContractAddress('priceFeed', 'PRICE_FEED_ADDRESS'),
            simpleAccountFactory: getContractAddress('simpleAccountFactory', 'SIMPLE_ACCOUNT_FACTORY_ADDRESS'),
        },
        testAccount: {
            privateKey: process.env.TEST_PRIVATE_KEY as `0x${string}`,
            address: (process.env.TEST_ACCOUNT_ADDRESS as Address) || privateKeyToAccount(process.env.TEST_PRIVATE_KEY as Hex).address
        },
        supplierAccount: supplierPrivateKey ? { privateKey: supplierPrivateKey } : undefined
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
