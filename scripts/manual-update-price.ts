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
    console.log('🔄 Calling SuperPaymaster.updatePrice()...');
    const hash = await walletClient.writeContract({
        address: superPaymaster,
        abi: parseAbi(['function updatePrice() public']),
        functionName: 'updatePrice'
    });
    console.log(`📝 Transaction: ${hash}`);
    
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log(`✅ updatePrice completed in block ${receipt.blockNumber}`);
    
    // Read updated cache
    const cache = await publicClient.readContract({
        address: superPaymaster,
        abi: parseAbi(['function cachedPrice() view returns (int256 price, uint256 updatedAt, uint80 roundId, uint8 decimals)']),
        functionName: 'cachedPrice'
    }) as [bigint, bigint, bigint, number];
    
    console.log(`\n📊 Updated Cache:`);
    console.log(`   Price: $${Number(cache[0]) / 1e8}`);
    console.log(`   UpdatedAt: ${cache[1]} (${new Date(Number(cache[1]) * 1000).toISOString()})`);
    console.log(`   RoundId: ${cache[2]}`);
}

main().catch(console.error);
