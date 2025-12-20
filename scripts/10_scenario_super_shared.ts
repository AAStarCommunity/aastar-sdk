
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
const GTokenABI = loadAbi('GToken');

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
    const REGISTRY_ADDR = process.env.REGISTRY_ADDRESS as Hex || '0x139e1D41943ee15dDe4DF876f9d0E7F85e26660A';
    const GTOKEN_ADDR = process.env.GTOKEN_ADDRESS as Hex || '0xFE5f411481565fbF70D8D33D992C78196E014b90';
    const STAKING_ADDR = process.env.GTOKEN_STAKING as Hex || '0xD6b040736e948621c5b6E0a494473c47a6113eA8';
    
    // --- 2b. Make sure EndUser Role is Configured (Admin) ---
    const ADMIN_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'; // Anvil #0
    const adminWallet = createWalletClient({ account: privateKeyToAccount(ADMIN_KEY as Hex), chain: anvil, transport: http(ANVIL_RPC) });
    
    // Check config
    const userConfigCheck = await publicClient.readContract({ address: REGISTRY_ADDR, abi: RegistryABI, functionName: 'roleConfigs', args: [ROLE_ENDUSER] }) as any;
    const currentMinStake = userConfigCheck[0];
    const isActive = userConfigCheck[6];
    
    console.log(`   🧐 Pre-Config Check: Active=${isActive}, MinStake=${currentMinStake}`);

    if (currentMinStake === 0n) {
        console.log(`   🔧 Updating ROLE_ENDUSER Config (MinStake 100)...`);
        // Config: [100, 0, 0, 0, 0, 0, true, "EndUser"]
        const newConfig = [100n, 0n, 0n, 0n, 0n, 0n, true, "EndUser"];
        const txConfig = await adminWallet.writeContract({
            address: REGISTRY_ADDR, abi: RegistryABI, functionName: 'configureRole', 
            args: [ROLE_ENDUSER, newConfig]
        });
        await waitForTx(publicClient, txConfig);
        console.log(`   ✅ ROLE_ENDUSER Configured.`);
    }

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
    
    // Check if already registered
    const isBobRegistered = await publicClient.readContract({
        address: REGISTRY_ADDR, abi: RegistryABI, functionName: 'hasRole', args: [ROLE_ENDUSER, bobAccount.address]
    });

    if (isBobRegistered) {
        console.log(`   ⚠️ Bob already registered (Pre-check). Skipping tx.`);
    } else {
        // Fetch Min Stake
        const userConfig = await publicClient.readContract({ address: REGISTRY_ADDR, abi: RegistryABI, functionName: 'roleConfigs', args: [ROLE_ENDUSER] }) as any;
        const requiredStake = userConfig[0];
        console.log(`   ⚖️ Required Stake for EndUser: ${requiredStake.toString()}`);

        if (requiredStake > 0n) {
            console.log(`   💰 Funding & Approving Stake...`);
            // Mint GToken to Bob (Mocking Admin Mint)
            // Need Admin Wallet to mint?
            const ADMIN_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'; 
            const adminWallet = createWalletClient({ account: privateKeyToAccount(ADMIN_KEY as Hex), chain: anvil, transport: http(ANVIL_RPC) });
            const txMint = await adminWallet.writeContract({
                address: GTOKEN_ADDR, abi: GTokenABI, functionName: 'mint', args: [bobAccount.address, requiredStake]
            });
            await waitForTx(publicClient, txMint);
            
            // Approve Staking
            const txApprove = await bobWallet.writeContract({
                address: GTOKEN_ADDR, abi: GTokenABI, functionName: 'approve', args: [STAKING_ADDR, requiredStake]
            });
            await waitForTx(publicClient, txApprove);
        }

        const bobData = encodeAbiParameters(
            [
                {
                    type: 'tuple',
                    components: [
                        { name: 'account', type: 'address' },
                        { name: 'community', type: 'address' },
                        { name: 'avatarURI', type: 'string' },
                        { name: 'ensName', type: 'string' },
                        { name: 'stakeAmount', type: 'uint256' }
                    ]
                }
            ],
            [
                {
                    account: bobAccount.address,
                    community: cAccount.address, // Link to C-Community
                    avatarURI: "ipfs://bob",
                    ensName: "bob.c",
                    stakeAmount: requiredStake
                }
            ]
        );

        try {
            const txReg = await bobWallet.writeContract({
                address: REGISTRY_ADDR, abi: RegistryABI, functionName: 'registerRoleSelf',
                args: [ROLE_ENDUSER, bobData]
            });
            await waitForTx(publicClient, txReg);
            console.log(`   ✅ Bob Registered linked to C-Community.`);
        } catch (e: any) {
             if (e.message.includes('RoleAlreadyGranted')) {
                 console.log(`   ⚠️ Bob already registered (Caught Error). Continuing.`);
             } else {
                 console.warn(`   ⚠️ Registration Error (Ignored if already active): ${e.message.split('\n')[0]}`);
             }
        }
    }

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
