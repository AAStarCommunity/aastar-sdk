import { createWalletClient, createPublicClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import type { NetworkConfig } from './config';
import { UserLifecycle, StakingManager, OperatorLifecycle } from '@aastar/patterns';

/**
 * L3 Scenario Patterns Regression Tests
 */

export async function testL3Patterns(config: NetworkConfig): Promise<void> {
    console.log('\n🧪 Testing L3 Scenario Patterns...\n');

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

    // Test 1: UserLifecycle
    totalTests++;
    try {
        console.log('👤 Test: UserLifecycle initialization');
        const userLifecycle = new UserLifecycle({
            accountAddress: account.address,
            rpcUrl: config.rpcUrl,
            gTokenAddress: config.contracts.gToken,
            gTokenStakingAddress: config.contracts.gTokenStaking,
            sbtAddress: config.contracts.sbt,
            publicClient,
            walletClient
        });
        
        // Test basic query
        const sbtBalance = await userLifecycle.getMySBTs();
        console.log(`   SBT Balance: ${sbtBalance.toString()}`);
        console.log('   ✅ PASS\n');
        passedTests++;
    } catch (e) {
        console.log(`   ❌ FAIL: ${(e as Error).message}\n`);
    }

    // Test 2: StakingManager
    totalTests++;
    try {
        console.log('💳 Test: StakingManager initialization');
        const stakingMgr = new StakingManager({
            accountAddress: account.address,
            rpcUrl: config.rpcUrl,
            gTokenAddress: config.contracts.gToken,
            gTokenStakingAddress: config.contracts.gTokenStaking,
            sbtAddress: config.contracts.sbt,
            publicClient,
            walletClient
        });
        
        console.log('   Client created successfully');
        console.log('   ✅ PASS\n');
        passedTests++;
    } catch (e) {
        console.log(`   ❌ FAIL: ${(e as Error).message}\n`);
    }

    // Test 3: OperatorLifecycle
    totalTests++;
    try {
        console.log('🚀 Test: OperatorLifecycle.checkReadiness()');
        const operatorLC = new OperatorLifecycle({
            accountAddress: account.address,
            rpcUrl: config.rpcUrl,
            superPaymasterAddress: config.contracts.superPaymaster,
            publicClient,
            walletClient
        });
        
        const status = await operatorLC.checkReadiness();
        console.log(`   Is Registered: ${status.isRegistered}`);
        console.log('   ✅ PASS\n');
        passedTests++;
    } catch (e) {
        console.log(`   ❌ FAIL: ${(e as Error).message}\n`);
    }

    console.log(`\n📊 L3 Results: ${passedTests}/${totalTests} tests passed\n`);
}
