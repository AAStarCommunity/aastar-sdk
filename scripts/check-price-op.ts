import { createPublicClient, http, parseAbi } from 'viem';
import { optimismSepolia } from 'viem/chains';
import * as dotenv from 'dotenv';
import * as path from 'path';

async function main() {
    dotenv.config({ path: '.env.op-sepolia' });
    const rpcUrl = process.env.OP_SEPOLIA_RPC_URL || process.env.OPTIMISM_SEPOLIA_RPC_URL;
    const superPaymaster = '0x9eC1FE8134A1C05aD34ba2E4e8758dAe0a009B94';

    const client = createPublicClient({ chain: optimismSepolia, transport: http(rpcUrl) });
    
    console.log(`🔍 Checking SuperPaymaster Cached Price on OP-Sepolia: ${superPaymaster}`);
    
    const cache = await client.readContract({
        address: superPaymaster as `0x${string}`,
        abi: parseAbi(['function cachedPrice() view returns (int256 price, uint256 updatedAt, uint80 roundId, uint8 decimals)']),
        functionName: 'cachedPrice'
    }) as [bigint, bigint, bigint, number];
    
    const now = Math.floor(Date.now() / 1000);
    const age = now - Number(cache[1]);
    
    console.log(`   Price: $${Number(cache[0]) / 1e8}`);
    console.log(`   UpdatedAt: ${cache[1]} (${new Date(Number(cache[1]) * 1000).toISOString()})`);
    console.log(`   Current Time: ${now} (${new Date(now * 1000).toISOString()})`);
    console.log(`   Age: ${age} seconds (${(age / 60).toFixed(2)} minutes)`);
    
    if (age > 3600) {
        console.log(`   ⚠️  Price is STALE (> 1 hour). Needs update!`);
    } else {
        console.log(`   ✅ Price is FRESH.`);
    }
}

main().catch(console.error);
