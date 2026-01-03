import { createWalletClient, createPublicClient, http, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import type { NetworkConfig } from './config';
import { 
    UserLifecycle, 
    StakingManager, 
    OperatorLifecycle,
    CommunityLaunchpad,
    SuperPaymasterOperator,
    ProtocolGovernance,
    ReputationManager
} from '../../packages/patterns/dist/index.js';

/**
 * Comprehensive L3 Scenario Patterns Regression Tests
 */

export async function runL3Tests(config: NetworkConfig) {
    console.log('\n🧪 Testing L3 Scenario Patterns (Comprehensive)...\n');
    
    let totalTests = 0;
    let passedTests = 0;
    
    // Create clients
    const account = privateKeyToAccount(config.testAccount.privateKey as `0x${string}`);
    
    const publicClient = createPublicClient({
        chain: config.chain,
        transport: http(config.rpcUrl)
    });
    
    // Create WalletClient for L2/L3 clients
    const walletClient = createWalletClient({
        account,
        chain: config.chain,
        transport: http(config.rpcUrl)
    });

    // ========================================
    // 1. UserLifecycle (10+ methods)
    // ========================================
    console.log('👤 === UserLifecycle ===');

    
    totalTests++;
    try {
        console.log('  Test: getMySBTs()');
        const userLifecycle = new UserLifecycle({
            accountAddress: account.address,
            rpcUrl: config.rpcUrl,
            gTokenAddress: config.contracts.gToken,
            gTokenStakingAddress: config.contracts.gTokenStaking,
            sbtAddress: config.contracts.sbt,
            publicClient,
            walletClient
        });
        
        const sbtBalance = await userLifecycle.getMySBTs();
        console.log(`    SBT Balance: ${sbtBalance.toString()}`);
        console.log('    ✅ PASS\n');
        passedTests++;
    } catch (e) {
        console.log(`    ❌ FAIL: ${(e as Error).message}\n`);
    }

    totalTests++;
    try {
        console.log('  Test: getStakedBalance()');
        const userLifecycle = new UserLifecycle({
            accountAddress: account.address,
            rpcUrl: config.rpcUrl,
            gTokenAddress: config.contracts.gToken,
            gTokenStakingAddress: config.contracts.gTokenStaking,
            sbtAddress: config.contracts.sbt,
            publicClient,
            walletClient
        });
        
        const roleId = '0x0000000000000000000000000000000000000000000000000000000000000001' as Hex;
        const staked = await userLifecycle.getStakedBalance(roleId);
        console.log(`    Staked: ${staked.toString()}`);
        console.log('    ✅ PASS\n');
        passedTests++;
    } catch (e) {
        console.log(`    ❌ FAIL: ${(e as Error).message}\n`);
    }

    // ========================================
    // 2. StakingManager
    // ========================================
    console.log('💳 === StakingManager ===');
    
    totalTests++;
    try {
        console.log('  Test: Client initialization');
        const stakingMgr = new StakingManager({
            accountAddress: account.address,
            rpcUrl: config.rpcUrl,
            gTokenAddress: config.contracts.gToken,
            gTokenStakingAddress: config.contracts.gTokenStaking,
            sbtAddress: config.contracts.sbt,
            publicClient,
            walletClient
        });
        
        console.log('    Client created successfully');
        console.log('    ✅ PASS\n');
        passedTests++;
    } catch (e) {
        console.log(`    ❌ FAIL: ${(e as Error).message}\n`);
    }

    // ========================================
    // 3. OperatorLifecycle
    // ========================================
    console.log('🚀 === OperatorLifecycle ===');
    
    totalTests++;
    try {
        console.log('  Test: checkReadiness()');
        const operatorLC = new OperatorLifecycle({
            accountAddress: account.address,
            rpcUrl: config.rpcUrl,
            superPaymasterAddress: config.contracts.superPaymaster,
            publicClient,
            walletClient
        });
        
        const status = await operatorLC.checkReadiness();
        console.log(`    Is Registered: ${status.isRegistered}`);
        console.log('    ✅ PASS\n');
        passedTests++;
    } catch (e) {
        console.log(`    ❌ FAIL: ${(e as Error).message}\n`);
    }

    // ========================================
    // 4. CommunityLaunchpad
    // ========================================
    console.log('🏛️ === CommunityLaunchpad ===');
    
    totalTests++;
    try {
        console.log('  Test: Client initialization');
        const launchpad = new CommunityLaunchpad({
            accountAddress: account.address,
            rpcUrl: config.rpcUrl,
            registryAddress: config.contracts.registry,
            xPNTsFactoryAddress: config.contracts.xPNTsFactory,
            reputationAddress: config.contracts.reputation,
            sbtAddress: config.contracts.sbt,
            publicClient,
            walletClient
        });
        
        console.log('    Client created successfully');
        console.log('    ✅ PASS\n');
        passedTests++;
    } catch (e) {
        console.log(`    ❌ FAIL: ${(e as Error).message}\n`);
    }

    // ========================================
    // 5. SuperPaymasterOperator
    // ========================================
    console.log('⚡ === SuperPaymasterOperator ===');
    
    totalTests++;
    try {
        console.log('  Test: isOperator()');
        const spOp = new SuperPaymasterOperator({
            accountAddress: account.address,
            rpcUrl: config.rpcUrl,
            superPaymasterAddress: config.contracts.superPaymaster,
            publicClient,
            walletClient
        });
        
        const isOp = await spOp.isOperator(account.address);
        console.log(`    Is Operator: ${isOp}`);
        console.log('    ✅ PASS\n');
        passedTests++;
    } catch (e) {
        console.log(`    ❌ FAIL: ${(e as Error).message}\n`);
    }

    totalTests++;
    try {
        console.log('  Test: getDepositBalance()');
        const spOp = new SuperPaymasterOperator({
            accountAddress: account.address,
            rpcUrl: config.rpcUrl,
            superPaymasterAddress: config.contracts.superPaymaster,
            publicClient,
            walletClient
        });
        
        const balance = await spOp.getDepositBalance();
        console.log(`    Deposit: ${balance.toString()}`);
        console.log('    ✅ PASS\n');
        passedTests++;
    } catch (e) {
        console.log(`    ❌ FAIL: ${(e as Error).message}\n`);
    }

    // ========================================
    // 6. ProtocolGovernance
    // ========================================
    console.log('🏛️ === ProtocolGovernance ===');
    
    if (config.contracts.dvtValidator && config.contracts.blsAggregator) {
        totalTests++;
        try {
            console.log('  Test: Client initialization');
            const protocolGov = new ProtocolGovernance({
                accountAddress: account.address,
                rpcUrl: config.rpcUrl,
                dvtValidatorAddress: config.contracts.dvtValidator,
                blsAggregatorAddress: config.contracts.blsAggregator,
                superPaymasterAddress: config.contracts.superPaymaster,
                publicClient,
                walletClient
            });
            
            console.log('    Client created successfully');
            console.log('    ✅ PASS\n');
            passedTests++;
        } catch (e) {
            console.log(`    ❌ FAIL: ${(e as Error).message}\n`);
        }
    } else {
        console.log('  ⏭️  Skipping (DVT/BLS addresses not configured)\n');
    }

    // ========================================
    // 7. ReputationManager
    // ========================================
    console.log('📊 === ReputationManager ===');
    
    totalTests++;
    try {
        console.log('  Test: getUserScore()');
        const repMgr = new ReputationManager(
            config.contracts.reputation,
            walletClient,
            config.contracts.sbt
        );
        
        const score = await repMgr.getUserScore(account.address);
        console.log(`    Score: ${score.toString()}`);
        console.log('    ✅ PASS\n');
        passedTests++;
    } catch (e) {
        console.log(`    ❌ FAIL: ${(e as Error).message}\n`);
    }

    totalTests++;
    try {
        console.log('  Test: getActiveRules()');
        const repMgr = new ReputationManager(
            config.contracts.reputation,
            publicClient,
            config.contracts.sbt
        );
        
        const rules = await repMgr.getActiveRules();
        console.log(`    Active Rules: ${rules.length}`);
        console.log('    ✅ PASS\n');
        passedTests++;
    } catch (e) {
        console.log(`    ❌ FAIL: ${(e as Error).message}\n`);
    }

    console.log(`\n📊 L3 Results: ${passedTests}/${totalTests} tests passed\n`);
}
