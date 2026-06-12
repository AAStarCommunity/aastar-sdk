import { getTestSetup } from './setup.js';
import { http, keccak256, stringToBytes, parseEther, parseAbi } from 'viem';
import { CORE_ADDRESSES } from '@aastar/core';
import { createOperatorClient } from '../../src/clients/operator.js';
import { RegistryABI, RoleIds } from '../../src/index.js';

async function main() {
    const { account, chain, rpcUrl } = await getTestSetup();
    
    console.log(`\n--- Scenario: Onboard Operator ---`);
    console.log(`Operator: ${account.address}`);

    const operatorClient = createOperatorClient({
        chain,
        transport: http(rpcUrl),
        account
    });

    // 1. Directly check role using Registry
    console.log("\n1. Checking existing operator status...");
    
    const registryAddress = process.env.REGISTRY_ADDRESS || process.env.REGISTRY;
    if (!registryAddress) {
        throw new Error('REGISTRY_ADDRESS not found in environment');
    }
    
    const hasRole = await operatorClient.readContract({
        address: registryAddress as `0x${string}`,
        abi: RegistryABI,
        functionName: 'hasRole',
        args: [RoleIds.PAYMASTER_SUPER, account.address]
    });
    
    if (hasRole) {
        console.log(`   ✅ Already configured as SuperPaymaster Operator`);
        
        // Get balance if available
        try {
            const status = await operatorClient.getOperatorStatus(account.address);
            console.log(`   💰 Balance: ${status.superPaymaster?.balance || 0} aPNTs`);
        } catch (e) {
            console.log(`   💰 Balance: (Unable to fetch)`);
        }
    } else {
        console.log("   ℹ️  Not onboarded or configured. Starting onboarding...");
        
        // 2. Prepare Tokens
        const aPNTsAddress = CORE_ADDRESSES.aPNTs;
        console.log(`   📍 aPNTs Address: ${aPNTsAddress}`);
        const spAddress = CORE_ADDRESSES.superPaymaster;
        console.log(`   📍 SuperPaymaster Address: ${spAddress}`);

        if (!aPNTsAddress) {
            throw new Error("aPNTs Address is undefined. Check your .env or CORE_ADDRESSES configuration.");
        }
        
        // Mint aPNTs (we are communityOwner of aPNTs in Anvil setup)
        console.log(`   🪙  Minting aPNTs to operator...`);
        const mintTx = await (operatorClient as any).writeContract({
            address: aPNTsAddress,
            abi: parseAbi(['function mint(address to, uint256 amount) external']),
            functionName: 'mint',
            args: [account.address, parseEther('1000')],
            account
        });
        await (operatorClient as any).waitForTransactionReceipt({ hash: mintTx });

        // Approve aPNTs for SuperPaymaster (for depositFor)
        console.log(`   🔓 Approving aPNTs for SuperPaymaster...`);
        const approveTx = await (operatorClient as any).writeContract({
            address: aPNTsAddress,
            abi: parseAbi(['function approve(address spender, uint256 amount) external']),
            functionName: 'approve',
            args: [spAddress, parseEther('1000')],
            account
        });
        await (operatorClient as any).waitForTransactionReceipt({ hash: approveTx });

        // 3. Onboard (Stake GToken + Deposit aPNTs)
        const roleId = keccak256(stringToBytes('PAYMASTER_SUPER'));
        console.log(`   📤 Onboarding operator (Role: PAYMASTER_SUPER)...`);
        
        await operatorClient.onboardOperator({
            stakeAmount: parseEther('10'),
            depositAmount: parseEther('100'),
            roleId
        });

        console.log(`   ✅ Onboarding complete.`);

        // 4. Configure Billing
        console.log("\n4. Configuring billing...");
        await operatorClient.configureOperator({
            xPNTsToken: aPNTsAddress as `0x${string}`,
            treasury: account.address,
        });

        console.log(`   ✅ Operator configured.`);
    }

    console.log("\n✅ Scenario 02 Finished Successfully!");
}

main().catch(error => {
    console.error("\n❌ Scenario 02 Failed:");
    console.error(error);
    process.exit(1);
});
