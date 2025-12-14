import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { 
    createPublicClient, 
    createWalletClient, 
    http, 
    parseEther, 
    formatEther, 
    Hex, 
    concat, 
    encodeFunctionData,
    pad,
    toHex,
    hashMessage,
    toBytes,
    keccak256,
    encodeAbiParameters,
    parseAbiParameters
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

// --- Config ---
const BUNDLER_RPC = process.env.ALCHEMY_BUNDLER_RPC_URL;
const PUBLIC_RPC = process.env.SEPOLIA_RPC_URL;
const contracts: any = CONTRACTS;

// Group B Config (Standard AA / Paymaster V4.1)
const ACCOUNT_B_ADDRESS = process.env.TEST_SIMPLE_ACCOUNT_B as Hex;
const OWNER_B_KEY = process.env.PRIVATE_KEY_SUPPLIER as Hex; // Assuming Supplier/Jason owns B
const PAYMASTER_V4_ADDRESS = (process.env.PAYMASTER_V4_ADDRESS || contracts?.sepolia?.paymaster?.v4_1 || "0x65Cf6C4ab3d40f9227A6C3d348039E8c50B2022C") as Hex; 
const OPERATOR_KEY = process.env.PRIVATE_KEY_JASON as Hex; // Operator signs for Paymaster

const ENTRY_POINT = '0x0000000071727De22E5E9d8BAf0edAc6f37da032'; // v0.7
const RECEIVER = (process.env.TEST_RECEIVER_ADDRESS || "0x93E67dbB7B2431dE61a9F6c7E488e7F0E2eD2B3e") as Hex;

const erc20Abi = [
    { inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], name: "transfer", outputs: [{ name: "", type: "bool" }], stateMutability: "nonpayable", type: "function" }
] as const;

// --- CSV ---
const csvPath = path.resolve(__dirname, '../data/experiment_data.csv');
const csvWriter = createObjectCsvWriter({
    path: csvPath, // Share same CSV
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
    console.log("🚀 Starting Experiment: Group B (Paymaster V4.1)");

    if (!BUNDLER_RPC || !ACCOUNT_B_ADDRESS || !OWNER_B_KEY) throw new Error("Missing Config for Group B");
    
    // Clients
    const bundlerClient = createPublicClient({ chain: sepolia, transport: http(BUNDLER_RPC) });
    const publicClient = createPublicClient({ chain: sepolia, transport: http(PUBLIC_RPC) });
    const ownerAccount = privateKeyToAccount(OWNER_B_KEY);
    const operatorAccount = privateKeyToAccount(OPERATOR_KEY);

    console.log(`   👤 AA Account: ${ACCOUNT_B_ADDRESS}`);
    console.log(`   🏭 Paymaster V4: ${PAYMASTER_V4_ADDRESS}`);

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

        // --- Paymaster Data Construction (Verifying Paymaster V0.7) ---
        // 1. Get Timestamps
        const validUntil = BigInt(Math.floor(Date.now() / 1000) + 3600); // 1 hour
        const validAfter = 0n;
        
        // 2. Initial PaymasterAndData (for Estimation)
        // Format: PM + validUntil(6) + validAfter(6) + dummySig
        const timeRange = concat([
             pad(toHex(validUntil), { size: 6 }),
             pad(toHex(validAfter), { size: 6 })
        ]);
        const dummySig = "0xfffffffffffffffffffffffffffffff0000000000000000000000000000000007aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1c";
        
        const initialPaymasterAndData = concat([
            PAYMASTER_V4_ADDRESS,
            timeRange,
            dummySig as Hex
        ]);

        // 3. Estimate Gas
        const partialUserOp = {
            sender: ACCOUNT_B_ADDRESS,
            nonce: nonce,
            initCode: "0x",
            callData: callData,
            paymasterAndData: initialPaymasterAndData,
            signature: dummySig as Hex
        };

        const gasEstimate: any = await bundlerClient.request({
            method: 'eth_estimateUserOperationGas',
            params: [partialUserOp, ENTRY_POINT]
        });

        // 4. Pack Gas
        const verificationGasLimit = BigInt(gasEstimate.verificationGasLimit ?? 100000n);
        const callGasLimit = BigInt(gasEstimate.callGasLimit ?? 100000n);
        const preVerificationGas = BigInt(gasEstimate.preVerificationGas ?? 50000n);
        const accountGasLimits = packGasLimits(verificationGasLimit, callGasLimit);
        
        const block = await publicClient.getBlock();
        const maxPriorityFeePerGas = await publicClient.request({ method: 'eth_maxPriorityFeePerGas' });
        const maxFeePerGas = block.baseFeePerGas! * 2n + BigInt(maxPriorityFeePerGas);
        const gasFees = packGasLimits(BigInt(maxPriorityFeePerGas), maxFeePerGas);

        // 5. Calculate Paymaster Hash & Sign
        // We need to sign the Paymaster hash according to V4.1 logic.
        // Usually: keccak256(sender, nonce, initCodeHash, callDataHash, accountGasLimits, preVerificationGas, gasFees, chainId, paymaster, validUntil, validAfter)
        // Note: SDK standard uses 'getHash' on paymaster contract or off-chain computation.
        // I will assume standard PackUserOp hash logic for Paymaster.
        
        // Let's rely on `viem` to potentially handle this if we were using `paymasterActions`.
        // But doing it manually:
        // We need the hash.
        // Let's assume V4.1 exports a `getHash` function we can read?
        // Or implement off-chain.
        // Struct: (sender, nonce, initCodeHash, callDataHash, accountGasLimits, preVerificationGas, gasFees, chainId, paymaster, validUntil, validAfter)
        
        const userOpForPmHash = {
            sender: ACCOUNT_B_ADDRESS,
            nonce,
            initCodeHash: keccak256("0x"),
            callDataHash: keccak256(callData),
            accountGasLimits,
            preVerificationGas,
            gasFees,
            chainId: sepolia.id,
            paymaster: PAYMASTER_V4_ADDRESS,
            validUntil,
            validAfter
        };
        
        // Encode for hashing
        const encoded = encodeAbiParameters(
            parseAbiParameters('address, uint256, bytes32, bytes32, bytes32, uint256, bytes32, uint256, address, uint48, uint48'),
            [
                userOpForPmHash.sender,
                userOpForPmHash.nonce,
                userOpForPmHash.initCodeHash,
                userOpForPmHash.callDataHash,
                userOpForPmHash.accountGasLimits,
                userOpForPmHash.preVerificationGas,
                userOpForPmHash.gasFees,
                BigInt(userOpForPmHash.chainId),
                userOpForPmHash.paymaster,
                Number(userOpForPmHash.validUntil),
                Number(userOpForPmHash.validAfter)
            ]
        );
        const pmHash = keccak256(encoded);
        
        // Sign with Operator
        const pmSignature = await operatorAccount.signMessage({
            message: { raw: pmHash } // Note: Sign Message applies prefix. Ensure contract uses ECDSA.recover/toEthSignedMessageHash
        });

        // 6. Final Paymaster Data
        const finalPaymasterAndData = concat([
            PAYMASTER_V4_ADDRESS,
            timeRange,
            pmSignature
        ]);

        // 7. Assemble UserOp
        const userOp = {
            sender: ACCOUNT_B_ADDRESS,
            nonce: nonce,
            initCode: "0x",
            callData: callData,
            accountGasLimits: accountGasLimits,
            preVerificationGas: preVerificationGas,
            gasFees: gasFees,
            paymasterAndData: finalPaymasterAndData,
            signature: "0x" as Hex
        };

        // 8. Sign UserOp (Owner)
        const userOpHash = await publicClient.readContract({
            address: ENTRY_POINT,
            abi: [{ inputs: [{ components: [{name:"sender",type:"address"},{name:"nonce",type:"uint256"},{name:"initCode",type:"bytes"},{name:"callData",type:"bytes"},{name:"accountGasLimits",type:"bytes32"},{name:"preVerificationGas",type:"uint256"},{name:"gasFees",type:"bytes32"},{name:"paymasterAndData",type:"bytes"},{name:"signature",type:"bytes"}], name: "userOp", type: "tuple" }], name: "getUserOpHash", outputs: [{ name: "", type: "bytes32" }], stateMutability: "view", type: "function" }],
            functionName: 'getUserOpHash',
            args: [userOp]
        });

        const signature = await ownerAccount.signMessage({ message: { raw: userOpHash } });
        userOp.signature = signature;

        // 9. Submit
        const userOpHashRes = await bundlerClient.request({
            method: 'eth_sendUserOperation',
            params: [userOp, ENTRY_POINT]
        });

        console.log(`   ✅ Submitted B! Hash: ${userOpHashRes}`);
        
        await csvWriter.writeRecords([{
            timestamp: new Date().toISOString(),
            group: 'Group B',
            type: 'Paymaster V4.1',
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
