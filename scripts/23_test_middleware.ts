import 'dotenv/config';
import { type Address, type Hex, concat, pad, toHex } from 'viem';
import { getSuperPaymasterMiddleware } from '../packages/paymaster/src/SuperPaymaster/index.ts';
import { getPaymasterV4Middleware } from '../packages/paymaster/src/V4/index.ts';

/**
 * Test Script: Middleware Functionality
 * 
 * Tests middleware functions:
 * - getSuperPaymasterMiddleware
 * - getPaymasterV4Middleware
 */

async function main() {
    console.log('\n🧪 Testing Middleware Functionality\n');

    let testsPassed = 0;
    let testsFailed = 0;

    const mockUserOp = {
        sender: '0x1234567890123456789012345678901234567890' as Address,
        nonce: 0n,
        initCode: '0x' as Hex,
        callData: '0x' as Hex,
        callGasLimit: 100000n,
        verificationGasLimit: 150000n,
        preVerificationGas: 21000n,
        maxFeePerGas: 1000000000n,
        maxPriorityFeePerGas: 1000000000n,
        paymasterAndData: '0x' as Hex,
        signature: '0x' as Hex
    };

    // Test 1: Create SuperPaymaster Middleware
    try {
        console.log('📝 Test 1: getSuperPaymasterMiddleware - creation');
        const middleware = getSuperPaymasterMiddleware({
            paymasterAddress: '0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e' as Address,
            operator: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' as Address,
            verificationGasLimit: 150000n,
            postOpGasLimit: 50000n
        });
        
        if (middleware && middleware.sponsorUserOperation) {
            console.log('   ✅ PASSED: Middleware created\n');
            testsPassed++;
        } else {
            console.log('   ❌ FAILED: Invalid middleware\n');
            testsFailed++;
        }
    } catch (error: any) {
        console.log(`   ❌ FAILED: ${error.message}\n`);
        testsFailed++;
    }

    // Test 2: SuperPaymaster Middleware - Generate paymasterAndData
    try {
        console.log('📝 Test 2: getSuperPaymasterMiddleware - generate paymasterAndData');
        const middleware = getSuperPaymasterMiddleware({
            paymasterAddress: '0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e' as Address,
            operator: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' as Address,
            verificationGasLimit: 150000n,
            postOpGasLimit: 50000n
        });
        
        const result = await middleware.sponsorUserOperation({ userOperation: mockUserOp });
        
        console.log(`   PaymasterAndData: ${result.paymasterAndData.slice(0, 20)}...`);
        console.log(`   Length: ${result.paymasterAndData.length} chars`);
        
        // V3.2.1 Layout: [Paymaster(20)][VerGas(16)][PostOpGas(16)][Operator(20)][MaxRate(32)] = 104 bytes = 208 hex chars + 0x = 210
        if (result.paymasterAndData.length === 210 && result.paymasterAndData.startsWith('0x')) {
            console.log('   ✅ PASSED: Correct format (20+16+16+20+32 bytes)\n');
            testsPassed++;
        } else {
            console.log(`   ❌ FAILED: Invalid format. Expected 210 chars, got ${result.paymasterAndData.length}\n`);
            testsFailed++;
        }
    } catch (error: any) {
        console.log(`   ❌ FAILED: ${error.message}\n`);
        testsFailed++;
    }

    // Test 3: SuperPaymaster Middleware - Verify gas limits
    try {
        console.log('📝 Test 3: getSuperPaymasterMiddleware - verify gas limits');
        const middleware = getSuperPaymasterMiddleware({
            paymasterAddress: '0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e' as Address,
            operator: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' as Address,
            verificationGasLimit: 150000n,
            postOpGasLimit: 50000n
        });
        
        const result = await middleware.sponsorUserOperation({ userOperation: mockUserOp });
        
        if (result.verificationGasLimit === 150000n) {
            console.log('   ✅ PASSED: Gas limits correct\n');
            testsPassed++;
        } else {
            console.log(`   ❌ FAILED: Gas limits mismatch\n`);
            testsFailed++;
        }
    } catch (error: any) {
        console.log(`   ❌ FAILED: ${error.message}\n`);
        testsFailed++;
    }

    // Test 4: Create PaymasterV4 Middleware
    try {
        console.log('📝 Test 4: getPaymasterV4Middleware - creation');
        const middleware = getPaymasterV4Middleware({
            paymasterAddress: '0x524F04724632eED237cbA3c37272e018b3A7967e' as Address,
            gasToken: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0' as Address,
            verificationGasLimit: 100000n,
            postOpGasLimit: 50000n
        });
        
        if (middleware && middleware.sponsorUserOperation) {
            console.log('   ✅ PASSED: Middleware created\n');
            testsPassed++;
        } else {
            console.log('   ❌ FAILED: Invalid middleware\n');
            testsFailed++;
        }
    } catch (error: any) {
        console.log(`   ❌ FAILED: ${error.message}\n`);
        testsFailed++;
    }

    // Test 5: PaymasterV4 Middleware - Generate paymasterAndData
    try {
        console.log('📝 Test 5: getPaymasterV4Middleware - generate paymasterAndData');
        const middleware = getPaymasterV4Middleware({
            paymasterAddress: '0x524F04724632eED237cbA3c37272e018b3A7967e' as Address,
            gasToken: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0' as Address,
            verificationGasLimit: 100000n,
            postOpGasLimit: 50000n
        });
        
        const result = await middleware.sponsorUserOperation({ userOperation: mockUserOp });
        
        console.log(`   PaymasterAndData: ${result.paymasterAndData.slice(0, 20)}...`);
        console.log(`   Length: ${result.paymasterAndData.length} chars`);
        
        // Format: [Paymaster(20)][VerGas(16)][PostOpGas(16)][Token(20)] = 72 bytes = 144 hex chars + 0x
        if (result.paymasterAndData.length === 146 && result.paymasterAndData.startsWith('0x')) {
            console.log('   ✅ PASSED: Correct format (20+16+16+20 bytes)\n');
            testsPassed++;
        } else {
            console.log(`   ❌ FAILED: Invalid format. Expected 146 chars, got ${result.paymasterAndData.length}\n`);
            testsFailed++;
        }
    } catch (error: any) {
        console.log(`   ❌ FAILED: ${error.message}\n`);
        testsFailed++;
    }

    // Test 6: PaymasterV4 Middleware - Verify gas limits
    try {
        console.log('📝 Test 6: getPaymasterV4Middleware - verify gas limits');
        const middleware = getPaymasterV4Middleware({
            paymasterAddress: '0x524F04724632eED237cbA3c37272e018b3A7967e' as Address,
            gasToken: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0' as Address,
            verificationGasLimit: 100000n,
            postOpGasLimit: 50000n
        });
        
        const result = await middleware.sponsorUserOperation({ userOperation: mockUserOp });
        
        if (result.verificationGasLimit === 100000n) {
            console.log('   ✅ PASSED: Gas limits correct\n');
            testsPassed++;
        } else {
            console.log(`   ❌ FAILED: Gas limits mismatch\n`);
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
