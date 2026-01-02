import { createWalletClient, createPublicClient, http, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import type { NetworkConfig } from './config';
import { UserClient, CommunityClient } from '@aastar/enduser';
import { PaymasterOperatorClient } from '@aastar/operator';

/**
 * L2 Business Clients Regression Tests
 */

export async function testL2Clients(config: NetworkConfig): Promise<void> {
    console.log('\n🧪 Testing L2 Business Clients...\n');

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

    // Test 1: UserClient
    totalTests++;
    try {
        console.log('👤 Test: UserClient.getSBTBalance()');
        const userClient = new UserClient({
            accountAddress: account.address,
            rpcUrl: config.rpcUrl,
            gTokenAddress: config.contracts.gToken,
            gTokenStakingAddress: config.contracts.gTokenStaking,
            sbtAddress: config.contracts.sbt,
            publicClient,
            walletClient
        });
        
        const sbtBalance = await userClient.getSBTBalance();
        console.log(`   SBT Balance: ${sbtBalance.toString()}`);
        console.log('   ✅ PASS\n');
        passedTests++;
    } catch (e) {
        console.log(`   ❌ FAIL: ${(e as Error).message}\n`);
    }

    // Test 2: CommunityClient
    totalTests++;
    try {
        console.log('🏛️ Test: CommunityClient initialization');
        const communityClient = new CommunityClient({
            accountAddress: account.address,
            rpcUrl: config.rpcUrl,
            registryAddress: config.contracts.registry,
            xPNTsFactoryAddress: config.contracts.xPNTsFactory,
            reputationAddress: config.contracts.reputation,
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

    // Test 3: PaymasterOperatorClient
    totalTests++;
    try {
        console.log('⚡ Test: PaymasterOperatorClient.isOperator()');
        const operatorClient = new PaymasterOperatorClient({
            accountAddress: account.address,
            rpcUrl: config.rpcUrl,
            superPaymasterAddress: config.contracts.superPaymaster,
            publicClient,
            walletClient
        });
        
        const isOp = await operatorClient.isOperator(account.address);
        console.log(`   Is Operator: ${isOp}`);
        console.log('   ✅ PASS\n');
        passedTests++;
    } catch (e) {
        console.log(`   ❌ FAIL: ${(e as Error).message}\n`);
    }

    console.log(`\n📊 L2 Results: ${passedTests}/${totalTests} tests passed\n`);
}
