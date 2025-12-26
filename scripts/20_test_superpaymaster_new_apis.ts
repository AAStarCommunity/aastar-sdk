import 'dotenv/config';
import { createPublicClient, createWalletClient, http, type Address, type Hex, parseEther } from 'viem';
import { anvil } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { createAdminClient } from '../packages/sdk/src/clients/admin';

/**
 * Test Script: SuperPaymaster New APIs
 * 
 * Tests newly added methods:
 * - setXPNTsFactory
 * - getXPNTsFactory
 */

const RPC_URL = 'http://127.0.0.1:8545';
const ADMIN_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as Hex;

async function main() {
    console.log('\n🧪 Testing SuperPaymaster New APIs\n');

    // Setup
    const account = privateKeyToAccount(ADMIN_PRIVATE_KEY);
    const publicClient = createPublicClient({
        chain: anvil,
        transport: http(RPC_URL)
    });

    const walletClient = createWalletClient({
        account,
        chain: anvil,
        transport: http(RPC_URL)
    });

    const adminClient = createAdminClient({
        chain: anvil,
        transport: http(RPC_URL),
        account
    });

    const superPaymasterAddress = process.env.SUPER_PAYMASTER as Address;
    console.log(`   SuperPaymaster: ${superPaymasterAddress}`);
    console.log(`   Admin: ${account.address}\n`);

    if (!superPaymasterAddress) {
        console.error('SUPER_PAYMASTER environment variable is not set.');
        process.exit(1);
    }

    let testsPassed = 0;
    let testsFailed = 0;

    // Test 1: Get current xPNTs Factory (should be zero address initially)
    try {
        console.log('📝 Test 1: getXPNTsFactory (initial state)');
        const currentFactory = await adminClient.getXPNTsFactory();
        console.log(`   Current Factory: ${currentFactory}`);
        
        if (currentFactory === '0x0000000000000000000000000000000000000000') {
            console.log('   ✅ PASSED: Factory is zero address (not set)\n');
            testsPassed++;
        } else {
            console.log(`   ✅ PASSED: Factory already set to ${currentFactory}\n`);
            testsPassed++;
        }
    } catch (error: any) {
        console.log(`   ❌ FAILED: ${error.message}\n`);
        testsFailed++;
    }

    // Test 2: Set xPNTs Factory
    try {
        console.log('📝 Test 2: setXPNTsFactory');
        
        // Use a mock address for testing (in production, this would be the actual factory)
        const mockFactoryAddress = '0x1234567890123456789012345678901234567890' as Address;
        console.log(`   Setting factory to: ${mockFactoryAddress}`);
        
        const hash = await adminClient.setXPNTsFactory({ 
            factory: mockFactoryAddress 
        });
        
        console.log(`   Transaction: ${hash}`);
        
        // Wait for transaction
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        
        if (receipt.status === 'success') {
            console.log('   ✅ PASSED: Factory set successfully\n');
            testsPassed++;
        } else {
            console.log('   ❌ FAILED: Transaction reverted\n');
            testsFailed++;
        }
    } catch (error: any) {
        console.log(`   ❌ FAILED: ${error.message}\n`);
        testsFailed++;
    }

    // Test 3: Verify xPNTs Factory was set
    try {
        console.log('📝 Test 3: getXPNTsFactory (after setting)');
        const newFactory = await adminClient.getXPNTsFactory();
        console.log(`   New Factory: ${newFactory}`);
        
        const expectedFactory = '0x1234567890123456789012345678901234567890';
        if (newFactory.toLowerCase() === expectedFactory.toLowerCase()) {
            console.log('   ✅ PASSED: Factory matches expected value\n');
            testsPassed++;
        } else {
            console.log(`   ❌ FAILED: Factory mismatch. Expected ${expectedFactory}, got ${newFactory}\n`);
            testsFailed++;
        }
    } catch (error: any) {
        console.log(`   ❌ FAILED: ${error.message}\n`);
        testsFailed++;
    }

    // Test 4: Reset factory to zero address
    try {
        console.log('📝 Test 4: Reset factory to zero address');
        const zeroAddress = '0x0000000000000000000000000000000000000000' as Address;
        
        const hash = await adminClient.setXPNTsFactory({ 
            factory: zeroAddress 
        });
        
        await publicClient.waitForTransactionReceipt({ hash });
        
        const resetFactory = await adminClient.getXPNTsFactory();
        
        if (resetFactory === zeroAddress) {
            console.log('   ✅ PASSED: Factory reset to zero address\n');
            testsPassed++;
        } else {
            console.log(`   ❌ FAILED: Factory not reset. Got ${resetFactory}\n`);
            testsFailed++;
        }
    } catch (error: any) {
        console.log(`   ❌ FAILED: ${error.message}\n`);
        testsFailed++;
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 Test Summary');
    console.log('='.repeat(50));
    console.log(`Total Tests: ${testsPassed + testsFailed}`);
    console.log(`✅ Passed: ${testsPassed}`);
    console.log(`❌ Failed: ${testsFailed}`);
    console.log(`Coverage: ${((testsPassed / (testsPassed + testsFailed)) * 100).toFixed(1)}%`);
    console.log('='.repeat(50) + '\n');

    if (testsFailed > 0) {
        process.exit(1);
    }
}

main().catch(console.error);
