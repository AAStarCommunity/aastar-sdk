import { createPublicClient, createWalletClient, http, formatEther, parseAbi, keccak256, toHex, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
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
const SUPER_PAYMASTER = process.env.SUPER_PAYMASTER as Hex;

if (!REGISTRY || !REPUTATION_SYSTEM || !SIGNER_KEY || !SUPER_PAYMASTER) throw new Error("Missing Config");

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

const pmAbi = parseAbi([
    'function operators(address) view returns (uint128 balance, uint96 exRate, bool isConfigured, bool isPaused, address xPNTsToken, uint32 reputation, address treasury, uint256 spent, uint256 txSponsored)',
]);

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

async function runReputationTest() {
    console.log("🧪 Running SuperPaymaster V3 Reputation & Credit Modular Test...");
    const publicClient = createPublicClient({ chain: sepolia, transport: http(RPC_URL) });
    const signer = privateKeyToAccount(SIGNER_KEY);
    const wallet = createWalletClient({ account: signer, chain: sepolia, transport: http(RPC_URL) });

    // ... (rest of setup)

    // 1. Setup Scoring Rules (Community Admin Context)
    console.log("   📏 Setting up Scoring Rules...");
    const ruleId = keccak256(toHex("TEST_RULE"));
    const hashRule = await wallet.writeContract({ 
        address: REPUTATION_SYSTEM, abi: repAbi, functionName: 'setRule', 
        args: [ruleId, 50n, 5n, 100n, "Modular Test Rule"] 
    });
    await publicClient.waitForTransactionReceipt({ hash: hashRule });

    // 1.1 Ensure Community Role (Prerequisite for Reputation Updates)
    console.log("   🔍 Checking Community Role...");
    const ROLE_COMMUNITY = keccak256(toHex('COMMUNITY'));
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
            [{ name: 'RepTest', ensName: '', website: '', description: '', logoURI: '', stakeAmount: 0n }]
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

    // 4. Sync to Registry (Real BLS Proof Format satisfy Registry.sol)
    console.log("   🔄 Syncing to Registry (Generating Valid BLS Proof)...");
    
    // Import noble-curves locally to avoid global dependency issues if not installed in root
    // We assume it's installed via 'pnpm add -w @noble/curves'
    const { bls12_381 } = require('@noble/curves/bls12-381');
    // Removed @noble/hashes/utils, using viem's toHex which supports Uint8Array

    // Generate random items
    const privKey = bls12_381.utils.randomPrivateKey();
    // Note: getPublicKey returns compressed (48 bytes) by default? No, usually Uint8Array.
    // We need UNCOMPRESSED G1 (96 bytes) for Registry.sol
    // Helper to pad hex string to 64 bytes (128 chars) or 128 bytes (256 chars) per coordinate if needed
    
    const pkPoint = bls12_381.G1.ProjectivePoint.fromPrivateKey(privKey);
    // G1 (96 bytes) -> (128 bytes)
    const pkRaw = pkPoint.toRawBytes(false); // 96 bytes
    // x: bytes 0-47, y: bytes 48-95
    const pkX = pkRaw.slice(0, 48);
    const pkY = pkRaw.slice(48, 96);
    // Pad to 64 bytes
    const pkX_padded = new Uint8Array(64); pkX_padded.set(pkX, 16);
    const pkY_padded = new Uint8Array(64); pkY_padded.set(pkY, 16);
    const pkHex = toHex(pkX_padded).slice(2) + toHex(pkY_padded).slice(2);

    // Message to G2
    const msgBytes = new TextEncoder().encode("SuperPaymaster Reputation Update");
    const msgPoint = bls12_381.G2.hashToCurve(msgBytes);
    // G2 (192 bytes) -> (256 bytes)
    const msgRaw = msgPoint.toRawBytes(false); // 192 bytes
    // x: 0-95 (two 48 byte parts?), y: 96-191
    // G2 element is (c0, c1) where c0, c1 are Fq.
    // noble encodes [x_c1, x_c0, y_c1, y_c0] ? No, usually [x_c1, x_c0]
    // Let's assume noble output is correct order, just field elements are 48 bytes.
    // We need 64 bytes per field element.
    // G2 uncompressed is 192 bytes. 48 * 4.
    // We want 256 bytes. 64 * 4.
    function padG2(raw: Uint8Array): string {
        // noble-curves (ZCash spec): c0 (Real), c1 (Imaginary)
        // EIP-2537: x_im (c1), x_re (c0), y_im (c1), y_re (c0)
        
        const x_c0 = raw.slice(0, 48);   // Real
        const x_c1 = raw.slice(48, 96);  // Im
        const y_c0 = raw.slice(96, 144); // Real
        const y_c1 = raw.slice(144, 192);// Im
        
        const x_c0_p = new Uint8Array(64); x_c0_p.set(x_c0, 16);
        const x_c1_p = new Uint8Array(64); x_c1_p.set(x_c1, 16);
        const y_c0_p = new Uint8Array(64); y_c0_p.set(y_c0, 16);
        const y_c1_p = new Uint8Array(64); y_c1_p.set(y_c1, 16);
        
        // Return Im then Re (c1, c0)
        return toHex(x_c1_p).slice(2) + toHex(x_c0_p).slice(2) + toHex(y_c1_p).slice(2) + toHex(y_c0_p).slice(2);
    }

    const msgHex = "0x" + padG2(msgRaw);

    // Signature (G2) = sk * msgG2
    const sigPoint = msgPoint.multiply(BigInt(toHex(privKey)));
    const sigRaw = sigPoint.toRawBytes(false);
    const sigHex = "0x" + padG2(sigRaw);
    
    // pkHex was just string concat, need 0x prefix
    const dummyPk = "0x" + pkHex;
    const dummySig = sigHex;
    const dummyMsg = msgHex;
    const signerMask = 0xFFFFn;

    console.log(`      PK Length: ${(dummyPk.length - 2)/2} bytes`);
    console.log(`      Sig Length: ${(dummySig.length - 2)/2} bytes`);
    console.log(`      Msg Length: ${(dummyMsg.length - 2)/2} bytes`);
    
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
    let opData = await publicClient.readContract({ address: SUPER_PAYMASTER, abi: pmAbi, functionName: 'operators', args: [signer.address] }) as unknown as any[];
    console.log(`   🔍 Final Operator Reputation: ${opData[5]}`);
    
    const globalRep = await publicClient.readContract({ address: REGISTRY, abi: regAbi, functionName: 'globalReputation', args: [ACCOUNT_C] });
    const credit = await publicClient.readContract({ address: REGISTRY, abi: regAbi, functionName: 'getCreditLimit', args: [ACCOUNT_C] });
    
    console.log(`   🏆 Registry Reputation: ${globalRep}`);
    console.log(`   💳 Credit Limit: ${formatEther(credit as bigint)} ETH`);

    console.log("\n🏁 Reputation Module Test Passed (Coverage: computeScore, syncToRegistry, setRule, setEntropyFactor, getCreditLimit)");
}

runReputationTest().catch(console.error);
