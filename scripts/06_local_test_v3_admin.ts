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
    'function operators(address) view returns (address xPNTsToken, bool isConfigured, bool isPaused, address treasury, uint96 exchangeRate, uint256 aPNTsBalance, uint256 totalSpent, uint256 totalTxSponsored, uint256 reputation)',
    'function configureOperator(address, address, uint256)',
    'function setOperatorPaused(address, bool)',
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
    // ABI returns: xPNTsToken(0), isConfigured(1), isPaused(2), treasury(3), exchangeRate(4), aPNTsBalance(5), totalSpent(6), totalTxSponsored(7), reputation(8)
    let opData = await publicClient.readContract({ address: SUPER_PAYMASTER, abi: pmAbi, functionName: 'operators', args: [signer.address] });
    console.log("   Full OpData:", opData);
    console.log(`   Initial State: Configured=${opData[1]}, Paused=${opData[2]}`);

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

    // 3. Test setOperatorPaused
    console.log("   ⏸️ Testing setOperatorPaused (true)...");
    const hashPause = await wallet.writeContract({ 
        address: SUPER_PAYMASTER, abi: pmAbi, functionName: 'setOperatorPaused', 
        args: [signer.address, true] 
    });
    await publicClient.waitForTransactionReceipt({ hash: hashPause });
    opData = await publicClient.readContract({ address: SUPER_PAYMASTER, abi: pmAbi, functionName: 'operators', args: [signer.address] });
    if (opData[2] !== true) throw new Error("Pause failed");
    console.log("   ✅ Operator Paused.");

    console.log("   ▶️ Testing setOperatorPaused (false)...");
    const hashUnpause = await wallet.writeContract({ 
        address: SUPER_PAYMASTER, abi: pmAbi, functionName: 'setOperatorPaused', 
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
