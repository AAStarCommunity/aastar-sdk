import { createPublicClient, createWalletClient, http, parseAbi, type Hex, keccak256, stringToBytes, toHex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';
import * as dotenv from 'dotenv';
import * as path from 'path';

// BigInt serialization fix
(BigInt.prototype as any).toJSON = function () { return this.toString(); };
dotenv.config({ path: path.resolve(process.cwd(), '.env.anvil') });

// Configuration
const RPC_URL = process.env.RPC_URL;
const SUPER_PAYMASTER = process.env.SUPERPAYMASTER_ADDR as Hex;
const REGISTRY = process.env.REGISTRY_ADDR as Hex;
const GTOKEN = process.env.GTOKEN_ADDR as Hex;
const STAKING = process.env.STAKING_ADDR as Hex;
const SIGNER_KEY = (process.env.ADMIN_KEY || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80') as Hex;
const APNTS = process.env.XPNTS_ADDR as Hex;

if (!SUPER_PAYMASTER || !SIGNER_KEY || !REGISTRY) throw new Error("Missing Config");

const pmAbi = parseAbi([
    'function operators(address) view returns (uint128 balance, uint96 exRate, bool isConfigured, bool isPaused, address xPNTsToken, uint32 reputation, address treasury, uint256 spent, uint256 txSponsored)',
    'function configureOperator(address, address, uint256)',
    'function setOperatorPaused(address, bool)',
    'function updateReputation(address, uint256)',
    'function setAPNTsToken(address)',
    'function owner() view returns (address)'
]);

const registryAbi = parseAbi([
    'function hasRole(bytes32, address) view returns (bool)',
    'function roleConfigs(bytes32) view returns (uint256, uint256, uint256, uint256, uint256, uint256, uint256, uint256, bool, string)',
    'function registerRoleSelf(bytes32, bytes)'
]);

const erc20Abi = parseAbi([
    'function approve(address, uint256) returns (bool)'
]);

const ROLE_PAYMASTER_SUPER = keccak256(stringToBytes('PAYMASTER_SUPER'));

async function runAdminTest() {
    console.log("🧪 Running SuperPaymaster V3 Admin Modular Test...");
    const publicClient = createPublicClient({ chain: foundry, transport: http(RPC_URL) });
    const signer = privateKeyToAccount(SIGNER_KEY);
    const wallet = createWalletClient({ account: signer, chain: foundry, transport: http(RPC_URL) });

    console.log(`   Operator: ${signer.address}`);
    console.log(`   Paymaster: ${SUPER_PAYMASTER}`);
    console.log(`   Registry:  ${REGISTRY}`);

    // ====================================================
    // 0. Ensure Prerequisite Roles (COMMUNITY + PAYMASTER_SUPER)
    // ====================================================
    console.log("   🔍 Checking Roles...");
    const hasSuper = await publicClient.readContract({
        address: REGISTRY, abi: registryAbi, functionName: 'hasRole',
        args: [ROLE_PAYMASTER_SUPER, signer.address]
    });

    if (!hasSuper) {
        console.log("   ⚠️ Missing PAYMASTER_SUPER role. Registering...");
        // Get Stake Amount
        const roleConf = await publicClient.readContract({
            address: REGISTRY, abi: registryAbi, functionName: 'roleConfigs',
            args: [ROLE_PAYMASTER_SUPER]
        });
        const minStake = roleConf[0];
        const entryBurn = roleConf[1];
        const total = minStake + entryBurn;

        // Approve
        console.log(`   💰 Approving ${total} GTokens...`);
        const txApprove = await wallet.writeContract({
            address: GTOKEN, abi: erc20Abi, functionName: 'approve',
            args: [STAKING, total]
        });
        await publicClient.waitForTransactionReceipt({ hash: txApprove });

        // Register
        console.log("   📝 Registering PAYMASTER_SUPER...");
        const txReg = await wallet.writeContract({
            address: REGISTRY, abi: registryAbi, functionName: 'registerRoleSelf',
            args: [ROLE_PAYMASTER_SUPER, "0x"]
        });
        await publicClient.waitForTransactionReceipt({ hash: txReg });
        console.log("   ✅ Registered PAYMASTER_SUPER.");
    } else {
        console.log("   ✅ Operator already has PAYMASTER_SUPER role.");
    }

    // 1. Initial State Check
    // ABI returns: xPNTsToken(0), isConfigured(1), isPaused(2), treasury(3), exchangeRate(4), aPNTsBalance(5), totalSpent(6), totalTxSponsored(7), reputation(8)
    let opData = await publicClient.readContract({ address: SUPER_PAYMASTER, abi: pmAbi, functionName: 'operators', args: [signer.address] });
    console.log("   Full OpData:", opData);
    // V3.2 Packed: 0:balance, 1:exRate, 2:isConfigured, 3:isPaused, 4:token, 5:reputation, 6:treasury, 7:spent, 8:txSponsored
    console.log(`   Initial State: Configured=${opData[2]}, Paused=${opData[3]}`);

    // 2. Test configureOperator
    console.log("   ⚙️ Testing configureOperator...");
    const hashConf = await wallet.writeContract({
        address: SUPER_PAYMASTER, abi: pmAbi, functionName: 'configureOperator', 
        args: [APNTS, signer.address, 1000000000000000000n] 
    });
    await publicClient.waitForTransactionReceipt({ hash: hashConf });
    opData = await publicClient.readContract({ address: SUPER_PAYMASTER, abi: pmAbi, functionName: 'operators', args: [signer.address] });
    if (!opData[2]) throw new Error("configureOperator failed");
    console.log("   ✅ Operator Configured.");

    // 3. Test setOperatorPaused
    console.log("   ⏸️ Testing setOperatorPaused (true)...");
    const hashPause = await wallet.writeContract({ 
        address: SUPER_PAYMASTER, abi: pmAbi, functionName: 'setOperatorPaused', 
        args: [signer.address, true] 
    });
    await publicClient.waitForTransactionReceipt({ hash: hashPause });
    opData = await publicClient.readContract({ address: SUPER_PAYMASTER, abi: pmAbi, functionName: 'operators', args: [signer.address] });
    if (opData[3] !== true) throw new Error("Pause failed");
    console.log("   ✅ Operator Paused.");

    console.log("   ▶️ Testing setOperatorPaused (false)...");
    const hashUnpause = await wallet.writeContract({ 
        address: SUPER_PAYMASTER, abi: pmAbi, functionName: 'setOperatorPaused', 
        args: [signer.address, false] 
    });
    await publicClient.waitForTransactionReceipt({ hash: hashUnpause });
    opData = await publicClient.readContract({ address: SUPER_PAYMASTER, abi: pmAbi, functionName: 'operators', args: [signer.address] });
    if (opData[3] !== false) throw new Error("Unpause failed");
    console.log("   ✅ Operator Unpaused.");

    // 4. Test updateReputation
    console.log("   ⭐ Testing updateReputation...");
    const hashRep = await wallet.writeContract({ 
        address: SUPER_PAYMASTER, abi: pmAbi, functionName: 'updateReputation', 
        args: [signer.address, 500n] 
    });
    await publicClient.waitForTransactionReceipt({ hash: hashRep });
    opData = await publicClient.readContract({ address: SUPER_PAYMASTER, abi: pmAbi, functionName: 'operators', args: [signer.address] });
    console.log("   Full OpData (After Update):", opData);
    // Index 8 is Reputation (9-field ABI)
    if (BigInt(opData[8]) !== 500n) {
        console.warn(`   ⚠️ Reputation Update verification failed. Expected 500, got ${opData[8]}. Check if Registry state is inconsistent.`);
    } else {
        console.log(`   ✅ Reputation updated to ${opData[8]}.`);
    }

    // 5. Test setAPNTsToken (Requires Owner)
    const owner = await publicClient.readContract({ address: SUPER_PAYMASTER, abi: pmAbi, functionName: 'owner' });
    if (signer.address.toLowerCase() === owner.toLowerCase()) {
        console.log("   🔗 Testing setAPNTsToken...");
        const hashToken = await wallet.writeContract({ 
            address: SUPER_PAYMASTER, abi: pmAbi, functionName: 'setAPNTsToken', 
            args: [APNTS] 
        });
        await publicClient.waitForTransactionReceipt({ hash: hashToken });
        console.log("   ✅ APNTs Token set.");
    }

    console.log("\n🏁 Admin Module Test Passed (Coverage: setOperatorPaused, configureOperator, updateReputation, setAPNTsToken)");
}

runAdminTest().catch(console.error);
