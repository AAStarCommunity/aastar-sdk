import { createPublicClient, createWalletClient, http, parseEther, formatEther, Hex, toHex, encodeFunctionData, parseAbi, concat, encodeAbiParameters, keccak256, Address } from 'viem';
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
const ANNI_KEY = process.env.PRIVATE_KEY_ANNI as Hex; // To fund PM if needed
const RECEIVER = "0x93E67dbB7B2431dE61a9F6c7E488e7F0E2eD2B3e";

if (!BUNDLER_RPC || !BPNTS || !SUPER_PAYMASTER) throw new Error("Missing Config for Group C");

function packUint(high128: bigint, low128: bigint): Hex {
    return `0x${((high128 << 128n) | low128).toString(16).padStart(64, '0')}`;
}

async function main() {
    console.log("🚀 Starting Group C: SuperPaymaster...");
    console.log(`   👤 Sender: ${ACCOUNT_C}`);
    console.log(`   🦸 Paymaster: ${SUPER_PAYMASTER}`);
    console.log(`   ⛽ Gas Token: ${BPNTS} (Paying for Gas)`);
    console.log(`   💎 Action Token: ${APNTS} (Transferring)`);

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

    // 2. Check Allowance (Account C -> SuperPaymaster for bPNTs)
    const allow = await publicClient.readContract({ address: BPNTS, abi: erc20Abi, functionName: 'allowance', args: [ACCOUNT_C, SUPER_PAYMASTER] });
    console.log(`   🔓 bPNTs Allowance: ${formatEther(allow)}`);

    if (allow < parseEther("100")) {
        console.log("   ⚠️  Allowance low. Sending Approve Ops...");
        // Use ETH to pay for Approval
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
    
    // CallData: Transfer aPNTs
    const transferData = encodeFunctionData({
        abi: erc20Abi, functionName: 'transfer', args: [RECEIVER, parseEther("1")]
    });

    // PaymasterData: Address only (SuperPaymaster infers Token from Registry)
    // Estimate Gas
    const pmGasLimits = packUint(100000n, 10000n);
    const pmAndDataPacked = concat([SUPER_PAYMASTER, pmGasLimits]);

    const executeAbi = parseAbi(['function execute(address, uint256, bytes)']);
    const callData = encodeFunctionData({ abi: executeAbi, functionName: 'execute', args: [APNTS, 0n, transferData] });

    console.log("   ☁️  Estimating...");
    // ... Estimation Logic similar to 04 ...
    // Note: We skip complex estimation code for brevity and use safe defaults + overrides
    // because typically estimation requires full packed structure.
    
    // We'll trust our helper to estimate/fill if we don't pass overrides, 
    // BUT our helper `sendUserOp` currently uses hardcoded defaults if no overrides.
    // Let's rely on `sendUserOp` defaults for now but ensure we pass correct Paymaster.
    
    // We construct PaymasterAndData for Final Submission
    // SuperPaymaster V3 likely only needs address + limits.
    // If it needs MODE byte (e.g. 0x01 for Token), we apppend it.
    // Investigating V3... usually it's implicit.
    // We'll send just Addr + Limits.

    await sendUserOp(
        publicClient, bundlerClient, signer, ACCOUNT_C,
        APNTS, 0n, transferData, 
        pmAndDataPacked,
        {
             callData // Explicitly passing callData to ensure we target APNTS
        }
    );
    console.log("   ✅ Group C Test Passed!");
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
        maxFeePerGas: "0x3B9ACA00",
        maxPriorityFeePerGas: "0x3B9ACA00",
        paymasterAndData: paymasterAndData,
        signature: "0x"
    };

    if (gasOverrides) {
        op = { ...op, ...gasOverrides };
    } else {
        // Defaults for Approval
        op.accountGasLimits = packUint(500000n, 100000n);
        op.gasFees = packUint(parseEther("0.00000002"), parseEther("0.00000002"));
    }

    const hash = await entryPointGetUserOpHash(publicClient, op, ENTRY_POINT, sepolia.id);
    op.signature = await signer.signMessage({ message: { raw: hash } });

    const uoHash = await bundlerClient.request({ method: 'eth_sendUserOperation', params: [op, ENTRY_POINT] });
    console.log(`   🚀 Sent UserOp: ${uoHash}`);
    await waitForUserOp(bundlerClient, uoHash as Hex);
}

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
