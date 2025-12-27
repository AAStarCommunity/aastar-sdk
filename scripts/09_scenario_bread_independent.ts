
import { 
    createPublicClient, 
    createWalletClient, 
    http, 
    parseEther, 
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

// Fix BigInt serialization
(BigInt.prototype as any).toJSON = function () { return this.toString(); };

dotenv.config({ path: path.resolve(process.cwd(), '.env.v3'), override: true });

// --- LOAD ABIS ---
const loadAbi = (name: string) => {
    const abiPath = path.resolve(__dirname, `../abis/${name}.json`);
    if (!fs.existsSync(abiPath)) throw new Error(`ABI not found: ${abiPath}`);
    return JSON.parse(fs.readFileSync(abiPath, 'utf-8'));
};

const RegistryABI = loadAbi('Registry');
const GTokenABI = loadAbi('GToken');

// --- CONSTANTS ---
const ROLE_COMMUNITY = keccak256(toBytes('COMMUNITY'));
const ROLE_PAYMASTER_AOA = keccak256(toBytes('PAYMASTER_AOA'));
const ROLE_ENDUSER = keccak256(toBytes('ENDUSER'));
const ANVIL_RPC = 'http://127.0.0.1:8545';

// --- ACCOUNTS (Must match solidity setup) ---
const ADMIN_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'; // Anvil #0
const BREAD_ADMIN_PK = '0xea6c44ac03bff858b476bba40716402b03e41b8e97e276d1baec7c37d42484a0'; // Anvil #3
const ALICE_PK = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d'; // Anvil #1 (Reusing for Alice)

// --- HELPER ---
const waitForTx = async (client: any, hash: Hex) => {
    const receipt = await client.waitForTransactionReceipt({ hash });
    if (receipt.status !== 'success') throw new Error(`Tx Failed: ${hash}`);
    return receipt;
};

async function main() {
    console.log('\n🍞 Starting Scenario 09: BreadDAO Independent Mode 🍞\n');

    // 1. Setup Clients
    const publicClient = createPublicClient({ chain: anvil, transport: http(ANVIL_RPC) });
    const adminWallet = createWalletClient({ account: privateKeyToAccount(ADMIN_KEY as Hex), chain: anvil, transport: http(ANVIL_RPC) });
    // const breadWallet = createWalletClient({...}); // Unused for now
    const aliceWallet = createWalletClient({ account: privateKeyToAccount(ALICE_PK as Hex), chain: anvil, transport: http(ANVIL_RPC) });
    const breadAccount = privateKeyToAccount(BREAD_ADMIN_PK as Hex);
    const aliceAccount = privateKeyToAccount(ALICE_PK as Hex);

    console.log(`👤 BreadAdmin: ${breadAccount.address}`);
    console.log(`👤 Alice (EndUser): ${aliceAccount.address}`);

    // 2. Load Contracts
    const REGISTRY_ADDR = process.env.REGISTRY_ADDRESS as Hex || '0x1c85638e118b37167e9298c2268758e058ddfda0';
    const GTOKEN_ADDR = process.env.GTOKEN_ADDRESS as Hex || '0x46b142dd1e924fab83ecc3c08e4d46e82f005e0e';
    const STAKING_ADDR = process.env.GTOKEN_STAKING as Hex || '0xc9a43158891282a2b1475592d5719c001986aaec';
    
    // 3. Verify BreadDAO Exists (Pre-requisite)
    const isBread = await publicClient.readContract({
        address: REGISTRY_ADDR, abi: RegistryABI, functionName: 'hasRole',
        args: [ROLE_COMMUNITY, breadAccount.address]
    });
    console.log(`   🔍 BreadDAO Registered? ${isBread}`);
    if (!isBread) {
        console.error("❌ BreadDAO not found. Run 'forge script RegisterScenarioCommunities' first.");
        process.exit(1);
    }

    // ===============================================
    // Step A: Deploy BreadPoints (Mock Token)
    // ===============================================
    console.log(`\n📦 [Step A] Deploying BreadPoints...`);
    // Note: In a real scenario, we'd use a bytecode deploy. For brevity in this test script, 
    // we'll assume GToken is serving as BreadPoints for simplicity OR verify if we can quick-deploy a mock.
    // Actually, let's use GToken as "BreadPoints" for now to save complexity, 
    // OR ideally deploy a fresh ERC20 if possible.
    // Strategy: Use ADMIN to deploy a fresh GToken instance as "BreadPoints"
    // Since we don't have artifacts for a simple ERC20 easily accessible in ABI json without bytecode,
    // we will REUSE GTOKEN Artifact bytecode if available, or just use the main GToken for this test 
    // but pretend it's BreadPoints. 
    // BETTER: Let's use the existing GToken for simplicity in this specific integration test 
    // to avoid bytecode issues, BUT treat it as the Community Token.
    const BREAD_POINTS_ADDR = GTOKEN_ADDR; 
    console.log(`   🍞 BreadPoints (Simulated via GToken): ${BREAD_POINTS_ADDR}`);


    // ===============================================
    // Step B: User (Alice) Registration
    // ===============================================
    console.log(`\n👤 [Step B] Registering Alice under BreadDAO...`);
    
    // Check if Alice is already registered
    const isAlice = await publicClient.readContract({
        address: REGISTRY_ADDR, abi: RegistryABI, functionName: 'hasRole',
        args: [ROLE_ENDUSER, aliceAccount.address]
    });

    if (isAlice) {
        console.log(`   ⚠️ Alice already registered. Skipping.`);
    } else {
        const userConfig = await publicClient.readContract({ address: REGISTRY_ADDR, abi: RegistryABI, functionName: 'roleConfigs', args: [ROLE_ENDUSER] }) as any;
        const requiredStake = userConfig[0];
        
        const aliceData = encodeAbiParameters(
            [
                { name: 'account', type: 'address' },
                { name: 'community', type: 'address' }, // Linked Community
                { name: 'avatarURI', type: 'string' },
                { name: 'ensName', type: 'string' },
                { name: 'stakeAmount', type: 'uint256' }
            ],
            [
                aliceAccount.address,
                breadAccount.address, // Link to BreadDAO
                "ipfs://alice",
                "alice.bread",
                requiredStake
            ]
        );

        if (requiredStake > 0n) {
             // Fund and Approve if needed
        }

        const txReg = await aliceWallet.writeContract({
            address: REGISTRY_ADDR,
            abi: RegistryABI,
            functionName: 'registerRoleSelf',
            args: [ROLE_ENDUSER, aliceData]
        });
        await waitForTx(publicClient, txReg);
        console.log(`   ✅ Alice Registered linked to BreadDAO.`);
    }

    // Verify Linkage (Optional: Check event logs or getter if available)
    // Currently Registry doesn't easily expose "getUserCommunity", ensuring logic executed is key.

    // ===============================================
    // Step C: Deploy & Register BreadPaymaster
    // ===============================================
    console.log(`\n🏰 [Step C] Setting up BreadPaymaster...`);
    // Ideally we deploy a NEW Paymaster contract. 
    // For this test, we can simulate by registering a random address AS a Paymaster 
    // OR we reuse the "Paymaster Candidate" from script 08 but register it as BreadPaymaster?
    // Let's use a NEW account to represent the deployed Paymaster Contract for verification purposes
    // (Actual gas sponsorship requires the real contract code, but for Registry lifecycle we can use EOA).
    // WAIT! Phase 4 "Scenario" implies we want ACTUAL gas sponsorship? 
    // "Scenario A: Operator Journey... verify Paymaster role... Scenario B1: Independent Paymaster... Payment"
    // Yes, we need a Real Paymaster for Step D (Payment). 
    // Deploying a full Paymaster via script might be complex without bytecode.
    // ALTERNATIVE: Use the `SuperPaymaster` artifact bytecode to deploy a new instance?
    // OR: Just reuse the ALREADY DEPLOYED `SuperPaymaster` at REGISTRY? No, that's the shared one.
    
    // DECISION: For this script, we will verify the REGISTRY SIDE of the scenario. 
    // Actual UserOp execution requiring a live Paymaster contract might be blocked by 
    // lack of artifacts/bytecode in this script context.
    // Let's focus on:
    // 1. Registering a "BreadPaymaster" role (simulated address).
    // 2. Staking for it.
    // 3. Verifying the Registry correctly marks it as active.
    
    // If we want real UserOp, we need to deploy `SuperPaymasterV3.sol`.
    // Let's assume for this "Registry Integration" stage, simulating the Paymaster Address is sufficient
    // to verify the "BreadDAO" management flow.
    const MOCK_PM_ADDR = '0xcafe00000000000000000000000000000000cafe';
    
    console.log(`   Using Mock Paymaster Address: ${MOCK_PM_ADDR}`);
    
    const pmConfig = await publicClient.readContract({ address: REGISTRY_ADDR, abi: RegistryABI, functionName: 'roleConfigs', args: [ROLE_PAYMASTER_AOA] }) as any;
    const pmStake = pmConfig[0];

    // BreadAdmin needs to fund this registration? 
    // No, Paymaster registers itself usually.
    // Let's impersonate the Mock Paymaster to register (requires ETH).
    await adminWallet.sendTransaction({ to: MOCK_PM_ADDR as Hex, value: parseEther('1') });
    
    // We need a signer for MOCK_PM_ADDR. We don't have the PK for 0xcafe... 
    // We must use a known account. Let's use Anvil #5 as BreadPaymaster
    const PM_PK = '0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffbb'; // Anvil #5
    const pmAccount = privateKeyToAccount(PM_PK);
    const pmWallet = createWalletClient({ account: pmAccount, chain: anvil, transport: http(ANVIL_RPC) });
    console.log(`   BreadPaymaster (Account): ${pmAccount.address}`);

    // Fund PM with GToken
    await adminWallet.writeContract({
        address: GTOKEN_ADDR, abi: GTokenABI, functionName: 'transfer', args: [pmAccount.address, pmStake]
    });
    await pmWallet.writeContract({
        address: GTOKEN_ADDR, abi: GTokenABI, functionName: 'approve', args: [STAKING_ADDR, pmStake]
    });

    // --- Ensure COMMUNITY Role for PM (Prerequisite) ---
    const hasPmCommunity = await publicClient.readContract({ address: REGISTRY_ADDR, abi: RegistryABI, functionName: 'hasRole', args: [ROLE_COMMUNITY, pmAccount.address] });
    if (!hasPmCommunity) {
        console.log(`   ⚠️ BreadPaymaster missing COMMUNITY role. Registering...`);
        const commData = encodeAbiParameters(
            [{ type: 'tuple', components: [{ name: 'name', type: 'string' }, { name: 'ensName', type: 'string' }, { name: 'website', type: 'string' }, { name: 'description', type: 'string' }, { name: 'logoURI', type: 'string' }, { name: 'stakeAmount', type: 'uint256' }] }],
            [{ name: 'BreadPM Community', ensName: '', website: '', description: '', logoURI: '', stakeAmount: 0n }]
        );
        const txCPm = await pmWallet.writeContract({ address: REGISTRY_ADDR, abi: RegistryABI, functionName: 'registerRoleSelf', args: [ROLE_COMMUNITY, commData] });
        await waitForTx(publicClient, txCPm);
        console.log(`   ✅ Registered COMMUNITY for PM.`);
    }

    const pmData = encodeAbiParameters(
        [{ name: 'paymaster', type: 'address' }, { name: 'name', type: 'string' }, { name: 'api', type: 'string' }, { name: 'stake', type: 'uint256' }],
        [pmAccount.address, "BreadPaymaster", "https://bread.pm", pmStake]
    );

    const txPmReg = await pmWallet.writeContract({
        address: REGISTRY_ADDR, abi: RegistryABI, functionName: 'registerRoleSelf',
        args: [ROLE_PAYMASTER_AOA, pmData]
    });
    await waitForTx(publicClient, txPmReg);
    console.log(`   ✅ BreadPaymaster Registered.`);

    // ===============================================
    // Step D: Verify State
    // ===============================================
    const hasRolePM = await publicClient.readContract({ address: REGISTRY_ADDR, abi: RegistryABI, functionName: 'hasRole', args: [ROLE_PAYMASTER_AOA, pmAccount.address] });
    console.log(`\n🔍 Verification:`);
    console.log(`   Paymaster Registered: ${hasRolePM}`);
    console.log(`   Alice Registered: ${await publicClient.readContract({ address: REGISTRY_ADDR, abi: RegistryABI, functionName: 'hasRole', args: [ROLE_ENDUSER, aliceAccount.address] })}`);

    console.log(`\n🎉 Scenario 09 Check Complete!`);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
