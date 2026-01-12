import { getTestSetup } from './setup.js';
import { http, parseEther, encodeFunctionData, erc20Abi } from 'viem';
import { createEndUserClient } from '../../src/clients/endUser.js';
import { ExperimentClient } from '../../src/clients/ExperimentClient.js';

async function main() {
    const { account, chain, rpcUrl } = await getTestSetup();
    
    console.log(`\n--- Scenario: Gasless Transaction Flow ---`);
    console.log(`User: ${account.address}`);

    const endUserClient = createEndUserClient({
        chain,
        transport: http(rpcUrl),
        account
    });

    const exp = new ExperimentClient("Gasless-Flow", "SuperPaymaster");

    // 1. Prepare Target Transaction
    // For testing, we transfer a tiny bit of GToken to ourselves
    const target = (process.env.GTOKEN_ADDRESS || '0x99f645c34d82f76d16F5bA11313F88E5Ae4FE5b6') as `0x${string}`;
    const data = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'transfer',
        args: [account.address, 1n] // 1 wei transfer
    });

    // 2. Determine Operator
    const operator = (process.env.OPERATOR_ADDRESS || account.address) as `0x${string}`;
    console.log(`   SDK: Targeting ${target} via Operator ${operator}`);

    // 3. Measure & Execute
    console.log("\n3. Executing UserOp...");
    try {
        const txHash = await exp.measureTx(
            "Send-UserOp", 
            endUserClient.executeGasless({
                target,
                data,
                operator
            }),
            endUserClient
        );

        console.log(`   ✅ Success! Tx Hash: ${txHash}`);
        
        // 4. Export results
        console.log("\n4. Exporting metrics...");
        // globalExperimentManager.exportToCSV("gasless_benchmark.csv");
        
    } catch (e: any) {
        console.error("\n❌ Transaction Failed:");
        console.warn(`   Reason: ${e.message.split('\n')[0]}`);
        
        if (e.message.includes('AA21') || e.message.includes('AA33')) {
            console.log("   💡 Tip: Check if the AA account has sufficient nonce and if operator is funded.");
        }
    }

    console.log("\n✅ Scenario 04 Finished.");
}

main().catch(error => {
    console.error("\n❌ Scenario 04 Fatal Error:");
    console.error(error);
    process.exit(1);
});
