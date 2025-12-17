import { createPublicClient, createWalletClient, http, parseEther, formatEther, Hex, toHex, encodeFunctionData, parseAbi, concat, encodeAbiParameters, keccak256, Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Fix BigInt serialization
(BigInt.prototype as any).toJSON = function () { return this.toString(); };

dotenv.config({ path: path.resolve(__dirname, '../../env/.env.v3') });

const RPC_URL = process.env.SEPOLIA_RPC_URL;
const BUNDLER_RPC = process.env.ALCHEMY_BUNDLER_RPC_URL;
const PIMLICO_API_KEY = process.env.PIMLICO_API_KEY;
const PIMLICO_RPC = `https://api.pimlico.io/v2/sepolia/rpc?apikey=${PIMLICO_API_KEY}`;
const ENTRY_POINT = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";

const ACCOUNT_ADDRESS = process.env.TEST_SIMPLE_ACCOUNT_A as Hex; 
const SIGNER_KEY = process.env.PRIVATE_KEY_JASON as Hex; // Jason owns A
const PIM_TOKEN = "0xFC3e86566895Fb007c6A0d3809eb2827DF94F751";
const APNTS_ADDRESS = process.env.APNTS_ADDRESS as Hex;
const RECEIVER = "0x93E67dbB7B2431dE61a9F6c7E488e7F0E2eD2B3e";

if (!BUNDLER_RPC || !PIMLICO_API_KEY || !APNTS_ADDRESS) throw new Error("Missing Config");

// Helper to Pack v0.7 Fields
function packUint(high128: bigint, low128: bigint): Hex {
    return `0x${((high128 << 128n) | low128).toString(16).padStart(64, '0')}`;
}

async function main() {
    console.log("🚀 Starting Standard AA Test (Pimlico ERC20)...");

    const publicClient = createPublicClient({ chain: sepolia, transport: http(RPC_URL) });
    const pimlicoClient = createPublicClient({ chain: sepolia, transport: http(PIMLICO_RPC) });
    const bundlerClient = createPublicClient({ chain: sepolia, transport: http(BUNDLER_RPC) });
    
    // Check PIM Balance
    const erc20Abi = parseAbi([
        'function balanceOf(address) view returns (uint256)',
        'function transfer(address, uint256) returns (bool)',
        'function approve(address, uint256) returns (bool)'
    ]);
    
    const pimBal = await publicClient.readContract({ address: PIM_TOKEN, abi: erc20Abi, functionName: 'balanceOf', args: [ACCOUNT_ADDRESS] });
    console.log(`   ⛽ PIM Balance (A): ${formatEther(pimBal)}`);
    if (pimBal < parseEther("1")) console.log("   ⚠️  Low PIM Balance! Test might fail.");

    // Check aPNTs Balance
    const apntsBal = await publicClient.readContract({ address: APNTS_ADDRESS, abi: erc20Abi, functionName: 'balanceOf', args: [ACCOUNT_ADDRESS] });
    console.log(`   💎 aPNTs Balance (A): ${formatEther(apntsBal)}`);

    const signer = privateKeyToAccount(SIGNER_KEY);

    // 1. Prepare CallData: Transfer aPNTs
    const innerCallData = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'transfer',
        args: [RECEIVER, parseEther("1")]
    });

    const executeAbi = parseAbi(['function execute(address, uint256, bytes)']);
    const userOpCallData = encodeFunctionData({
        abi: executeAbi,
        functionName: 'execute',
        args: [APNTS_ADDRESS, 0n, innerCallData]
    });

    // 2. Get Nonce
    const nonce = await publicClient.readContract({
        address: ENTRY_POINT,
        abi: parseAbi(['function getNonce(address, uint192) view returns (uint256)']),
        functionName: 'getNonce',
        args: [ACCOUNT_ADDRESS, 0n]
    });
    console.log(`   🔢 Nonce: ${nonce}`);

    // 3. Construct UserOp
    const userOp = {
        sender: ACCOUNT_ADDRESS,
        nonce: toHex(nonce),
        factory: undefined,
        factoryData: undefined,
        callData: userOpCallData,
        callGasLimit: "0x1",
        verificationGasLimit: "0x1",
        preVerificationGas: "0x1", 
        maxFeePerGas: "0x1",
        maxPriorityFeePerGas: "0x1",
        signature: "0x"
    };

    // 4. Request Sponsorship
    console.log("   ☁️  Requesting Sponsorship (PIM)...");
    try {
        const sponsorship: any = await pimlicoClient.request({
            method: 'pm_sponsorUserOperation',
            params: [
                userOp,
                {
                    entryPoint: ENTRY_POINT,
                    sponsorshipPolicyId: "erc20-token",
                    token: PIM_TOKEN
                }
            ]
        });

        const { paymaster, paymasterData, preVerificationGas, verificationGasLimit, callGasLimit, paymasterVerificationGasLimit, paymasterPostOpGasLimit, maxFeePerGas, maxPriorityFeePerGas } = sponsorship;
        console.log(`   ✅ Sponsored! Paymaster: ${paymaster}`);

        // 5. Pack & Sign
        const accountGasLimits = packUint(BigInt(verificationGasLimit), BigInt(callGasLimit));
        const gasFees = packUint(BigInt(maxFeePerGas), BigInt(maxPriorityFeePerGas || maxFeePerGas));
        const paymasterGasLimits = packUint(BigInt(paymasterVerificationGasLimit), BigInt(paymasterPostOpGasLimit));
        const paymasterAndData = concat([paymaster, paymasterGasLimits, paymasterData]);

        const finalUserOp = {
            ...userOp,
            preVerificationGas,
            accountGasLimits,
            gasFees,
            paymasterAndData
        };

        const hash = await entryPointGetUserOpHash(publicClient, finalUserOp, ENTRY_POINT, sepolia.id);
        finalUserOp.signature = await signer.signMessage({ message: { raw: hash } });

        // 6. Submit
        console.log("   🚀 Submitting...");
        const uoHash = await bundlerClient.request({
            method: 'eth_sendUserOperation',
            params: [finalUserOp, ENTRY_POINT]
        });
        console.log(`   ✅ Sent! UserOpHash: ${uoHash}`);
        
        // Wait
        console.log("   ⏳ Waiting for receipt...");
        await waitForUserOp(bundlerClient, uoHash as Hex);

    } catch (e: any) {
        console.log(`   ❌ Failed: ${e.message}`);
        // If AA23, it might be lack of approval. We log it and move on as per standard procedure debugging.
    }
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

async function waitForUserOp(client: any, hash: Hex) {
    for(let i=0; i<30; i++) {
        const res = await client.request({ method: 'eth_getUserOperationReceipt', params: [hash] });
        if (res) {
            console.log(`   ✅ Mined! Tx: ${(res as any).receipt.transactionHash}`);
            return;
        }
        await new Promise(r => setTimeout(r, 2000));
    }
    console.log("   ⚠️  Timeout waiting.");
}

main().catch(console.error);
