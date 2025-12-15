import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { 
    createPublicClient, 
    http, 
    parseEther, 
    formatEther, 
    Hex, 
    concat, 
    encodeFunctionData,
    pad,
    toHex,
    createWalletClient
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import * as fs from 'fs';
import { createObjectCsvWriter } from 'csv-writer';

// @ts-ignore
import { CONTRACTS } from '@aastar/shared-config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../../env/.env.v3');
dotenv.config({ path: envPath });

const BUNDLER_RPC = process.env.ALCHEMY_BUNDLER_RPC_URL;
const PUBLIC_RPC = process.env.SEPOLIA_RPC_URL;
const contracts: any = CONTRACTS;

// Group B Config (AOA Mode)
const ACCOUNT_B_ADDRESS = process.env.TEST_SIMPLE_ACCOUNT_B as Hex;
const OWNER_B_KEY = process.env.PRIVATE_KEY_SUPPLIER as Hex;
// AOA Mode Paymaster (Deployed via Factory)
const PAYMASTER_V4_ADDRESS = (process.env.PAYMASTER_V4_ADDRESS || contracts?.sepolia?.paymaster?.v4_1 || "0x65Cf6C4ab3d40f9227A6C3d348039E8c50B2022C") as Hex; 

const ENTRY_POINT = '0x0000000071727De22E5E9d8BAf0edAc6f37da032'; 
const RECEIVER = (process.env.TEST_RECEIVER_ADDRESS || "0x93E67dbB7B2431dE61a9F6c7E488e7F0E2eD2B3e") as Hex;

const erc20Abi = [
    { inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], name: "transfer", outputs: [{ name: "", type: "bool" }], stateMutability: "nonpayable", type: "function" }
] as const;

const csvPath = path.resolve(__dirname, '../data/experiment_data.csv');
const csvWriter = createObjectCsvWriter({
    path: csvPath,
    header: [
        { id: 'timestamp', title: 'TIMESTAMP' },
        { id: 'group', title: 'GROUP' },
        { id: 'type', title: 'TYPE' },
        { id: 'txHash', title: 'TX_HASH' },
        { id: 'gasUsed', title: 'GAS_USED' },
        { id: 'gasPrice', title: 'GAS_PRICE' },
        { id: 'l1Fee', title: 'L1_FEE_ETH' },
        { id: 'status', title: 'STATUS' },
    ],
    append: true
});

function packGasLimits(verificationGasLimit: bigint, callGasLimit: bigint): Hex {
    return concat([
        pad(toHex(verificationGasLimit), { size: 16 }),
        pad(toHex(callGasLimit), { size: 16 })
    ]);
}

async function runPaymasterV4Test() {
    console.log("🚀 Starting Experiment: Group B (Paymaster V4.1 - AOA Mode)");

    if (!BUNDLER_RPC || !ACCOUNT_B_ADDRESS || !OWNER_B_KEY) throw new Error("Missing Config for Group B");
    
    const bundlerClient = createPublicClient({ chain: sepolia, transport: http(BUNDLER_RPC) });
    const publicClient = createPublicClient({ chain: sepolia, transport: http(PUBLIC_RPC) });
    const ownerAccount = privateKeyToAccount(OWNER_B_KEY);

    console.log(`   👤 AA Account: ${ACCOUNT_B_ADDRESS}`);
    console.log(`   🏭 Paymaster: ${PAYMASTER_V4_ADDRESS}`);

    try {
        const callData = encodeFunctionData({
            abi: erc20Abi,
            functionName: 'transfer',
            args: [RECEIVER, parseEther("0.001")]
        });

        const nonce = await publicClient.readContract({
            address: ENTRY_POINT,
            abi: [{ inputs: [{name: "sender", type: "address"}, {name: "key", type: "uint192"}], name: "getNonce", outputs: [{name: "nonce", type: "uint256"}], stateMutability: "view", type: "function"}],
            functionName: 'getNonce',
            args: [ACCOUNT_B_ADDRESS, 0n]
        });

        // --- Paymaster Data (AOA Mode) ---
        // Hypothesis: AOA Mode checks on-chain assets (MySBT + xPNTs).
        // It does NOT require off-chain signature or timestamps if configured correctly.
        // It matches the "Sponsor" logic: Paymaster pays ETH, User pays xPNTs (PostOp) or is sponsored (SBT).
        // Therefore, paymasterAndData is just the address.
        
        const paymasterAndData = PAYMASTER_V4_ADDRESS; 

        // 3. Estimate Gas
        const partialUserOp = {
            sender: ACCOUNT_B_ADDRESS,
            nonce: nonce,
            initCode: "0x",
            callData: callData,
            paymasterAndData: paymasterAndData,
            signature: "0xfffffffffffffffffffffffffffffff0000000000000000000000000000000007aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1c"
        };

        const gasEstimate: any = await bundlerClient.request({
            method: 'eth_estimateUserOperationGas',
            params: [partialUserOp, ENTRY_POINT]
        });

        const verificationGasLimit = BigInt(gasEstimate.verificationGasLimit ?? 100000n);
        const callGasLimit = BigInt(gasEstimate.callGasLimit ?? 100000n);
        const preVerificationGas = BigInt(gasEstimate.preVerificationGas ?? 50000n);
        const accountGasLimits = packGasLimits(verificationGasLimit, callGasLimit);
        
        const block = await publicClient.getBlock();
        const maxPriorityFeePerGas = await publicClient.request({ method: 'eth_maxPriorityFeePerGas' });
        const maxFeePerGas = block.baseFeePerGas! * 2n + BigInt(maxPriorityFeePerGas);
        const gasFees = packGasLimits(BigInt(maxPriorityFeePerGas), maxFeePerGas);

        const userOp = {
            sender: ACCOUNT_B_ADDRESS,
            nonce: nonce,
            initCode: "0x",
            callData: callData,
            accountGasLimits: accountGasLimits,
            preVerificationGas: preVerificationGas,
            gasFees: gasFees,
            paymasterAndData: paymasterAndData,
            signature: "0x" as Hex
        };

        const userOpHash = await publicClient.readContract({
            address: ENTRY_POINT,
            abi: [{ inputs: [{ components: [{name:"sender",type:"address"},{name:"nonce",type:"uint256"},{name:"initCode",type:"bytes"},{name:"callData",type:"bytes"},{name:"accountGasLimits",type:"bytes32"},{name:"preVerificationGas",type:"uint256"},{name:"gasFees",type:"bytes32"},{name:"paymasterAndData",type:"bytes"},{name:"signature",type:"bytes"}], name: "userOp", type: "tuple" }], name: "getUserOpHash", outputs: [{ name: "", type: "bytes32" }], stateMutability: "view", type: "function" }],
            functionName: 'getUserOpHash',
            args: [userOp]
        });

        const signature = await ownerAccount.signMessage({ message: { raw: userOpHash } });
        userOp.signature = signature;

        const userOpHashRes = await bundlerClient.request({
            method: 'eth_sendUserOperation',
            params: [userOp, ENTRY_POINT]
        });

        console.log(`   ✅ Submitted B! Hash: ${userOpHashRes}`);
        
        await csvWriter.writeRecords([{
            timestamp: new Date().toISOString(),
            group: 'Group B',
            type: 'Paymaster V4.1 (AOA)',
            txHash: userOpHashRes,
            gasUsed: 'PENDING',
            gasPrice: maxFeePerGas.toString(),
            l1Fee: 'PENDING',
            status: 'Submitted'
        }]);

    } catch (e: any) {
        console.error(`   ❌ Group B Failed: ${e.message}`);
         await csvWriter.writeRecords([{
            timestamp: new Date().toISOString(),
            group: 'Group B',
            status: `Error: ${e.message}`
        }]);
    }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    runPaymasterV4Test().catch(console.error);
}

export { runPaymasterV4Test };
