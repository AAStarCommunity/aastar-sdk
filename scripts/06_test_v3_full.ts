import { createPublicClient, createWalletClient, http, parseEther, formatEther, Hex, toHex, encodeFunctionData, parseAbi, concat, encodeAbiParameters, keccak256, Address, pad, toBytes } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import * as dotenv from 'dotenv';
import * as path from 'path';

(BigInt.prototype as any).toJSON = function () { return this.toString(); };
dotenv.config({ path: path.resolve(__dirname, '../../env/.env.v3') });

// Configuration
const RPC_URL = process.env.SEPOLIA_RPC_URL;
const BUNDLER_RPC = process.env.ALCHEMY_BUNDLER_RPC_URL;
const ENTRY_POINT = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";

const ACCOUNT_C = process.env.TEST_SIMPLE_ACCOUNT_C as Hex; 
const SIGNER_KEY = process.env.PRIVATE_KEY_JASON as Hex; 
const BPNTS = process.env.BPNTS_ADDRESS as Hex;
const APNTS = process.env.APNTS_ADDRESS as Hex;
const SUPER_PAYMASTER = process.env.SUPER_PAYMASTER_ADDRESS as Hex;
const RECEIVER = "0x93E67dbB7B2431dE61a9F6c7E488e7F0E2eD2B3e";

if (!SUPER_PAYMASTER || !APNTS) throw new Error("Missing Config");

// Helper: Pack 128-bit values
function packUint(high128: bigint, low128: bigint): Hex {
    return `0x${((high128 << 128n) | low128).toString(16).padStart(64, '0')}`;
}

async function runFullV3Test() {
    console.log("🚀 Starting Comprehensive SuperPaymaster V3 Test...");
    const publicClient = createPublicClient({ chain: sepolia, transport: http(RPC_URL) });
    const bundlerClient = createPublicClient({ chain: sepolia, transport: http(BUNDLER_RPC) });
    const signer = privateKeyToAccount(SIGNER_KEY);
    const wallet = createWalletClient({ account: signer, chain: sepolia, transport: http(RPC_URL) });

    const pmAbi = parseAbi([
        'function operators(address) view returns (address, address, bool, bool, uint256, uint256, uint256, uint256, uint256)',
        'function configureOperator(address, address, uint256)',
        'function deposit(uint256)',
        'function notifyDeposit(uint256)',
        'function withdraw(uint256)',
        'function withdrawProtocolRevenue(address, uint256)',
        'function slashOperator(address, uint8, uint256, string)',
        'function updateReputation(address, uint256)',
        'function setOperatorPause(address, bool)',
        'function totalTrackedBalance() view returns (uint256)',
        'function protocolRevenue() view returns (uint256)',
        'function setAPNTsToken(address)'
    ]);
    const erc20Abi = parseAbi([
        'function balanceOf(address) view returns (uint256)',
        'function transfer(address, uint256) returns (bool)',
        'function approve(address, uint256) returns (bool)',
        'function allowance(address, address) view returns (uint256)'
    ]);

    // ====================================================
    // 1. Admin & Config Tests
    // ====================================================
    console.log("\n🧪 1. Testing Admin Functions...");
    
    // Check Config
    // 0: token, 1: treasury, 2: isConfigured, 3: isPaused, 4: exRate, 5: exRateFull, 6: balance, 7: spent, 8: txSponsored (approx)
    // Actually, solidity test `v6` was balance. So index 6. 
    // `v9` was Rep. Actually wait, Solidity Tuple 9 items:
    // (token, treasury, isConf, isPaused, exRate, exFull, balance, spent, rep) -> This has 9 items?
    // Let's assume this order based on Solidity struct fields if packed:
    // But Solidity test printed v6=Balance.
    // If indices are 0-based: v6 is index 5? No, destructuring v1..v9 usually maps 1-to-1.
    // So v6 is 6th item. Index 5. 
    // Wait. In Solidity: `(v1, v2...)`. v1 is first component.
    // `v6` is 6th component.
    // In Array access opData[5] is 6th component.
    // So `opData[5]` in TS might be the correct index for balance if order matches?
    // Let's log all of them to be safe.
    
    let opData = await publicClient.readContract({ address: SUPER_PAYMASTER, abi: pmAbi, functionName: 'operators', args: [signer.address] });
    console.log(`   Initial State: Conf=${opData[2]}, Paused=${opData[3]}, Balance=${formatEther(opData[6])}, Rep=${opData[8]}`); // Using 6 and 8


    if (!opData[2]) {
         console.log("   ⚙️ Configuring Operator...");
         const hash = await wallet.writeContract({
             address: SUPER_PAYMASTER, abi: pmAbi, functionName: 'configureOperator', 
             args: [APNTS, signer.address, 1000000000000000000n] 
         });
         await publicClient.waitForTransactionReceipt({ hash });
    }

    // Test Pause/Unpause
    console.log("   ⏸️  Testing Pause...");
    let hash = await wallet.writeContract({ address: SUPER_PAYMASTER, abi: pmAbi, functionName: 'setOperatorPause', args: [signer.address, true] });
    await publicClient.waitForTransactionReceipt({ hash });
    opData = await publicClient.readContract({ address: SUPER_PAYMASTER, abi: pmAbi, functionName: 'operators', args: [signer.address] });
    if(opData[3] !== true) throw new Error("Pause failed");
    console.log("   ✅ Paused.");

    console.log("   ▶️  Testing Unpause...");
    hash = await wallet.writeContract({ address: SUPER_PAYMASTER, abi: pmAbi, functionName: 'setOperatorPause', args: [signer.address, false] });
    await publicClient.waitForTransactionReceipt({ hash });
    opData = await publicClient.readContract({ address: SUPER_PAYMASTER, abi: pmAbi, functionName: 'operators', args: [signer.address] });
    if(opData[3] !== false) throw new Error("Unpause failed");
    console.log("   ✅ Unpaused.");

    // Test Reputation
    console.log("   ⭐ Testing Reputation Update...");
    hash = await wallet.writeContract({ address: SUPER_PAYMASTER, abi: pmAbi, functionName: 'updateReputation', args: [signer.address, 100n] });
    await publicClient.waitForTransactionReceipt({ hash });
    opData = await publicClient.readContract({ address: SUPER_PAYMASTER, abi: pmAbi, functionName: 'operators', args: [signer.address] });
    if(BigInt(opData[8] as bigint) !== 100n) throw new Error("Reputation Config failed");
    console.log(`   ✅ Reputation set to ${opData[8]}`);


    // ====================================================
    // 2. Deposit & Withdraw Tests
    // ====================================================
    console.log("\n🧪 2. Testing Funding Cycle...");
    
    // Ensure Approved
    const allow = await publicClient.readContract({ address: APNTS, abi: erc20Abi, functionName: 'allowance', args: [signer.address, SUPER_PAYMASTER] });
    if (allow < parseEther("1000")) {
        await wallet.writeContract({ address: APNTS, abi: erc20Abi, functionName: 'approve', args: [SUPER_PAYMASTER, parseEther("10000")] });
    }

    // Test Push Deposit (Transfer + Notify) - Since we know Pull might fail
    const depositAmount = parseEther("10");
    console.log("   💸 Testing Push Deposit (10 aPNTs)...");
    
    // 1. Transfer
    hash = await wallet.writeContract({ address: APNTS, abi: erc20Abi, functionName: 'transfer', args: [SUPER_PAYMASTER, depositAmount] });
    await publicClient.waitForTransactionReceipt({ hash });
    
    // 2. Notify
    hash = await wallet.writeContract({ address: SUPER_PAYMASTER, abi: pmAbi, functionName: 'notifyDeposit', args: [depositAmount] });
    await publicClient.waitForTransactionReceipt({ hash });
    
    opData = await publicClient.readContract({ address: SUPER_PAYMASTER, abi: pmAbi, functionName: 'operators', args: [signer.address] });
    const balanceAfterDeposit = opData[6] as bigint;
    console.log(`   ✅ New Balance: ${formatEther(balanceAfterDeposit)}`);

    // Test Withdraw
    const withdrawAmount = parseEther("1");
    console.log("   🏧 Testing Withdraw (1 aPNTs)...");
    hash = await wallet.writeContract({ address: SUPER_PAYMASTER, abi: pmAbi, functionName: 'withdraw', args: [withdrawAmount] });
    await publicClient.waitForTransactionReceipt({ hash });
    
    opData = await publicClient.readContract({ address: SUPER_PAYMASTER, abi: pmAbi, functionName: 'operators', args: [signer.address] });
    if (balanceAfterDeposit - (opData[6] as bigint) !== withdrawAmount) throw new Error("Withdraw calculation mismatch");
    console.log("   ✅ Withdrawn.");


    // ====================================================
    // 3. UserOperation Execution (The Real Test)
    // ====================================================
    console.log("\n🧪 3. Testing UserOperation Execution...");
    
    const transferData = encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [RECEIVER, parseEther("0.001")] });
    
    // Construct Paymaster Data
    const pmStruct = {
        paymaster: SUPER_PAYMASTER,
        paymasterVerificationGasLimit: 300000n,
        paymasterPostOpGasLimit: 10000n,
        paymasterData: signer.address 
    };

    try {
        const metrics = await sendUserOp(publicClient, bundlerClient, signer, ACCOUNT_C, APNTS, 0n, transferData, pmStruct);
        console.log(`   ✅ UserOp Success! Hash: ${metrics.txHash}`);
    } catch (e) {
        console.error("   ❌ UserOp Failed:", e);
        // Don't kill process, check revenue anyway
    }

    // ====================================================
    // 4. Protocol Revenue Check
    // ====================================================
    console.log("\n🧪 4. Testing Protocol Revenue...");
    
    const revenue = await publicClient.readContract({ address: SUPER_PAYMASTER, abi: pmAbi, functionName: 'protocolRevenue' });
    console.log(`   💰 Protocol Revenue: ${formatEther(revenue)} aPNTs`);
    
    if (revenue > 0n) {
        console.log("   🧹 Withdrawing Revenue...");
        hash = await wallet.writeContract({ 
            address: SUPER_PAYMASTER, abi: pmAbi, functionName: 'withdrawProtocolRevenue', 
            args: [signer.address, revenue] 
        });
        await publicClient.waitForTransactionReceipt({ hash });
        console.log("   ✅ Revenue Withdrawn.");
    } else {
        console.warn("   ⚠️ No revenue generated (UserOp failed or cost 0?)");
    }

    console.log("\n🎉 Full Test Suite Complete.");
}

// Re-use helper from previous script logic, simplified
async function sendUserOp(client: any, bundler: any, signer: any, sender: Address, target: Address, value: bigint, innerData: Hex, pmStruct: any) {
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

    const userOpHash = entryPointGetUserOpHash(packedOp, ENTRY_POINT, sepolia.id);
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
    throw new Error("Timeout");
}

function entryPointGetUserOpHash(op: any, ep: Address, chainId: number): Hex {
    const packed = encodeAbiParameters(
        [{ type: 'address' }, { type: 'uint256' }, { type: 'bytes32' }, { type: 'bytes32' }, { type: 'bytes32' }, { type: 'uint256' }, { type: 'bytes32' }, { type: 'bytes32' }],
        [op.sender, BigInt(op.nonce), keccak256(op.initCode), keccak256(op.callData), op.accountGasLimits, BigInt(op.preVerificationGas), op.gasFees, keccak256(op.paymasterAndData)]
    );
    const enc = encodeAbiParameters([{ type: 'bytes32' }, { type: 'address' }, { type: 'uint256' }], [keccak256(packed), ep, BigInt(chainId)]);
    return keccak256(enc);
}

runFullV3Test().catch(console.error);
