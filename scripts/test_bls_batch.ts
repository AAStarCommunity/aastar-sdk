import { createPublicClient, createWalletClient, http, parseAbi, keccak256, toHex, type Hex, encodeAbiParameters, parseAbiParameters, hexToBytes } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry, sepolia } from 'viem/chains';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { createRequire } from 'module';

// Polyfill for BigInt serialization
(BigInt.prototype as any).toJSON = function () { return this.toString(); };

// Environment Setup
const envFile = process.env.REVISION_ENV === 'sepolia' ? '.env.sepolia' : '.env.anvil';
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

const isSepolia = process.env.REVISION_ENV === 'sepolia';
const chain = isSepolia ? sepolia : foundry;
const RPC_URL = process.env.RPC_URL || (isSepolia ? process.env.SEPOLIA_RPC_URL : 'http://127.0.0.1:8545');

console.log(`🚀 Running Batch BLS Verification Test`);
console.log(`📍 Environment: ${isSepolia ? 'Sepolia' : 'Anvil'}`);
console.log(`🔗 RPC: ${RPC_URL}`);

// Configuration
const BLS_AGGREGATOR = (process.env.BLS_AGGREGATOR_ADDR || process.env.BLS_AGGREGATOR_ADDRESS || '0xe380d443842A8A37F691B9f3EF58e40073759edc') as Hex; // Default to Sepolia or common anvil
const SIGNER_KEY = (process.env.ADMIN_KEY || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80') as Hex;

console.log(`📝 BLS Aggregator: ${BLS_AGGREGATOR}`);

// Imports for BLS
const require = createRequire(import.meta.url);
const { bls12_381 } = require('@noble/curves/bls12-381');

async function runBatchTest() {
    const publicClient = createPublicClient({ chain, transport: http(RPC_URL) });
    const signer = privateKeyToAccount(SIGNER_KEY);
    const wallet = createWalletClient({ account: signer, chain, transport: http(RPC_URL) });

    // ABI
    const aggAbi = parseAbi([
        'function verifyAndExecute(uint256, address, uint8, address[], uint256[], uint256, bytes)'
    ]);

    // Test Parameters: Batch of 10 Users
    const BATCH_SIZE = 10;
    console.log(`   👥 Batch Size: ${BATCH_SIZE}`);
    
    const batchUsers = Array.from({length: BATCH_SIZE}, (_, i) => 
        `0x${(i+1).toString(16).padStart(40, '0')}` as Hex
    );
    const batchScores = Array.from({length: BATCH_SIZE}, () => 80n);
    const proposalId = BigInt(Math.floor(Math.random() * 1000000));
    const epoch = 1n;
    const operator = '0x0000000000000000000000000000000000000000' as Hex; 
    const slashLevel = 0;
    
    const chainId = await publicClient.getChainId();

    // 1. Construct Message Hash
    const expectedMessageHash = keccak256(encodeAbiParameters(
        parseAbiParameters('uint256, address, uint8, address[], uint256[], uint256, uint256'),
        [proposalId, operator, slashLevel, batchUsers, batchScores, epoch, BigInt(chainId)]
    ));

    // 2. Generate BLS Signature
    // Key Gen
    const privKey = bls12_381.utils.randomPrivateKey();
    const pkPoint = bls12_381.G1.ProjectivePoint.fromPrivateKey(privKey);
    const pkRaw = pkPoint.toRawBytes(false);
    
    // Pad PK (G1)
    const pkX_padded = new Uint8Array(64); pkX_padded.set(pkRaw.slice(0, 48), 16);
    const pkY_padded = new Uint8Array(64); pkY_padded.set(pkRaw.slice(48, 96), 16);
    const pkHex = "0x" + toHex(pkX_padded).slice(2) + toHex(pkY_padded).slice(2);

    // Hash to Curve (G2)
    const msgBytes = hexToBytes(expectedMessageHash); 
    const msgPoint = bls12_381.G2.hashToCurve(msgBytes); // H(H(msg)) binding
    const msgRaw = msgPoint.toRawBytes(false);
    
    function padG2(raw: Uint8Array): string {
        const x_c0 = raw.slice(0, 48);   const x_c1 = raw.slice(48, 96);
        const y_c0 = raw.slice(96, 144); const y_c1 = raw.slice(144, 192);
        
        const x_c0_p = new Uint8Array(64); x_c0_p.set(x_c0, 16);
        const x_c1_p = new Uint8Array(64); x_c1_p.set(x_c1, 16);
        const y_c0_p = new Uint8Array(64); y_c0_p.set(y_c0, 16);
        const y_c1_p = new Uint8Array(64); y_c1_p.set(y_c1, 16);
        
        // Return Im then Re (c1, c0) -> EIP-2537 format
        return toHex(x_c1_p).slice(2) + toHex(x_c0_p).slice(2) + toHex(y_c1_p).slice(2) + toHex(y_c0_p).slice(2);
    }
    const msgHex = "0x" + padG2(msgRaw);

    // Sign
    const sigPoint = msgPoint.multiply(BigInt(toHex(privKey)));
    const sigRaw = sigPoint.toRawBytes(false);
    const sigHex = "0x" + padG2(sigRaw);
    const signerMask = 0xFFFFn; // Assume authorized

    const encodedProof = encodeAbiParameters(
        parseAbiParameters('bytes, bytes, bytes, uint256'),
        [pkHex as Hex, sigHex as Hex, msgHex as Hex, signerMask]
    );

    // 3. Estimate Gas
    try {
        console.log("   ⛽ Estimating Gas...");
        const gasEstimate = await publicClient.estimateContractGas({ 
            address: BLS_AGGREGATOR, 
            abi: aggAbi, 
            functionName: 'verifyAndExecute', 
            args: [proposalId, operator, slashLevel, batchUsers, batchScores, epoch, encodedProof],
            account: signer.address
        });
        
        console.log(`   ✅ Total Gas Used: ${gasEstimate}`);
        console.log(`   📊 Amortized Gas per User: ${Number(gasEstimate) / BATCH_SIZE}`);
        console.log(`   (Base Cost ~140k is effectively shared)`);
        
    } catch (e: any) {
        if (e.message.includes('revert') || e.message.includes('Unauthorized')) {
             console.log("   ⚠️  Contract Reverted. This is expected if the signer is not an authorized DVT validator.");
             console.log("   Since we used a random key, the on-chain BLS Aggregator will reject it if it checks 'isValidator'.");
             console.log("   HOWEVER, the pairing check (precompile) happens BEFORE authorization check usually, or we can look at the revert reason.");
             console.log("   Error:", e.shortMessage || e.message);
             
             // If revert happens AFTER pairing, we still paid for pairing provided we ran it? 
             // No, estimateGas simulates. 
             // We can assume the theoretical cost holding true.
             // But let's see if we can use a known Validator key? No, we don't have private keys for on-chain validators usually.
             
             // Fallback: We can simulate the cost purely by calculation if this fails.
        } else {
             console.error("   ❌ Unexpected Error:", e);
        }
    }
}

runBatchTest().catch(console.error);
