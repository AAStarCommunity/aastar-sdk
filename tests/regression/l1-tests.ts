import { createWalletClient, createPublicClient, http, parseEther, type Address, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import type { NetworkConfig } from './config';
import { registryActions, stakingActions, tokenActions, sbtActions } from '@aastar/core';

/**
 * L1 Core Actions Regression Tests
 */

export async function testL1Actions(config: NetworkConfig): Promise<void> {
    console.log('\n🧪 Testing L1 Core Actions...\n');

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

    // Test 1: Registry Actions
    totalTests++;
    try {
        console.log('📝 Test: registryActions.hasRole()');
        const registry = registryActions(config.contracts.registry);
        const roleId = '0x0000000000000000000000000000000000000000000000000000000000000001' as Hex;
        const hasRole = await registry(publicClient).hasRole(roleId, account.address);
        console.log(`   Result: ${hasRole ? 'Has role' : 'No role'}`);
        console.log('   ✅ PASS\n');
        passedTests++;
    } catch (e) {
        console.log(`   ❌ FAIL: ${(e as Error).message}\n`);
    }

    // Test 2: Token Actions
    totalTests++;
    try {
        console.log('💰 Test: tokenActions.balanceOf()');
        const token = tokenActions(config.contracts.gToken);
        const balance = await token(publicClient).balanceOf(account.address);
        console.log(`   Balance: ${balance.toString()}`);
        console.log('   ✅ PASS\n');
        passedTests++;
    } catch (e) {
        console.log(`   ❌ FAIL: ${(e as Error).message}\n`);
    }

    // Test 3: Staking Actions
    totalTests++;
    try {
        console.log('🔒 Test: stakingActions.getLockedStake()');
        const staking = stakingActions(config.contracts.gTokenStaking);
        const roleId = '0x0000000000000000000000000000000000000000000000000000000000000001' as Hex;
        const staked = await staking(publicClient).getLockedStake({
            user: account.address,
            roleId
        });
        console.log(`   Staked: ${staked.toString()}`);
        console.log('   ✅ PASS\n');
        passedTests++;
    } catch (e) {
        console.log(`   ❌ FAIL: ${(e as Error).message}\n`);
    }

    // Test 4: SBT Actions
    totalTests++;
    try {
        console.log('🎫 Test: sbtActions.balanceOf()');
        const sbt = sbtActions(config.contracts.sbt);
        const sbtBalance = await sbt(publicClient).balanceOf({
            owner: account.address
        });
        console.log(`   SBT Count: ${sbtBalance.toString()}`);
        console.log('   ✅ PASS\n');
        passedTests++;
    } catch (e) {
        console.log(`   ❌ FAIL: ${(e as Error).message}\n`);
    }

    console.log(`\n📊 L1 Results: ${passedTests}/${totalTests} tests passed\n`);
}
