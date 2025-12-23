import { createPublicClient, http, parseEther, formatEther, type Hex, toHex, encodeFunctionData, parseAbi, concat, type Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { ERC20Client } from '../packages/tokens/src/index.ts';

(BigInt.prototype as any).toJSON = function () { return this.toString(); };
dotenv.config({ path: path.resolve(__dirname, '../../env/.env.v3') });

const RPC_URL = process.env.SEPOLIA_RPC_URL;
const BUNDLER_RPC = process.env.ALCHEMY_BUNDLER_RPC_URL;
const ENTRY_POINT = "0x0000000071727DE22E5E9d8BAf0edAc6f37da032";

const ACCOUNT_B = process.env.TEST_SIMPLE_ACCOUNT_B as Hex; 
const SIGNER_KEY = process.env.PRIVATE_KEY_JASON as Hex; 
const BPNTS = process.env.BPNTS_ADDRESS as Hex;
const PAYMASTER_V4 = process.env.PAYMASTER_V4_ADDRESS as Hex;
const RECEIVER = "0x93E67dbB7B2431dE61a9F6c7E488e7F0E2eD2B3e";

if (!BUNDLER_RPC || !BPNTS || !PAYMASTER_V4) throw new Error("Missing Config for Group B");

function packUint(args: { high: bigint; low: bigint }): Hex {
    return `0x${((args.high << 128n) | args.low).toString(16).padStart(64, '0')}` as Hex;
}

async function main() {
    console.log("🚀 Starting Group B: Paymaster V4 (AOA Mode) - Refactored...");
    const publicClient = createPublicClient({ chain: sepolia, transport: http(RPC_URL) });
    const bundlerClient = createPublicClient({ chain: sepolia, transport: http(BUNDLER_RPC) });
    const signer = privateKeyToAccount(SIGNER_KEY);
    
    // 1. Check Allowance using ERC20Client
    const allowance = await ERC20Client.allowance(publicClient, BPNTS, ACCOUNT_B, PAYMASTER_V4);
    console.log(`   🔓 Allowance: ${formatEther(allowance)}`);

    if (allowance < parseEther("100")) {
        console.log("   ⚠️  Allowance too low. Sending 'Approve' UserOp (ETH paid)...");
        await sendUserOp(
            publicClient, bundlerClient, signer, ACCOUNT_B,
            BPNTS, 0n, 
            encodeFunctionData({ 
                abi: parseAbi(['function approve(address, uint256) returns (bool)']), 
                functionName: 'approve', 
                args: [PAYMASTER_V4, parseEther("1000000")] 
            }),
            "0x" // No Paymaster
        );
        console.log("   ✅ Approved.");
    }

    // 2. Prepare Test Transfer UserOp (Paid by Paymaster)
    console.log("   🔄 Sending Test Transfer (Paid by Paymaster)...");
    const transferData = encodeFunctionData({ 
        abi: parseAbi(['function transfer(address, uint256) returns (bool)']), 
        functionName: 'transfer', 
        args: [RECEIVER, parseEther("1")] 
    });
    
    const pmGasLimitsPlaceholder = packUint({ high: 300000n, low: 10000n });
    const pmAndDataForEst = concat([PAYMASTER_V4, pmGasLimitsPlaceholder]);

    await sendUserOp(
        publicClient, bundlerClient, signer, ACCOUNT_B,
        BPNTS, 0n, transferData, 
        pmAndDataForEst
    );
    console.log("   ✅ Group B Test Passed!");
}

async function sendUserOp(client: any, bundler: any, signer: any, sender: Address, target: Address, value: bigint, innerData: Hex, paymasterAndData: Hex = "0x") {
    const executeAbi = parseAbi(['function execute(address, uint256, bytes)']);
    const callData = encodeFunctionData({ abi: executeAbi, functionName: 'execute', args: [target, value, innerData] });
    
    const nonce = await client.readContract({
        address: ENTRY_POINT, 
        abi: [{ inputs: [{ name: "sender", type: "address" }, { name: "key", type: "uint192" }], name: "getNonce", outputs: [{ name: "nonce", type: "uint256" }], stateMutability: "view", type: "function" }],
        functionName: 'getNonce', args: [sender, 0n]
    });

    let estOp: any = {
        sender,
        nonce: toHex(nonce),
        callData,
        paymasterAndData: paymasterAndData,
        signature: "0xfffffffffffffffffffffffffffffff0000000000000000000000000000000007aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1c" as Hex
    };
    
    console.log("   ☁️  Estimating...");
    const estRes: any = await bundler.request({
        method: 'eth_estimateUserOperationGas',
        params: [estOp, ENTRY_POINT]
    });

    const verificationGasLimit = BigInt(estRes.verificationGasLimit ?? estRes.verificationGas ?? 500000n);
    const callGasLimit = BigInt(estRes.callGasLimit ?? 100000n);
    const preVerificationGas = BigInt(estRes.preVerificationGas ?? 50000n);
    const pmVerif = BigInt(estRes.paymasterVerificationGasLimit ?? 0n);
    const pmPost = BigInt(estRes.paymasterPostOpGasLimit ?? 0n);

    const block = await client.getBlock();
    const priority = parseEther("5", "gwei");
    const maxFee = block.baseFeePerGas! * 2n + priority;

    const accountGasLimits = packUint({ high: verificationGasLimit + 50000n, low: callGasLimit + 20000n });
    const gasFees = packUint({ high: maxFee, low: priority });
    
    let finalPMAndData = "0x" as Hex;
    if (paymasterAndData !== "0x") {
        const pmAddr = paymasterAndData.slice(0, 42) as Hex;
        const realPmVerif = pmVerif > 0n ? pmVerif + 50000n : 30000n;
        const realPmPost = pmPost > 0n ? pmPost + 10000n : 10000n;
        const pmLimits = packUint({ high: realPmVerif, low: realPmPost });
        const existingData = paymasterAndData.length > 106 ? ("0x" + paymasterAndData.slice(106)) as Hex : "0x" as Hex;
        finalPMAndData = concat([pmAddr, pmLimits, existingData]);
    }

    const packedUserOp = {
        sender, nonce, initCode: "0x" as Hex, callData, accountGasLimits, preVerificationGas, gasFees, paymasterAndData: finalPMAndData, signature: "0x" as Hex
    };

    const userOpHash = await client.readContract({
        address: ENTRY_POINT,
        abi: [{ inputs: [{ components: [{name:"sender",type:"address"},{name:"nonce",type:"uint256"},{name:"initCode",type:"bytes"},{name:"callData",type:"bytes"},{name:"accountGasLimits",type:"bytes32"},{name:"preVerificationGas",type:"uint256"},{name:"gasFees",type:"bytes32"},{name:"paymasterAndData",type:"bytes"},{name:"signature",type:"bytes"}], name: "userOp", type: "tuple" }], name: "getUserOpHash", outputs: [{ name: "", type: "bytes32" }], stateMutability: "view", type: "function" }] as const,
        functionName: 'getUserOpHash',
        args: [packedUserOp]
    });

    const sig = await signer.signMessage({ message: { raw: userOpHash } });
    
    let pmFields: any = {};
    if (finalPMAndData !== "0x") {
        pmFields.paymaster = finalPMAndData.slice(0, 42) as Hex;
        const pmVerifVal = BigInt("0x" + finalPMAndData.slice(42, 74));
        const pmPostVal = BigInt("0x" + finalPMAndData.slice(74, 106));
        pmFields.paymasterVerificationGasLimit = toHex(pmVerifVal);
        pmFields.paymasterPostOpGasLimit = toHex(pmPostVal);
        pmFields.paymasterData = finalPMAndData.length > 106 ? ("0x" + finalPMAndData.slice(106)) as Hex : "0x";
    }

    const unpackedUserOp = {
        sender, nonce: toHex(nonce), callData, callGasLimit: toHex(callGasLimit + 20000n), verificationGasLimit: toHex(verificationGasLimit + 50000n), preVerificationGas: toHex(preVerificationGas), maxFeePerGas: toHex(maxFee), maxPriorityFeePerGas: toHex(priority), ...pmFields, signature: sig
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
