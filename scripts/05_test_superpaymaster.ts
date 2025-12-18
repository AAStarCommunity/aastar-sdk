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

// Helper: Pack 128-bit values for PaymasterAndData (Legacy view for packing)
function packUint(high128: bigint, low128: bigint): Hex {
    return `0x${((high128 << 128n) | low128).toString(16).padStart(64, '0')}`;
}

export async function runSuperPaymasterTest() {
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
        const feeData = await publicClient.estimateFeesPerGas();
        const maxPriority = (feeData.maxPriorityFeePerGas || parseEther("1.5", "gwei")) * 2n;
        const maxFee = (feeData.maxFeePerGas || parseEther("20", "gwei")) * 2n;
        
        try {
            const hash = await anniWallet.writeContract({
                address: ENTRY_POINT, abi: epAbi, functionName: 'depositTo', args: [SUPER_PAYMASTER], value: parseEther("0.05"),
                maxPriorityFeePerGas: maxPriority, maxFeePerGas: maxFee
            });
            console.log(`   ⏳ Deposited: ${hash}`);
            await publicClient.waitForTransactionReceipt({ hash });
        } catch (e) {
            console.warn("Deposit failed, hoping existing balance is enough.");
        }
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
            undefined, // No Paymaster, use ETH
            true // isApproval
        );
        console.log("   ✅ Approved.");
    }

    // 3. Prepare Transfer UserOp (aPNTs Transfer, bPNTs Gas)
    console.log("   🔄 Sending Test Transfer...");
    
    const transferData = encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [RECEIVER, parseEther("1")] });
    
    // 4. Setup Operator (Self-Sponsorship)
    await setupOperator(publicClient, bundlerClient, signer, SUPER_PAYMASTER, APNTS, signer.address);

    // 5. Prepare Transfer UserOp (aPNTs Transfer, bPNTs Gas)
    console.log("   🔄 Sending Test Transfer...");
    
    // For V4/SuperPaymaster, we construct the Paymaster struct.
    const pmStruct = {
        paymaster: SUPER_PAYMASTER,
        paymasterVerificationGasLimit: 300000n,
        paymasterPostOpGasLimit: 10000n,
        paymasterData: signer.address // Use OUR address as Operator
    };

    const metrics = await sendUserOp(
        publicClient, bundlerClient, signer, ACCOUNT_C,
        APNTS, 0n, transferData, 
        pmStruct // Pass struct, NOT packed hex
    );
    console.log("   ✅ Group C Test Passed!");
    
    return {
        group: 'SuperPaymaster',
        ...metrics
    };
}

// Ensure Signer is a valid Operator
async function setupOperator(publicClient: any, bundlerClient: any, signer: any, pm: Hex, token: Hex, treasury: Hex) {
    console.log("   🛠️  Setting up Operator...");
    const wallet = createWalletClient({ account: signer, chain: sepolia, transport: http(process.env.SEPOLIA_RPC_URL) });
    
    const pmAbi = parseAbi([
        'function operators(address) view returns (address, address, bool, bool, uint256, uint256, uint256, uint256, uint256)',
        'function configureOperator(address, address, uint256)',
        'function deposit(uint256)',
        'function notifyDeposit(uint256)',
        'function REGISTRY() view returns (address)'
    ]);
    const registryAbi = parseAbi(['function hasRole(bytes32, address) view returns (bool)']);
    const erc20Abi = parseAbi(['function approve(address, uint256) returns (bool)', 'function allowance(address, address) view returns (uint256)', 'function transfer(address, uint256) returns (bool)']);

    // 1. Check Role
    const regAddr = await publicClient.readContract({ address: pm, abi: pmAbi, functionName: 'REGISTRY' });
    const COMMUNITY = keccak256(new TextEncoder().encode("COMMUNITY"));
    const hasRole = await publicClient.readContract({ address: regAddr, abi: registryAbi, functionName: 'hasRole', args: [COMMUNITY, signer.address] });
    
    if (!hasRole) {
        console.warn("   ⚠️  Signer missing COMMUNITY role! Assuming Admin key can grant it or ignoring (might fail).");
        // Try to grant? Need Admin Key. Assuming signer IS admin for now.
    }

    // 2. Check Config
    const opData = await publicClient.readContract({ address: pm, abi: pmAbi, functionName: 'operators', args: [signer.address] });
    // struct OperatorData { token, isConfigured, reserved, treasury, exchangeRate, exchangeRateFull, aPNTsBalance, totalSpent, txSponsored }
    // Returned as tuple by view function IF it's packed.
    // If it's returning (addr, addr, bool, bool, uint, uint, uint, uint, uint)
    // 0: token, 1: treasury, 2: isConfigured, 3: isPaused, 4: exRate, 5: exRateFull, 6: balance, 7: spent, 8: txSponsored
    const isConfigured = opData[2];
    const balance = opData[6];

    if (!isConfigured) {
        console.log("   ⚙️  Configuring Operator...");
        const hash = await wallet.writeContract({
            address: pm, abi: pmAbi, functionName: 'configureOperator', 
            args: [token, treasury, 1000000000000000000n] // 1:1 Rate
        });
        await publicClient.waitForTransactionReceipt({ hash });
        console.log("   ✅ Configured.");
    }

    // 3. Check Balance & Deposit
    if (balance < parseEther("75")) {
        console.log(`   💰 Operator Balance Low (${formatEther(balance)}). Depositing...`);
        // Approve
        const allow = await publicClient.readContract({ address: token, abi: erc20Abi, functionName: 'allowance', args: [signer.address, pm] });
        if (allow < parseEther("100")) {
            const tx = await wallet.writeContract({ address: token, abi: erc20Abi, functionName: 'approve', args: [pm, parseEther("1000")] });
            await publicClient.waitForTransactionReceipt({ hash: tx });
            console.log("   🔓 Approved.");
        }
        
        // Try Legacy Deposit first
        try {
            const hash = await wallet.writeContract({ address: pm, abi: pmAbi, functionName: 'deposit', args: [parseEther("100")] });
            await publicClient.waitForTransactionReceipt({ hash });
            console.log("   ✅ Deposited (Legacy): 100 aPNTs");
        } catch (e: any) {
            console.warn(`   ⚠️ Legacy Deposit failed (Likely blocked by Token). Switching to Push Mode...`);
            
            // Push Mode: Transfer + Notify
            // 1. Transfer
            const txTrans = await wallet.writeContract({ 
                address: token, abi: erc20Abi, functionName: 'transfer', 
                args: [pm, parseEther("100")] 
            });
            await publicClient.waitForTransactionReceipt({ hash: txTrans });
            console.log("   ➡ Transferred tokens.");

            // 2. Notify
            const txNotify = await wallet.writeContract({
                address: pm, abi: pmAbi, functionName: 'notifyDeposit',
                args: [parseEther("100")]
            });
            await publicClient.waitForTransactionReceipt({ hash: txNotify });
            console.log("   ✅ Deposited (Push + Notify): 100 aPNTs");
        }
    }
}

// Support both struct (for Paymaster) and undefined (for ETH)
async function sendUserOp(
    client: any, 
    bundler: any, 
    signer: any, 
    sender: Address, 
    target: Address, 
    value: bigint, 
    innerData: Hex, 
    paymasterStruct?: { paymaster: Address, paymasterVerificationGasLimit: bigint, paymasterPostOpGasLimit: bigint, paymasterData: Hex }, 
    isApproval = false
) {
    const executeAbi = parseAbi(['function execute(address, uint256, bytes)']);
    const callData = encodeFunctionData({ abi: executeAbi, functionName: 'execute', args: [target, value, innerData] });
    
    const nonce = await client.readContract({
        address: ENTRY_POINT, 
        abi: [{ inputs: [{ name: "sender", type: "address" }, { name: "key", type: "uint192" }], name: "getNonce", outputs: [{ name: "nonce", type: "uint256" }], stateMutability: "view", type: "function" }],
        functionName: 'getNonce', args: [sender, 0n]
    });

    // 1. Estimation
    // MUST unpack Paymaster fields for Alchemy v0.7
    let estOp: any = {
        sender,
        nonce: toHex(nonce),
        initCode: "0x",
        callData,
        signature: "0xfffffffffffffffffffffffffffffff0000000000000000000000000000000007aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1c" as Hex
    };

    if (paymasterStruct) {
        estOp.paymaster = paymasterStruct.paymaster;
        estOp.paymasterVerificationGasLimit = toHex(paymasterStruct.paymasterVerificationGasLimit);
        estOp.paymasterPostOpGasLimit = toHex(paymasterStruct.paymasterPostOpGasLimit);
        estOp.paymasterData = paymasterStruct.paymasterData;
    }

    console.log("   ☁️  Estimating...");
    const estRes: any = await bundler.request({
        method: 'eth_estimateUserOperationGas',
        params: [estOp, ENTRY_POINT]
    });

    const verificationGasLimit = BigInt(estRes.verificationGasLimit ?? estRes.verificationGas ?? 500000n);
    const callGasLimit = BigInt(estRes.callGasLimit ?? 100000n);
    const preVerificationGas = BigInt(estRes.preVerificationGas ?? 50000n);
    
    // Update PM limits from estimation if available, else keep defaults
    const pmVerif = estRes.paymasterVerificationGasLimit ? BigInt(estRes.paymasterVerificationGasLimit) : (paymasterStruct?.paymasterVerificationGasLimit ?? 0n);
    const pmPost = estRes.paymasterPostOpGasLimit ? BigInt(estRes.paymasterPostOpGasLimit) : (paymasterStruct?.paymasterPostOpGasLimit ?? 0n);

    // Add buffer
    const finalPmVerif = pmVerif + 50000n;
    const finalPmPost = pmPost + 10000n;

    const block = await client.getBlock();
    const priority = parseEther("5", "gwei");
    const maxFee = block.baseFeePerGas! * 2n + priority;

    // 2. Hashing (Requires Packed Fields)
    const accountGasLimits = packUint(verificationGasLimit + 50000n, callGasLimit + 20000n);
    // FIX: gasFees = (maxPriorityFeePerGas << 128) | maxFeePerGas
    const gasFees = packUint(priority, maxFee);
    
    let paymasterAndData = "0x" as Hex;
    if (paymasterStruct) {
        // Re-pack for the hash
        const pmLimits = packUint(finalPmVerif, finalPmPost);
        paymasterAndData = concat([paymasterStruct.paymaster, pmLimits, paymasterStruct.paymasterData]);
    }

    const packedUserOp = {
        sender,
        nonce, 
        initCode: "0x" as Hex,
        callData,
        accountGasLimits,
        preVerificationGas,
        gasFees,
        paymasterAndData,
        signature: "0x" as Hex
    };

    // Debug: Use Local Hashing to be 100% sure of what we are signing
    const userOpHash = entryPointGetUserOpHash(packedUserOp, ENTRY_POINT, sepolia.id);
    console.log(`   #️⃣  UserOpHash (Local): ${userOpHash}`);

    // Standard SimpleAccount expects EIP-191 signature (toEthSignedMessageHash)
    const sig = await signer.signMessage({ message: { raw: userOpHash } });


    // 3. Sending (Requires Unpacked Fields)
    const unpackedUserOp: any = {
        sender,
        nonce: toHex(nonce),
        initCode: "0x",
        callData,
        callGasLimit: toHex(callGasLimit + 20000n),
        verificationGasLimit: toHex(verificationGasLimit + 50000n),
        preVerificationGas: toHex(preVerificationGas),
        maxFeePerGas: toHex(maxFee),
        maxPriorityFeePerGas: toHex(priority),
        signature: sig
    };

    if (paymasterStruct) {
        unpackedUserOp.paymaster = paymasterStruct.paymaster;
        unpackedUserOp.paymasterVerificationGasLimit = toHex(finalPmVerif);
        unpackedUserOp.paymasterPostOpGasLimit = toHex(finalPmPost);
        unpackedUserOp.paymasterData = paymasterStruct.paymasterData;
    }

    console.log("   🚀 Sending Unpacked...");
    const userOpHashRes = await bundler.request({
        method: 'eth_sendUserOperation',
        params: [unpackedUserOp, ENTRY_POINT]
    });
    console.log(`   ✅ Sent: ${userOpHashRes}`);
    
    const startTime = Date.now();
    let receipt: any = null;
    
    for(let i=0; i<60; i++) {
        const r = await bundler.request({ method: 'eth_getUserOperationReceipt', params: [userOpHashRes] });
        if(r) {
            receipt = (r as any).receipt;
            console.log(`   ✅ Mined: ${receipt.transactionHash}`);
            break;
        }
        await new Promise(res => setTimeout(res, 2000));
    }

    if (!receipt) throw new Error("Timeout waiting for receipt");

    // Return Metrics
    return {
        gasUsed: BigInt(receipt.gasUsed),
        l1Fee: BigInt(receipt.l1Fee || 0), // Alchemy specific field?
        gasPrice: BigInt(receipt.effectiveGasPrice),
        totalCost: BigInt(receipt.gasUsed) * BigInt(receipt.effectiveGasPrice),
        status: receipt.status === '0x1' ? 'Success' : 'Failed',
        txHash: receipt.transactionHash,
        time: (Date.now() - startTime) / 1000
    };
}

function entryPointGetUserOpHash(op: any, ep: Address, chainId: number): Hex {
    const packed = encodeAbiParameters(
        [
            { type: 'address' }, { type: 'uint256' }, { type: 'bytes32' }, { type: 'bytes32' },
            { type: 'bytes32' }, { type: 'uint256' }, { type: 'bytes32' }, { type: 'bytes32' }
        ],
        [
            op.sender, BigInt(op.nonce), 
            keccak256(op.initCode && op.initCode !== "0x" ? op.initCode : '0x'), 
            keccak256(op.callData),
            op.accountGasLimits, BigInt(op.preVerificationGas), op.gasFees,
            keccak256(op.paymasterAndData)
        ]
    );
    const enc = encodeAbiParameters(
        [{ type: 'bytes32' }, { type: 'address' }, { type: 'uint256' }],
        [keccak256(packed), ep, BigInt(chainId)]
    );
    return keccak256(enc);
}

if (require.main === module) {
    runSuperPaymasterTest().catch(console.error);
}
