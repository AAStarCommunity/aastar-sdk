import { getTestSetup } from './setup.js';
import { http } from 'viem';
import { createCommunityClient } from '../../src/clients/community.js';
import { RegistryABI, RoleIds } from '../../src/index.js';

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

    // 1. Directly check role using Registry
    console.log("\n1. Checking existing community info...");
    
    const registryAddress = process.env.REGISTRY_ADDRESS || process.env.REGISTRY;
    if (!registryAddress) {
        throw new Error('REGISTRY_ADDRESS not found in environment');
    }
    
    const hasRole = await communityClient.readContract({
        address: registryAddress as `0x${string}`,
        abi: RegistryABI,
        functionName: 'hasRole',
        args: [RoleIds.COMMUNITY, account.address]
    });
    
    if (hasRole) {
        console.log(`   ✅ Already registered as Local Operator`);
        
        // Get token address if available
        try {
            const info = await communityClient.getCommunityInfo(account.address);
            console.log(`   🪙 Token: ${info.tokenAddress || 'Pending'}`);
        } catch (e) {
            console.log(`   🪙 Token: (Unable to fetch)`);
        }
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
    }

    console.log("\n✅ Scenario 01 Finished Successfully!");
}

main().catch(error => {
    console.error("\n❌ Scenario 01 Failed:");
    console.error(error);
    process.exit(1);
});
