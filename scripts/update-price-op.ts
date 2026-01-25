import { createPublicClient, createWalletClient, http, parseAbi } from 'viem';
import { optimismSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import * as dotenv from 'dotenv';
import * as path from 'path';

async function main() {
    dotenv.config({ path: '.env.op-sepolia' });
    const rpcUrl = process.env.OP_SEPOLIA_RPC_URL || process.env.OPTIMISM_SEPOLIA_RPC_URL;
    const superPaymaster = '0x9eC1FE8134A1C05aD34ba2E4e8758dAe0a009B94';
    const privateKey = process.env.PRIVATE_KEY_SUPPLIER as `0x${string}`;

    if (!privateKey) throw new Error('PRIVATE_KEY_SUPPLIER missing in .env.op-sepolia');

    const account = privateKeyToAccount(privateKey);
    const publicClient = createPublicClient({ chain: optimismSepolia, transport: http(rpcUrl) });
    const walletClient = createWalletClient({ account, chain: optimismSepolia, transport: http(rpcUrl) });

    console.log(`🔄 Calling SuperPaymaster.updatePriceDVT() on OP-Sepolia: ${superPaymaster}`);
    
    // Use a fixed price or fetch it. For now, matching the sepolia script's logic
    const price = 330000000000n; // $3300 (8 decimals)
    const now = Math.floor(Date.now() / 1000);
    const proof = '0x'; // Empty proof allowed for owner
    
    console.log(`   Price: $${Number(price) / 1e8}`);
    console.log(`   Timestamp: ${now}`);
    
    const hash = await walletClient.writeContract({
        address: superPaymaster as `0x${string}`,
        abi: parseAbi(['function updatePriceDVT(int256 price, uint256 updatedAt, bytes calldata proof) external']),
        functionName: 'updatePriceDVT',
        args: [price, BigInt(now), proof]
    });
    console.log(`📝 Transaction: ${hash}`);
    
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log(`✅ updatePriceDVT completed in block ${receipt.blockNumber}`);
}

main().catch(console.error);
