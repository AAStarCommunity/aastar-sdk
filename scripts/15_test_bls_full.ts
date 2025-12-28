
import { createPublicClient, createWalletClient, http, hexToBytes, toHex, keccak256, encodeAbiParameters, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { bls12_381 } from '@noble/curves/bls12-381';
import { fileURLToPath } from 'url';

// Fix BigInt serialization
(BigInt.prototype as any).toJSON = function () { return this.toString(); };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(process.cwd(), '.env.v3') });

const RPC_URL = process.env.RPC_URL || 'http://127.0.0.1:8545';
const BLS_VALIDATOR_ADDR = '0x0DCd1Bf9A1b36cE34237eEaFef220932846BCD82'; // From latest deployment log or config
// Note: We might need to read this from config.json if address changes frequently.
// For now we trust the user environment or synced .env.v3 (but logic below uses config)

// Use createRequire for JSON import to avoid ESM attribute issues in ts-node
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const config = require('./../packages/sdk/examples/config.json');
// Fallback if config import fails or is stale
const VALIDATOR_ADDRESS = (process.env.BLS_AGGREGATOR_ADDR || BLS_VALIDATOR_ADDR) as Hex; // Wait, Aggregator is different from Validator Strategy.
// We need to fetch the Validator address from the Registry or assume it's set.
// For the purpose of this test, we can interact directly with the deployed BLSValidator if we know its address.
// Let's use the one logged in previous steps: 0x0DCd1Bf9A1b36cE34237eEaFef220932846BCD82 (Strat)

// ABI
const validatorAbi = [
    {
        name: "verifyProof",
        type: "function",
        stateMutability: "view",
        inputs: [{ type: "bytes", name: "proof" }, { type: "bytes", name: "reference" }],
        outputs: [{ type: "bool", name: "isValid" }]
    }
] as const;

async function main() {
    console.log("🧪 Running Full BLS Verification Test (EIP-2537 Logic)...");

    const client = createPublicClient({ chain: foundry, transport: http(RPC_URL) });

    // 1. Generate Keys (Off-chain)
    const privateKey = bls12_381.utils.randomPrivateKey();
    const publicKey = bls12_381.getPublicKey(privateKey);
    console.log("🔑 Generated BLS Key Pair");
    console.log("   Priv:", toHex(privateKey));
    console.log("   Pub: ", toHex(publicKey)); // 48 bytes compressed

    // 2. Sign a Message
    const msg = new TextEncoder().encode("Hello BLS World");
    const signature = await bls12_381.sign(msg, privateKey);
    console.log("✍️  Signed Message: 'Hello BLS World'");
    console.log("   Sig: ", toHex(signature)); // 96 bytes compressed

    // 3. Prepare Proof for Contract
    // The contract expects encoded (pkG1, sigG2, msgG2, mask)
    // We need to map the message to G2 for the pairing check: e(pk, H(m))
    // Standard BLS signature verification: e(g1, sig) == e(pk, H(m))
    // LibBLS on-chain expects:
    // verify(sigG2, msgG2, pkG1) checks: e(sig, g2_gen?) ??? 
    // Wait, LibBLS.verify(sig, msg, pk) usually checks e(pk, msg) == e(g1, sig)
    // where pk is G1, sig is G2, and msg is hashed to G2.
    
    // Convert inputs to expected format
    // Solady LibBLS.verify expects G2 points for sig and msg, and G1 for pk.
    // It handles the pairing check internally.
    
    // We need to pass the *points* themselves, not just compressed bytes if `abi.decode` expects `bytes`.
    // Wait, `abi.decode(proof, (bytes, bytes, bytes, uint256))` reads dynamic bytes.
    // We should pass the Compressed or Uncompressed bytes depending on what `LibBLS.decodePoint` expects.
    // Solady's `decodePointG1/G2` handles both compressed (flag set) and uncompressed.
    
    // Noble BLS returns compressed by default.
    const pkBytes = toHex(publicKey);
    const sigBytes = toHex(signature);
    
    // Hash message to G2 point
    const msgPoint = bls12_381.G2.hashToCurve(msg);
    const msgBytes = toHex((msgPoint as any).toRawBytes(true)); // Compressed G2 point

    console.log("📦 constructing Proof...");
    console.log("   PK (G1):", pkBytes);
    console.log("   Sig (G2):", sigBytes);
    console.log("   Msg (G2):", msgBytes);

    const proof = encodeAbiParameters(
        [{ type: 'bytes' }, { type: 'bytes' }, { type: 'bytes' }, { type: 'uint256' }],
        [pkBytes, sigBytes, msgBytes, 0n] // Mask unused for single sig
    );

    // 4. Verify On-chain
    // We refer to the BLSValidator contract address found in config or recent deployment
    // Let's look for the BLSValidator address dynamically?
    // For this specific run, relying on the address logged in deployment (0x0DCd...)
    // Or we should update this script to take an arg or read from config.
    // I'll read from config.json (synced)
    
    // Note: synced config might not have 'blsValidator' key explicitly if it maps 'blsAggregator'.
    // Let's try to verify against the registry's set validator if possible, or just use the known address.
    const blsValidatorAddress = "0x0DCd1Bf9A1b36cE34237eEaFef220932846BCD82"; // Hardcoded from Step 8496/8515 log

    try {
        console.log(`🔍 Verifying on contract: ${blsValidatorAddress}`);
        const isValid = await client.readContract({
            address: blsValidatorAddress,
            abi: validatorAbi,
            functionName: 'verifyProof',
            args: [proof, "0x"]
        });

        if (isValid) {
            console.log("✅ BLS Verification SUCCESS!");
        } else {
            console.log("❌ BLS Verification FAILED (returned false).");
            process.exit(1);
        }
    } catch (e) {
        console.error("❌ Verification Reverted / Error:", e);
        process.exit(1);
    }
}

main().catch(console.error);
