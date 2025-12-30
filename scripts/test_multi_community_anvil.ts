import { createPublicClient, createWalletClient, http, parseEther, parseAbi, type Hex, encodeAbiParameters } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.v3') });

const RPC_URL = process.env.RPC_URL || 'http://127.0.0.1:8545';
const ADMIN_KEY = process.env.ADMIN_KEY as Hex;
const ALICE_KEY = process.env.ALICE_KEY as Hex;
const REGISTRY_ADDR = process.env.REGISTRY_ADDR as Hex;
const GTOKEN_ADDR = process.env.GTOKEN_ADDR as Hex;
const STAKING_ADDR = process.env.STAKING_ADDR as Hex;
const MYSBT_ADDR = process.env.MYSBT_ADDR as Hex;

const RegistryABI = parseAbi([
    'function ROLE_COMMUNITY() view returns (bytes32)',
    'function ROLE_ENDUSER() view returns (bytes32)',
    'function registerRoleSelf(bytes32, bytes) returns (uint256)',
    'function hasRole(bytes32, address) view returns (bool)',
    'function roleStakes(bytes32, address) view returns (uint256)'
]);

const GTokenABI = parseAbi([
    'function balanceOf(address) view returns (uint256)',
    'function approve(address, uint256) returns (bool)',
    'function mint(address, uint256)',
    'function transfer(address, uint256) returns (bool)'
]);

const MySBTABI = parseAbi([
    'function userToSBT(address) view returns (uint256)',
    'function getMemberships(uint256) view returns ((address,uint256,uint256,bool,string)[])',
    'function balanceOf(address) view returns (uint256)'
]);

async function main() {
    console.log('\n🧪 Multi-Community Registration Test (Anvil)\n');
    
    const admin = privateKeyToAccount(ADMIN_KEY);
    const alice = privateKeyToAccount(ALICE_KEY);
    
    const publicClient = createPublicClient({
        chain: foundry,
        transport: http(RPC_URL)
    });
    
    const adminWallet = createWalletClient({
        account: admin,
        chain: foundry,
        transport: http(RPC_URL)
    });
    
    const aliceWallet = createWalletClient({
        account: alice,
        chain: foundry,
        transport: http(RPC_URL)
    });
    
    console.log(`Admin: ${admin.address}`);
    console.log(`Alice: ${alice.address}`);
    console.log(`Registry: ${REGISTRY_ADDR}`);
    console.log(`MySBT: ${MYSBT_ADDR}\n`);
    
    // Get role IDs
    const ROLE_COMMUNITY = await publicClient.readContract({
        address: REGISTRY_ADDR,
        abi: RegistryABI,
        functionName: 'ROLE_COMMUNITY'
    }) as Hex;
    
    const ROLE_ENDUSER = await publicClient.readContract({
        address: REGISTRY_ADDR,
        abi: RegistryABI,
        functionName: 'ROLE_ENDUSER'
    }) as Hex;
    
    console.log(`ROLE_COMMUNITY: ${ROLE_COMMUNITY}`);
    console.log(`ROLE_ENDUSER: ${ROLE_ENDUSER}\n`);
    
    // ========================================
    // Step 1: Register 2 Communities (Admin as both)
    // ========================================
    console.log('📝 Step 1: Registering 2 Communities...');
    
    // Community A (Admin already registered in deployment script)
    const isAdminCommunity = await publicClient.readContract({
        address: REGISTRY_ADDR,
        abi: RegistryABI,
        functionName: 'hasRole',
        args: [ROLE_COMMUNITY, admin.address]
    });
    
    console.log(`   Admin is Community: ${isAdminCommunity}`);
    
    // For testing, we'll create a second "community" using Alice's address
    // First, mint GToken to Alice for staking
    const mintTx = await adminWallet.writeContract({
        address: GTOKEN_ADDR,
        abi: GTokenABI,
        functionName: 'mint',
        args: [alice.address, parseEther('1000')]
    });
    await publicClient.waitForTransactionReceipt({ hash: mintTx });
    console.log(`   ✅ Minted 1000 GToken to Alice`);
    
    // Alice registers as Community B
    const approveTx = await aliceWallet.writeContract({
        address: GTOKEN_ADDR,
        abi: GTokenABI,
        functionName: 'approve',
        args: [STAKING_ADDR, parseEther('100')]
    });
    await publicClient.waitForTransactionReceipt({ hash: approveTx });
    
    const communityBData = encodeAbiParameters(
        [
            { name: 'name', type: 'string' },
            { name: 'ensName', type: 'string' },
            { name: 'website', type: 'string' },
            { name: 'description', type: 'string' },
            { name: 'logoURI', type: 'string' },
            { name: 'stakeAmount', type: 'uint256' }
        ],
        ['Community B', 'communityb.eth', 'https://communityb.com', 'Test Community B', '', parseEther('30')]
    );
    
    try {
        const regBTx = await aliceWallet.writeContract({
            address: REGISTRY_ADDR,
            abi: RegistryABI,
            functionName: 'registerRoleSelf',
            args: [ROLE_COMMUNITY, communityBData]
        });
        await publicClient.waitForTransactionReceipt({ hash: regBTx });
        console.log(`   ✅ Alice registered as Community B\n`);
    } catch (e: any) {
        console.log(`   ⚠️ Community B registration failed: ${e.message}\n`);
    }
    
    // ========================================
    // Step 2: User (Admin) joins Community A (self)
    // ========================================
    console.log('📝 Step 2: Admin joins Community A (self)...');
    
    const userDataA = encodeAbiParameters(
        [
            { name: 'account', type: 'address' },
            { name: 'community', type: 'address' },
            { name: 'avatarURI', type: 'string' },
            { name: 'ensName', type: 'string' },
            { name: 'stakeAmount', type: 'uint256' }
        ],
        [admin.address, admin.address, '', '', parseEther('1')]
    );
    
    // Approve more GToken
    const approveUserTx = await adminWallet.writeContract({
        address: GTOKEN_ADDR,
        abi: GTokenABI,
        functionName: 'approve',
        args: [STAKING_ADDR, parseEther('10')]
    });
    await publicClient.waitForTransactionReceipt({ hash: approveUserTx });
    
    const joinATx = await adminWallet.writeContract({
        address: REGISTRY_ADDR,
        abi: RegistryABI,
        functionName: 'registerRoleSelf',
        args: [ROLE_ENDUSER, userDataA]
    });
    await publicClient.waitForTransactionReceipt({ hash: joinATx });
    console.log(`   ✅ Admin joined Community A (tx: ${joinATx})`);
    
    // Check SBT
    const sbtId1 = await publicClient.readContract({
        address: MYSBT_ADDR,
        abi: MySBTABI,
        functionName: 'userToSBT',
        args: [admin.address]
    }) as bigint;
    
    console.log(`   📛 SBT ID: ${sbtId1}`);
    
    const memberships1 = await publicClient.readContract({
        address: MYSBT_ADDR,
        abi: MySBTABI,
        functionName: 'getMemberships',
        args: [sbtId1]
    }) as any[];
    
    console.log(`   📊 Memberships: ${memberships1.length}`);
    memberships1.forEach((m: any, i: number) => {
        console.log(`      [${i}] Community: ${m.community}, Active: ${m.isActive}`);
    });
    console.log('');
    
    // ========================================
    // Step 3: User (Admin) joins Community B (Alice's community) - IDEMPOTENT CALL
    // ========================================
    console.log('📝 Step 3: Admin joins Community B (idempotent call)...');
    
    const userDataB = encodeAbiParameters(
        [
            { name: 'account', type: 'address' },
            { name: 'community', type: 'address' },
            { name: 'avatarURI', type: 'string' },
            { name: 'ensName', type: 'string' },
            { name: 'stakeAmount', type: 'uint256' }
        ],
        [admin.address, alice.address, '', '', parseEther('1')]
    );
    
    // Approve more GToken (for additional stake if needed)
    const approveUser2Tx = await adminWallet.writeContract({
        address: GTOKEN_ADDR,
        abi: GTokenABI,
        functionName: 'approve',
        args: [STAKING_ADDR, parseEther('10')]
    });
    await publicClient.waitForTransactionReceipt({ hash: approveUser2Tx });
    
    try {
        const joinBTx = await adminWallet.writeContract({
            address: REGISTRY_ADDR,
            abi: RegistryABI,
            functionName: 'registerRoleSelf',
            args: [ROLE_ENDUSER, userDataB]
        });
        await publicClient.waitForTransactionReceipt({ hash: joinBTx });
        console.log(`   ✅ Admin joined Community B (tx: ${joinBTx})`);
        
        // Check SBT again
        const sbtId2 = await publicClient.readContract({
            address: MYSBT_ADDR,
            abi: MySBTABI,
            functionName: 'userToSBT',
            args: [admin.address]
        }) as bigint;
        
        console.log(`   📛 SBT ID: ${sbtId2} (should be same as ${sbtId1})`);
        
        if (sbtId1 !== sbtId2) {
            console.log(`   ❌ ERROR: Different SBT IDs! Expected ${sbtId1}, got ${sbtId2}\n`);
            process.exit(1);
        }
        
        const memberships2 = await publicClient.readContract({
            address: MYSBT_ADDR,
            abi: MySBTABI,
            functionName: 'getMemberships',
            args: [sbtId2]
        }) as any[];
        
        console.log(`   📊 Memberships: ${memberships2.length} (expected: 2)`);
        memberships2.forEach((m: any, i: number) => {
            console.log(`      [${i}] Community: ${m.community}, Active: ${m.isActive}`);
        });
        
        if (memberships2.length === 2) {
            console.log(`\n✅ SUCCESS! User can join multiple communities!\n`);
        } else {
            console.log(`\n❌ FAILED! Expected 2 memberships, got ${memberships2.length}\n`);
            process.exit(1);
        }
        
    } catch (e: any) {
        console.log(`\n❌ FAILED to join Community B:`);
        console.log(`   Error: ${e.message}`);
        console.log(`\n   This indicates the idempotent logic may not be working correctly.\n`);
        process.exit(1);
    }
}

main().catch(console.error);
