import { createPublicClient, createWalletClient, http, parseEther, encodeAbiParameters, parseAbiParameters, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { loadNetworkConfig } from '../tests/regression/config.js';
import { registryActions, tokenActions } from '../packages/core/dist/index.js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.sepolia' });

async function debugCommunityRegistration() {
    const config = loadNetworkConfig('sepolia');
    const publicClient = createPublicClient({
        chain: config.chain,
        transport: http(config.rpcUrl)
    });

    // Bob's account
    const keyBob = process.env.PRIVATE_KEY_BOB as Hex;
    const bob = privateKeyToAccount(keyBob);
    const clientBob = createWalletClient({
        chain: config.chain,
        transport: http(config.rpcUrl),
        account: bob
    });

    const registry = registryActions(config.contracts.registry);
    const gToken = tokenActions();

    console.log('\n🔍 Debugging Community Registration for Bob\n');
    console.log(`Bob Address: ${bob.address}`);

    // Check Bob's GToken balance
    const balance = await gToken(publicClient).balanceOf({
        token: config.contracts.gToken,
        account: bob.address
    });
    console.log(`Bob GToken Balance: ${balance / BigInt(1e18)} tokens`);

    // Check allowance
    const allowance = await gToken(publicClient).allowance({
        token: config.contracts.gToken,
        owner: bob.address,
        spender: config.contracts.registry
    });
    console.log(`Bob Allowance to Registry: ${allowance / BigInt(1e18)} tokens`);

    // Get ROLE_COMMUNITY
    const ROLE_COMMUNITY = await registry(publicClient).ROLE_COMMUNITY();
    console.log(`ROLE_COMMUNITY: ${ROLE_COMMUNITY}`);

    // Check if Bob already has role
    const hasRole = await registry(publicClient).hasRole({
        user: bob.address,
        roleId: ROLE_COMMUNITY
    });
    console.log(`Bob has ROLE_COMMUNITY: ${hasRole}`);

    if (!hasRole) {
        // Encode CommunityRoleData
        const communityData = encodeAbiParameters(
            parseAbiParameters('string, string, string, string, string, uint256'),
            [
                'Bread', // Community name
                '', // ensName (optional)
                '', // website (optional)
                'Bread Community', // description
                '', // logoURI (optional)
                parseEther('30') // stakeAmount (30 GToken)
            ]
        );
        console.log(`\nEncoded Community Data: ${communityData}`);

        // Try to register with detailed error
        console.log('\n📝 Attempting registerRoleSelf...');
        try {
            const hash = await registry(clientBob).registerRoleSelf({
                roleId: ROLE_COMMUNITY,
                data: communityData,
                account: bob
            });
            await publicClient.waitForTransactionReceipt({ hash });
            console.log('✅ Registration successful!');
            console.log(`Transaction: ${hash}`);
        } catch (e: any) {
            console.log(`❌ Registration failed:`);
            console.log(`Error message: ${e.message}`);
            console.log(`\nFull error:`);
            console.log(e);
        }
    }
}

debugCommunityRegistration().catch(console.error);
