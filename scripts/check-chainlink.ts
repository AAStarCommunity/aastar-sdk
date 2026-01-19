import { createPublicClient, http, parseAbi } from 'viem';
import { sepolia } from 'viem/chains';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.sepolia' });

const publicClient = createPublicClient({ chain: sepolia, transport: http(process.env.RPC_URL_SEPOLIA!) });
const priceFeed = '0x694AA1769357215DE4FAC081bf1f309aDC325306';

async function main() {
    const data = await publicClient.readContract({
        address: priceFeed,
        abi: parseAbi(['function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)']),
        functionName: 'latestRoundData'
    }) as [bigint, bigint, bigint, bigint, bigint];
    
    const now = Math.floor(Date.now() / 1000);
    const age = now - Number(data[3]);
    
    console.log('📊 Chainlink ETH/USD Feed (Sepolia):');
    console.log(`   Price: $${Number(data[1]) / 1e8}`);
    console.log(`   UpdatedAt: ${data[3]} (${new Date(Number(data[3]) * 1000).toISOString()})`);
    console.log(`   Age: ${age} seconds (${(age / 3600).toFixed(1)} hours)`);
    console.log(`   Threshold: 3600 seconds (1 hour)`);
    console.log(`   Status: ${age > 3600 ? '❌ STALE' : '✅ Fresh'}`);
}

main().catch(console.error);
