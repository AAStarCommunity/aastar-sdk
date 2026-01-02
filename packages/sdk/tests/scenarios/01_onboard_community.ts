import { getTestSetup } from './setup.js';
import { http, keccak256, stringToBytes, parseEther } from 'viem';
import { createCommunityClient } from '../../src/clients/community.js';

async function main() {
    const { account, chain, rpcUrl } = await getTestSetup();
    
    console.log(`\n--- Scenario: Onboard Community ---`);
    console.log(`Owner: ${account.address}`);
    console.log(`Chain: ${chain.name}`);

    const communityClient = createCommunityClient({
        chain,
        transport: http(rpcUrl),
        account
    });

    // 1. Check current info
    console.log("\n1. Checking existing community info...");
    
    try {
        const info = await communityClient.getCommunityInfo(account.address);
        if (info.hasRole) {
            console.log(`   ✅ Already registered as ${info.communityData?.name || 'Community'}`);
            console.log(`   🪙 Token: ${info.tokenAddress || 'Pending'}`);
        } else {
            console.log("   ℹ️  Not registered. Launching...");
            
            // 2. Launch
            const result = await communityClient.launch({
                name: "Mycelium Community",
                tokenName: "Mycelium Points",
                tokenSymbol: "mPNT",
                description: "A research-focused community for Mycelium project.",
                website: "https://mycelium.research"
            });

            console.log(`   ✅ Community launched!`);
            console.log(`   🪙 Token Address: ${result.tokenAddress}`);
            
            // 3. Final verification
            const finalInfo = await communityClient.getCommunityInfo(account.address);
            console.log(`   📊 Status: Registered? ${finalInfo.hasRole} | Token: ${finalInfo.tokenAddress}`);
        }
    } catch (error: any) {
        // Handle "already registered" error gracefully
        if (error.message?.includes('already has COMMUNITY role')) {
            console.log(`   ✅ Already registered (detected during launch)`);
        } else {
            throw error;
        }
    }

    console.log("\n✅ Scenario 01 Finished Successfully!");
}

main().catch(error => {
    console.error("\n❌ Scenario 01 Failed:");
    console.error(error);
    process.exit(1);
});
