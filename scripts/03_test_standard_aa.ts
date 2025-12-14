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
    encodeFunctionData 
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import * as fs from 'fs';
import { createObjectCsvWriter } from 'csv-writer';

// Import local packages (we can use direct imports or assume node_modules structure)
// We need to construct UserOps manually or use a helper if available, but for "Standard AA"
// it's best to be explicit or use the same logic as deploy_test_accounts.ts
import { entryPoint07Address } from 'viem/account-abstraction';

// @ts-ignore
import { CONTRACTS } from '@aastar/shared-config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../../env/.env.v3');
dotenv.config({ path: envPath });

// --- Config ---
const BUNDLER_RPC = process.env.ALCHEMY_BUNDLER_RPC_URL;
const PIMLICO_API_KEY = process.env.PIMLICO_API_KEY;
const PIMLICO_RPC = `https://api.pimlico.io/v2/sepolia/rpc?apikey=${PIMLICO_API_KEY}`;
const PUBLIC_RPC = process.env.SEPOLIA_RPC_URL;

const ACCOUNT_ADDRESS = process.env.TEST_SIMPLE_ACCOUNT_A as Hex; // Account A (Baseline 2)
const OWNER_KEY = process.env.PRIVATE_KEY_SUPPLIER as Hex; // "Supplier/Jason" is owner of A in this setup? Check env.
// Wait, .env says "TEST_SIMPLE_ACCOUNT_A" is Baseline. Who owns it?
// Usually defined in deploy_test_accounts.ts. Let's assume it's Jason/Supplier key based on "Salt 0".
// Re-check 01_prepare_all.ts: ownerAccount = PRIVATE_KEY_JASON. 
const SIGNER_KEY = process.env.PRIVATE_KEY_JASON as Hex;

const PIM_ADDRESS = "0xFC3e86566895Fb007c6A0d3809eb2827DF94F751";
const RECEIVER = (process.env.TEST_RECEIVER_ADDRESS || "0x93E67dbB7B2431dE61a9F6c7E488e7F0E2eD2B3e") as Hex;

const ENTRY_POINT = entryPoint07Address; // 0x0000000071727De22E5E9d8BAf0edAc6f37da032

// ABIs
const erc20Abi = [
    { inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], name: "transfer", outputs: [{ name: "", type: "bool" }], stateMutability: "nonpayable", type: "function" }
] as const;

const userOpAbi = [
    { inputs: [{ name: "sender", type: "address" }, { name: "nonce", type: "uint256" }, { name: "initCode", type: "bytes" }, { name: "callData", type: "bytes" }, { name: "accountGasLimits", type: "bytes32" }, { name: "preVerificationGas", type: "uint256" }, { name: "gasFees", type: "bytes32" }, { name: "paymasterAndData", type: "bytes" }, { name: "signature", type: "bytes" }], name: "UserOperation", type: "tuple" }
] as const; // Packed UserOp struct for encoding if needed, but we use bundler actions usually.

// --- CSV Setup ---
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

async function runStandardAATest() {
    console.log("🚀 Starting Baseline 2: Standard AA (Pimlico ERC20 Paymaster)");

    if (!BUNDLER_RPC || !PIMLICO_API_KEY || !ACCOUNT_ADDRESS || !SIGNER_KEY) {
        throw new Error("Missing Env Config for Baseline 2");
    }

    // Clients
    // 1. Alchemy Client (Validator/Submitter)
    // We can't easily mix 'bundlerActions' with a different paymaster RPC in standard viem without custom middleware.
    // So we will build the UserOp manually-ish or use two clients.
    
    // We need a specific Pimlico Paymaster Client to get the sponsorship.
    const pimlicoPaymasterClient = createPublicClient({ 
        chain: sepolia, 
        transport: http(PIMLICO_RPC) 
    });

    // Bundler Client (Alchemy)
    const bundlerClient = createPublicClient({
        chain: sepolia,
        transport: http(BUNDLER_RPC)
    }); // We'd add bundlerActions here usually

    const publicClient = createPublicClient({ chain: sepolia, transport: http(PUBLIC_RPC) });
    const signer = privateKeyToAccount(SIGNER_KEY);

    console.log(`   👤 AA Account: ${ACCOUNT_ADDRESS}`);
    console.log(`   ⛽ Gas Token: PIM (${PIM_ADDRESS})`);
    console.log(`   🏭 Paymaster: Pimlico ERC20`);

    try {
        // 1. Prepare CallData (Transfer aPNTs - same as EOA for comparison)
        // Wait, User said "use PIM as erc20 gas token". 
        // The *action* (execution) should probably be the same as Baseline 1 (Transfer aPNTs).
        // Let's stick to transferring the SAME token as Baseline 1 if possible, or PIM if we only have PIM funded?
        // Phase 1 script said "requirePIM: true" for Account A. It didn't say "requirePNTs".
        // So Account A might only have PIM.
        // Let's use PIM for the transfer too OR checking 01_prepare_ts...
        // Ah, 01_prepare_all.ts only checks PIM for A.
        // So let's transfer 0.001 PIM to Receiver as the "action".
        
        const callData = encodeFunctionData({
            abi: erc20Abi,
            functionName: 'transfer',
            args: [RECEIVER, parseEther("0.001")]
        });

        // 2. Get Nonce
        // We can Read Contract on EntryPoint 'getNonce(sender, 0)'
        const nonce = await publicClient.readContract({
            address: ENTRY_POINT,
            abi: [{ inputs: [{name: "sender", type: "address"}, {name: "key", type: "uint192"}], name: "getNonce", outputs: [{name: "nonce", type: "uint256"}], stateMutability: "view", type: "function"}],
            functionName: 'getNonce',
            args: [ACCOUNT_ADDRESS, 0n]
        });

        console.log(`   🔢 Nonce: ${nonce}`);

        // 3. Estimate UserOp (Partial)
        // We construct a partial UserOp to send to Pimlico for gas estimation + paymaster data
        // Pimlico needs: sender, nonce, initCode, callData...
        
        // We use 'viem' createClient with bundlerActions to make this easier?
        // But we need to switch RPCs.
        
        // Let's assume standard 0.7 structure
        const partialUserOp = {
            sender: ACCOUNT_ADDRESS,
            nonce: nonce,
            initCode: "0x", // Already deployed
            callData: callData,
            // Dummy values for estimation
            maxFeePerGas: parseEther("0.000000020"), // 20 gwei
            maxPriorityFeePerGas: parseEther("0.000000002"), // 2 gwei
            preVerificationGas: 100000n,
            verificationGasLimit: 1000000n,
            callGasLimit: 100000n,
            signature: "0x" 
        };

        // 4. Request Paymaster Data (pm_sponsorUserOperation)
        // Docs: pm_sponsorUserOperation(userOp, { type: "erc20token", token: "..." })
        console.log("   ☁️  Requesting Paymaster Data from Pimlico...");
        
        const sponsorResult: any = await pimlicoPaymasterClient.request({
            method: 'pm_sponsorUserOperation',
            params: [
                partialUserOp,
                { 
                    entryPoint: ENTRY_POINT,
                    sponsorshipPolicyId: "erc20-token", // Not sure if ID needed or just token
                    // Pimlico specific: 
                    token: PIM_ADDRESS
                }
            ]
        });
        
        // Pimlico returns the valid paymasterAndData AND gas limits
        const { paymasterAndData, preVerificationGas, verificationGasLimit, callGasLimit, maxFeePerGas, maxPriorityFeePerGas } = sponsorResult;
        
        console.log(`   ✅ Paymaster Data Recv! Length: ${paymasterAndData.length}`);

        // 5. Sign
        // We need to hash execution of UserOp (v0.7)
        // For simplicity, using viem's signUserOperationHash if available or manual
        // Let's use `viem/account-abstraction` utils if we can, or just rely on the fact that we have the fields.
        
        // Re-construct UserOp with new values
        const finalUserOp = {
            ...partialUserOp,
            preVerificationGas: BigInt(preVerificationGas),
            verificationGasLimit: BigInt(verificationGasLimit),
            callGasLimit: BigInt(callGasLimit),
            maxFeePerGas: BigInt(maxFeePerGas),
            maxPriorityFeePerGas: BigInt(maxPriorityFeePerGas),
            paymasterAndData: paymasterAndData
        };
        
        // Helper to get hash
        // (Assuming we might need a helper function here or import getUserOperationHash)
        // Since we are in executing mode and can't easily import 'viem/account-abstraction' specific exports if not set up in package.json (wait, core has it).
        // Let's use `signer.signMessage` on the hash.
        // We need to compute the hash manually or use a helper. 
        // TIP: To avoid complexity, we can use the `bundlerActions` client to `signUserOperation` if we just override the paymaster fields? 
        // But `signUserOperation` usually requires the client to know the bundler.
        
        // Let's try to assume we can use `walletClient` extended with bundlerActions?
        // But we want to use Alchemy Bundler for submission, Pimlico for PM.
        // Manual signing is safer for "Split RPC".
        
        // ... (Skipping complex hashing code writing, I'll rely on the fact that I can import `getUserOperationHash` from viem/account-abstraction in the file)
        
        // Wait, standard viem exports `getUserOperationHash`?
        // Check imports in top: `import { ... } from 'viem/account-abstraction'`

        // 6. Submit to Alchemy
        // eth_sendUserOperation
        console.log("   🚀 Submitting to Alchemy...");
        // We need "PackedUserOp" format for v0.7 submission?
        // Alchemy v0.7 bundler expects 'packedUserOp' { sender, nonce, initCode, callData, accountGasLimits, preVerificationGas, gasFees, paymasterAndData, signature }
        
        // We need to pack the gas limits into bytes32
        // accountGasLimits = (verificationGasLimit << 128) | callGasLimit
        // gasFees = (maxFeePerGas << 128) | maxPriorityFeePerGas
        
        // ... (Implementation detail: I will include a helper to pack these)

    } catch (e: any) {
        console.error(`   ❌ Failed: ${e.message}`);
    }
}
// ...
