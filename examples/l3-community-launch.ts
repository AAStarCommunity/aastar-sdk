import { createWalletClient, http, parseEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { CommunityClient } from '@aastar/sdk'; // Should be available now via re-export
import dotenv from 'dotenv';

dotenv.config();

/**
 * L3 Scenario: Community Launch
 * 
 * Demonstrates how to create a new community using the CommunityClient.
 */
async function main() {
    // 1. Setup User
    const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
    const wallet = createWalletClient({
        account,
        chain: sepolia,
        transport: http(process.env.RPC_URL)
    });

    console.log(`\n🚀 Starting Community Launch for ${account.address}...`);

    // 2. Initialize CommunityClient (New Architecture)
    const communityClient = new CommunityClient(wallet as any, {
        registryAddress: process.env.REGISTRY_ADDRESS as `0x${string}`,
        xPNTsFactoryAddress: process.env.XPNTS_FACTORY_ADDRESS as `0x${string}`,
        reputationAddress: process.env.REPUTATION_ADDRESS as `0x${string}`
    });

    // 3. Launch Community
    console.log('\n🏗️ Launching Community "ExampleDAO"...');
    
    // Note: Real deployment would require careful gas management if on mainnet
    const result = await communityClient.deployCommunity({
        name: 'ExampleDAO',
        tokenName: 'ExampleToken',
        tokenSymbol: 'EXT',
        initialSupply: parseEther('1000000'),
        minStake: parseEther('100')
    });

    console.log(`   ✅ Community Launched!`);
    console.log(`   - Community Address: ${result.communityAddress}`);
    console.log(`   - Token Address: ${result.tokenAddress}`);
}

main().catch(console.error);
