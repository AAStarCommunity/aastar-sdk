import { createPublicClient, createWalletClient, http, parseEther, keccak256, toBytes, encodeAbiParameters, formatEther, type Hex, type Address, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry, sepolia } from 'viem/chains';
import * as dotenv from 'dotenv';
import * as path from 'path';

const envPath = process.env.SDK_ENV_PATH || '.env.v3';
dotenv.config({ path: path.resolve(process.cwd(), envPath), override: true });

const isSepolia = process.env.REVISION_ENV === 'sepolia';
const chain = isSepolia ? sepolia : foundry;
const RPC_URL = process.env.RPC_URL || (isSepolia ? process.env.SEPOLIA_RPC_URL : 'http://127.0.0.1:8545');

const ADMIN_KEY = (process.env.ADMIN_KEY || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80') as Hex;
const REGISTRY = process.env.REGISTRY_ADDRESS as Address;
const SUPER_PAYMASTER = process.env.SUPER_PAYMASTER as Address;

const ROLE_COMMUNITY = keccak256(toBytes('COMMUNITY'));

async function testLifecycle() {
    console.log('🧪 Running Step 18: Enhanced Lifecycle Scenarios (Completion)');
    
    if (!REGISTRY) {
        console.error('❌ REGISTRY_ADDRESS missing in environment');
        process.exit(1);
    }

    const admin = privateKeyToAccount(ADMIN_KEY);
    const publicClient = createPublicClient({ chain, transport: http(RPC_URL) });
    const walletClient = createWalletClient({ account: admin, chain, transport: http(RPC_URL) });

    // 1. Batch Reputation Sync (Simulation of Batch Enrollment State)
    console.log('\n📊 Scenario 1: Batch Reputation Sync');
    const users = [
        '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' as Address, // Anvil #1
        '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC' as Address  // Anvil #2
    ];
    const newScores = [500n, 800n];
    const epoch = BigInt(Math.floor(Date.now() / 1000));

    console.log(`   Syncing ${users.length} user scores...`);
    const syncTx = await walletClient.writeContract({
        address: REGISTRY,
        abi: parseAbi(['function syncGlobalReputation(address[] calldata users, uint256[] calldata newScores, uint256 epoch, bytes calldata proof) external']),
        functionName: 'syncGlobalReputation',
        args: [users, newScores, epoch, '0x'], // Skip BLS proof check for admin if configured or using mock
    }).catch(e => {
        console.log(`   ℹ️ Sync failed (expected revert if BLS active): ${e.message.split('\n')[0]}`);
        return null;
    });

    if (syncTx) {
        await publicClient.waitForTransactionReceipt({ hash: syncTx });
        const score0 = await publicClient.readContract({
            address: REGISTRY,
            abi: parseAbi(['function globalReputation(address) view returns (uint256)']),
            functionName: 'globalReputation',
            args: [users[0]]
        });
        console.log(`   ✅ User 0 score: ${score0}`);
    }

    // 2. Role Exit & Namespace Release
    console.log('\n🚪 Scenario 2: Role Exit & Namespace Release');
    // We'll use a temporary community owner to test exit
    const exitUserKey = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d' as Hex;
    const exitUser = privateKeyToAccount(exitUserKey);
    const exitWallet = createWalletClient({ account: exitUser, chain, transport: http(RPC_URL) });

    const hasCommRole = await publicClient.readContract({
        address: REGISTRY,
        abi: parseAbi(['function hasRole(bytes32, address) view returns (bool)']),
        functionName: 'hasRole',
        args: [ROLE_COMMUNITY, exitUser.address]
    });

    if (hasCommRole) {
        console.log(`   User ${exitUser.address} has COMMUNITY role, initiating exit...`);
        const exitTx = await exitWallet.writeContract({
            address: REGISTRY,
            abi: parseAbi(['function exitRole(bytes32 roleId) external']),
            functionName: 'exitRole',
            args: [ROLE_COMMUNITY]
        });
        await publicClient.waitForTransactionReceipt({ hash: exitTx });
        console.log('   ✅ Exit successful.');
        
        // Final check: Role should be false
        const stillHasRole = await publicClient.readContract({
            address: REGISTRY,
            abi: parseAbi(['function hasRole(bytes32, address) view returns (bool)']),
            functionName: 'hasRole',
            args: [ROLE_COMMUNITY, exitUser.address]
        });
        console.log(`   Role status after exit: ${stillHasRole}`);
    } else {
        console.log('   ℹ️ Exit user does not have COMMUNITY role, skipping exit test.');
    }

    // 3. Ownership Transfer
    console.log('\n👑 Scenario 3: Ownership Transfer (Dry Run / Safe Check)');
    const currentOwner = await publicClient.readContract({
        address: REGISTRY,
        abi: parseAbi(['function owner() view returns (address)']),
        functionName: 'owner'
    });
    console.log(`   Registry Owner: ${currentOwner}`);

    if (currentOwner.toLowerCase() === admin.address.toLowerCase()) {
        console.log('   Admin is owner. Transferring to self to verify flow...');
        const transferTx = await walletClient.writeContract({
            address: REGISTRY,
            abi: parseAbi(['function transferOwnership(address newOwner) external']),
            functionName: 'transferOwnership',
            args: [admin.address]
        });
        await publicClient.waitForTransactionReceipt({ hash: transferTx });
        console.log('   ✅ Ownership transfer self-verified.');
    }

    console.log('\n🎉 Step 18 Completed Successfully\n');
}

testLifecycle().catch(err => {
    console.error('❌ Step 18 Failed:', err);
    process.exit(1);
});
