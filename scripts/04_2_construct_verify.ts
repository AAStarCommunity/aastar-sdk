import { createPublicClient, createWalletClient, http, parseEther, formatEther, Hex, toHex, encodeFunctionData, parseAbi, concat, encodeAbiParameters, keccak256, Address, pad, toBytes } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';
import * as dotenv from 'dotenv';
import * as path from 'path';

(BigInt.prototype as any).toJSON = function () { return this.toString(); };
dotenv.config({ path: path.resolve(__dirname, '../../env/.env.anvil') });

const RPC_URL = process.env.SEPOLIA_RPC_URL;
const ENTRY_POINT = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";
const ACCOUNT_B = process.env.TEST_SIMPLE_ACCOUNT_B as Hex;
const SIGNER_KEY = process.env.PRIVATE_KEY_JASON as Hex; 
const BPNTS = process.env.BPNTS_ADDRESS as Hex;
const PAYMASTER_V4 = process.env.PAYMASTER_V4_ADDRESS as Hex;
const RECEIVER = "0x93E67dbB7B2431dE61a9F6c7E488e7F0E2eD2B3e";

function packUint(high128: bigint, low128: bigint): Hex {
    return `0x${((high128 << 128n) | low128).toString(16).padStart(64, '0')}`;
}

async function main() {
    console.log("🛠️ [04.2] Constructing UserOp Locally for Inspection...");
    const client = createPublicClient({ chain: foundry, transport: http(RPC_URL) });
    const signer = privateKeyToAccount(SIGNER_KEY);

    const erc20Abi = parseAbi(['function transfer(address, uint256) returns (bool)', 'function approve(address, uint256) returns (bool)']);
    const executeAbi = parseAbi(['function execute(address, uint256, bytes)']);

    // 1. Data
    // We assume allowance is OK (implied from 04.1 or previous runs)
    // We construct Transfer Op
    const transferData = encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [RECEIVER, parseEther("1")] });
    const callData = encodeFunctionData({ abi: executeAbi, functionName: 'execute', args: [BPNTS, 0n, transferData] });
    
    // 2. Nonce
    const nonce = await client.readContract({
        address: ENTRY_POINT, abi: parseAbi(['function getNonce(address, uint192) view returns (uint256)']),
        functionName: 'getNonce', args: [ACCOUNT_B, 0n]
    });
    console.log(`   🔢 Nonce: ${nonce}`);

    // 3. Construct Packed Config (Simulation)
    const verificationGasLimit = 500000n;
    const callGasLimit = 200000n;
    const maxFee = parseEther("20", "gwei");
    const priority = parseEther("2", "gwei");
    const pmVerif = 300000n;
    const pmPost = 10000n;

    const accountGasLimits = packUint(verificationGasLimit, callGasLimit);
    const gasFees = packUint(maxFee, priority);
    const pmGasLimits = packUint(pmVerif, pmPost);

    // Paymaster V4
    const paymasterAndData = concat([PAYMASTER_V4, pmGasLimits, "0x" as Hex]);

    // 4. Create Packed Object
    const packedUserOp = {
        sender: ACCOUNT_B,
        nonce,
        initCode: "0x" as Hex,
        callData,
        accountGasLimits,
        preVerificationGas: 50000n,
        gasFees,
        paymasterAndData,
        signature: "0xfffffffffffffffffffffffffffffff0000000000000000000000000000000007aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1c" as Hex
    };
    
    console.log("\n📦 Packed UserOp Structure:");
    console.log(JSON.stringify(packedUserOp, null, 2));

    // 5. Hash
    const userOpHash = await client.readContract({
        address: ENTRY_POINT,
        abi: [{ inputs: [{ components: [{name:"sender",type:"address"},{name:"nonce",type:"uint256"},{name:"initCode",type:"bytes"},{name:"callData",type:"bytes"},{name:"accountGasLimits",type:"bytes32"},{name:"preVerificationGas",type:"uint256"},{name:"gasFees",type:"bytes32"},{name:"paymasterAndData",type:"bytes"},{name:"signature",type:"bytes"}], name: "userOp", type: "tuple" }], name: "getUserOpHash", outputs: [{ name: "", type: "bytes32" }], stateMutability: "view", type: "function" }] as const,
        functionName: 'getUserOpHash',
        args: [packedUserOp]
    });
    console.log(`\n🔑 UserOp Hash: ${userOpHash}`);
    
    // 6. Local Signature
    const sig = await signer.signMessage({ message: { raw: userOpHash } });
    console.log(`✍️  Signature: ${sig}`);
    
    // 7. Verify Locally with ecrecover/viem
    const valid = await client.verifyMessage({ address: signer.address, message: { raw: userOpHash }, signature: sig });
    console.log(`\n✅ Signature Valid for Signer(${signer.address})? ${valid}`);
    
    // 8. Verify On-Chain (StaticCall to EntryPoint)
    // Not easy to static-call validateUserOp directly as it reverts on success sometimes or is restricted.
    // Instead we usually trust the Hash+Sign logic if 'valid' is true locally.
}

main().catch(console.error);
