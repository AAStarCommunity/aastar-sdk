import { createWalletClient, createPublicClient, http, type Address, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import type { NetworkConfig } from './config';
import { 
    registryActions, 
    stakingActions, 
    tokenActions, 
    sbtActions,
    reputationActions,
    superPaymasterActions,
    paymasterV4Actions,
    xPNTsFactoryActions,
    dvtActions,
    aggregatorActions
} from '../../packages/core/dist/index.js';


/**
 * Comprehensive L1 Core Actions Regression Tests
 */

export async function runL1Tests(config: NetworkConfig) {
    console.log('\n🧪 Testing L1 Core Actions (Comprehensive)...\n');

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
    // 1. Registry Actions (10+ methods)
    // ========================================
    console.log('📝 Test 1: Registry Actions');
    
    totalTests++;
    try {
        console.log('📝 Test: registryActions.hasRole()');
        const registry = registryActions(config.contracts.registry);
        const roleId = '0x0000000000000000000000000000000000000000000000000000000000000001' as Hex;
        const hasRole = await registry(publicClient).hasRole({ user: account.address, roleId });
        console.log(`    Result: ${hasRole ? 'Has role' : 'No role'}`);
        console.log('    ✅ PASS\n');
        passedTests++;
    } catch (e) {
        console.log(`    ❌ FAIL: ${(e as Error).message}\n`);
    }

    totalTests++;
    try {
        console.log('  Test: getRoleMemberCount()');
        const registry = registryActions(config.contracts.registry);
        const roleId = '0x0000000000000000000000000000000000000000000000000000000000000001' as Hex;
        const count = await registry(publicClient).getRoleMemberCount (roleId);
        console.log(`    Count: ${count.toString()}`);
        console.log('    ✅ PASS\n');
        passedTests++;
    } catch (e) {
        console.log(`    ❌ FAIL: ${(e as Error).message}\n`);
    }

    totalTests++;
    try {
        console.log('  Test: getRoleAdmin()');
        const registry = registryActions(config.contracts.registry);
        const roleId = '0x0000000000000000000000000000000000000000000000000000000000000001' as Hex;
        const admin = await registry(publicClient).getRoleAdmin(roleId);
        console.log(`    Admin: ${admin}`);
        console.log('    ✅ PASS\n');
        passedTests++;
    } catch (e) {
        console.log(`    ❌ FAIL: ${(e as Error).message}\n`);
    }

    // ========================================
    // 2. Token Actions (ERC20)
    // ========================================
    console.log('💰 === Token Actions ===');
    
    totalTests++;
    try {
        console.log('  Test: balanceOf()');
        const token = tokenActions(config.contracts.gToken);
        const balance = await token(publicClient).balanceOf(account.address);
        console.log(`    Balance: ${balance.toString()}`);
        console.log('    ✅ PASS\n');
        passedTests++;
    } catch (e) {
        console.log(`    ❌ FAIL: ${(e as Error).message}\n`);
    }

    totalTests++;
    try {
        console.log('  Test: totalSupply()');
        const token = tokenActions(config.contracts.gToken);
        const supply = await token(publicClient).totalSupply();
        console.log(`    Supply: ${supply.toString()}`);
        console.log('    ✅ PASS\n');
        passedTests++;
    } catch (e) {
        console.log(`    ❌ FAIL: ${(e as Error).message}\n`);
    }

    totalTests++;
    try {
        console.log('  Test: allowance()');
        const token = tokenActions(config.contracts.gToken);
        const allowance = await token(publicClient).allowance({
            owner: account.address,
            spender: config.contracts.gTokenStaking
        });
        console.log(`    Allowance: ${allowance.toString()}`);
        console.log('    ✅ PASS\n');
        passedTests++;
    } catch (e) {
        console.log(`    ❌ FAIL: ${(e as Error).message}\n`);
    }

    // ========================================
    // 3. Staking Actions
    // ========================================
    console.log('🔒 === Staking Actions ===');
    
    totalTests++;
    try {
        console.log('  Test: getLockedStake()');
        const staking = stakingActions(config.contracts.gTokenStaking);
        const roleId = '0x0000000000000000000000000000000000000000000000000000000000000001' as Hex;
        const staked = await staking(publicClient).getLockedStake({
            user: account.address,
            roleId
        });
        console.log(`    Staked: ${staked.toString()}`);
        console.log('    ✅ PASS\n');
        passedTests++;
    } catch (e) {
        console.log(`    ❌ FAIL: ${(e as Error).message}\n`);
    }

    totalTests++;
    try {
        console.log('  Test: getTotalStaked()');
        const staking = stakingActions(config.contracts.gTokenStaking);
        const total = await staking(publicClient).getTotalStaked();
        console.log(`    Total: ${total.toString()}`);
        console.log('    ✅ PASS\n');
        passedTests++;
    } catch (e) {
        console.log(`    ❌ FAIL: ${(e as Error).message}\n`);
    }

    // ========================================
    // 4. SBT Actions
    // ========================================
    console.log('🎫 === SBT Actions ===');
    
    totalTests++;
    try {
        console.log('  Test: balanceOf()');
        const sbt = sbtActions(config.contracts.sbt);
        const sbtBalance = await sbt(publicClient).balanceOf({
            owner: account.address
        });
        console.log(`    SBT Count: ${sbtBalance.toString()}`);
        console.log('    ✅ PASS\n');
        passedTests++;
    } catch (e) {
        console.log(`    ❌ FAIL: ${(e as Error).message}\n`);
    }

    totalTests++;
    try {
        console.log('  Test: totalSupply()');
        const sbt = sbtActions(config.contracts.sbt);
        const supply = await sbt(publicClient).totalSupply();
        console.log(`    Total SBTs: ${supply.toString()}`);
        console.log('    ✅ PASS\n');
        passedTests++;
    } catch (e) {
        console.log(`    ❌ FAIL: ${(e as Error).message}\n`);
    }

    // ========================================
    // 5. Reputation Actions
    // ========================================
    console.log('📊 === Reputation Actions ===');
    
    totalTests++;
    try {
        console.log('  Test: getUserScore()');
        const rep = reputationActions(config.contracts.reputation);
        const score = await rep(publicClient).getUserScore({ user: account.address });
        console.log(`    Score: ${score.toString()}`);
        console.log('    ✅ PASS\n');
        passedTests++;
    } catch (e) {
        console.log(`    ❌ FAIL: ${(e as Error).message}\n`);
    }

    totalTests++;
    try {
        console.log('  Test: getActiveRules()');
        const rep = reputationActions(config.contracts.reputation);
        const rules = await rep(publicClient).getActiveRules();
        console.log(`    Active Rules: ${rules.length}`);
        console.log('    ✅ PASS\n');
        passedTests++;
    } catch (e) {
        console.log(`    ❌ FAIL: ${(e as Error).message}\n`);
    }

    // ========================================
    // 6. SuperPaymaster Actions  
    // ========================================
    console.log('⚡ === SuperPaymaster Actions ===');
    
    totalTests++;
    try {
        console.log('  Test: getDeposit()');
        const sp = superPaymasterActions(config.contracts.superPaymaster);
        const deposit = await sp(publicClient).getDeposit(account.address);
        console.log(`    Deposit: ${deposit.deposit.toString()}`);
        console.log('    ✅ PASS\n');
        passedTests++;
    } catch (e) {
        console.log(`    ❌ FAIL: ${(e as Error).message}\n`);
    }

    totalTests++;
    try {
        console.log('  Test: operators()');
        const sp = superPaymasterActions(config.contracts.superPaymaster);
        const isOp = await sp(publicClient).operators(account.address);
        console.log(`    Is Operator: ${isOp}`);
        console.log('    ✅ PASS\n');
        passedTests++;
    } catch (e) {
        console.log(`    ❌ FAIL: ${(e as Error).message}\n`);
    }

    // ========================================
    // 7. xPNTs Factory Actions 
    // ========================================
    console.log('🏭 === xPNTs Factory Actions ===');
    
    totalTests++;
    try {
        console.log('  Test: getTokenCount()');
        const factory = xPNTsFactoryActions(config.contracts.xPNTsFactory);
        const count = await factory(publicClient).getTokenCount();
        console.log(`    Token Count: ${count.toString()}`);
        console.log('    ✅ PASS\n');
        passedTests++;
    } catch (e) {
        console.log(`    ❌ FAIL: ${(e as Error).message}\n`);
    }

    console.log(`\n📊 L1 Results: ${passedTests}/${totalTests} tests passed\n`);
}
