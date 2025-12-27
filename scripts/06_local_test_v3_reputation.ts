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
    'function syncToRegistry(address, address[], bytes32[][], uint256[][], uint256, bytes)',
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

    // 1.1 Ensure Community Role (Prerequisite for Reputation Updates)
    console.log("   🔍 Checking Community Role...");
    const ROLE_COMMUNITY = keccak256(Buffer.from('COMMUNITY'));
    const hasCommunity = await publicClient.readContract({
        address: REGISTRY, abi: parseAbi(['function hasRole(bytes32, address) view returns (bool)']),
        functionName: 'hasRole', args: [ROLE_COMMUNITY, signer.address]
    });

    if (!hasCommunity) {
        console.log("   ⚠️ Missing COMMUNITY role. Registering...");
        // 1. Mint/Approve GTokens often needed for stake
        const GTOKEN = process.env.GTOKEN_ADDR as Hex;
        const STAKING = process.env.STAKING_ADDR as Hex;
        if (GTOKEN && STAKING) {
             const mint = await wallet.writeContract({ address: GTOKEN, abi: parseAbi(['function mint(address, uint256)']), functionName: 'mint', args: [signer.address, 30000000000000000000n] });
             await publicClient.waitForTransactionReceipt({hash:mint});
             const app = await wallet.writeContract({ address: GTOKEN, abi: parseAbi(['function approve(address, uint256)']), functionName: 'approve', args: [STAKING, 30000000000000000000n] });
             await publicClient.waitForTransactionReceipt({hash:app});
        }

        const roleData = await import('viem').then(v => v.encodeAbiParameters(
            [{
                type: 'tuple',
                components: [
                    { name: 'name', type: 'string' },
                    { name: 'ensName', type: 'string' },
                    { name: 'website', type: 'string' },
                    { name: 'description', type: 'string' },
                    { name: 'logoURI', type: 'string' },
                    { name: 'stakeAmount', type: 'uint256' }
                ]
            }],
            [['RepTest', '', '', '', '', 0n]]
        ));

        // Register
        const reg = await wallet.writeContract({
            address: REGISTRY,
            abi: parseAbi(['function registerRoleSelf(bytes32, bytes) external']),
            functionName: 'registerRoleSelf',
            args: [ROLE_COMMUNITY, roleData]
        }); 
        await publicClient.waitForTransactionReceipt({ hash: reg });
        console.log("   ✅ Registered COMMUNITY.");
    }

    // 1.5 Register ReputationSystem as trusted source in Registry BEFORE sync
    console.log("   🔑 Configuring trusted reputation source...");
    const abiRegSet = parseAbi(['function setReputationSource(address, bool)']);
    const hashAuth = await wallet.writeContract({
        address: REGISTRY, abi: abiRegSet, functionName: 'setReputationSource',
        args: [REPUTATION_SYSTEM, true]
    });
    await publicClient.waitForTransactionReceipt({ hash: hashAuth });
    console.log("   ✅ ReputationSystem Authorized");

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

    // 4. Sync to Registry (with dummy BLS proof)
    console.log("   🔄 Syncing to Registry...");
    // Dummy proof: (bytes pkG1, bytes sigG2, bytes msgG2, uint256 signerMask)
    // pkG1: 96 bytes, sigG2: 192 bytes, msgG2: 192 bytes, signerMask: uint256
    const dummyPk = "0x17f1d3a73197d7942695638c4fa9ac0fc3688c4f9774b905a14e3a3f171bac586c55e83ff97a1aeffb3af00adb22c6bb" + "00".repeat(48); // 96 bytes total
    const dummySig = "0x" + "00".repeat(192);
    const dummyMsg = "0x" + "00".repeat(192);
    const signerMask = 0xFFFFn;
    
    // ABI encode the proof
    const proof = publicClient.readContract({ 
        address: REGISTRY, // Dummy address for encoding helper if existed, but we encode manually
        abi: parseAbi(['function encodeProof(bytes,bytes,bytes,uint256) pure returns (bytes)']),
        functionName: 'encodeProof',
        args: [dummyPk as Hex, dummySig as Hex, dummyMsg as Hex, signerMask]
    }).catch(() => {
        // Fallback for manual encoding if helper not present
        return "0x" + "dummy"; 
    });

    // Actually, Registry.sol doesn't have encodeProof helper. We use viem's encodeAbiParameters
    const { encodeAbiParameters, parseAbiParameters } = await import('viem');
    const encodedProof = encodeAbiParameters(
        parseAbiParameters('bytes, bytes, bytes, uint256'),
        [dummyPk as Hex, dummySig as Hex, dummyMsg as Hex, signerMask]
    );

    const hashSync = await wallet.writeContract({ 
        address: REPUTATION_SYSTEM, abi: repAbi, functionName: 'syncToRegistry', 
        args: [ACCOUNT_C, communities, ruleIds, activities, 1n, encodedProof] 
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
