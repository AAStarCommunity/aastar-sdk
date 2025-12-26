import 'dotenv/config';
import { type Hex, keccak256, encodePacked } from 'viem';
import { BLSSigner, BLSHelpers } from '../packages/core/src/crypto';

/**
 * Test Script: BLS Signing Functionality
 * 
 * Tests BLS signing features:
 * - BLSSigner class methods
 * - BLSHelpers utility functions
 */

// Test private keys (for testing only!)
const TEST_PRIVATE_KEY_1 = '0x0000000000000000000000000000000000000000000000000000000000000001' as Hex;
const TEST_PRIVATE_KEY_2 = '0x0000000000000000000000000000000000000000000000000000000000000002' as Hex;

async function main() {
    console.log('\n🧪 Testing BLS Signing Functionality\n');

    let testsPassed = 0;
    let testsFailed = 0;

    // Test 1: Create BLS Signer
    try {
        console.log('📝 Test 1: Create BLSSigner');
        const signer = new BLSSigner(TEST_PRIVATE_KEY_1);
        console.log('   ✅ PASSED: BLSSigner created\n');
        testsPassed++;
    } catch (error: any) {
        console.log(`   ❌ FAILED: ${error.message}\n`);
        testsFailed++;
    }

    // Test 2: Get Public Key
    try {
        console.log('📝 Test 2: getPublicKey');
        const signer = new BLSSigner(TEST_PRIVATE_KEY_1);
        const publicKey = signer.getPublicKey();
        
        console.log(`   Public Key: ${publicKey.slice(0, 20)}...`);
        
        if (publicKey.startsWith('0x') && publicKey.length > 10) {
            console.log('   ✅ PASSED: Public key generated\n');
            testsPassed++;
        } else {
            console.log('   ❌ FAILED: Invalid public key format\n');
            testsFailed++;
        }
    } catch (error: any) {
        console.log(`   ❌ FAILED: ${error.message}\n`);
        testsFailed++;
    }

    // Test 3: Sign Message
    try {
        console.log('📝 Test 3: sign');
        const signer = new BLSSigner(TEST_PRIVATE_KEY_1);
        const message = keccak256(encodePacked(['string'], ['test message']));
        const signature = signer.sign(message);
        
        console.log(`   Signature: ${signature.slice(0, 20)}...`);
        
        if (signature.startsWith('0x') && signature.length > 10) {
            console.log('   ✅ PASSED: Message signed\n');
            testsPassed++;
        } else {
            console.log('   ❌ FAILED: Invalid signature format\n');
            testsFailed++;
        }
    } catch (error: any) {
        console.log(`   ❌ FAILED: ${error.message}\n`);
        testsFailed++;
    }

    // Test 4: Verify Signature
    try {
        console.log('📝 Test 4: verify');
        const signer = new BLSSigner(TEST_PRIVATE_KEY_1);
        const message = keccak256(encodePacked(['string'], ['test message']));
        const signature = signer.sign(message);
        const publicKey = signer.getPublicKey();
        
        const isValid = BLSSigner.verify(message, signature, publicKey);
        
        if (isValid) {
            console.log('   ✅ PASSED: Signature verified\n');
            testsPassed++;
        } else {
            console.log('   ❌ FAILED: Signature verification failed\n');
            testsFailed++;
        }
    } catch (error: any) {
        console.log(`   ❌ FAILED: ${error.message}\n`);
        testsFailed++;
    }

    // Test 5: Aggregate Signatures
    try {
        console.log('📝 Test 5: aggregateSignatures');
        const signer1 = new BLSSigner(TEST_PRIVATE_KEY_1);
        const signer2 = new BLSSigner(TEST_PRIVATE_KEY_2);
        
        const message = keccak256(encodePacked(['string'], ['test message']));
        const sig1 = signer1.sign(message);
        const sig2 = signer2.sign(message);
        
        const aggregatedSig = BLSSigner.aggregateSignatures([sig1, sig2]);
        
        console.log(`   Aggregated Signature: ${aggregatedSig.slice(0, 20)}...`);
        
        if (aggregatedSig.startsWith('0x') && aggregatedSig.length > 10) {
            console.log('   ✅ PASSED: Signatures aggregated\n');
            testsPassed++;
        } else {
            console.log('   ❌ FAILED: Invalid aggregated signature\n');
            testsFailed++;
        }
    } catch (error: any) {
        console.log(`   ❌ FAILED: ${error.message}\n`);
        testsFailed++;
    }

    // Test 6: Aggregate Public Keys
    try {
        console.log('📝 Test 6: aggregatePublicKeys');
        const signer1 = new BLSSigner(TEST_PRIVATE_KEY_1);
        const signer2 = new BLSSigner(TEST_PRIVATE_KEY_2);
        
        const pk1 = signer1.getPublicKey();
        const pk2 = signer2.getPublicKey();
        
        const aggregatedPk = BLSSigner.aggregatePublicKeys([pk1, pk2]);
        
        console.log(`   Aggregated Public Key: ${aggregatedPk.slice(0, 20)}...`);
        
        if (aggregatedPk.startsWith('0x') && aggregatedPk.length > 10) {
            console.log('   ✅ PASSED: Public keys aggregated\n');
            testsPassed++;
        } else {
            console.log('   ❌ FAILED: Invalid aggregated public key\n');
            testsFailed++;
        }
    } catch (error: any) {
        console.log(`   ❌ FAILED: ${error.message}\n`);
        testsFailed++;
    }

    // Test 7: Verify Aggregated Signature
    try {
        console.log('📝 Test 7: verify aggregated signature');
        const signer1 = new BLSSigner(TEST_PRIVATE_KEY_1);
        const signer2 = new BLSSigner(TEST_PRIVATE_KEY_2);
        
        const message = keccak256(encodePacked(['string'], ['test message']));
        const sig1 = signer1.sign(message);
        const sig2 = signer2.sign(message);
        const pk1 = signer1.getPublicKey();
        const pk2 = signer2.getPublicKey();
        
        const aggregatedSig = BLSSigner.aggregateSignatures([sig1, sig2]);
        const aggregatedPk = BLSSigner.aggregatePublicKeys([pk1, pk2]);
        
        const isValid = BLSSigner.verify(message, aggregatedSig, aggregatedPk);
        
        if (isValid) {
            console.log('   ✅ PASSED: Aggregated signature verified\n');
            testsPassed++;
        } else {
            console.log('   ❌ FAILED: Aggregated signature verification failed\n');
            testsFailed++;
        }
    } catch (error: any) {
        console.log(`   ❌ FAILED: ${error.message}\n`);
        testsFailed++;
    }

    // Test 8: createSlashProposalMessage
    try {
        console.log('📝 Test 8: BLSHelpers.createSlashProposalMessage');
        const proposalId = 123n;
        const message = BLSHelpers.createSlashProposalMessage(proposalId);
        
        console.log(`   Message: ${message.slice(0, 20)}...`);
        
        if (message.startsWith('0x') && message.length === 66) { // keccak256 = 32 bytes = 66 hex chars
            console.log('   ✅ PASSED: Slash proposal message created\n');
            testsPassed++;
        } else {
            console.log('   ❌ FAILED: Invalid message format\n');
            testsFailed++;
        }
    } catch (error: any) {
        console.log(`   ❌ FAILED: ${error.message}\n`);
        testsFailed++;
    }

    // Test 9: createReputationUpdateMessage
    try {
        console.log('📝 Test 9: BLSHelpers.createReputationUpdateMessage');
        const users = ['0x1234567890123456789012345678901234567890' as Hex];
        const scores = [100n];
        const epoch = 1n;
        
        const message = BLSHelpers.createReputationUpdateMessage(users, scores, epoch);
        
        console.log(`   Message: ${message.slice(0, 20)}...`);
        
        if (message.startsWith('0x') && message.length === 66) {
            console.log('   ✅ PASSED: Reputation update message created\n');
            testsPassed++;
        } else {
            console.log('   ❌ FAILED: Invalid message format\n');
            testsFailed++;
        }
    } catch (error: any) {
        console.log(`   ❌ FAILED: ${error.message}\n`);
        testsFailed++;
    }

    // Test 10: encodeReputationProof
    try {
        console.log('📝 Test 10: BLSHelpers.encodeReputationProof');
        const signer = new BLSSigner(TEST_PRIVATE_KEY_1);
        const message = keccak256(encodePacked(['string'], ['test']));
        const signature = signer.sign(message);
        const publicKey = signer.getPublicKey();
        const bitmap = 0xFn;
        
        const proof = BLSHelpers.encodeReputationProof(signature, publicKey, bitmap);
        
        console.log(`   Proof: ${proof.slice(0, 20)}...`);
        
        if (proof.startsWith('0x') && proof.length > 10) {
            console.log('   ✅ PASSED: Reputation proof encoded\n');
            testsPassed++;
        } else {
            console.log('   ❌ FAILED: Invalid proof format\n');
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
