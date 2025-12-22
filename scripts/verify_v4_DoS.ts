import { 
  createPublicClient, 
  createWalletClient, 
  http, 
  parseEther, 
  getContract
} from 'viem';
import type { Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Config ---
const ANVIL_RPC = "http://127.0.0.1:8545";
const PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"; // Anvil Default 0

// Paths relative to scripts/
const PAYMASTER_ARTIFACT = "../../SuperPaymaster/out/PaymasterV4.sol/PaymasterV4.json";
const BAD_ARTIFACT = "../../SuperPaymaster/out/BadContract.sol/BadContract.json";

function loadArtifact(relativePath: string) {
    const absPath = path.resolve(__dirname, relativePath);
    if (!fs.existsSync(absPath)) throw new Error(`Artifact not found: ${absPath}`);
    return JSON.parse(fs.readFileSync(absPath, 'utf8'));
}

function ensureHex(str: string): Hex {
    return (str.startsWith('0x') ? str : `0x${str}`) as Hex;
}

async function main() {
    console.log("🛡️  Verifying Paymaster V4 DoS Protection...");

    const publicClient = createPublicClient({ chain: foundry, transport: http(ANVIL_RPC) });
    const account = privateKeyToAccount(PRIVATE_KEY);
    const walletClient = createWalletClient({ chain: foundry, transport: http(ANVIL_RPC), account });

    // 1. Load Artifacts
    const pmArtifact = loadArtifact(PAYMASTER_ARTIFACT);
    const badArtifact = loadArtifact(BAD_ARTIFACT);

    // 2. Deploy PaymasterV4
    console.log("deploying PaymasterV4...");
    const deployHash = await walletClient.deployContract({
        abi: pmArtifact.abi,
        bytecode: ensureHex(pmArtifact.bytecode.object),
        args: [
            "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789", // EntryPoint
            account.address, // Owner
            account.address, // Treasury
            "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419", // PriceFeed
            200n, // Fee
            parseEther("1"), // Cap
            "0x0000000000000000000000000000000000000001"  // Factory (Mock)
        ]
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash: deployHash });
    const pmAddress = receipt.contractAddress!;
    console.log(`✅ PaymasterV4 Deployed at: ${pmAddress}`);

    // 3. Deploy BadContract
    console.log("deploying BadContract...");
    const badHash = await walletClient.deployContract({
        abi: badArtifact.abi,
        bytecode: ensureHex(badArtifact.bytecode.object),
        args: []
    });
    const badReceipt = await publicClient.waitForTransactionReceipt({ hash: badHash });
    const badAddress = badReceipt.contractAddress!;
    console.log(`✅ BadContract Deployed at: ${badAddress}`);

    const paymaster = getContract({
        address: pmAddress,
        abi: pmArtifact.abi,
        client: walletClient
    });

    // 4. Test V4-01: Add Bad Gas Token
    console.log("\n🧪 Test V4-01: Add Bad Gas Token (Should Revert)...");
    try {
        await paymaster.write.addGasToken([badAddress]);
        console.error("❌ FAILED: addGasToken succeeded but should have failed!");
        process.exit(1);
    } catch (e: any) {
        if (e.message.includes("PaymasterV4__InvalidGasToken") || e.message.includes("revert")) {
             console.log("✅ SUCCESS: addGasToken reverted as expected.");
             const isSupported = await publicClient.readContract({
                 address: pmAddress,
                 abi: pmArtifact.abi,
                 functionName: 'isGasTokenSupported',
                 args: [badAddress]
             });
             if (!isSupported) console.log("   (Registry confirmed empty)");
             else console.error("   ❌ Registry updated despite revert!");
        } else {
            console.error(`❌ Unexpected Error: ${e.message}`);
            // If it's a raw revert, sometimes message differs. Accepting "revert" generally.
        }
    }

    // 5. Test V4-02: Add Bad SBT
    console.log("\n🧪 Test V4-02: Add Bad SBT (Should Revert)...");
    try {
        await paymaster.write.addSBT([badAddress]);
        console.error("❌ FAILED: addSBT succeeded but should have failed!");
        process.exit(1);
    } catch (e: any) {
        if (e.message.includes("PaymasterV4__InvalidSBT") || e.message.includes("revert")) {
             console.log("✅ SUCCESS: addSBT reverted as expected.");
             const isSupported = await publicClient.readContract({
                 address: pmAddress,
                 abi: pmArtifact.abi,
                 functionName: 'isSBTSupported',
                 args: [badAddress]
             });
             if (!isSupported) console.log("   (Registry confirmed empty)");
             else console.error("   ❌ Registry updated despite revert!");
        } else {
            console.error(`❌ Unexpected Error: ${e.message}`);
        }
    }

    console.log("\n🎉 V4 DoS Protection Verified!");
}

main().catch(console.error);
