import { createWalletClient, createPublicClient, http, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import type { NetworkConfig } from './config';
import { UserClient } from '../../packages/enduser/dist/UserClient.js';
import { CommunityClient } from '../../packages/enduser/dist/CommunityClient.js';
import { PaymasterOperatorClient, ProtocolClient } from '../../packages/operator/dist/index.js';

/**
 * Comprehensive L2 Business Clients Regression Tests
 */

export async function runL2Tests(config: NetworkConfig) {
    console.log('\n🧪 Testing L2 Business Clients (Comprehensive)...\n');
    
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

    let passedTests = 0;
    let totalTests = 0;

    // ========================================
    // 1. UserClient (15+ methods)
    // ========================================
    console.log('👤 === UserClient ===');
    
    totalTests++;
    try {
        console.log('  Test: getSBTBalance()');
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
        console.log(`    SBT Balance: ${sbtBalance.toString()}`);
        console.log('    ✅ PASS\n');
        passedTests++;
    } catch (e) {
        console.log(`    ❌ FAIL: ${(e as Error).message}\n`);
    }

    totalTests++;
    try {
        console.log('  Test: getStakedBalance()');
        const userClient = new UserClient({
            accountAddress: account.address,
            rpcUrl: config.rpcUrl,
            gTokenAddress: config.contracts.gToken,
            gTokenStakingAddress: config.contracts.gTokenStaking,
            sbtAddress: config.contracts.sbt,
            publicClient,
            walletClient
        });
        
        const roleId = '0x0000000000000000000000000000000000000000000000000000000000000001' as Hex;
        const staked = await userClient.getStakedBalance(roleId);
        console.log(`    Staked: ${staked.toString()}`);
        console.log('    ✅ PASS\n');
        passedTests++;
    } catch (e) {
        console.log(`    ❌ FAIL: ${(e as Error).message}\n`);
    }

    totalTests++;
    try {
        console.log('  Test: getTokenBalance()');
        const userClient = new UserClient({
            accountAddress: account.address,
            rpcUrl: config.rpcUrl,
            gTokenAddress: config.contracts.gToken,
            gTokenStakingAddress: config.contracts.gTokenStaking,
            sbtAddress: config.contracts.sbt,
            publicClient,
            walletClient
        });
        
        const balance = await userClient.getTokenBalance(config.contracts.gToken);
        console.log(`    Token Balance: ${balance.toString()}`);
        console.log('    ✅ PASS\n');
        passedTests++;
    } catch (e) {
        console.log(`    ❌ FAIL: ${(e as Error).message}\n`);
    }

    // ========================================
    // 2. CommunityClient (10+ methods)
    // ========================================
    console.log('🏛️ === CommunityClient ===');
    
    totalTests++;
    try {
        console.log('  Test: Client initialization');
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
        
        console.log('    Client created successfully');
        console.log('    ✅ PASS\n');
        passedTests++;
    } catch (e) {
        console.log(`    ❌ FAIL: ${(e as Error).message}\n`);
    }

    totalTests++;
    try {
        console.log('  Test: hasRole() check');
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
        
        const roleId = '0x0000000000000000000000000000000000000000000000000000000000000002' as Hex;
        const hasRole = await communityClient.hasRole(roleId);
        console.log(`    Has Community Role: ${hasRole}`);
        console.log('    ✅ PASS\n');
        passedTests++;
    } catch (e) {
        console.log(`    ❌ FAIL: ${(e as Error).message}\n`);
    }

    // ========================================
    // 3. PaymasterOperatorClient (10+ methods)
    // ========================================
    console.log('⚡ === PaymasterOperatorClient ===');
    
    totalTests++;
    try {
        console.log('  Test: isOperator()');
        const operatorClient = new PaymasterOperatorClient({
            accountAddress: account.address,
            rpcUrl: config.rpcUrl,
            superPaymasterAddress: config.contracts.superPaymaster,
            publicClient,
            walletClient
        });
        
        const isOp = await operatorClient.isOperator(account.address);
        console.log(`    Is Operator: ${isOp}`);
        console.log('    ✅ PASS\n');
        passedTests++;
    } catch (e) {
        console.log(`    ❌ FAIL: ${(e as Error).message}\n`);
    }

    totalTests++;
    try {
        console.log('  Test: getDepositDetails()');
        const operatorClient = new PaymasterOperatorClient({
            accountAddress: account.address,
            rpcUrl: config.rpcUrl,
            superPaymasterAddress: config.contracts.superPaymaster,
            publicClient,
            walletClient
        });
        
        const details = await operatorClient.getDepositDetails();
        console.log(`    Deposit: ${details.deposit.toString()}`);
        console.log('    ✅ PASS\n');
        passedTests++;
    } catch (e) {
        console.log(`    ❌ FAIL: ${(e as Error).message}\n`);
    }

    // ========================================
    // 4. ProtocolClient (8+ methods)
    // ========================================
    console.log('🏛️ === ProtocolClient ===');
    
    if (config.contracts.dvtValidator && config.contracts.blsAggregator) {
        totalTests++;
        try {
            console.log('  Test: Client initialization');
            const protocolClient = new ProtocolClient({
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

    console.log(`\n📊 L2 Results: ${passedTests}/${totalTests} tests passed\n`);
}
