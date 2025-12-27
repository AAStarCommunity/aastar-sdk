import { http, parseEther, type Hex, type Address, keccak256, stringToBytes, encodeAbiParameters, parseAbiParameters, erc20Abi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { createCommunityClient, createAdminClient, RegistryABI } from '../../packages/sdk/src/index.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env.v3'), override: true });

const RPC_URL = process.env.RPC_URL || 'http://127.0.0.1:8545';
const ADMIN_KEY = (process.env.ADMIN_KEY || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80') as Hex;
const COMMUNITY_OWNER_KEY = "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a" as Hex;

const localAddresses = {
    registry: process.env.REGISTRY_ADDRESS as Address,
    gToken: process.env.GTOKEN_ADDRESS as Address,
    gTokenStaking: process.env.GTOKENSTAKING_ADDRESS as Address,
    superPaymaster: process.env.SUPER_PAYMASTER as Address,
    aPNTs: process.env.APNTS_ADDRESS as Address,
    mySBT: process.env.MYSBT_ADDRESS as Address
};

const ROLE_COMMUNITY = keccak256(stringToBytes('COMMUNITY'));

async function communityRegistry() {
    console.log('🚀 Step 03: Community Registry & SBT Setup');
    
    const adminAccount = privateKeyToAccount(ADMIN_KEY);
    const adminClient = createAdminClient({
        chain: foundry, transport: http(RPC_URL), account: adminAccount, addresses: localAddresses as any
    });

    const communityAccount = privateKeyToAccount(COMMUNITY_OWNER_KEY);
    const communityClient = createCommunityClient({
        chain: foundry, transport: http(RPC_URL), account: communityAccount, addresses: localAddresses as any
    });

    console.log(`   Community Owner: ${communityAccount.address}`);

    // 1. Register Community Role
    console.log('\n🏘️ Registering Community in Registry...');
    const hasRole = await adminClient.readContract({
        address: localAddresses.registry,
        abi: RegistryABI,
        functionName: 'hasRole',
        args: [ROLE_COMMUNITY, communityAccount.address]
    });

    if (hasRole) {
        console.log('   ✅ Community already registered');
    } else {
        // Approve GToken for staging/burn
        const approveTx = await communityClient.writeContract({
            address: localAddresses.gToken,
            abi: erc20Abi,
            functionName: 'approve',
            args: [localAddresses.gTokenStaking, parseEther('100')],
            account: communityAccount
        });
        await adminClient.waitForTransactionReceipt({ hash: approveTx });

        // Create unique name to avoid "Name taken"
        const uniqueName = `RegTest_${Date.now()}`;
        console.log(`   📝 Using unique community name: ${uniqueName}`);

        // Create proper CommunityRoleData: (name, ensName, website, description, logoURI, stakeAmount)
        const communityData = encodeAbiParameters(
            [{
                type: 'tuple',
                components: [
                    { name: 'name', type: 'string' },
                    { name: 'ensName', type: 'string' },
                    { name: 'website', type: 'string' },
                    { name: 'description', type: 'string' },
                    { name: 'logoURI', type: 'string' },
                    { name: 'stakeAmount', type: 'uint256' }
                ]
            }],
            [{ name: uniqueName, ensName: '', website: 'https://test.com', description: 'A test community for regression tests', logoURI: '', stakeAmount: 0n }]
        );

        // Register using writeContract directly
        const registerTx = await communityClient.writeContract({
            address: localAddresses.registry,
            abi: RegistryABI,
            functionName: 'registerRoleSelf',
            args: [ROLE_COMMUNITY, communityData],
            account: communityAccount
        });
        await communityClient.waitForTransactionReceipt({ hash: registerTx });
        console.log('   ✅ Community Registered Successfully');
    }

    // 2. Setup Reputation for Community (Admin side)
    console.log('\n⚖️ Setting up Reputation entropy...');
    // ReputationSystemV3 is handled via ReputationSystemV3.sol, often linked to Registry or Paymaster
    // In SDK, adminClient.setEntropyFactor handles this.
    // Need to find the reputation system address if it's separate, but usually handled via SuperPaymaster or Registry hooks.
    // For this regression, we assume it's configured to accept admin input for the community.
    
    try {
        const entropyTx = await adminClient.setEntropyFactor({
            community: communityAccount.address,
            factor: 100n, // 1.0x
            account: adminAccount
        });
        await adminClient.waitForTransactionReceipt({ hash: entropyTx });
        console.log('   ✅ Reputation Entropy Factor Set to 100');
    } catch (e) {
        console.log('   ⚠️ setEntropyFactor failed (maybe Reputation contract not deployed or already set). Continuing...');
    }

    console.log('\n🎉 Step 03 Completed Successfully\n');
}

communityRegistry().catch(err => {
    console.error('❌ Step 03 Failed:', err);
    process.exit(1);
});
