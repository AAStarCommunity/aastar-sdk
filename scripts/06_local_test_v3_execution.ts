import { createPublicClient, http, parseEther, toHex, encodeFunctionData, parseAbi, concat, encodeAbiParameters, keccak256, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';
import * as dotenv from 'dotenv';
import * as path from 'path';

// BigInt serialization fix
(BigInt.prototype as any).toJSON = function () { return this.toString(); };
dotenv.config({ path: path.resolve(process.cwd(), '.env.v3') });

// Configuration
const RPC_URL = process.env.RPC_URL;
const BUNDLER_RPC = process.env.BUNDLER_RPC;
const ENTRY_POINT = process.env.MOCK_ENTRY_POINT as Hex;
const APNTS = process.env.APNTS as Hex;
const SUPER_PAYMASTER = process.env.SUPER_PAYMASTER as Hex;
const SIGNER_KEY = process.env.PRIVATE_KEY_SUPPLIER as Hex;
const ACCOUNT_C = process.env.ALICE_AA_ACCOUNT as Hex;
const RECEIVER = process.env.RECEIVER as Hex;

if (!SUPER_PAYMASTER || !APNTS || !BUNDLER_RPC) throw new Error("Missing Config");

const erc20Abi = parseAbi(['function transfer(address, uint256) returns (bool)']);

// Helper: Pack 128-bit values
function packUint(high128: bigint, low128: bigint): Hex {
    return `0x${((high128 << 128n) | low128).toString(16).padStart(64, '0')}`;
}

async function runExecutionTest() {
    console.log("🧪 Running SuperPaymaster V3 Execution Modular Test...");
    const publicClient = createPublicClient({ chain: foundry, transport: http(RPC_URL) });
    const bundlerClient = createPublicClient({ chain: foundry, transport: http(BUNDLER_RPC) });
    const signer = privateKeyToAccount(SIGNER_KEY);

    // ====================================================
    // 3. UserOperation Execution
    // ====================================================
    console.log("   🚀 Preparing UserOperation...");
    
    const transferData = encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [RECEIVER, parseEther("0.001")] });
    
    // Construct Paymaster Data
    const pmStruct = {
        paymaster: SUPER_PAYMASTER,
        paymasterVerificationGasLimit: 350000n,
        paymasterPostOpGasLimit: 20000n,
        paymasterData: signer.address 
    };

    try {
        const metrics = await sendUserOp(publicClient, bundlerClient, signer, ACCOUNT_C, APNTS, 0n, transferData, pmStruct, 31337);
        console.log(`   ✅ UserOp Success! Hash: ${metrics.txHash}`);
        console.log("\n🏁 Execution Module Test Passed (Coverage: validatePaymasterUserOp, postOp, _extractOperator)");
    } catch (e) {
        console.error("   ❌ UserOp Execution Failed:", e);
        process.exit(1);
    }
}

async function sendUserOp(client: any, bundler: any, signer: any, sender: Hex, target: Hex, value: bigint, innerData: Hex, pmStruct: any, chainId: number) {
    const nonce = await client.readContract({
        address: ENTRY_POINT, abi: parseAbi(['function getNonce(address,uint192) view returns (uint256)']),
        functionName: 'getNonce', args: [sender, 0n]
    });

    const callData = encodeFunctionData({
        abi: parseAbi(['function execute(address, uint256, bytes)']),
        functionName: 'execute', args: [target, value, innerData]
    });

    // Estimate
    let estOp: any = {
        sender, nonce: toHex(nonce), initCode: "0x", callData,
        signature: "0xfffffffffffffffffffffffffffffff0000000000000000000000000000000007aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1c" as Hex
    };
    if (pmStruct) {
        estOp.paymaster = pmStruct.paymaster;
        estOp.paymasterVerificationGasLimit = toHex(pmStruct.paymasterVerificationGasLimit);
        estOp.paymasterPostOpGasLimit = toHex(pmStruct.paymasterPostOpGasLimit);
        estOp.paymasterData = pmStruct.paymasterData;
    }

    const estRes: any = await bundler.request({ method: 'eth_estimateUserOperationGas', params: [estOp, ENTRY_POINT] });
    
    const verificationGasLimit = BigInt(estRes.verificationGasLimit ?? 500000n) + 50000n;
    const callGasLimit = BigInt(estRes.callGasLimit ?? 100000n) + 20000n;
    const preVerificationGas = BigInt(estRes.preVerificationGas ?? 50000n);
    const maxFee = (await client.getBlock()).baseFeePerGas! * 2n + parseEther("5", "gwei");

    const packedOp = {
        sender, nonce, initCode: "0x" as Hex, callData,
        accountGasLimits: packUint(verificationGasLimit, callGasLimit),
        preVerificationGas,
        gasFees: packUint(parseEther("5", "gwei"), maxFee),
        paymasterAndData: concat([pmStruct.paymaster, packUint(350000n, 20000n), pmStruct.paymasterData]),
        signature: "0x" as Hex
    };

    function entryPointGetUserOpHash(op: any, ep: Hex, cId: number): Hex {
        const packed = encodeAbiParameters(
            [{ type: 'address' }, { type: 'uint256' }, { type: 'bytes32' }, { type: 'bytes32' }, { type: 'bytes32' }, { type: 'uint256' }, { type: 'bytes32' }, { type: 'bytes32' }],
            [op.sender, BigInt(op.nonce), keccak256(op.initCode), keccak256(op.callData), op.accountGasLimits, BigInt(op.preVerificationGas), op.gasFees, keccak256(op.paymasterAndData)]
        );
        const enc = encodeAbiParameters([{ type: 'bytes32' }, { type: 'address' }, { type: 'uint256' }], [keccak256(packed), ep, BigInt(cId)]);
        return keccak256(enc);
    }

    const userOpHash = entryPointGetUserOpHash(packedOp, ENTRY_POINT, chainId);
    const sig = await signer.signMessage({ message: { raw: userOpHash } });

    const unpackedOp = {
        sender, nonce: toHex(nonce), initCode: "0x", callData,
        callGasLimit: toHex(callGasLimit), verificationGasLimit: toHex(verificationGasLimit),
        preVerificationGas: toHex(preVerificationGas),
        maxFeePerGas: toHex(maxFee), maxPriorityFeePerGas: toHex(parseEther("5", "gwei")),
        paymaster: pmStruct.paymaster,
        paymasterVerificationGasLimit: toHex(350000n),
        paymasterPostOpGasLimit: toHex(20000n),
        paymasterData: pmStruct.paymasterData,
        signature: sig
    };

    const hash = await bundler.request({ method: 'eth_sendUserOperation', params: [unpackedOp, ENTRY_POINT] });
    
    // Wait
    for(let i=0; i<60; i++) {
        const r: any = await bundler.request({ method: 'eth_getUserOperationReceipt', params: [hash] });
        if(r) return { txHash: r.receipt.transactionHash, status: 'Success' };
        await new Promise(res => setTimeout(res, 2000));
    }
    throw new Error("Timeout waiting for UserOp receipt");
}

runExecutionTest().catch(console.error);
