
import { createWalletClient, createPublicClient, http, type Address, parseEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import type { NetworkConfig } from './config';
import { UserClient, CommunityClient, EndUserClient } from '../../packages/enduser/src/index.js';

/**
 * L3 New API Methods Regression Tests
 * Covers:
 * - UserClient.deployAccount (Static)
 * - CommunityClient.getCommunityInfo
 */

export async function runNewApiTests(config: NetworkConfig) {
    console.log('\n🧪 Testing New API Methods (L3)...\n');

    const account = privateKeyToAccount(config.testAccount.privateKey);
    
    const publicClient = createPublicClient({
        chain: config.chain,
        transport: http(config.rpcUrl)
    });

    const walletClient = createWalletClient({
        account,
        chain: config.chain,
        transport: http(config.rpcUrl)
    });

    let passedTests = 0;
    let totalTests = 0;

    // ========================================
    // 1. UserClient.deployAccount (Static)
    // ========================================
    console.log('📝 Test 1: UserClient.deployAccount (Static Helper)');
    totalTests++;
    
    try {
        const salt = BigInt(Math.floor(Math.random() * 1000000));
        console.log(`    Running with random salt: ${salt}`);

        // 2. Deploy (using generic deploy helper)
        const { accountAddress, hash } = await UserClient.deployAccount(walletClient, {
            owner: account.address,
            salt: salt,
            factoryAddress: config.contracts.simpleAccountFactory, // Ensure correct factory for Anvil
            publicClient: publicClient, // Pass publicClient for reading
            accountType: 'simple' // Explicitly showing the new parameter
        });

        console.log(`    Deployed AA: ${accountAddress}`);
        console.log(`    Tx Hash: ${hash}`);
        
        // Wait for deployment
        await publicClient.waitForTransactionReceipt({ hash });
        
        // Verify code exists
        const code = await publicClient.getBytecode({ address: accountAddress });
        if (code && code !== '0x') {
            console.log('    ✅ Code verification passed');
            console.log('    ✅ PASS\n');
            passedTests++;
        } else {
             throw new Error('Code not found at deployed address');
        }

    } catch (e: any) {
        // If it failed because it's already deployed (unlikely with random salt) or other reason
        console.log(`    ❌ FAIL: ${e.message}\n`);
    }

    // ========================================
    // 2. CommunityClient.getCommunityInfo
    // ========================================
    console.log('📝 Test 2: CommunityClient.getCommunityInfo');
    totalTests++;


    try {
        // We initialize a client to be the community manager
        const communityClient = new CommunityClient({
            accountAddress: account.address, // Use EOA as community manager for this test
            account: account,
            client: walletClient, // Pass WalletClient
            publicClient: publicClient,
            chainId: config.chain.id,
            paymasterUrl: config.paymasterUrl || '',
            bundleUrl: config.bundlerUrl || '',
            registryAddress: config.contracts.registry,
            xPNTsFactoryAddress: config.contracts.xPNTsFactory,
            sbtAddress: config.contracts.sbt,
            reputationAddress: config.contracts.reputation,
            gTokenAddress: config.contracts.gToken,
            gTokenStakingAddress: config.contracts.gTokenStaking
        });

        // 2. Setup (Register & Token)
        console.log('    ⚙️  Setting up Community (Register + Token)...');
        // We use the high-level setupCommunity which handles GToken approval, staking, and role registration
        // It handles idempotency checks internally
        const setupResult = await communityClient.setupCommunity({
            name: 'Test Community',
            tokenName: 'Test Token',
            tokenSymbol: 'TEST',
            description: 'A test community for SDK regression',
            logoURI: 'https://test.com/logo.png',
            website: 'https://test.com', // Map to ENS/Website
            stakeAmount: parseEther('100')
        });
        console.log(`    ✅ Community Setup Complete. Token: ${setupResult.tokenAddress}`);
        
        // Define metadata for verification
        const sampleMetadata = {
            name: 'Test Community',
            description: 'A test community for SDK regression'
        };

        // 2.2 Unhappy Path (Fetch)
        const info = await communityClient.getCommunityInfo(account.address);
        console.log(`    Fetched Info: Name=${info.name}`);
        
        if (info.name === 'AAStar' || info.name === 'Test Community') {
            console.log('    ✅ Community metadata retrieved successfully');
            console.log('    ✅ PASS\n');
            passedTests++;
        } else {
             throw new Error(`Unexpected community name: ${info.name}`);
        }

    } catch (e: any) {
        console.log(`    ❌ FAIL: ${e.message}\n`);
    }

    console.log(`\n📊 New API Results: ${passedTests}/${totalTests} tests passed\n`);
}
