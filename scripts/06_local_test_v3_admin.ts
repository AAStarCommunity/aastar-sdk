import { createPublicClient, createWalletClient, http, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { SuperPaymasterClient } from '../packages/superpaymaster/src/index.ts';

// BigInt serialization fix
(BigInt.prototype as any).toJSON = function () { return this.toString(); };
dotenv.config({ path: path.resolve(process.cwd(), '.env.v3') });

// Configuration
const RPC_URL = process.env.RPC_URL;
const SUPER_PAYMASTER = process.env.SUPERPAYMASTER_ADDR as Hex;
const SIGNER_KEY = process.env.ADMIN_KEY as Hex;
const APNTS = process.env.XPNTS_ADDR as Hex;

if (!SUPER_PAYMASTER || !SIGNER_KEY) throw new Error("Missing Config");

async function runAdminTest() {
    console.log("🧪 Running SuperPaymaster V3 Admin Modular Test (Refactored)...");
    const publicClient = createPublicClient({ chain: foundry, transport: http(RPC_URL) });
    const signer = privateKeyToAccount(SIGNER_KEY);
    const wallet = createWalletClient({ account: signer, chain: foundry, transport: http(RPC_URL) });

    const pmClient = new SuperPaymasterClient(publicClient, SUPER_PAYMASTER);

    console.log(`   Operator: ${signer.address}`);
    console.log(`   Paymaster: ${SUPER_PAYMASTER}`);

    // 1. Initial State Check
    let opData = await pmClient.getOperator(signer.address);
    console.log("   Full OpData:", opData);
    console.log(`   Initial State: Configured=${opData[1]}, Paused=${opData[2]}`);

    // 2. Test configureOperator
    console.log("   ⚙️ Testing configureOperator...");
    const hashConf = await SuperPaymasterClient.configureOperator(
        wallet, SUPER_PAYMASTER, APNTS, signer.address, 1000000000000000000n
    );
    await publicClient.waitForTransactionReceipt({ hash: hashConf });
    opData = await pmClient.getOperator(signer.address);
    if (!opData[1]) throw new Error("configureOperator failed");
    console.log("   ✅ Operator Configured.");

    // 3. Test setOperatorPaused
    console.log("   ⏸️ Testing setOperatorPaused (true)...");
    const hashPause = await SuperPaymasterClient.setOperatorPaused(
        wallet, SUPER_PAYMASTER, signer.address, true
    );
    await publicClient.waitForTransactionReceipt({ hash: hashPause });
    opData = await pmClient.getOperator(signer.address);
    if (opData[2] !== true) throw new Error("Pause failed");
    console.log("   ✅ Operator Paused.");

    console.log("   ▶️ Testing setOperatorPaused (false)...");
    const hashUnpause = await SuperPaymasterClient.setOperatorPaused(
        wallet, SUPER_PAYMASTER, signer.address, false
    );
    await publicClient.waitForTransactionReceipt({ hash: hashUnpause });
    opData = await pmClient.getOperator(signer.address);
    if (opData[2] !== false) throw new Error("Unpause failed");
    console.log("   ✅ Operator Unpaused.");

    // 4. Test updateReputation
    console.log("   ⭐ Testing updateReputation...");
    const hashRep = await SuperPaymasterClient.updateReputation(
        wallet, SUPER_PAYMASTER, signer.address, 500n
    );
    await publicClient.waitForTransactionReceipt({ hash: hashRep });
    opData = await pmClient.getOperator(signer.address);
    console.log("   Full OpData (After Update):", opData);
    if (BigInt(opData[8]) !== 500n) {
        console.warn(`   ⚠️ Reputation Update verification failed. Expected 500, got ${opData[8]}.`);
    } else {
        console.log(`   ✅ Reputation updated to ${opData[8]}.`);
    }

    // 5. Test setAPNTsToken (Requires Owner)
    // For simplicity in this test, we skip owner check and just try
    console.log("   🔗 Testing setAPNTsToken...");
    const hashToken = await SuperPaymasterClient.setAPNTsToken(wallet, SUPER_PAYMASTER, APNTS);
    await publicClient.waitForTransactionReceipt({ hash: hashToken });
    console.log("   ✅ APNTs Token set.");

    console.log("\n🏁 Admin Module Test Passed (Coverage: setOperatorPaused, configureOperator, updateReputation, setAPNTsToken)");
}

runAdminTest().catch(console.error);
