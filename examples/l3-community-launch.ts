import { createWalletClient, createPublicClient, http, parseEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { CommunityLaunchpad } from '@aastar/patterns';

/**
 * L3 Example: Community Launch
 * 
 * Demonstrates using CommunityLaunchpad pattern to create a new community.
 */

async function main() {
    // 1. Setup
    const privateKey = process.env.TEST_PRIVATE_KEY as `0x${string}`;
    if (!privateKey) throw new Error('TEST_PRIVATE_KEY required');

    const account = privateKeyToAccount(privateKey);
    const chain = sepolia;

    const publicClient = createPublicClient({
        chain,
        transport: http(process.env.RPC_URL)
    });

    const walletClient = createWalletClient({
        account,
        chain,
        transport: http(process.env.RPC_URL)
    });

    // 2. Initialize CommunityLaunchpad
    const launchpad = new CommunityLaunchpad({
        accountAddress: account.address,
        rpcUrl: process.env.RPC_URL!,
        registryAddress: process.env.REGISTRY_ADDRESS as `0x${string}`,
        xPNTsFactoryAddress: process.env.XPNTS_FACTORY_ADDRESS as `0x${string}`,
        reputationAddress: process.env.REPUTATION_ADDRESS as `0x${string}`,
        publicClient,
        walletClient
    });

    // 3. Launch Community
    console.log('🚀 Launching New Community...');
    
    const result = await launchpad.launch({
        name: 'ExampleDAO',
        token: {
            name: 'ExampleToken',
            symbol: 'EXT',
            initialSupply: parseEther('1000000')
        },
        governance: {
            minStake: parseEther('100')
        }
    });

    console.log('✅ Community Launched!');
    console.log('Community:', result.communityName);
    console.log('Registration TX:', result.registrationTxHash);
    console.log('Token TX:', result.tokenTxHash);
}

main().catch(console.error);
