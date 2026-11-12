
import { http, createWalletClient, createPublicClient, type Address, type PublicClient, keccak256, toHex, stringToBytes } from 'viem';
import { paymasterActions } from '@aastar/core';
import { adminClientForPaymaster, registerGasToken, requireMinedSuccess, runCountedStep, withdrawPaymasterDeposit, type StepCounts, type StepOutcome } from './paymaster-v4-anvil-client.js';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';
import { config } from 'dotenv';
import path from 'path';

import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env.anvil specifically
config({ path: path.resolve(__dirname, '../.env.anvil') });

const RPC_URL = process.env.RPC_URL || 'http://127.0.0.1:8545';
const ADMIN_KEY = (process.env.ADMIN_KEY || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80') as `0x${string}`;

async function main() {
    console.log('\n🧪 Testing PaymasterV4 Complete APIs\n');

    const account = privateKeyToAccount(ADMIN_KEY);
    
    // Create clients
    const publicClient = createPublicClient({
        chain: foundry,
        transport: http(RPC_URL)
    });

    const walletClient = createWalletClient({
        chain: foundry,
        transport: http(RPC_URL),
        account
    });

    const paymasterV4Address = process.env.PAYMASTER_V4_ADDRESS as Address;
    const gTokenAddress = process.env.GTOKEN_ADDRESS as Address;
    const apntsAddress = process.env.APNTS_ADDRESS as Address;
    const mySBTAddress = process.env.MYSBT_ADDRESS as Address;

    console.log(`   PaymasterV4: ${paymasterV4Address}`);
    console.log(`   GToken: ${gTokenAddress}`);
    console.log(`   APNTS:  ${apntsAddress}`);
    console.log(`   MySBT:  ${mySBTAddress}`);
    console.log(`   Admin:  ${account.address}\n`);

    if (!paymasterV4Address || paymasterV4Address === '0x0000000000000000000000000000000000000000') {
        console.error('❌ PaymasterV4 Address not set in .env.anvil');
        process.exit(1);
    }

    // Bound after validation. See paymaster-v4-anvil-client.ts.
    const adminClient = adminClientForPaymaster({
        transport: http(RPC_URL),
        account,
        paymasterV4Address,
    });
    // adminClient.pause/unpause are MySBT: sbtActions is spread after paymasterActions.
    const paymaster = paymasterActions(paymasterV4Address)(adminClient as PublicClient);

    const counts: StepCounts = { testsPassed: 0, testsFailed: 0, testsSkipped: 0 };
    const errorMessage = (error: unknown) => error instanceof Error ? error.message : String(error);
    const logCaught = (error: unknown, outcome: StepOutcome) => {
        const message = errorMessage(error);
        if (outcome === 'skipped') {
            console.log(`   ⚠️ SKIPPED: ${message} (SDK/Contract Mismatch)\n`);
        } else if (outcome === 'passed') {
            console.log('   ✅ PASSED: already exists (idempotent)\n');
        } else {
            console.log(`   ❌ FAILED: ${message}\n`);
        }
    };

    // Helper for reading contract directly (bypassing potential SDK ABI mismatch)
    const read = async (func: string, args: any[] = [], returnType: string = 'uint256') => {
        return publicClient.readContract({
            address: paymasterV4Address,
            abi: [{
                type: 'function',
                name: func,
                inputs: args.map(a => ({ type: 'address', name: 'arg' })), // specific for simple address inputs
                outputs: [{ type: returnType, name: 'out' }],
                stateMutability: 'view'
            }],
            functionName: func,
            args: args
        });
    };
    
    // Helper for simple no-arg getters
    const readSimple = async (func: string, returnType: string = 'uint256') => {
        return publicClient.readContract({
            address: paymasterV4Address,
            abi: [{
                type: 'function',
                name: func,
                inputs: [],
                outputs: [{ type: returnType, name: 'out' }],
                stateMutability: 'view'
            }],
            functionName: func
        });
    };

    // Test 1: isPaused (initial state)
    await runCountedStep(counts, async () => {
        console.log('📝 Test 1: isPaused (initial state)');
        const paused = await readSimple('paused', 'bool');
        console.log(`   Paused: ${paused}`);
        console.log('   ✅ PASSED: Paused status read\n');
    }, 'fail', logCaught);

    // Test 2: register APNTS as a gas token.
    // `addGasToken(address)` is not a method on the admin client and not a PaymasterV4
    // function. The real entry is `setTokenPrice(token, price)` — the same forwarding
    // `PaymasterOperatorClient.addGasToken(token, price)` does. Price scale matches
    // scripts/l4-setup.ts ($1.00, 8 decimals). The paymaster address is the validated
    // `paymasterV4Address`, closed over when the admin client is built.
    await runCountedStep(counts, async () => {
        console.log('📝 Test 2: setTokenPrice (using APNTS)');
        await registerGasToken({
            adminClient,
            token: apntsAddress,
            waitForReceipt: (hash) => publicClient.waitForTransactionReceipt({ hash }),
        });
        console.log('   ✅ PASSED: Gas token price set (APNTS)\n');
    }, 'already-exists', logCaught);

    // Test 3: isGasTokenSupported
    await runCountedStep(counts, async () => {
        console.log('📝 Test 3: isGasTokenSupported');
        const supported = await read('isGasTokenSupported', [apntsAddress], 'bool');
        console.log(`   Supported: ${supported}`);
        console.log('   ✅ PASSED: Gas token support checked\n');
    }, 'fail', logCaught);

    // Test 4: getSupportedGasTokens
    await runCountedStep(counts, async () => {
        console.log('📝 Test 4: getSupportedGasTokens');
        const tokens = await publicClient.readContract({
             address: paymasterV4Address,
             abi: [{ type: 'function', name: 'getSupportedGasTokens', inputs: [], outputs: [{ type: 'address[]' }], stateMutability: 'view' }],
             functionName: 'getSupportedGasTokens'
        }) as Address[];

        console.log(`   Tokens: ${tokens}`);
        const found = tokens.some(t => t.toLowerCase() === apntsAddress.toLowerCase());
        if (!found) throw new Error('APNTS not found in supported list');
        console.log('   ✅ PASSED: Supported gas tokens read and verified\n');
    }, 'fail', logCaught);

    // Test 5: addSBT
    await runCountedStep(counts, async () => {
        console.log('📝 Test 5: addSBT');
        const hash = await adminClient.addSBT({
            address: paymasterV4Address,
            sbt: mySBTAddress
        });
        requireMinedSuccess(await publicClient.waitForTransactionReceipt({ hash }), 'addSBT', hash);
        console.log('   ✅ PASSED: SBT added\n');
    }, 'already-exists', logCaught);

    // Test 5.1: addSBTWithActivity
    // Missing SDK method is a skip, not a pass. A mined revert fails the step.
    await runCountedStep(counts, async () => {
        console.log('📝 Test 5.1: addSBTWithActivity');
        const hash = await adminClient.addSBTWithActivity({
            address: paymasterV4Address,
            sbt: mySBTAddress,
            // @ts-ignore
            activity: keccak256(toHex(1)) // Passing it even if SDK type is wrong
        });
        requireMinedSuccess(await publicClient.waitForTransactionReceipt({ hash }), 'addSBTWithActivity', hash);
        console.log('   ✅ PASSED: SBT with activity added\n');
    }, 'sbt-activity', logCaught);

    // Test 6: isSBTSupported
    await runCountedStep(counts, async () => {
        console.log('📝 Test 6: isSBTSupported');
        const supported = await read('isSBTSupported', [mySBTAddress], 'bool');
        console.log(`   Supported: ${supported}`);
        console.log('   ✅ PASSED: SBT support checked\n');
    }, 'fail', logCaught);

    // Test 7: setMaxGasCostCap
    await runCountedStep(counts, async () => {
        console.log('📝 Test 7: setMaxGasCostCap');
        const newCap = BigInt(2 * 1e18); // 2 ETH
        const hash = await adminClient.setMaxGasCostCap({
            address: paymasterV4Address,
            _maxGasCostCap: newCap
        });
        requireMinedSuccess(await publicClient.waitForTransactionReceipt({ hash }), 'setMaxGasCostCap', hash);
        console.log('   ✅ PASSED: Max gas cost cap set\n');
    }, 'fail', logCaught);

    // Test 8: getMaxGasCostCap
    await runCountedStep(counts, async () => {
        console.log('📝 Test 8: getMaxGasCostCap');
        const cap = await readSimple('maxGasCostCap', 'uint256');
        console.log(`   Max Gas Cost Cap: ${cap}`);
        console.log('   ✅ PASSED: Max gas cost cap read\n');
    }, 'fail', logCaught);

    // Test 9: setServiceFeeRate
    await runCountedStep(counts, async () => {
        console.log('📝 Test 9: setServiceFeeRate');
        const newRate = BigInt(500); // 5% (Max is 10%)
        const hash = await adminClient.setServiceFeeRate({
            address: paymasterV4Address,
            _serviceFeeRate: newRate
        });
        requireMinedSuccess(await publicClient.waitForTransactionReceipt({ hash }), 'setServiceFeeRate', hash);
        console.log('   ✅ PASSED: Service fee rate set\n');
    }, 'fail', logCaught);

    // Test 10: getServiceFeeRate
    await runCountedStep(counts, async () => {
        console.log('📝 Test 10: getServiceFeeRate');
        const rate = await readSimple('serviceFeeRate', 'uint256');
        console.log(`   Service Fee Rate: ${rate}`);
        console.log('   ✅ PASSED: Service fee rate read\n');
    }, 'fail', logCaught);

    // Test 11: pause
    await runCountedStep(counts, async () => {
        console.log('📝 Test 11: pause');
        const hash = await paymaster.pause({});
        requireMinedSuccess(await publicClient.waitForTransactionReceipt({ hash }), 'pause', hash);
        console.log('   ✅ PASSED: Paymaster paused\n');
    }, 'fail', logCaught);

    // Test 12: unpause
    await runCountedStep(counts, async () => {
        console.log('📝 Test 12: unpause');
        const hash = await paymaster.unpause({});
        requireMinedSuccess(await publicClient.waitForTransactionReceipt({ hash }), 'unpause', hash);
        console.log('   ✅ PASSED: Paymaster unpaused\n');
    }, 'fail', logCaught);
    
    // Test 13: withdraw EntryPoint deposit.
    // `withdrawPNT(address,address,uint256)` is not on the admin client. The real entry
    // is `withdrawTo(to, amount)` and it takes no token. 1 wei is the smallest amount
    // the client will forward — `validatePositive` rejects 0 before any transaction.
    console.log('📝 Test 13: withdrawTo');
    const withdrawn = await withdrawPaymasterDeposit({
        counts,
        adminClient,
        to: account.address,
        waitForReceipt: (hash) => publicClient.waitForTransactionReceipt({ hash }),
    });
    if (withdrawn.error) {
        console.log(`   ❌ FAILED: ${errorMessage(withdrawn.error)}\n`);
    } else {
        console.log('   ✅ PASSED: withdrawTo called\n');
    }

    console.log('==================================================');
    console.log('📊 Test Summary');
    console.log('==================================================');
    console.log(`Total Tests: 14`);
    console.log(`✅ Passed: ${counts.testsPassed}`);
    console.log(`⏭️ Skipped: ${counts.testsSkipped}`);
    console.log(`❌ Failed: ${counts.testsFailed}`);
    console.log('==================================================\n');

    if (counts.testsFailed > 0) process.exit(1);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
