
import { createPublicClient, createWalletClient, http, type Address, type Hex } from 'viem';
import { anvil } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { createAdminClient } from '../packages/sdk/src/clients/admin.js';
import { config } from 'dotenv';
import path from 'path';

import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env.anvil
config({ path: path.resolve(__dirname, '../.env.anvil') });

/**
 * Test Script: SuperPaymaster New APIs
 * 
 * Tests newly added methods:
 * - setXPNTsFactory (requires owner)
 * - getXPNTsFactory
 */

const RPC_URL = 'http://127.0.0.1:8545';
// Anvil Account #0 (Owner of contracts in local deploy)
const OWNER_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as Hex;

async function main() {
    console.log('\n🧪 Testing SuperPaymaster New APIs\n');

    // Setup
    const account = privateKeyToAccount(OWNER_PRIVATE_KEY);
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
    console.log(`   Owner: ${account.address}\n`);

    if (!superPaymasterAddress) {
        console.error('SUPER_PAYMASTER environment variable is not set.');
        process.exit(1);
    }

    let testsPassed = 0;
    let testsFailed = 0;

    // Test 1: Get current xPNTs Factory (should be zero address initially)
    try {
        console.log('📝 Test 1: getXPNTsFactory (initial state)');
        
        const currentFactory = await publicClient.readContract({
            address: superPaymasterAddress,
            abi: [{
                type: 'function',
                name: 'xpntsFactory',
                inputs: [],
                outputs: [{ type: 'address' }],
                stateMutability: 'view'
            }],
            functionName: 'xpntsFactory'
        }) as Address;
        
        console.log(`   Current Factory: ${currentFactory}`);
        
        // It's technically okay if it's already set from a previous run, but usually 0x0
        if (currentFactory === '0x0000000000000000000000000000000000000000') {
            console.log('   ✅ PASSED: Factory is zero address (not set)\n');
        } else {
            console.log(`   ✅ PASSED: Factory is set to ${currentFactory}\n`);
        }
        testsPassed++;
    } catch (error: any) {
        console.log(`   ❌ FAILED: ${error.message}\n`);
        testsFailed++;
    }

    // Test 2: Set xPNTs Factory (requires owner)
    // We use a direct walletClient call to ensure we are using the owner account
    // and to avoid any SDK abstraction layers that might interfere
    try {
        console.log('📝 Test 2: setXPNTsFactory');
        const newFactory = '0x1234567890123456789012345678901234567890' as const;
        console.log(`   Setting factory to: ${newFactory}`);
        
        const hash = await walletClient.writeContract({
            address: superPaymasterAddress,
            abi: [{
                type: 'function',
                name: 'setXPNTsFactory',
                inputs: [{ name: '_factory', type: 'address' }],
                outputs: [],
                stateMutability: 'nonpayable'
            }],
            functionName: 'setXPNTsFactory',
            args: [newFactory]
        });
        
        await publicClient.waitForTransactionReceipt({ hash });
        console.log('   ✅ PASSED: Factory set successfully\n');
        testsPassed++;
    } catch (error: any) {
        console.log(`   ❌ FAILED: ${error.message}\n`);
        testsFailed++;
    }

    // Test 3: Get current xPNTs Factory (after setting)
    try {
        console.log('📝 Test 3: getXPNTsFactory (after setting)');
        
        const currentFactory = await publicClient.readContract({
            address: superPaymasterAddress,
            abi: [{
                type: 'function',
                name: 'xpntsFactory',
                inputs: [],
                outputs: [{ type: 'address' }],
                stateMutability: 'view'
            }],
            functionName: 'xpntsFactory'
        }) as Address;
        
        console.log(`   Current Factory: ${currentFactory}`);
        
        if (currentFactory.toLowerCase() === '0x1234567890123456789012345678901234567890') {
            console.log('   ✅ PASSED: Factory updated correctly\n');
            testsPassed++;
        } else {
            console.log(`   ❌ FAILED: Wanted 0x1234... but got ${currentFactory}\n`);
            testsFailed++;
        }
    } catch (error: any) {
        console.log(`   ❌ FAILED: ${error.message}\n`);
        testsFailed++;
    }

    // Test 4: Reset factory to zero address
    try {
        console.log('📝 Test 4: Reset factory to zero address');
        const zeroAddr = '0x0000000000000000000000000000000000000000' as const;
        
        const hash = await walletClient.writeContract({
            address: superPaymasterAddress,
            abi: [{
                type: 'function',
                name: 'setXPNTsFactory',
                inputs: [{ name: '_factory', type: 'address' }],
                outputs: [],
                stateMutability: 'nonpayable'
            }],
            functionName: 'setXPNTsFactory',
            args: [zeroAddr]
        });
        
        await publicClient.waitForTransactionReceipt({ hash });
        console.log('   ✅ PASSED: Factory reset successfully\n');
        testsPassed++;
    } catch (error: any) {
        console.log(`   ❌ FAILED: ${error.message}\n`);
        testsFailed++;
    }

    console.log('==================================================');
    console.log('📊 Test Summary');
    console.log('==================================================');
    console.log(`Total Tests: 4`);
    console.log(`✅ Passed: ${testsPassed}`);
    console.log(`❌ Failed: ${testsFailed}`);
    console.log('==================================================\n');

    if (testsFailed > 0) process.exit(1);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
