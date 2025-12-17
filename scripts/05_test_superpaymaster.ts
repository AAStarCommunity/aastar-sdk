import { createPublicClient, createWalletClient, http, parseEther, formatEther, Hex, toHex, encodeFunctionData, parseAbi, concat, encodeAbiParameters, keccak256, Address, pad, toBytes } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import * as dotenv from 'dotenv';
import * as path from 'path';

(BigInt.prototype as any).toJSON = function () { return this.toString(); };
dotenv.config({ path: path.resolve(__dirname, '../../env/.env.v3') });

const RPC_URL = process.env.SEPOLIA_RPC_URL;
const BUNDLER_RPC = process.env.ALCHEMY_BUNDLER_RPC_URL;
const ENTRY_POINT = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";

const ACCOUNT_C = process.env.TEST_SIMPLE_ACCOUNT_C as Hex; 
const SIGNER_KEY = process.env.PRIVATE_KEY_JASON as Hex; 
const BPNTS = process.env.BPNTS_ADDRESS as Hex;
const APNTS = process.env.APNTS_ADDRESS as Hex;
const SUPER_PAYMASTER = process.env.SUPER_PAYMASTER_ADDRESS as Hex;
const ANNI_KEY = process.env.PRIVATE_KEY_ANNI as Hex; 
const RECEIVER = "0x93E67dbB7B2431dE61a9F6c7E488e7F0E2eD2B3e";

if (!BUNDLER_RPC || !BPNTS || !SUPER_PAYMASTER) throw new Error("Missing Config for Group C");

function packUint(high128: bigint, low128: bigint): Hex {
    return `0x${((high128 << 128n) | low128).toString(16).padStart(64, '0')}`;
}

async function main() {
    console.log("🚀 Starting Group C: SuperPaymaster...");
    const publicClient = createPublicClient({ chain: sepolia, transport: http(RPC_URL) });
    const bundlerClient = createPublicClient({ chain: sepolia, transport: http(BUNDLER_RPC) });
    const signer = privateKeyToAccount(SIGNER_KEY);
    const anniWallet = createWalletClient({ account: privateKeyToAccount(ANNI_KEY), chain: sepolia, transport: http(RPC_URL) });

    const erc20Abi = parseAbi([
        'function balanceOf(address) view returns (uint256)',
        'function transfer(address, uint256) returns (bool)',
        'function approve(address, uint256) returns (bool)',
        'function allowance(address, address) view returns (uint256)'
    ]);
    const epAbi = parseAbi(['function balanceOf(address) view returns (uint256)', 'function depositTo(address) payable']);

    // 1. Check SuperPaymaster Deposit
    const pmDeposit = await publicClient.readContract({ address: ENTRY_POINT, abi: epAbi, functionName: 'balanceOf', args: [SUPER_PAYMASTER] });
    console.log(`   🏦 PM Deposit: ${formatEther(pmDeposit)} ETH`);
    if (pmDeposit < parseEther("0.05")) {
        console.log("   ⚠️  Low Deposit. Converting Anni ETH -> EntryPoint Deposit...");
        const hash = await anniWallet.writeContract({
            address: ENTRY_POINT, abi: epAbi, functionName: 'depositTo', args: [SUPER_PAYMASTER], value: parseEther("0.05")
        });
        console.log(`   ⏳ Deposited: ${hash}`);
        await publicClient.waitForTransactionReceipt({ hash });
    }

    // 2. Check Allowance
    const allow = await publicClient.readContract({ address: BPNTS, abi: erc20Abi, functionName: 'allowance', args: [ACCOUNT_C, SUPER_PAYMASTER] });
    console.log(`   🔓 bPNTs Allowance: ${formatEther(allow)}`);

    if (allow < parseEther("100")) {
        console.log("   ⚠️  Allowance low. Sending Approve Ops...");
        await sendUserOp(
            publicClient, bundlerClient, signer, ACCOUNT_C,
            BPNTS, 0n, 
            encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [SUPER_PAYMASTER, parseEther("1000000")] }),
            "0x"
        );
        console.log("   ✅ Approved.");
    }

    // 3. Prepare Transfer UserOp (aPNTs Transfer, bPNTs Gas)
    console.log("   🔄 Sending Test Transfer...");
    
    const transferData = encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [RECEIVER, parseEther("1")] });
    
    // SuperPaymaster: Address + Limits + (Optional) Mode
    const pmGasLimitsPlaceholder = packUint(300000n, 10000n);
    const pmAndDataForEst = concat([SUPER_PAYMASTER, pmGasLimitsPlaceholder, "0x" as Hex]);

    await sendUserOp(
        publicClient, bundlerClient, signer, ACCOUNT_C,
        APNTS, 0n, transferData, 
        pmAndDataForEst
    );
    console.log("   ✅ Group C Test Passed!");
}

async function sendUserOp(client: any, bundler: any, signer: any, sender: Address, target: Address, value: bigint, innerData: Hex, paymasterAndData: Hex) {
    const executeAbi = parseAbi(['function execute(address, uint256, bytes)']);
    const callData = encodeFunctionData({ abi: executeAbi, functionName: 'execute', args: [target, value, innerData] });
    
    const nonce = await client.readContract({
        address: ENTRY_POINT, 
        abi: [{ inputs: [{ name: "sender", type: "address" }, { name: "key", type: "uint192" }], name: "getNonce", outputs: [{ name: "nonce", type: "uint256" }], stateMutability: "view", type: "function" }],
        functionName: 'getNonce', args: [sender, 0n]
    });

    // 1. Estimation (Using Object Structure)
    const estOp = {
        sender,
        nonce: toHex(nonce),
        initCode: "0x" as Hex,
        callData,
        // Crucial Fix: Send hex strings, NOT raw packUint output if it was misinterpreted, 
        // BUT packUint ALREADY returns `0x...`.
        // The issue was that in `toHex(packUint(...))` -> packUint returns string "0x...", toHex converts that string to bytes!
        // So we strictly remove `toHex` wrapper for things that are already Hex strings.
        accountGasLimits: packUint(1000000n, 500000n), 
        preVerificationGas: toHex(100000n),
        gasFees: packUint(parseEther("50", "gwei"), parseEther("60", "gwei")),
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
    const pmVerif = BigInt(estRes.paymasterVerificationGasLimit ?? 100000n);
    const pmPost = BigInt(estRes.paymasterPostOpGasLimit ?? 10000n);

    const block = await client.getBlock();
    const priority = parseEther("5", "gwei");
    const maxFee = block.baseFeePerGas! * 2n + priority;

    // 2. Pack Final UserOp (For Hashing)
    const accountGasLimits = packUint(verificationGasLimit + 50000n, callGasLimit + 20000n);
    const gasFees = packUint(maxFee, priority);
    const pmGasLimits = packUint(pmVerif + 50000n, pmPost + 10000n);
    
    let finalPMAndData = "0x" as Hex;
    if (paymasterAndData !== "0x") {
        const pmAddr = paymasterAndData.slice(0, 42) as Hex;
        const pmData = ("0x" + paymasterAndData.slice(106)) as Hex;
        finalPMAndData = concat([pmAddr, pmGasLimits, pmData.length > 2 ? pmData : "0x" as Hex]);
    }

    const packedUserOp = {
        sender,
        nonce, // BigInt ok for ABI encoding
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
    
    // 3. Send Unpacked (Alchemy Format)
    // NOTE: For 'Unpacked' Alchemy format, we must separate Paymaster fields
    const unpackedUserOp = {
        sender,
        nonce: toHex(nonce),
        // factory/factoryData undefined for existing account
        callData,
        callGasLimit: toHex(callGasLimit + 20000n),
        verificationGasLimit: toHex(verificationGasLimit + 50000n),
        preVerificationGas: toHex(preVerificationGas),
        maxFeePerGas: toHex(maxFee),
        maxPriorityFeePerGas: toHex(priority),
        paymaster: finalPMAndData === "0x" ? undefined : finalPMAndData.slice(0, 42) as Hex,
        paymasterVerificationGasLimit: finalPMAndData === "0x" ? undefined : toHex(pmVerif + 50000n),
        paymasterPostOpGasLimit: finalPMAndData === "0x" ? undefined : toHex(pmPost + 10000n),
        paymasterData: finalPMAndData === "0x" ? undefined : ("0x" + finalPMAndData.slice(106)) as Hex,
        signature: sig
    };

    console.log("   🚀 Sending Unpacked...");
    const finalRes = await bundler.request({
        method: 'eth_sendUserOperation',
        params: [unpackedUserOp, ENTRY_POINT]
    });
    console.log(`   ✅ Sent: ${finalRes}`);
    
    for(let i=0; i<60; i++) { // Increased Wait
        const r = await bundler.request({ method: 'eth_getUserOperationReceipt', params: [finalRes] });
        if(r) {
            console.log(`   ✅ Mined: ${(r as any).receipt.transactionHash}`);
            return;
        }
        await new Promise(res => setTimeout(res, 2000));
    }
}

main().catch(console.error);
