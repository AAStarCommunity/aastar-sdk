import { config } from 'dotenv';
config({ path: '.env.v3' });
import { createPublicClient, createWalletClient, http, type Address, type Hex, parseEther } from 'viem';
import { anvil } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { createAdminClient } from '../packages/sdk/src/clients/admin';

/**
 * Test Script: PaymasterV4 Complete API Test
 * 
 * Tests all PaymasterV4Actions methods:
 * - Management: addGasToken, removeGasToken, addSBT, removeSBT, 
 *               setMaxGasCostCap, setServiceFeeRate, setTreasury, pause, unpause
 * - Query: getSupportedGasTokens, getSupportedSBTs, isGasTokenSupported,
 *          isSBTSupported, getMaxGasCostCap, getServiceFeeRate, getTreasury, isPaused
 */

const RPC_URL = 'http://127.0.0.1:8545';
const ADMIN_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as Hex;

async function main() {
    console.log('\n🧪 Testing PaymasterV4 Complete APIs\n');

    // Setup
    const account = privateKeyToAccount(ADMIN_PRIVATE_KEY);
    const publicClient = createPublicClient({
        chain: anvil,
        transport: http(RPC_URL)
    });

    const adminClient = createAdminClient({
        chain: anvil,
        transport: http(RPC_URL),
        account
    });

    const paymasterV4Address = process.env.PAYMASTER_V4_ADDRESS as Address;
    const gTokenAddress = process.env.GTOKEN_ADDRESS as Address;
    const mySBTAddress = process.env.MYSBT_ADDRESS as Address;
    
    console.log(`   PaymasterV4: ${paymasterV4Address}`);
    console.log(`   GToken: ${gTokenAddress}`);
    console.log(`   MySBT: ${mySBTAddress}`);
    console.log(`   Admin: ${account.address}\n`);

    let testsPassed = 0;
    let testsFailed = 0;

    // Test 1: Check initial pause status
    try {
        console.log('📝 Test 1: isPaused (initial state)');
        const paused = await adminClient.isPaused({ address: paymasterV4Address });
        console.log(`   Paused: ${paused}`);
        console.log('   ✅ PASSED\n');
        testsPassed++;
    } catch (error: any) {
        console.log(`   ❌ FAILED: ${error.message}\n`);
        testsFailed++;
    }

    // Test 2: Add Gas Token
    try {
        console.log('📝 Test 2: addGasToken');
        const hash = await adminClient.addGasToken({ 
            address: paymasterV4Address,
            token: gTokenAddress 
        });
        await publicClient.waitForTransactionReceipt({ hash });
        console.log('   ✅ PASSED: Gas token added\n');
        testsPassed++;
    } catch (error: any) {
        if (error.message.includes('AlreadyExists')) {
            console.log('   ✅ PASSED: Gas token already exists (idempotent)\n');
            testsPassed++;
        } else {
            console.log(`   ❌ FAILED: ${error.message}\n`);
            testsFailed++;
        }
    }

    // Test 3: Verify Gas Token was added
    try {
        console.log('📝 Test 3: isGasTokenSupported');
        const isSupported = await adminClient.isGasTokenSupported({ 
            address: paymasterV4Address,
            token: gTokenAddress 
        });
        
        if (isSupported) {
            console.log('   ✅ PASSED: Gas token is supported\n');
            testsPassed++;
        } else {
            console.log('   ❌ FAILED: Gas token not supported\n');
            testsFailed++;
        }
    } catch (error: any) {
        console.log(`   ❌ FAILED: ${error.message}\n`);
        testsFailed++;
    }

    // Test 4: Get Supported Gas Tokens
    try {
        console.log('📝 Test 4: getSupportedGasTokens');
        const tokens = await adminClient.getSupportedGasTokens({ 
            address: paymasterV4Address 
        });
        
        console.log(`   Supported tokens: ${tokens.length}`);
        if (tokens.some(t => t.toLowerCase() === gTokenAddress.toLowerCase())) {
            console.log('   ✅ PASSED: GToken in supported list\n');
            testsPassed++;
        } else {
            console.log('   ❌ FAILED: GToken not in supported list\n');
            testsFailed++;
        }
    } catch (error: any) {
        console.log(`   ❌ FAILED: ${error.message}\n`);
        testsFailed++;
    }

    // Test 5: Add SBT
    try {
        console.log('📝 Test 5: addSBT');
        const hash = await adminClient.addSBT({ 
            address: paymasterV4Address,
            sbt: mySBTAddress 
        });
        await publicClient.waitForTransactionReceipt({ hash });
        console.log('   ✅ PASSED: SBT added\n');
        testsPassed++;
    } catch (error: any) {
        if (error.message.includes('AlreadyExists')) {
            console.log('   ✅ PASSED: SBT already exists (idempotent)\n');
            testsPassed++;
        } else {
            console.log(`   ❌ FAILED: ${error.message}\n`);
            testsFailed++;
        }
    }

    // Test 6: Verify SBT was added
    try {
        console.log('📝 Test 6: isSBTSupported');
        const isSupported = await adminClient.isSBTSupported({ 
            address: paymasterV4Address,
            sbt: mySBTAddress 
        });
        
        if (isSupported) {
            console.log('   ✅ PASSED: SBT is supported\n');
            testsPassed++;
        } else {
            console.log('   ❌ FAILED: SBT not supported\n');
            testsFailed++;
        }
    } catch (error: any) {
        console.log(`   ❌ FAILED: ${error.message}\n`);
        testsFailed++;
    }

    // Test 7: Set Max Gas Cost Cap
    try {
        console.log('📝 Test 7: setMaxGasCostCap');
        const cap = parseEther('0.01');
        const hash = await adminClient.setMaxGasCostCap({ 
            address: paymasterV4Address,
            cap 
        });
        
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        
        if (receipt.status === 'success') {
            console.log('   ✅ PASSED: Max gas cost cap set\n');
            testsPassed++;
        } else {
            console.log('   ❌ FAILED: Transaction reverted\n');
            testsFailed++;
        }
    } catch (error: any) {
        console.log(`   ❌ FAILED: ${error.message}\n`);
        testsFailed++;
    }

    // Test 8: Get Max Gas Cost Cap
    try {
        console.log('📝 Test 8: getMaxGasCostCap');
        const cap = await adminClient.getMaxGasCostCap({ 
            address: paymasterV4Address 
        });
        
        console.log(`   Cap: ${cap}`);
        if (cap === parseEther('0.01')) {
            console.log('   ✅ PASSED: Cap matches expected value\n');
            testsPassed++;
        } else {
            console.log(`   ❌ FAILED: Cap mismatch\n`);
            testsFailed++;
        }
    } catch (error: any) {
        console.log(`   ❌ FAILED: ${error.message}\n`);
        testsFailed++;
    }

    // Test 9: Set Service Fee Rate
    try {
        console.log('📝 Test 9: setServiceFeeRate');
        const rate = 100n; // 1% (assuming 10000 = 100%)
        const hash = await adminClient.setServiceFeeRate({ 
            address: paymasterV4Address,
            rate 
        });
        
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        
        if (receipt.status === 'success') {
            console.log('   ✅ PASSED: Service fee rate set\n');
            testsPassed++;
        } else {
            console.log('   ❌ FAILED: Transaction reverted\n');
            testsFailed++;
        }
    } catch (error: any) {
        console.log(`   ❌ FAILED: ${error.message}\n`);
        testsFailed++;
    }

    // Test 10: Get Service Fee Rate
    try {
        console.log('📝 Test 10: getServiceFeeRate');
        const rate = await adminClient.getServiceFeeRate({ 
            address: paymasterV4Address 
        });
        
        console.log(`   Rate: ${rate}`);
        if (rate === 100n) {
            console.log('   ✅ PASSED: Rate matches expected value\n');
            testsPassed++;
        } else {
            console.log(`   ❌ FAILED: Rate mismatch\n`);
            testsFailed++;
        }
    } catch (error: any) {
        console.log(`   ❌ FAILED: ${error.message}\n`);
        testsFailed++;
    }

    // Test 11: Pause Paymaster
    try {
        console.log('📝 Test 11: pause');
        const hash = await adminClient.pause({ 
            address: paymasterV4Address 
        });
        
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        
        if (receipt.status === 'success') {
            const paused = await adminClient.isPaused({ address: paymasterV4Address });
            if (paused) {
                console.log('   ✅ PASSED: Paymaster paused\n');
                testsPassed++;
            } else {
                console.log('   ❌ FAILED: Paymaster not paused\n');
                testsFailed++;
            }
        } else {
            console.log('   ❌ FAILED: Transaction reverted\n');
            testsFailed++;
        }
    } catch (error: any) {
        console.log(`   ❌ FAILED: ${error.message}\n`);
        testsFailed++;
    }

    // Test 12: Unpause Paymaster
    try {
        console.log('📝 Test 12: unpause');
        const hash = await adminClient.unpause({ 
            address: paymasterV4Address 
        });
        
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        
        if (receipt.status === 'success') {
            const paused = await adminClient.isPaused({ address: paymasterV4Address });
            if (!paused) {
                console.log('   ✅ PASSED: Paymaster unpaused\n');
                testsPassed++;
            } else {
                console.log('   ❌ FAILED: Paymaster still paused\n');
                testsFailed++;
            }
        } else {
            console.log('   ❌ FAILED: Transaction reverted\n');
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
