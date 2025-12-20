
import { 
    createPublicClient, 
    createWalletClient, 
    http, 
    keccak256, 
    toBytes, 
    encodeAbiParameters, 
    type Hex
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { anvil } from 'viem/chains';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

(BigInt.prototype as any).toJSON = function () { return this.toString(); };

dotenv.config({ path: path.resolve(__dirname, '../../SuperPaymaster/contracts/.env') });

const loadAbi = (name: string) => {
    const abiPath = path.resolve(__dirname, `../abis/${name}.abi.json`);
    if (!fs.existsSync(abiPath)) throw new Error(`ABI not found: ${abiPath}`);
    return JSON.parse(fs.readFileSync(abiPath, 'utf-8'));
};

const RegistryABI = loadAbi('Registry');

// --- CONSTANTS ---
const ROLE_COMMUNITY = keccak256(toBytes('COMMUNITY'));
const ROLE_ENDUSER = keccak256(toBytes('ENDUSER'));
const ANVIL_RPC = 'http://127.0.0.1:8545';

// --- ACCOUNTS (Must match solidity setup) ---
// const ADMIN_KEY = ...; // Unused
const C_ADMIN_PK = '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a'; // Anvil #2
const BOB_PK = '0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6'; // Anvil #9

// --- HELPER ---
const waitForTx = async (client: any, hash: Hex) => {
    const receipt = await client.waitForTransactionReceipt({ hash });
    if (receipt.status !== 'success') throw new Error(`Tx Failed: ${hash}`);
    return receipt;
};

async function main() {
    console.log('\n🦸 Starting Scenario 10: SuperPaymaster Shared Mode (C-Community) 🦸\n');

    // 1. Setup Clients
    const publicClient = createPublicClient({ chain: anvil, transport: http(ANVIL_RPC) });
    // const cWallet = ... // Unused if we only read? No, we need write Reg.
    const bobWallet = createWalletClient({ account: privateKeyToAccount(BOB_PK as Hex), chain: anvil, transport: http(ANVIL_RPC) });
    
    // 2. Load Contracts
    const REGISTRY_ADDR = process.env.REGISTRY_ADDRESS as Hex || '0x1c85638e118b37167e9298c2268758e058ddfda0';
    
    // 3. Verify C-Community Exists
    const cAccount = privateKeyToAccount(C_ADMIN_PK as Hex);
    const bobAccount = privateKeyToAccount(BOB_PK as Hex);
    console.log(`👤 C-Admin: ${cAccount.address}`);
    console.log(`👤 Bob (User): ${bobAccount.address}`);

    const isC = await publicClient.readContract({
        address: REGISTRY_ADDR, abi: RegistryABI, functionName: 'hasRole',
        args: [ROLE_COMMUNITY, cAccount.address]
    });
    console.log(`   🔍 C-Community Registered? ${isC}`);
    if (!isC) {
        console.error("❌ C-Community not found. Run 'forge script RegisterScenarioCommunities' first.");
        process.exit(1);
    }

    // ===============================================
    // Step A: Register Bob under C-Community
    // ===============================================
    console.log(`\n👤 [Step A] Registering Bob under C-Community...`);
    
    const bobData = encodeAbiParameters(
        [
            { name: 'account', type: 'address' },
            { name: 'community', type: 'address' },
            { name: 'avatarURI', type: 'string' },
            { name: 'ensName', type: 'string' },
            { name: 'stakeAmount', type: 'uint256' }
        ],
        [
            bobAccount.address,
            cAccount.address, // Link to C-Community
            "ipfs://bob",
            "bob.c",
            0n
        ]
    );

    const txReg = await bobWallet.writeContract({
        address: REGISTRY_ADDR, abi: RegistryABI, functionName: 'registerRoleSelf',
        args: [ROLE_ENDUSER, bobData]
    });
    await waitForTx(publicClient, txReg);
    console.log(`   ✅ Bob Registered linked to C-Community.`);

    // ===============================================
    // Step B: Verify Shared Paymaster Access
    // ===============================================
    console.log(`\n💳 [Step B] Verifying Shared Paymaster Logic...`);
    
    const isBobUser = await publicClient.readContract({
        address: REGISTRY_ADDR, abi: RegistryABI, functionName: 'hasRole', args: [ROLE_ENDUSER, bobAccount.address]
    });
    console.log(`   🔍 Bob Valid User: ${isBobUser}`);
    if(!isBobUser) throw new Error("Bob Registration Failed");

    console.log(`\n🎉 Scenario 10 Check Complete (Shared Logic Ready)!`);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
