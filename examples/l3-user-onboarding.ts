import { createWalletClient, createPublicClient, http, parseEther, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { UserLifecycle } from '@aastar/patterns';

/**
 * L3 Example: User Onboarding
 * 
 * Demonstrates complete user onboarding with stake + SBT self-mint.
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

    // 2. Initialize UserLifecycle
    const userLifecycle = new UserLifecycle({
        accountAddress: account.address,
        rpcUrl: process.env.RPC_URL!,
        gTokenAddress: process.env.GTOKEN_ADDRESS as `0x${string}`,
        gTokenStakingAddress: process.env.GTOKEN_STAKING_ADDRESS as `0x${string}`,
        sbtAddress: process.env.SBT_ADDRESS as `0x${string}`,
        publicClient,
        walletClient
    });

    // 3. Check Eligibility
    const communityAddress = process.env.COMMUNITY_ADDRESS as `0x${string}`;
    const eligible = await userLifecycle.checkEligibility(communityAddress);
    
    if (!eligible) {
        console.log('❌ Already a member or ineligible');
        return;
    }

    // 4. Onboard (Stake + Mint SBT)
    console.log('👤 Starting onboarding...');
    
    const roleId = '0x0000000000000000000000000000000000000000000000000000000000000001' as Hex;
    const result = await userLifecycle.onboard({
        community: communityAddress,
        roleId,
        stakeAmount: parseEther('100')
    });

    console.log('✅ Onboarding Complete!');
    console.log('Stake TX:', result.stakeTx);
    console.log('SBT Token ID:', result.sbtTokenId);

    // 5. Check Status
    const sbtBalance = await userLifecycle.getMySBTs();
    const stakedBalance = await userLifecycle.getStakedBalance(roleId);
    
    console.log('\nUser Status:');
    console.log('SBT Count:', sbtBalance.toString());
    console.log('Staked:', stakedBalance.toString());
}

main().catch(console.error);
