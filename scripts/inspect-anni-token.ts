
import { createPublicClient, http, parseAbi, formatEther } from 'viem';
import { sepolia } from 'viem/chains';
import { loadNetworkConfig } from '../tests/regression/config.js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import path from 'path';

// Load Env
process.env.NETWORK_NAME = 'sepolia';
dotenv.config({ path: path.resolve(process.cwd(), '.env.sepolia') });

async function main() {
    console.log('🔍 Inspecting Anni Setup...');

    // 1. Load Config & Addresses
    const config = loadNetworkConfig('sepolia');
    const publicClient = createPublicClient({
        chain: sepolia,
        transport: http(process.env.BUNDLER_URL) // Use Bundler RPC or direct
    });

    // 2. Identify Anni's Token from State
    // We check what token Anni (Operator) has registered via Factory
    const xPNTsFactory = config.contracts.xPNTsFactory;
    const anniAA = '0xBC7626E94a215F6614d1B6aFA740787A2E50aaA4'; // Anni AA

    console.log(`\n🏭 Checking xPNTsFactory (${xPNTsFactory})...`);
    console.log(`   Querying token for Anni AA: ${anniAA}`);

    const factoryAbi = parseAbi([
        'function getTokenAddress(address community) view returns (address)',
        'function aPNTsPriceUSD() view returns (uint256)'
    ]);

    try {
        const token = await publicClient.readContract({ 
            address: xPNTsFactory, 
            abi: factoryAbi, 
            functionName: 'getTokenAddress',
            args: [anniAA]
        });
        
        const zeroAddr = '0x0000000000000000000000000000000000000000';
        if (token === zeroAddr) {
            console.log(`   ❌ Anni has NO registered xPNTs token.`);
            console.log(`   ⚠️  This confirms Anni is using aPNTs (Canonical) directly in tests, not her own token.`);
        } else {
            console.log(`   ✅ Anni's Issued Token: ${token}`);
            // Get Symbol
            const tokenAbi = parseAbi(['function symbol() view returns (string)', 'function name() view returns (string)']);
            const sym = await publicClient.readContract({ address: token, abi: tokenAbi, functionName: 'symbol' });
            console.log(`      Symbol: ${sym}`);
        }
    } catch(e) {
        console.log(`   ❌ Factory Query Failed:`, e);
    }
    
    // Check what 0xb725... is
    const dPNTs = '0xb725452998da5645024B1a99e4D1DF52204875FB'; 
    console.log(`\n🔍 Checking Test Token Identity (${dPNTs})...`);
    
    const tokenAbi = parseAbi([
        'function symbol() view returns (string)',
        'function name() view returns (string)',
        'function totalSupply() view returns (uint256)',
        'function balanceOf(address) view returns (uint256)'
    ]);

    try {
        const symbol = await publicClient.readContract({ address: dPNTs, abi: tokenAbi, functionName: 'symbol' });
        const name = await publicClient.readContract({ address: dPNTs, abi: tokenAbi, functionName: 'name' });
        console.log(`   ✅ Token Identity: ${name} (${symbol})`);
    } catch(e) {
        console.log(`   ❌ Failed to read token details:`, e);
    }

    // 3. SuperPaymaster Checks
    const superPM = config.contracts.superPaymaster;
    console.log(`\n🦸 Checking SuperPaymaster (${superPM})...`);
    
    const pmAbi = parseAbi([
        'function cachedPrice() view returns (int256 price, uint256 updatedAt, uint80 roundId, uint8 decimals)',
        'function aPNTsPriceUSD() view returns (uint256)',
        'function operators(address) view returns (uint128 aPNTsBalance, bool isConfigured, bool isPaused, address xPNTsToken, uint32 reputation, uint48 minTxInterval, address treasury, uint256 totalSpent, uint256 totalTxSponsored)'
    ]);

    // Cache
    try {
        const [price, updatedAt, roundId, decimals] = await publicClient.readContract({ 
            address: superPM, abi: pmAbi, functionName: 'cachedPrice' 
        }) as [bigint, bigint, bigint, number];
        console.log(`   💰 Cached ETH Price: ${price} (Decimals: ${decimals})`);
        console.log(`   🕒 Updated At: ${new Date(Number(updatedAt) * 1000).toISOString()}`);
    } catch(e) {
        console.log(`   ❌ Failed to read Cached Price:`, e);
    }

    // aPNTs Price
    try {
        const apntsPrice = await publicClient.readContract({ 
            address: superPM, abi: pmAbi, functionName: 'aPNTsPriceUSD' 
        });
        console.log(`   🏷️  aPNTs Price (USD): ${formatEther(apntsPrice as bigint)}`);
    } catch(e) {
        console.log(`   ❌ Failed to read aPNTs Price:`, e);
    }

    // Custom Query: Is dPNTs registered in Factory?
    // If factory has a mapping `isRegistered` or similar.
    // Let's guess: `customTokens(address)`?
    // Or just rely on token symbol.

}

main().catch(console.error);
