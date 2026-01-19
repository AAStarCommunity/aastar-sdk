import { createPublicClient, createWalletClient, http, parseAbi } from 'viem';
import { sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.sepolia' });

const account = privateKeyToAccount(process.env.PRIVATE_KEY_SUPPLIER as `0x${string}`);
const publicClient = createPublicClient({ chain: sepolia, transport: http(process.env.RPC_URL_SEPOLIA!) });
const walletClient = createWalletClient({ account, chain: sepolia, transport: http(process.env.RPC_URL_SEPOLIA!) });

const superPaymaster = '0xe74304cC5860B950A45967E12321dfF8B5cdCAA0';

async function main() {
    console.log('🔄 Calling SuperPaymaster.updatePriceDVT() (owner bypass for stale Chainlink)...');
    
    // Use current price from Chainlink, but with current timestamp
    const price = 333495970000n; // $3334.9597 (8 decimals)
    const now = Math.floor(Date.now() / 1000);
    const proof = '0x'; // Empty proof allowed for owner
    
    console.log(`   Price: $${Number(price) / 1e8}`);
    console.log(`   Timestamp: ${now} (${new Date(now * 1000).toISOString()})`);
    
    const hash = await walletClient.writeContract({
        address: superPaymaster,
        abi: parseAbi(['function updatePriceDVT(int256 price, uint256 updatedAt, bytes calldata proof) external']),
        functionName: 'updatePriceDVT',
        args: [price, BigInt(now), proof]
    });
    console.log(`📝 Transaction: ${hash}`);
    
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log(`✅ updatePriceDVT completed in block ${receipt.blockNumber}`);
    
    // Read updated cache
    const cache = await publicClient.readContract({
        address: superPaymaster,
        abi: parseAbi(['function cachedPrice() view returns (int256 price, uint256 updatedAt, uint80 roundId, uint8 decimals)']),
        functionName: 'cachedPrice'
    }) as [bigint, bigint, bigint, number];
    
    const threshold = 3600; // 1 hour
    const validUntil = Number(cache[1]) + threshold;
    
    console.log(`\n📊 Updated Cache:`);
    console.log(`   Price: $${Number(cache[0]) / 1e8}`);
    console.log(`   UpdatedAt: ${cache[1]} (${new Date(Number(cache[1]) * 1000).toISOString()})`);
    console.log(`   ValidUntil: ${validUntil} (${new Date(validUntil * 1000).toISOString()})`);
    console.log(`   Fresh for: ${threshold / 60} minutes ✅`);
}

main().catch(console.error);
