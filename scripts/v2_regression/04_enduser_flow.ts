import { http, parseEther, type Hex, type Address, keccak256, stringToBytes, erc20Abi, encodeAbiParameters, parseAbiParameters } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { createEndUserClient, RegistryABI } from '../../packages/sdk/src/index.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env.v3'), override: true });

const RPC_URL = process.env.RPC_URL || 'http://127.0.0.1:8545';
const USER_KEY = "0x7c8521197cd533c301a916120409a63c809181144001a1c93a0280eb46c6495d" as Hex;
const COMMUNITY_OWNER_KEY = "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a" as Hex;

const localAddresses = {
    registry: process.env.REGISTRY_ADDRESS as Address,
    gToken: process.env.GTOKEN_ADDRESS as Address,
    gTokenStaking: process.env.GTOKENSTAKING_ADDRESS as Address,
    superPaymaster: process.env.SUPER_PAYMASTER as Address,
    aPNTs: process.env.APNTS_ADDRESS as Address,
    mySBT: process.env.MYSBT_ADDRESS as Address
};

const ROLE_ENDUSER = keccak256(stringToBytes('ENDUSER'));

async function enduserFlow() {
    console.log('🚀 Step 04: End User Flow');
    
    const userAccount = privateKeyToAccount(USER_KEY);
    const communityAccount = privateKeyToAccount(COMMUNITY_OWNER_KEY);
    const userClient = createEndUserClient({
        chain: foundry, transport: http(RPC_URL), account: userAccount, addresses: localAddresses as any
    });

    console.log(`   User: ${userAccount.address}`);

    // 1. Check if user already has ENDUSER role
    console.log('\n👤 Checking ENDUSER Role...');
    const hasRole = await userClient.readContract({
        address: localAddresses.registry,
        abi: RegistryABI,
        functionName: 'hasRole',
        args: [ROLE_ENDUSER, userAccount.address]
    });

    if (hasRole) {
        console.log('   ✅ User already has ENDUSER role');
    } else {
        console.log('   📝 Registering ENDUSER role...');
        
        // Approve GToken for staking
        const approveTx = await userClient.writeContract({
            address: localAddresses.gToken,
            abi: erc20Abi,
            functionName: 'approve',
            args: [localAddresses.gTokenStaking, parseEther('10')],
            account: userAccount
        });
        await userClient.waitForTransactionReceipt({ hash: approveTx });

        // ENDUSER roleData: (account, community, avatarURI, ensName, stakeAmount)
        const enduserData = encodeAbiParameters(
            [{
                type: 'tuple',
                components: [
                    { name: 'account', type: 'address' },
                    { name: 'community', type: 'address' },
                    { name: 'avatarURI', type: 'string' },
                    { name: 'ensName', type: 'string' },
                    { name: 'stakeAmount', type: 'uint256' }
                ]
            }],
            [{ account: userAccount.address, community: communityAccount.address, avatarURI: '', ensName: '', stakeAmount: 0n }]
        );

        // Register ENDUSER role using writeContract
        const registerTx = await userClient.writeContract({
            address: localAddresses.registry,
            abi: RegistryABI,
            functionName: 'registerRoleSelf',
            args: [ROLE_ENDUSER, enduserData],
            account: userAccount
        });
        await userClient.waitForTransactionReceipt({ hash: registerTx });
        console.log('   ✅ ENDUSER Role Registered');
    }

    // 2. Verify SBT was minted
    console.log('\n🎫 Verifying SBT...');
    const sbtTokenId = await userClient.readContract({
        address: localAddresses.mySBT,
        abi: [{ type: 'function', name: 'getUserSBT', inputs: [{ name: 'user', type: 'address' }], outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view' }],
        functionName: 'getUserSBT',
        args: [userAccount.address]
    });

    if (sbtTokenId > 0n) {
        console.log(`   ✅ SBT Token ID: ${sbtTokenId}`);
    } else {
        console.log('   ⚠️ No SBT found (unexpected)');
    }

    // 3. Check user's reputation (if available)
    console.log('\n⭐ Checking Reputation...');
    try {
        const reputation = await userClient.readContract({
            address: localAddresses.registry,
            abi: [{ type: 'function', name: 'globalReputation', inputs: [{ name: '', type: 'address' }], outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view' }],
            functionName: 'globalReputation',
            args: [userAccount.address]
        });
        console.log(`   Reputation Score: ${reputation}`);
    } catch (e) {
        console.log('   ⚠️ Reputation not available (may need activity)');
    }

    console.log('\n🎉 Step 04 Completed Successfully\n');
}

enduserFlow().catch(err => {
    console.error('❌ Step 04 Failed:', err);
    process.exit(1);
});
