
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { createPublicClient, createWalletClient, http, type Hex, parseAbi, keccak256, stringToBytes, type Address, encodeAbiParameters } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env.sepolia') });

async function main() {
    console.log('🚀 Stage 3 Scenario 03c: AA Multi-Community Onboarding');
    
    // CONFIG
    const RPC_URL = process.env.SEPOLIA_RPC_URL;
    const ADMIN_A_KEY = '0x0c52a28d94e411a01580d995eb0b0a90256e7eef32f7eaddfc9f0c889afd67ce' as Hex;
    const ADMIN_B_KEY = '0xa0fecea9e4754594e6c5a563fe1bd79a9192b7212d7425c2ab2158c1807d32a1' as Hex;
    const USER_AA = '0x710a314F85b12A4Cbd0f141F576a40279Fe3a552' as Address;
    
    if (!RPC_URL) throw new Error('Missing RPC_URL');

    const client = createPublicClient({ chain: sepolia, transport: http(RPC_URL) });
    const registryAddr = process.env.REGISTRY_ADDR as Address;
    const gtokenAddr = process.env.GTOKEN_ADDR as Address;
    const stakingAddr = process.env.STAKING_ADDR as Address;
    const mysbtAddr = process.env.MYSBT_ADDR as Address;

    const registryAbi = parseAbi([
        'function safeMintForRole(bytes32 roleId, address user, bytes calldata data) external returns (uint256)',
        'function hasRole(bytes32, address) view returns (bool)',
        'function roleConfigs(bytes32) view returns (uint256 minStake, uint256 entryBurn, uint256, uint256, uint256, uint256, uint256, uint256, bool isActive, string description)'
    ]);
    const gtokenAbi = parseAbi(['function approve(address, uint256) external', 'function balanceOf(address) view returns (uint256)']);
    const sbtAbi = parseAbi(['function balanceOf(address) view returns (uint256)']);

    const ROLE_ENDUSER = keccak256(stringToBytes('ENDUSER'));

    const admins = [
        { name: 'Admin A (Stage3 DAO)', key: ADMIN_A_KEY },
        { name: 'Admin B (BreadDAO)', key: ADMIN_B_KEY }
    ];

    for (const adm of admins) {
        console.log(`\n--- Onboarding by ${adm.name} ---`);
        const account = privateKeyToAccount(adm.key);
        const wallet = createWalletClient({ account, chain: sepolia, transport: http(RPC_URL) });

        // Check if already registered
        // Note: Registry checks if user has ENDUSER role in the community? 
        // Actually ENDUSER role is global per user, but metadata links community.
        // Wait, Registry mapping is hasRole[ROLE_ENDUSER][user]. 
        // If a user belongs to multiple communities, how is it handled?
        // In this implementation, a user has ONE ENDUSER role in Registry, 
        // but the SBT allows multiple memberships.
        
        const hasGlobalRole = await client.readContract({
            address: registryAddr, abi: registryAbi, functionName: 'hasRole', args: [ROLE_ENDUSER, USER_AA]
        });

        if (hasGlobalRole && adm.name.includes('Admin B')) {
             console.log("   ⚠️ User already has ENDUSER role. Testing multi-community via secondary registration...");
             // Registry might revert if already has role.
        }

        const config = await client.readContract({ address: registryAddr, abi: registryAbi, functionName: 'roleConfigs', args: [ROLE_ENDUSER] });
        const totalStake = config[0] + config[1];

        console.log("   Approving GToken from Admin...");
        const txApp = await wallet.writeContract({
            address: gtokenAddr, abi: gtokenAbi, functionName: 'approve', args: [stakingAddr, totalStake]
        });
        await client.waitForTransactionReceipt({ hash: txApp });

        console.log(`   Registering AA User in ${adm.name}...`);
        const data = encodeAbiParameters(
            [{ type: 'tuple', components: [
                { name: 'account', type: 'address' }, { name: 'community', type: 'address' },
                { name: 'avatar', type: 'string' }, { name: 'ensName', type: 'string' },
                { name: 'stakeAmount', type: 'uint256' }
            ]}],
            [[USER_AA, account.address, '', '', 0n]] as any
        );

        try {
            const txReg = await wallet.writeContract({
                address: registryAddr, abi: registryAbi, functionName: 'safeMintForRole', args: [ROLE_ENDUSER, USER_AA, data]
            });
            await client.waitForTransactionReceipt({ hash: txReg });
            console.log("   ✅ Registered.");
        } catch (e: any) {
            console.log(`   ℹ️ Note: ${e.message.split('\n')[0]}`);
        }
    }

    // Verify SBT
    const sbtBal = await client.readContract({ address: mysbtAddr, abi: sbtAbi, functionName: 'balanceOf', args: [USER_AA] });
    console.log(`\n📊 Final State: User AA holds ${sbtBal} MySBTs.`);

    console.log('\n🏁 Scenario 03c Complete.');
}

main().catch(console.error);
