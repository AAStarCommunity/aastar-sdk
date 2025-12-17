import { createPublicClient, createWalletClient, http, parseEther, formatEther, Hex, toHex, encodeFunctionData, parseAbi, concat, encodeAbiParameters, keccak256, Address, zeroAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import * as dotenv from 'dotenv';
import * as path from 'path';

(BigInt.prototype as any).toJSON = function () { return this.toString(); };
dotenv.config({ path: path.resolve(__dirname, '../../env/.env.v3') });

const RPC_URL = process.env.SEPOLIA_RPC_URL;
const BUNDLER_RPC = process.env.ALCHEMY_BUNDLER_RPC_URL;
const ENTRY_POINT = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";

const ACCOUNT_B = process.env.TEST_SIMPLE_ACCOUNT_B as Hex; 
const SIGNER_KEY = process.env.PRIVATE_KEY_JASON as Hex; // Jason owns the accounts
const BPNTS = process.env.BPNTS_ADDRESS as Hex;
const PAYMASTER_V4 = process.env.PAYMASTER_V4_ADDRESS as Hex;
const RECEIVER = "0x93E67dbB7B2431dE61a9F6c7E488e7F0E2eD2B3e";

if (!BUNDLER_RPC || !BPNTS || !PAYMASTER_V4) throw new Error("Missing Config for Group B");

// Helper to Pack v0.7 Fields
function packUint(high128: bigint, low128: bigint): Hex {
    return `0x${((high128 << 128n) | low128).toString(16).padStart(64, '0')}`;
}

async function main() {
    console.log("🚀 Starting Group B: Paymaster V4 (AOA Mode)...");
    console.log(`   👤 Sender: ${ACCOUNT_B}`);
    console.log(`   🏭 Paymaster: ${PAYMASTER_V4}`);
    console.log(`   💎 Token: ${BPNTS}`);

    const publicClient = createPublicClient({ chain: sepolia, transport: http(RPC_URL) });
    const bundlerClient = createPublicClient({ chain: sepolia, transport: http(BUNDLER_RPC) });
    const signer = privateKeyToAccount(SIGNER_KEY);

    // ABIs
    const erc20Abi = parseAbi([
        'function balanceOf(address) view returns (uint256)',
        'function transfer(address, uint256) returns (bool)',
        'function approve(address, uint256) returns (bool)',
        'function allowance(address, address) view returns (uint256)'
    ]);
    const executeAbi = parseAbi(['function execute(address, uint256, bytes)']);

    // 1. Check Allowance & Balance
    const bal = await publicClient.readContract({ address: BPNTS, abi: erc20Abi, functionName: 'balanceOf', args: [ACCOUNT_B] });
    const allow = await publicClient.readContract({ address: BPNTS, abi: erc20Abi, functionName: 'allowance', args: [ACCOUNT_B, PAYMASTER_V4] });
    
    console.log(`   💰 Balance: ${formatEther(bal)}`);
    console.log(`   🔓 Allowance: ${formatEther(allow)}`);

    if (allow < parseEther("100")) {
        console.log("   ⚠️  Allowance too low. Sending 'Approve' UserOp (ETH paid)...");
        await sendUserOp(
            publicClient, bundlerClient, signer, ACCOUNT_B,
            BPNTS, 0n, 
            encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [PAYMASTER_V4, parseEther("1000000")] }),
            "0x" // No Paymaster (ETH)
        );
        console.log("   ✅ Approved.");
    }

    // 2. Prepare Test Transfer UserOp (Paid by Paymaster)
    console.log("   🔄 Sending Test Transfer (Paid by Paymaster)...");
    
    // CallData: Transfer 1 bPNTs
    const transferData = encodeFunctionData({
        abi: erc20Abi, functionName: 'transfer', args: [RECEIVER, parseEther("1")]
    });

    // PaymasterAndData: Just the address for AOA V4
    // Pack: address (20) + gas limit (32)?
    // V0.7 PaymasterAndData = paymaster + paymasterVerificationGasLimit + ... + data
    // When we estimate, we can provide a dummy.
    // For V4, typically only the address is needed if no special logic.
    // BUT Bundler v0.7 expects structured fields.
    // We will let `eth_estimateUserOperationGas` figure out the limits if we provide the Paymaster address stub.
    
    // Construct Partial for Estimation
    const callData = encodeFunctionData({ abi: executeAbi, functionName: 'execute', args: [BPNTS, 0n, transferData] });
    const nonce = await publicClient.readContract({ address: ENTRY_POINT, abi: parseAbi(['function getNonce(address,uint192) view returns(uint256)']), functionName: 'getNonce', args: [ACCOUNT_B, 0n] });

    // Dummy Gas Limits for Estimation
    const estimateOp = {
        sender: ACCOUNT_B,
        nonce: toHex(nonce),
        factory: undefined, factoryData: undefined,
        callData,
        paymaster: PAYMASTER_V4, // This is a special field for estimation in some bundlers, or part of paymasterAndData
        // For v0.7 estimation, we pass 'paymasterAndData' packed?
        // Let's try passing fields individually if supported, or packed.
        // Alchemy 0.7 supports: paymaster, paymasterData...
        paymasterVerificationGasLimit: "0x100000",
        paymasterPostOpGasLimit: "0x10000",
        paymasterData: "0x",
        signature: "0x" + "ff".repeat(65) // Dummy signature
    };

    // Pack into paymasterAndData for estimation if needed
    // But better to ask Bundler to estimate.
    console.log("   ☁️  Estimating Gas...");
    
    // Note: Some bundlers require properly packed paymasterAndData even for estimation.
    const pmGasLimits = packUint(100000n, 10000n);
    const pmAndDataPacked = concat([PAYMASTER_V4, pmGasLimits]); 

    // We use a simplified estimation call or assume reasonable limits if estimation is flaky
    const estimated = await bundlerClient.request({
        method: 'eth_estimateUserOperationGas',
        params: [
            {
                ...estimateOp,
                paymasterAndData: pmAndDataPacked,
                // Gas limits to 0 to signal estimation
                callGasLimit: "0x0", verificationGasLimit: "0x0", preVerificationGas: "0x0"
            }, 
            ENTRY_POINT
        ]
    });

    const { preVerificationGas, verificationGasLimit, callGasLimit, paymasterVerificationGasLimit, paymasterPostOpGasLimit } = estimated;
    
    // 3. Submit Final
    const finalPMGasLimits = packUint(BigInt(paymasterVerificationGasLimit), BigInt(paymasterPostOpGasLimit));
    const finalPMAndData = concat([PAYMASTER_V4, finalPMGasLimits]); // No extra data for V4 AOA

    const limits = packUint(BigInt(verificationGasLimit) + 50000n, BigInt(callGasLimit) + 20000n); // Buffer
    const fees = packUint(parseEther("0.00000005"), parseEther("0.00000005")); // 50 gwei (Sepolia high)

    await sendUserOp(
        publicClient, bundlerClient, signer, ACCOUNT_B,
        BPNTS, 0n, transferData, // Not used here directly, we use raw UserOp construction below
        finalPMAndData,
        { 
            preVerificationGas: BigInt(preVerificationGas),
            accountGasLimits: limits,
            gasFees: fees,
            callData // Reuse callData from above
        } 
    );
    console.log("   ✅ Group B Test Passed!");
}

async function sendUserOp(publicClient: any, bundlerClient: any, signer: any, sender: Address, target: Address, value: bigint, innerData: Hex, paymasterAndData: Hex, gasOverrides?: any) {
    const executeAbi = parseAbi(['function execute(address, uint256, bytes)']);
    const callData = gasOverrides?.callData || encodeFunctionData({ abi: executeAbi, functionName: 'execute', args: [target, value, innerData] });
    
    const nonce = await publicClient.readContract({ address: ENTRY_POINT, abi: parseAbi(['function getNonce(address,uint192) view returns(uint256)']), functionName: 'getNonce', args: [sender, 0n] });

    let op: any = {
        sender,
        nonce: toHex(nonce),
        factory: undefined, factoryData: undefined,
        callData,
        callGasLimit: "0x100000", verificationGasLimit: "0x100000", preVerificationGas: "0x10000",
        maxFeePerGas: "0x3B9ACA00", // 1 gwei
        maxPriorityFeePerGas: "0x3B9ACA00",
        paymasterAndData: paymasterAndData,
        signature: "0x"
    };

    if (gasOverrides) {
        op = { ...op, ...gasOverrides };
    } else {
        // Estimate if not overridden (for the Approve step)
        // ... simple estimation logic or fixed high gas for approval
        const accountLimits = packUint(500000n, 100000n); 
        const fees = packUint(parseEther("0.00000002"), parseEther("0.00000002")); // 20 gwei
        op.accountGasLimits = accountLimits;
        op.gasFees = fees;
        op.preVerificationGas = 100000n;
    }

    // Sign
    const hash = await entryPointGetUserOpHash(publicClient, op, ENTRY_POINT, sepolia.id);
    op.signature = await signer.signMessage({ message: { raw: hash } });

    // Send
    const uoHash = await bundlerClient.request({ method: 'eth_sendUserOperation', params: [op, ENTRY_POINT] });
    console.log(`   🚀 Sent UserOp: ${uoHash}`);
    await waitForUserOp(bundlerClient, uoHash as Hex);
}

// Reuse helper (can be imported if module usage was better, but copying for safety in single file execution)
async function entryPointGetUserOpHash(client: any, op: any, ep: Address, chainId: number): Promise<Hex> {
    const packed = encodeAbiParameters(
        [
            { type: 'address' }, { type: 'uint256' }, { type: 'bytes32' }, { type: 'bytes32' },
            { type: 'bytes32' }, { type: 'uint256' }, { type: 'bytes32' }, { type: 'bytes32' }
        ],
        [
            op.sender, BigInt(op.nonce), 
            keccak256(op.factory ? concat([op.factory, op.factoryData]) : '0x'), 
            keccak256(op.callData),
            op.accountGasLimits || packUint(BigInt(op.verificationGasLimit), BigInt(op.callGasLimit)), 
            BigInt(op.preVerificationGas),
            op.gasFees || packUint(BigInt(op.maxFeePerGas), BigInt(op.maxPriorityFeePerGas)),
            keccak256(op.paymasterAndData)
        ]
    );
    const enc = encodeAbiParameters(
        [{ type: 'bytes32' }, { type: 'address' }, { type: 'uint256' }],
        [keccak256(packed), ep, BigInt(chainId)]
    );
    return keccak256(enc);
}

async function waitForUserOp(client: any, hash: Hex) {
    for(let i=0; i<30; i++) {
        const res = await client.request({ method: 'eth_getUserOperationReceipt', params: [hash] });
        if (res) return;
        await new Promise(r => setTimeout(r, 2000));
    }
    throw new Error("Timeout waiting for UserOp");
}

main().catch(console.error);
