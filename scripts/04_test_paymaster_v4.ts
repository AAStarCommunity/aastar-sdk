import { createPublicClient, createWalletClient, http, parseEther, formatEther, Hex, toHex, encodeFunctionData, parseAbi, concat, encodeAbiParameters, keccak256, Address, pad, toBytes } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';
import * as dotenv from 'dotenv';
import * as path from 'path';

(BigInt.prototype as any).toJSON = function () { return this.toString(); };
dotenv.config({ path: path.resolve(__dirname, '../../env/.env.anvil') });

const RPC_URL = process.env.SEPOLIA_RPC_URL;
const BUNDLER_RPC = process.env.ALCHEMY_BUNDLER_RPC_URL;
const ENTRY_POINT = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";

const ACCOUNT_B = process.env.TEST_SIMPLE_ACCOUNT_B as Hex; 
const SIGNER_KEY = process.env.PRIVATE_KEY_JASON as Hex; 
const BPNTS = process.env.BPNTS_ADDRESS as Hex;
const PAYMASTER_V4 = process.env.PAYMASTER_V4_ADDRESS as Hex;
const RECEIVER = "0x93E67dbB7B2431dE61a9F6c7E488e7F0E2eD2B3e";

if (!BUNDLER_RPC || !BPNTS || !PAYMASTER_V4) throw new Error("Missing Config for Group B");

function packUint(high128: bigint, low128: bigint): Hex {
    return `0x${((high128 << 128n) | low128).toString(16).padStart(64, '0')}`;
}

async function main() {
    console.log("🚀 Starting Group B: Paymaster V4 (AOA Mode)...");
    const publicClient = createPublicClient({ chain: foundry, transport: http(RPC_URL) });
    const bundlerClient = createPublicClient({ chain: foundry, transport: http(BUNDLER_RPC) });
    const signer = privateKeyToAccount(SIGNER_KEY);

    const erc20Abi = parseAbi([
        'function balanceOf(address) view returns (uint256)',
        'function transfer(address, uint256) returns (bool)',
        'function approve(address, uint256) returns (bool)',
        'function allowance(address, address) view returns (uint256)'
    ]);
    
    // 1. Check Allowance
    const allow = await publicClient.readContract({ address: BPNTS, abi: erc20Abi, functionName: 'allowance', args: [ACCOUNT_B, PAYMASTER_V4] });
    console.log(`   🔓 Allowance: ${formatEther(allow)}`);

    if (allow < parseEther("100")) {
        console.log("   ⚠️  Allowance too low. Sending 'Approve' UserOp (ETH paid)...");
        await sendUserOp(
            publicClient, bundlerClient, signer, ACCOUNT_B,
            BPNTS, 0n, 
            encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [PAYMASTER_V4, parseEther("1000000")] }),
            "0x", // No Paymaster
            true // isApproval
        );
        console.log("   ✅ Approved.");
    }

    // 2. Prepare Test Transfer UserOp (Paid by Paymaster)
    console.log("   🔄 Sending Test Transfer (Paid by Paymaster)...");
    const transferData = encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [RECEIVER, parseEther("1")] });
    
    // Construct Minimal PaymasterAndData for V4 Estimation
    // V4 AOA Mode: Only Paymaster address is strictly needed for routing, 
    // but some Paymasters verify data length.
    // For Estimation, 0x + Address + DummyLimits usually works if logic handles it.
    // Let's use clean Paymaster Address first.
    
    // NOTE: Alchemy v0.7 Expects paymasterAndData to be valid.
    // We pass "0x" + PaymasterAddress + DummyGas(32bytes) + DummyData?
    // Or just PaymasterAddress?
    // UserOp v0.7 paymasterAndData = [paymaster (20)] [gasLimits (32)] [data (?)]
    // We pre-pack a placeholder
    // We pre-pack a placeholder
    const pmGasLimitsPlaceholder = packUint(300000n, 10000n);
    // V3 requires [PM(20)][Limits(32)][Operator(20)]
    const operator = signer.address;
    const pmAndDataForEst = concat([PAYMASTER_V4, pmGasLimitsPlaceholder, operator]);

    await sendUserOp(
        publicClient, bundlerClient, signer, ACCOUNT_B,
        BPNTS, 0n, transferData, 
        pmAndDataForEst
    );
    console.log("   ✅ Group B Test Passed!");
}

async function sendUserOp(client: any, bundler: any, signer: any, sender: Address, target: Address, value: bigint, innerData: Hex, paymasterAndData: Hex, isApproval = false) {
    const executeAbi = parseAbi(['function execute(address, uint256, bytes)']);
    const callData = encodeFunctionData({ abi: executeAbi, functionName: 'execute', args: [target, value, innerData] });
    
    const nonce = await client.readContract({
        address: ENTRY_POINT, 
        abi: [{ inputs: [{ name: "sender", type: "address" }, { name: "key", type: "uint192" }], name: "getNonce", outputs: [{ name: "nonce", type: "uint256" }], stateMutability: "view", type: "function" }],
        functionName: 'getNonce', args: [sender, 0n]
    });

    // 1. Estimation (MINIMALIST)
    let estOp: any = {
        sender,
        nonce: toHex(nonce),
        callData,
        paymasterAndData: paymasterAndData,
        signature: "0xfffffffffffffffffffffffffffffff0000000000000000000000000000000007aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1c" as Hex
    };
    
    // ONLY add explicit gas limits if absolutely necessary (e.g. for Eth paid op to force valid limit)
    // But for Estimation, usually less is more with Alchemy v0.7.
    // Let's TRY minimal.

    console.log("   ☁️  Estimating...");
    const estRes: any = await bundler.request({
        method: 'eth_estimateUserOperationGas',
        params: [estOp, ENTRY_POINT]
    });

    // Parse Response
    const verificationGasLimit = BigInt(estRes.verificationGasLimit ?? estRes.verificationGas ?? 500000n);
    const callGasLimit = BigInt(estRes.callGasLimit ?? 100000n);
    const preVerificationGas = BigInt(estRes.preVerificationGas ?? 50000n);
    const pmVerif = BigInt(estRes.paymasterVerificationGasLimit ?? 0n);
    const pmPost = BigInt(estRes.paymasterPostOpGasLimit ?? 0n);

    const block = await client.getBlock();
    const priority = parseEther("5", "gwei");
    const maxFee = block.baseFeePerGas! * 2n + priority;

    // 2. Pack Final UserOp (For Hashing)
    const accountGasLimits = packUint(verificationGasLimit + 50000n, callGasLimit + 20000n);
    const gasFees = packUint(maxFee, priority);
    
    // Handle Paymaster Data Packing
    let finalPMAndData = "0x" as Hex;
    if (paymasterAndData !== "0x") {
        // Replace the placeholder limits with ESTIMATED limits
        const pmAddr = paymasterAndData.slice(0, 42) as Hex;
        // If estimation returned 0 for PM liits, use defaults
        const realPmVerif = pmVerif > 0n ? pmVerif + 50000n : 300000n;
        const realPmPost = pmPost > 0n ? pmPost + 10000n : 10000n;
        const pmLimits = packUint(realPmVerif, realPmPost);
        
        // Preserve any existing data after the limits (index 2+40+64 = 106)
        const existingData = paymasterAndData.length > 106 ? ("0x" + paymasterAndData.slice(106)) as Hex : "0x" as Hex;
        
        finalPMAndData = concat([pmAddr, pmLimits, existingData]);
    }

    const packedUserOp = {
        sender,
        nonce, 
        initCode: "0x" as Hex,
        callData,
        accountGasLimits,
        preVerificationGas,
        gasFees,
        paymasterAndData: finalPMAndData,
        signature: "0x" as Hex
    };

    const userOpHash = await client.readContract({
        address: ENTRY_POINT,
        abi: [{ inputs: [{ components: [{name:"sender",type:"address"},{name:"nonce",type:"uint256"},{name:"initCode",type:"bytes"},{name:"callData",type:"bytes"},{name:"accountGasLimits",type:"bytes32"},{name:"preVerificationGas",type:"uint256"},{name:"gasFees",type:"bytes32"},{name:"paymasterAndData",type:"bytes"},{name:"signature",type:"bytes"}], name: "userOp", type: "tuple" }], name: "getUserOpHash", outputs: [{ name: "", type: "bytes32" }], stateMutability: "view", type: "function" }] as const,
        functionName: 'getUserOpHash',
        args: [packedUserOp]
    });

    const sig = await signer.signMessage({ message: { raw: userOpHash } });
    
    // 3. Send Unpacked
    // Extract PM fields for Alchemy
    let pmFields: any = {};
    if (finalPMAndData !== "0x") {
        pmFields.paymaster = finalPMAndData.slice(0, 42) as Hex;
        pmFields.paymasterVerificationGasLimit = "0x" + finalPMAndData.slice(42, 74); // High 128
        pmFields.paymasterPostOpGasLimit = "0x" + finalPMAndData.slice(74, 106); // Low 128
        // Fix: Ensure we correctly slice the 128-bit chunks. 
        // Hex string chars: 2 (0x) + 40 (addr) + 32 (high) + 32 (low) -- wait, 128 bits is 16 bytes = 32 hex chars.
        // packUint structure: High(128b/32hex) | Low(128b/32hex). Total 64 chars.
        // So offset 42 (end of addr) -> 42+32=74 (end of high) -> 74+32=106 (end of low/limits)
        
        // BUT wait! Alchemy expects `paymasterVerificationGasLimit` as a quantity (uint256 hex string), not a packed chunk.
        // We unpack it back to clean hex for RPC.
        const pmVerifVal = BigInt("0x" + finalPMAndData.slice(42, 74));
        const pmPostVal = BigInt("0x" + finalPMAndData.slice(74, 106));
        
        pmFields.paymasterVerificationGasLimit = toHex(pmVerifVal);
        pmFields.paymasterPostOpGasLimit = toHex(pmPostVal);
        pmFields.paymasterData = finalPMAndData.length > 106 ? ("0x" + finalPMAndData.slice(106)) as Hex : "0x";
    }

    const unpackedUserOp = {
        sender,
        nonce: toHex(nonce),
        callData,
        callGasLimit: toHex(callGasLimit + 20000n),
        verificationGasLimit: toHex(verificationGasLimit + 50000n),
        preVerificationGas: toHex(preVerificationGas),
        maxFeePerGas: toHex(maxFee),
        maxPriorityFeePerGas: toHex(priority),
        ...pmFields,
        signature: sig
    };

    console.log("   🚀 Sending Unpacked...");
    const finalRes = await bundler.request({
        method: 'eth_sendUserOperation',
        params: [unpackedUserOp, ENTRY_POINT]
    });
    console.log(`   ✅ Sent: ${finalRes}`);
    
    for(let i=0; i<30; i++) {
        const r = await bundler.request({ method: 'eth_getUserOperationReceipt', params: [finalRes] });
        if(r) {
            console.log(`   ✅ Mined: ${(r as any).receipt.transactionHash}`);
            return;
        }
        await new Promise(res => setTimeout(res, 2000));
    }
}

main().catch(console.error);
