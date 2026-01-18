import { createWalletClient, http, parseEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { UserClient } from '@aastar/sdk'; // Should be available now via re-export
import dotenv from 'dotenv';

dotenv.config();

/**
 * L3 Scenario: User Onboarding
 * 
 * Demonstrates how a new user interacts with the system:
 * 1. Checks credit score (SBT)
 * 2. Mints an SBT if eligible
 * 3. Claims initial reputation
 */
async function main() {
    // 1. Setup User
    const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
    const wallet = createWalletClient({
        account,
        chain: sepolia,
        transport: http(process.env.RPC_URL)
    });

    console.log(`\n🚀 Starting User Onboarding for ${account.address}...`);

    // 2. Initialize UserClient (New Architecture)
    // Note: In a real app, addresses would come from config or discovery
    const userClient = new UserClient(wallet as any, {
        registryAddress: process.env.REGISTRY_ADDRESS as `0x${string}`,
        sbtAddress: process.env.SBT_ADDRESS as `0x${string}`,
        reputationAddress: process.env.REPUTATION_ADDRESS as `0x${string}`
    });

    // 3. Check SBT Status
    console.log('\n📊 Checking SBT Status...');
    const hasSBT = await userClient.hasSBT(account.address);
    console.log(`   - Has SBT: ${hasSBT}`);

    if (!hasSBT) {
        console.log('   - Minting SBT...');
        const tx = await userClient.mintSBT();
        console.log(`   ✅ SBT Minted! Tx: ${tx}`);
    }

    // 4. Check Reputation
    console.log('\n⭐ Checking Reputation...');
    const score = await userClient.getReputationScore(account.address);
    // reputation score is bigint, convert to string for display
    console.log(`   - Current Score: ${score.toString()}`);

    console.log('\n✅ User Onboarding Complete!');
}

main().catch(console.error);
