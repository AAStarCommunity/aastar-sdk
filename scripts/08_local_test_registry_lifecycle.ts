
import { 
    createPublicClient, 
    createWalletClient, 
    http, 
    parseEther, 
    keccak256, 
    toBytes, 
    encodeAbiParameters, 
    formatEther
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { anvil } from 'viem/chains';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


// Fix BigInt serialization for console.log
(BigInt.prototype as any).toJSON = function () {
    return this.toString();
};

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.v3') });

// Load ABIs
const loadAbi = (name: string) => {
    const abiPath = path.resolve(__dirname, `../packages/core/src/abis/${name}.json`);
    if (!fs.existsSync(abiPath)) {
        throw new Error(`ABI not found at ${abiPath}`);
    }
    return JSON.parse(fs.readFileSync(abiPath, 'utf-8'));
};

const RegistryABI = loadAbi('Registry');
const GTokenStakingABI = loadAbi('GTokenStaking');
const GTokenABI = loadAbi('GToken');
// const MySBTABI = loadAbi('MySBT'); // UNUSED

// Constants
const ROLE_PAYMASTER_AOA = keccak256(toBytes('PAYMASTER_AOA'));
// const ROLE_SUPERPAYMASTER = keccak256(toBytes('PAYMASTER_SUPER')); // UNUSED
// const ROLE_ENDUSER = keccak256(toBytes('ENDUSER')); // MOVED TO SCENARIO
// const ROLE_COMMUNITY = keccak256(toBytes('COMMUNITY')); // MOVED TO SCENARIO
// const MIN_STAKE = parseEther('5'); // UNUSED

// Config
const ANVIL_RPC = 'http://127.0.0.1:8545';
// Force Anvil Account #0 for local test to match deployment
const ADMIN_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'; 


// Helper to wait for tx
const waitForTx = async (client: any, hash: `0x${string}`) => {
    const receipt = await client.waitForTransactionReceipt({ hash });
    if (receipt.status !== 'success') {
        throw new Error(`Transaction failed: ${hash}`);
    }
    return receipt;
};

async function main() {
    console.log('\n🔵 Starting Registry Lifecycle Tests (08_local_test_registry_lifecycle)...\n');

    // 1. Setup Clients
    const adminAccount = privateKeyToAccount(ADMIN_KEY as `0x${string}`);
    // Create separate test accounts
    const paymasterUser = privateKeyToAccount('0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d'); // Anvil #1
    const endUser = privateKeyToAccount('0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a'); // Anvil #2

    const publicClient = createPublicClient({ chain: anvil, transport: http(ANVIL_RPC) });
    const adminWallet = createWalletClient({ account: adminAccount, chain: anvil, transport: http(ANVIL_RPC) });
    const pmWallet = createWalletClient({ account: paymasterUser, chain: anvil, transport: http(ANVIL_RPC) });
    // const userWallet = createWalletClient({...}); // MOVED TO SCENARIO

    console.log(`👤 Admin: ${adminAccount.address}`);
    console.log(`👤 Paymaster Candidate: ${paymasterUser.address}`);
    console.log(`👤 EndUser Candidate: ${endUser.address}`);

    // 2. Resolve Contract Addresses
    // Try environment variables first, else fallback to hardcoded (Fresh Local Deployment)
    const REGISTRY_ADDR = process.env.REGISTRY_ADDRESS as `0x${string}`;
    const STAKING_ADDR = process.env.GTOKEN_STAKING as `0x${string}`;
    const GTOKEN_ADDR = process.env.GTOKEN_ADDRESS as `0x${string}`;
    const MYSBT_ADDR = process.env.MYSBT_ADDRESS as `0x${string}`; 

    if (!REGISTRY_ADDR || !STAKING_ADDR || !GTOKEN_ADDR) {
        throw new Error('Missing contract addresses in .env (REGISTRY_ADDRESS, GTOKEN_STAKING, GTOKEN_ADDRESS)');
    }

    console.log(`\n📄 Contracts:`);
    console.log(`   Registry: ${REGISTRY_ADDR}`);
    console.log(`   Staking:  ${STAKING_ADDR}`);
    console.log(`   GToken:   ${GTOKEN_ADDR}`);
    console.log(`   MySBT:    ${MYSBT_ADDR}`);

    try {
        const owner = await publicClient.readContract({
            address: REGISTRY_ADDR,
            abi: RegistryABI,
            functionName: 'owner',
            args: []
        });
        console.log(`   ✅ Connected to Registry. Owner: ${owner}`);
    } catch (e: any) {
        console.error(`   ❌ Failed to connect to Registry at ${REGISTRY_ADDR}: ${e.message}`);
        process.exit(1);
    }

    // ==========================================
    // Test 1: Paymaster Registration
    // ==========================================
    console.log(`\n🧪 [Test 1] Paymaster Role Registration`);

    // 1.1 Fund Paymaster with GToken (Admin sends GToken)
    const stakeAmount = parseEther('50'); // Needs 30 for AOA, but verify config
    console.log(`   Funding Paymaster with ${formatEther(stakeAmount)} GToken...`);
    
    // Check Config first
    const roleConfig = await publicClient.readContract({
        address: REGISTRY_ADDR,
        abi: RegistryABI,
        functionName: 'roleConfigs',
        args: [ROLE_PAYMASTER_AOA]
    }) as any;
    console.log(`   DEBUG: roleConfig:`, roleConfig); // ADDED LOG
    console.log(`   Role Config (AOA): MinStake=${formatEther(roleConfig[0])}, Active=${roleConfig[6]}`);
    if(!roleConfig[6]) throw new Error("Paymaster Role not active");

    const requiredStake = roleConfig[0];

    try {
        const txFund = await adminWallet.writeContract({
            address: GTOKEN_ADDR,
            abi: GTokenABI,
            functionName: 'transfer',
            args: [paymasterUser.address, stakeAmount]
        });
        await waitForTx(publicClient, txFund);
        console.log(`   ✅ Funded.`);
    } catch (e: any) {
        console.warn(`   ⚠️ Funding check failed (maybe duplicate run, assuming balance ok): ${e.message.split('\n')[0]}`);
    }

    // 1.2 Approve Staking Contract
    console.log(`   Approving Staking Contract...`);
    const txApprove = await pmWallet.writeContract({
        address: GTOKEN_ADDR,
        abi: GTokenABI,
        functionName: 'approve',
        args: [STAKING_ADDR, stakeAmount]
    });
    await waitForTx(publicClient, txApprove);
    console.log(`   ✅ Approved.`);

    // 1.3 Register Role
    // Struct PaymasterRoleData { address paymasterContract; string name; string apiEndpoint; uint256 stakeAmount; }
    const pmData = encodeAbiParameters(
        [
            { name: 'paymasterContract', type: 'address' },
            { name: 'name', type: 'string' },
            { name: 'apiEndpoint', type: 'string' },
            { name: 'stakeAmount', type: 'uint256' }
        ],
        [
            paymasterUser.address, // Use self as contract for test
            "Test Paymaster AOA",
            "https://api.example.com",
            requiredStake
        ]
    );

    console.log(`   Registering Paymaster Role (Self)...`);
    
    // Check if already registered
    const alreadyRegistered = await publicClient.readContract({
        address: REGISTRY_ADDR,
        abi: RegistryABI,
        functionName: 'hasRole',
        args: [ROLE_PAYMASTER_AOA, paymasterUser.address]
    });

    if (alreadyRegistered) {
        console.log(`   ⚠️ Already registered. Skipping registration tx.`);
    } else {
        try {
            const txReg = await pmWallet.writeContract({
                address: REGISTRY_ADDR,
                abi: RegistryABI,
                functionName: 'registerRoleSelf',
                args: [ROLE_PAYMASTER_AOA, pmData]
            });
            await waitForTx(publicClient, txReg);
            console.log(`   ✅ Registered.`);
        } catch (e: any) {
             const isNowRegistered = await publicClient.readContract({
                address: REGISTRY_ADDR,
                abi: RegistryABI,
                functionName: 'hasRole',
                args: [ROLE_PAYMASTER_AOA, paymasterUser.address]
            });
            if (isNowRegistered) {
                 console.log(`   ⚠️ Already registered (caught tx failure).`);
            } else {
                 console.error(`   ❌ Registration failed and not registered: ${e.message}`);
                 throw e;
            }
        }
    }

    // 1.4 Verification
    const hasRolePM = await publicClient.readContract({
        address: REGISTRY_ADDR,
        abi: RegistryABI,
        functionName: 'hasRole',
        args: [ROLE_PAYMASTER_AOA, paymasterUser.address]
    });
    console.log(`   🔍 Verification (hasRole): ${hasRolePM}`);
    if (!hasRolePM) throw new Error("Paymaster Registration Verification Failed");

    // ==========================================
    // Test 2: Role Configuration Update
    // ==========================================
    console.log(`\n🧪 [Test 2] Role Configuration Update (Admin)`);
    
    // Increase Min Stake for AOA
    const newMinStake = requiredStake + parseEther('1');
    const roleConfigStruct = [
        newMinStake,      // minStake
        roleConfig[1],    // entryBurn
        roleConfig[2],    // slashThreshold
        roleConfig[3],    // slashBase
        roleConfig[4],    // slashIncrement
        roleConfig[5],    // slashMax
        roleConfig[6],    // exitFeePercent
        roleConfig[7],    // minExitFee
        true,             // isActive
        "Updated AOA Paymaster" // description
    ];

    console.log(`   Updating MinStake to ${formatEther(newMinStake)}...`);
    const txConfig = await adminWallet.writeContract({
        address: REGISTRY_ADDR,
        abi: RegistryABI,
        functionName: 'configureRole',
        args: [ROLE_PAYMASTER_AOA, roleConfigStruct]
    });
    await waitForTx(publicClient, txConfig);
    console.log(`   ✅ Role Configured.`);

    // Verify
    const updatedConfig = await publicClient.readContract({
        address: REGISTRY_ADDR,
        abi: RegistryABI,
        functionName: 'roleConfigs',
        args: [ROLE_PAYMASTER_AOA]
    }) as any;
    console.log(`   🔍 New MinStake: ${formatEther(updatedConfig[0])}`);
    if (updatedConfig[0] !== newMinStake) throw new Error("Config Update Verification Failed");

    // Revert config to avoid breaking other tests
    console.log(`   Restoring Config...`);
    const restoreConfigStruct = [
        requiredStake,
        roleConfig[1],
        roleConfig[2],
        roleConfig[3],
        roleConfig[4],
        roleConfig[5],
        roleConfig[6],
        roleConfig[7],
        roleConfig[8],
        roleConfig[9]
    ];
     const txRestore = await adminWallet.writeContract({
        address: REGISTRY_ADDR,
        abi: RegistryABI,
        functionName: 'configureRole',
        args: [ROLE_PAYMASTER_AOA, restoreConfigStruct]
    });
    await waitForTx(publicClient, txRestore);
    console.log(`   ✅ Config Restored.`);


    // ==========================================
    // Test 3: [MOVED TO SCENARIO 09] EndUser Registration
    // ==========================================
    // We are deliberately skipping EndUser registration here as requested by the user.
    // Complex EndUser/Community interactions are now handled in the dedicated 
    // scenario scripts (09_scenario_bread_independent.ts) to keep this script focused
    // on Registry/Paymaster lifecycle.
    
    console.log(`\n🧪 [Test 3] EndUser Role Registration -> MOVED TO SCENARIO 09`);
    console.log(`   (Skipping to keep 08 focused on Paymaster Lifecycle)`);

    // ==========================================
    // Test 4: Role Exit
    // ==========================================
    console.log(`\n🧪 [Test 4] Role Exit (Paymaster)`);

    console.log(`   Exiting Paymaster Role...`);
    const txExit = await pmWallet.writeContract({
        address: REGISTRY_ADDR,
        abi: RegistryABI,
        functionName: 'exitRole',
        args: [ROLE_PAYMASTER_AOA]
    });
    await waitForTx(publicClient, txExit);
    console.log(`   ✅ Exited.`);

    const hasRoleAfterExit = await publicClient.readContract({
        address: REGISTRY_ADDR,
        abi: RegistryABI,
        functionName: 'hasRole',
        args: [ROLE_PAYMASTER_AOA, paymasterUser.address]
    });
    console.log(`   🔍 Verification (hasRole==false): ${!hasRoleAfterExit}`);
    if (hasRoleAfterExit) throw new Error("Exit Role Verification Failed (Still has role)");
    
    // Check Stake Refund
    const stakeInfo = await publicClient.readContract({
        address: STAKING_ADDR,
        abi: GTokenStakingABI,
        functionName: 'stakes',
        args: [paymasterUser.address]
    }) as any;
    // stakeInfo is struct { amount, stGTokenShares, slashedAmount, stakedAt }
    console.log(`   🔍 Stake Info after exit: Amount=${formatEther(stakeInfo[0])}`);
    // Should be near 50 (funded) if full refund, minus any entry fees.
    
    console.log('\n✅ All Registry Lifecycle Tests Passed!');
}

main().catch((error) => {
    console.error('\n❌ Test Failed:', error);
    process.exit(1);
});
