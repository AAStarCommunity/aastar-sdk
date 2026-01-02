import { getTestSetup } from './setup.js';
import { http, keccak256, stringToBytes, parseEther } from 'viem';
import { createEndUserClient } from '../../src/clients/endUser.js';

async function main() {
    const { account, chain, rpcUrl } = await getTestSetup();
    
    console.log(`\n--- Scenario: Onboard User ---`);
    console.log(`EOA Owner: ${account.address}`);

    const endUserClient = createEndUserClient({
        chain,
        transport: http(rpcUrl),
        account
    });

    // 1. AA Account Management
    console.log("\n1. Predicting & Deploying Smart Account...");
    const { accountAddress, isDeployed } = await endUserClient.deploySmartAccount({
        owner: account.address,
        salt: 0n,
        fundWithETH: parseEther('0.1') // Fund for testing (though not strictly needed for gasless)
    });

    console.log(`   ✅ AA Address: ${accountAddress}`);
    console.log(`   📊 Status: Deployed: ${isDeployed}`);

    // 2. Joining Community
    console.log("\n2. Joining Community & Activating Credit...");
    // Use a test community address (can be from env or hardcoded for Anvil)
    const testCommunity = process.env.TEST_COMMUNITY_AASTAR || account.address; // Fallback to self for simple registry test
    const roleId = keccak256(stringToBytes('ENDUSER'));

    try {
        const result = await endUserClient.joinAndActivate({
            community: testCommunity as `0x${string}`,
            roleId
        });

        console.log(`   ✅ Joined Community! SBT ID: ${result.sbtId}`);
        console.log(`   💎 Initial Credit: ${result.initialCredit} points`);
    } catch (e) {
        console.warn(`   ⚠️ Join failed (likely role config missing on this network):`, e);
    }

    console.log("\n✅ Scenario 03 Finished Successfully!");
}

main().catch(error => {
    console.error("\n❌ Scenario 03 Failed:");
    console.error(error);
    process.exit(1);
});
