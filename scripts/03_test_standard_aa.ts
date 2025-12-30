import { createPublicClient, createWalletClient, http, parseEther, formatEther, Hex, toHex, encodeFunctionData, parseAbi, concat, encodeAbiParameters, keccak256, Address, pad, toBytes } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';
import * as dotenv from 'dotenv';
import * as path from 'path';

(BigInt.prototype as any).toJSON = function () { return this.toString(); };
dotenv.config({ path: path.resolve(__dirname, '../../env/.env.anvil') });

const RPC_URL = process.env.SEPOLIA_RPC_URL;
const BUNDLER_RPC = process.env.ALCHEMY_BUNDLER_RPC_URL;
const PIMLICO_API_KEY = process.env.PIMLICO_API_KEY;
const PIMLICO_RPC = `https://api.pimlico.io/v2/sepolia/rpc?apikey=${PIMLICO_API_KEY}`;
const ENTRY_POINT = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";

const ACCOUNT_ADDRESS = process.env.TEST_SIMPLE_ACCOUNT_A as Hex; 
const SIGNER_KEY = process.env.PRIVATE_KEY_JASON as Hex; 
const PIM_TOKEN = "0xFC3e86566895Fb007c6A0d3809eb2827DF94F751";
const APNTS_ADDRESS = process.env.APNTS_ADDRESS as Hex;
const RECEIVER = "0x93E67dbB7B2431dE61a9F6c7E488e7F0E2eD2B3e";

if (!BUNDLER_RPC || !PIMLICO_API_KEY || !APNTS_ADDRESS) throw new Error("Missing Config");

// Fix: Ensure standard hex serialization without double encoding
function packUint(high128: bigint, low128: bigint): Hex {
    return `0x${((high128 << 128n) | low128).toString(16).padStart(64, '0')}`;
}

async function main() {
    console.log("🚀 Starting Standard AA Test (Pimlico ERC20)...");

    const publicClient = createPublicClient({ chain: foundry, transport: http(RPC_URL) });
    const pimlicoClient = createPublicClient({ chain: foundry, transport: http(PIMLICO_RPC) });
    const bundlerClient = createPublicClient({ chain: foundry, transport: http(BUNDLER_RPC) });
    const signer = privateKeyToAccount(SIGNER_KEY);

    // ABIs
    const erc20Abi = parseAbi(['function transfer(address, uint256) returns (bool)', 'function approve(address, uint256) returns (bool)', 'function allowance(address, address) view returns (uint256)']);
    const executeAbi = parseAbi(['function execute(address, uint256, bytes)']);

    // 1. Prepare CallData: Transfer aPNTs
    const transferData = encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [RECEIVER, parseEther("1")] });
    const userOpCallData = encodeFunctionData({ abi: executeAbi, functionName: 'execute', args: [APNTS_ADDRESS, 0n, transferData] });

    // 2. Get Nonce
    const nonce = await publicClient.readContract({
        address: ENTRY_POINT, abi: parseAbi(['function getNonce(address, uint192) view returns (uint256)']),
        functionName: 'getNonce', args: [ACCOUNT_ADDRESS, 0n]
    });
    console.log(`   🔢 Nonce: ${nonce}`);

    // 3. Construct Estimate Op
    const estimateOp = {
        sender: ACCOUNT_ADDRESS,
        nonce: toHex(nonce),
        factory: undefined,
        factoryData: undefined,
        callData: userOpCallData,
        callGasLimit: "0x1", // Dummy
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
                estimateOp,
                {
                    entryPoint: ENTRY_POINT,
                    sponsorshipPolicyId: "erc20-token",
                    token: PIM_TOKEN
                }
            ]
        });

        const { paymaster, paymasterData, preVerificationGas, verificationGasLimit, callGasLimit, paymasterVerificationGasLimit, paymasterPostOpGasLimit, maxFeePerGas, maxPriorityFeePerGas } = sponsorship;
        console.log(`   ✅ Sponsored! PM: ${paymaster}`);

        // 5. Pack & Sign
        const accountGasLimits = packUint(BigInt(verificationGasLimit), BigInt(callGasLimit));
        const gasFees = packUint(BigInt(maxFeePerGas), BigInt(maxPriorityFeePerGas));
        const paymasterGasLimits = packUint(BigInt(paymasterVerificationGasLimit), BigInt(paymasterPostOpGasLimit));
        const paymasterAndData = concat([paymaster, paymasterGasLimits, paymasterData]);

        // Construct Typed UserOp for Hashing (Packed)
        const packedUserOp = {
            sender: ACCOUNT_ADDRESS,
            nonce: nonce,
            initCode: "0x" as Hex,
            callData: userOpCallData,
            accountGasLimits,
            preVerificationGas: BigInt(preVerificationGas),
            gasFees,
            paymasterAndData,
            signature: "0x" as Hex
        };

        const hash = await entryPointGetUserOpHash(publicClient, packedUserOp, ENTRY_POINT, sepolia.id);
        const sig = await signer.signMessage({ message: { raw: hash } });

        // 6. Send Unpacked (Alchemy V0.7 Format)
        // Ensure strictly NO double hex encoding
        const msg = {
            sender: ACCOUNT_ADDRESS,
            nonce: toHex(nonce),
            factory: undefined, factoryData: undefined,
            callData: userOpCallData,
            callGasLimit: toHex(BigInt(callGasLimit)),
            verificationGasLimit: toHex(BigInt(verificationGasLimit)),
            preVerificationGas: toHex(BigInt(preVerificationGas)),
            maxFeePerGas: toHex(BigInt(maxFeePerGas)),
            maxPriorityFeePerGas: toHex(BigInt(maxPriorityFeePerGas)),
            paymaster: paymaster,
            paymasterVerificationGasLimit: toHex(BigInt(paymasterVerificationGasLimit)),
            paymasterPostOpGasLimit: toHex(BigInt(paymasterPostOpGasLimit)),
            paymasterData: paymasterData,
            signature: sig
        };

        console.log("   🚀 Submitting...");
        const uoHash = await bundlerClient.request({ method: 'eth_sendUserOperation', params: [msg, ENTRY_POINT] });
        console.log(`   ✅ Sent! Hash: ${uoHash}`);
        
        await waitForUserOp(bundlerClient, uoHash as Hex);

    } catch (e: any) {
        console.log(`   ❌ Failed: ${e.message}`);
        if(e.cause) console.log(e.cause);
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

async function waitForUserOp(client: any, hash: Hex) {
    for(let i=0; i<30; i++) {
        try {
            const res = await client.request({ method: 'eth_getUserOperationReceipt', params: [hash] });
            if (res) {
                console.log(`   ✅ Mined! Tx: ${(res as any).receipt.transactionHash}`);
                return;
            }
        } catch {}
        await new Promise(r => setTimeout(r, 2000));
    }
    console.log("   ⚠️  Timeout waiting.");
}

main().catch(console.error);
