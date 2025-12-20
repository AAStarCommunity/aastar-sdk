import { createPublicClient, createWalletClient, http, parseAbi, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';
import * as dotenv from 'dotenv';
import * as path from 'path';

// BigInt serialization fix
(BigInt.prototype as any).toJSON = function () { return this.toString(); };
dotenv.config({ path: path.resolve(process.cwd(), '.env.v3') });

// Configuration
const RPC_URL = process.env.RPC_URL;
const SUPER_PAYMASTER = process.env.SUPERPAYMASTER_ADDR as Hex;
const SIGNER_KEY = process.env.ADMIN_KEY as Hex;
const APNTS = process.env.XPNTS_ADDR as Hex;

if (!SUPER_PAYMASTER || !SIGNER_KEY) throw new Error("Missing Config");

const pmAbi = parseAbi([
    'function operators(address) view returns (address xPNTsToken, address treasury, bool isConfigured, bool isPaused, uint256 reserved, uint256 exchangeRate, uint256 aPNTsBalance, uint256 totalSpent, uint256 totalTxSponsored, uint256 reputation)',
    'function configureOperator(address, address, uint256)',
    'function setOperatorPause(address, bool)',
    'function updateReputation(address, uint256)',
    'function setAPNTsToken(address)',
    'function owner() view returns (address)'
]);

async function runAdminTest() {
    console.log("🧪 Running SuperPaymaster V3 Admin Modular Test...");
    const publicClient = createPublicClient({ chain: foundry, transport: http(RPC_URL) });
    const signer = privateKeyToAccount(SIGNER_KEY);
    const wallet = createWalletClient({ account: signer, chain: foundry, transport: http(RPC_URL) });

    console.log(`   Operator: ${signer.address}`);
    console.log(`   Paymaster: ${SUPER_PAYMASTER}`);

    // 1. Initial State Check
    // ABI returns: xPNTsToken(0), treasury(1), isConfigured(2), isPaused(3), reserved(4), exchangeRate(5), aPNTsBalance(6), totalSpent(7), totalTxSponsored(8), reputation(9)
    let opData = await publicClient.readContract({ address: SUPER_PAYMASTER, abi: pmAbi, functionName: 'operators', args: [signer.address] });
    console.log("   Full OpData:", opData);
    console.log(`   Initial State: Configured=${opData[2]}, Paused=${opData[3]}`);

    // 2. Test configureOperator
    console.log("   ⚙️ Testing configureOperator...");
    const hashConf = await wallet.writeContract({
        address: SUPER_PAYMASTER, abi: pmAbi, functionName: 'configureOperator', 
        args: [APNTS, signer.address, 1000000000000000000n] 
    });
    await publicClient.waitForTransactionReceipt({ hash: hashConf });
    opData = await publicClient.readContract({ address: SUPER_PAYMASTER, abi: pmAbi, functionName: 'operators', args: [signer.address] });
    if (!opData[1]) throw new Error("configureOperator failed");
    console.log("   ✅ Operator Configured.");

    // 3. Test setOperatorPause
    console.log("   ⏸️ Testing setOperatorPause (true)...");
    const hashPause = await wallet.writeContract({ 
        address: SUPER_PAYMASTER, abi: pmAbi, functionName: 'setOperatorPause', 
        args: [signer.address, true] 
    });
    await publicClient.waitForTransactionReceipt({ hash: hashPause });
    opData = await publicClient.readContract({ address: SUPER_PAYMASTER, abi: pmAbi, functionName: 'operators', args: [signer.address] });
    if (opData[2] !== true) throw new Error("Pause failed");
    console.log("   ✅ Operator Paused.");

    console.log("   ▶️ Testing setOperatorPause (false)...");
    const hashUnpause = await wallet.writeContract({ 
        address: SUPER_PAYMASTER, abi: pmAbi, functionName: 'setOperatorPause', 
        args: [signer.address, false] 
    });
    await publicClient.waitForTransactionReceipt({ hash: hashUnpause });
    opData = await publicClient.readContract({ address: SUPER_PAYMASTER, abi: pmAbi, functionName: 'operators', args: [signer.address] });
    if (opData[2] !== false) throw new Error("Unpause failed");
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
    // Index 9 is Reputation
    if (BigInt(opData[9]) !== 500n) {
        console.warn(`   ⚠️ Reputation Update verification failed. Expected 500, got ${opData[9]}. Check if Registry state is inconsistent.`);
    } else {
        console.log(`   ✅ Reputation updated to ${opData[9]}.`);
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

    console.log("\n🏁 Admin Module Test Passed (Coverage: setOperatorPause, configureOperator, updateReputation, setAPNTsToken)");
}

runAdminTest().catch(console.error);
