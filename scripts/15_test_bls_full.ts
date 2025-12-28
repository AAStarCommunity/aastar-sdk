
import { createPublicClient, http, hexToBytes, toHex, encodeAbiParameters, type Hex } from 'viem';
import { foundry } from 'viem/chains';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import { createRequire } from 'module';
import * as bls from '@noble/curves/bls12-381';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

dotenv_config();
function dotenv_config() {
    const envPath = path.resolve(process.cwd(), '.env.v3');
    if (fs.existsSync(envPath)) {
        const env = fs.readFileSync(envPath, 'utf8');
        env.split('\n').forEach(line => {
            const [key, value] = line.split('=');
            if (key && value) process.env[key.trim()] = value.trim();
        });
    }
}

const RPC_URL = process.env.RPC_URL || 'http://127.0.0.1:8545';
let BLS_VALIDATOR_ADDR: Hex = '0xf6a8ad553b265405526030c2102fda2bdcddc177'; 

const validatorAbi = [
  {
    name: 'verifyProof',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'proof', type: 'bytes' },
      { name: 'reference', type: 'bytes' }
    ],
    outputs: [{ name: 'isValid', type: 'bool' }]
  }
] as const;

const client = createPublicClient({ chain: foundry, transport: http(RPC_URL) });

function splitFp(coordBytes: Uint8Array): bigint[] {
    const start16 = coordBytes.slice(0, 16);
    const end32 = coordBytes.slice(16, 48);
    const highBuf = Buffer.alloc(32);
    highBuf.set(start16, 16);
    const high = BigInt('0x' + highBuf.toString('hex'));
    const low = BigInt('0x' + Buffer.from(end32).toString('hex'));
    return [high, low];
}

function splitFp2(coordBytes: Uint8Array): bigint[] {
    const c1 = coordBytes.slice(0, 48); // Noble puts c1 first
    const c0 = coordBytes.slice(48, 96); // Noble puts c0 second
    const [c0a, c0b] = splitFp(c0);
    const [c1a, c1b] = splitFp(c1);
    return [c0a, c0b, c1a, c1b];
}

function encodeG1(point: any): Hex {
    const bytes = point.toRawBytes(false);
    const x = bytes.slice(0, 48);
    const y = bytes.slice(48, 96);
    const [xa, xb] = splitFp(x);
    const [ya, yb] = splitFp(y);
    return encodeAbiParameters(
        [{ type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }],
        [xa, xb, ya, yb]
    );
}

function encodeG2(point: any): Hex {
    const bytes = point.toRawBytes(false);
    const x = bytes.slice(0, 96);
    const y = bytes.slice(96, 192);
    const [x_c0a, x_c0b, x_c1a, x_c1b] = splitFp2(x);
    const [y_c0a, y_c0b, y_c1a, y_c1b] = splitFp2(y);
    return encodeAbiParameters(
        Array(8).fill({ type: 'uint256' }),
        [x_c0a, x_c0b, x_c1a, x_c1b, y_c0a, y_c0b, y_c1a, y_c1b]
    );
}

async function main() {
    console.log("🚀 Starting Production BLS Verification...");

    const privKeyBytes = bls.bls12_381.utils.randomPrivateKey();
    const privKey = BigInt('0x' + Buffer.from(privKeyBytes).toString('hex'));
    
    // G1 PK
    const pkPoint = bls.bls12_381.G1.ProjectivePoint.BASE.multiply(privKey);
    
    // G2 Signature
    const message = new TextEncoder().encode("Hello BLS World");
    const sigPoint = await bls.bls12_381.G2.hashToCurve(message);
    const sigFinal = sigPoint.multiply(privKey);
    
    console.log("--------------------------------------------------");
    console.log("Step 2: Calling verifyProof on-chain...");
    
    const proof = encodeAbiParameters(
        [{ type: 'bytes' }, { type: 'bytes' }, { type: 'uint256' }],
        [encodeG1(pkPoint), encodeG2(sigFinal), 1n]
    );

    const messageHex = toHex(message);

    try {
        const isValid = await client.readContract({
            address: BLS_VALIDATOR_ADDR,
            abi: validatorAbi,
            functionName: 'verifyProof',
            args: [proof, messageHex]
        });
        
        if (isValid) {
            console.log("✅ BLS Verification SUCCESS!");
        } else {
            console.log("❌ BLS Verification FAILED!");
        }
    } catch (e: any) {
        console.error("❌ Error during verification:", e.shortMessage || e.message);
    }
}

main().catch(console.error);
