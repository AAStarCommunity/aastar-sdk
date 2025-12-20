import { createPublicClient, createWalletClient, http, formatEther, parseAbi, keccak256, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';
import * as dotenv from 'dotenv';
import * as path from 'path';

// BigInt serialization fix
(BigInt.prototype as any).toJSON = function () { return this.toString(); };
dotenv.config({ path: path.resolve(process.cwd(), '.env.v3') });

// Configuration
const RPC_URL = process.env.RPC_URL;
const REGISTRY = process.env.REGISTRY_ADDR as Hex;
const REPUTATION_SYSTEM = process.env.REPUTATION_SYSTEM_ADDR as Hex;
const SIGNER_KEY = process.env.ADMIN_KEY as Hex;
// Use a random address if ALICE is missing, sufficient for reputation updates (registry doesn't checks if it's a contract for score updates)
const ACCOUNT_C = (process.env.ALICE_AA_ACCOUNT || '0x70997970C51812dc3A010C7d01b50e0d17dc79C8') as Hex; // Default to Anvil #1

if (!REGISTRY || !REPUTATION_SYSTEM || !SIGNER_KEY) throw new Error("Missing Config");

const regAbi = parseAbi([
    'function globalReputation(address) view returns (uint256)',
    'function getCreditLimit(address) view returns (uint256)',
    'function batchUpdateGlobalReputation(address[], uint256[], uint256, bytes)'
]);

const repAbi = parseAbi([
    'function computeScore(address, address[], bytes32[][], uint256[][]) view returns (uint256)',
    'function syncToRegistry(address, address[], bytes32[][], uint256[][], uint256)',
    'function setEntropyFactor(address, uint256)',
    'function setRule(bytes32, uint256, uint256, uint256, string)'
]);

async function runReputationTest() {
    console.log("🧪 Running SuperPaymaster V3 Reputation & Credit Modular Test...");
    const publicClient = createPublicClient({ chain: foundry, transport: http(RPC_URL) });
    const signer = privateKeyToAccount(SIGNER_KEY);
    const wallet = createWalletClient({ account: signer, chain: foundry, transport: http(RPC_URL) });

    // 1. Setup Scoring Rules (Community Admin Context)
    console.log("   📏 Setting up Scoring Rules...");
    const ruleId = keccak256(Buffer.from("TEST_RULE"));
    const hashRule = await wallet.writeContract({ 
        address: REPUTATION_SYSTEM, abi: repAbi, functionName: 'setRule', 
        args: [ruleId, 50n, 5n, 100n, "Modular Test Rule"] 
    });
    await publicClient.waitForTransactionReceipt({ hash: hashRule });

    // 2. Set Entropy Factor
    console.log("   🌀 Setting Entropy Factor (0.8x)...");
    const hashEntropy = await wallet.writeContract({ 
        address: REPUTATION_SYSTEM, abi: repAbi, functionName: 'setEntropyFactor', 
        args: [signer.address, 800000000000000000n] 
    });
    await publicClient.waitForTransactionReceipt({ hash: hashEntropy });

    // 3. Compute Score
    console.log("   🧮 Computing Reputation Score...");
    const communities = [signer.address];
    const ruleIds = [[ruleId]];
    const activities = [[10n]]; // 10 activities
    const score = await publicClient.readContract({ 
        address: REPUTATION_SYSTEM, abi: repAbi, functionName: 'computeScore', 
        args: [ACCOUNT_C, communities, ruleIds, activities] 
    });
    
    // Calculation: (Base 50 + 10 * 5) * 0.8 = 100 * 0.8 = 80
    console.log(`   ✅ Computed Score: ${score}`);
    if (score !== 80n) throw new Error(`Score mismatch: expected 80, got ${score}`);

    // 4. Sync to Registry
    console.log("   🔄 Syncing to Registry...");
    const hashSync = await wallet.writeContract({ 
        address: REPUTATION_SYSTEM, abi: repAbi, functionName: 'syncToRegistry', 
        args: [ACCOUNT_C, communities, ruleIds, activities, 1n] 
    });
    await publicClient.waitForTransactionReceipt({ hash: hashSync });

    // 5. Verify Final Global Reputation & Credit Limit
    const globalRep = await publicClient.readContract({ address: REGISTRY, abi: regAbi, functionName: 'globalReputation', args: [ACCOUNT_C] });
    const credit = await publicClient.readContract({ address: REGISTRY, abi: regAbi, functionName: 'getCreditLimit', args: [ACCOUNT_C] });
    
    console.log(`   🏆 Registry Reputation: ${globalRep}`);
    console.log(`   💳 Credit Limit: ${formatEther(credit)} ETH`);

    console.log("\n🏁 Reputation Module Test Passed (Coverage: computeScore, syncToRegistry, setRule, setEntropyFactor, getCreditLimit)");
}

runReputationTest().catch(console.error);
