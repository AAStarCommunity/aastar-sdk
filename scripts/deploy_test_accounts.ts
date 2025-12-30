import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { 
  createPublicClient, 
  createWalletClient,
  http, 
  encodeFunctionData, 
  concat, 
  Hex, 
  pad, 
  toBytes,
  toHex, // Ensure this is present
  parseAbiParameters,
  formatEther,
  parseEther,
  decodeErrorResult
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../../env/.env.v3');
dotenv.config({ path: envPath });

// --- Config ---
const ENTRY_POINT_ADDRESS = '0x0000000071727De22E5E9d8BAf0edAc6f37da032';
const FACTORY_ADDRESS = '0x91E60e0613810449d098b0b5Ec8b51A0FE8c8985';
const BUNDLER_RPC = process.env.ALCHEMY_BUNDLER_RPC_URL;
const PUBLIC_RPC = process.env.SEPOLIA_RPC_URL;

// --- ABIs ---
const factoryAbi = [
  { inputs: [{ name: "owner", type: "address" }, { name: "salt", type: "uint256" }], name: "createAccount", outputs: [{ name: "ret", type: "address" }],stateMutability: "nonpayable", type: "function" }
] as const;

const accountAbi = [
  { inputs: [{ name: "dest", type: "address" }, { name: "value", type: "uint256" }, { name: "func", type: "bytes" }], name: "execute", outputs: [], stateMutability: "nonpayable", type: "function" }
] as const;

const senderAddressResultAbi = [{
    inputs: [{ name: "sender", type: "address" }],
    name: "SenderAddressResult",
    type: "error"
}] as const;

function parseKey(key: string | undefined): Hex {
    if (!key) throw new Error("Private Key is undefined");
    if (!key.startsWith("0x")) {
         if (key.length === 64) return `0x${key}` as Hex;
         throw new Error(`Private Key must start with 0x. Got: ${key}`);
    }
    return key as Hex;
}

async function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    if (!BUNDLER_RPC || !process.env.PRIVATE_KEY_JASON) {
        console.error("Missing BUNDLER_RPC or PRIVATE_KEY_JASON in .env.v3");
        process.exit(1);
    }
    const rpcUrl = PUBLIC_RPC || BUNDLER_RPC;
    console.log(`Using RPC: ${rpcUrl}`);

    const client = createPublicClient({
        chain: foundry,
        transport: http(BUNDLER_RPC) // Bundler RPC for UserOp methods
    });
    
    // For normal reads/funds
    const publicClient = createPublicClient({ chain: foundry, transport: http(rpcUrl) });
    
    // Owner Account
    const ownerAccount = privateKeyToAccount(parseKey(process.env.PRIVATE_KEY_JASON));
    console.log(`Owner: ${ownerAccount.address}`);

    // Supplier (Optional)
    const supplierKey = process.env.PRIVATE_KEY_SUPPLIER ? parseKey(process.env.PRIVATE_KEY_SUPPLIER) : undefined;

    // --- Process 3 Accounts ---
    const salts = [0n, 1n, 2n];
    const labels = ['Baseline (A)', 'Standard (B)', 'SuperPaymaster (C)'];

    for (let i = 0; i < 3; i++) {
        // Pace ourselves to avoid Rate Limits / In-flight limits
        await sleep(5000);

        const salt = salts[i];
        const label = labels[i];
        console.log(`\n--------------------------------------------`);
        console.log(`🚀 Processing ${label} [Salt ${salt}]`);
        console.log(`--------------------------------------------`);

        // 1. Calculate Address
        const factoryData = encodeFunctionData({
            abi: factoryAbi,
            functionName: 'createAccount',
            args: [ownerAccount.address, salt]
        });
        const initCode = concat([FACTORY_ADDRESS, factoryData]);

        let senderAddress: string;
        try {
            await client.simulateContract({
                address: ENTRY_POINT_ADDRESS,
                abi: [{ inputs: [{ name: "initCode", type: "bytes" }], name: "getSenderAddress", outputs: [], stateMutability: "nonpayable", type: "function" }, ...senderAddressResultAbi],
                functionName: 'getSenderAddress',
                args: [initCode]
            });
            senderAddress = "0x"; 
        } catch (err: any) {
             const data = err.data || (err.cause && err.cause.data);
             if (data) {
                 try {
                    const decoded = decodeErrorResult({ abi: senderAddressResultAbi, data });
                    senderAddress = decoded.args[0] as string;
                 } catch (e) { /* ignore */ }
             }
             if (!senderAddress || senderAddress === "0x") {
                 const msg = err.details || err.message || JSON.stringify(err);
                 const match = msg.match(/0x[a-fA-F0-9]{40}/);
                 if (!match) {
                     console.error("❌ Failed to calculate address");
                     continue;
                 }
                 senderAddress = match[0];
             }
        }
        console.log(`📝 Address: ${senderAddress}`);

        // 2. Check Deployment & Balance
        const code = await publicClient.getBytecode({ address: senderAddress as Hex });
        const isDeployed = code && code.length > 2;
        const balance = await publicClient.getBalance({ address: senderAddress as Hex });
        
        console.log(`   Deployed: ${isDeployed ? "✅ YES" : "❌ NO"}`);
        console.log(`   Balance: ${formatEther(balance)} ETH`);

        if (isDeployed) {
            console.log("   ✅ Already deployed. Skipping.");
            continue;
        }

        // 3. Fund if needed
        // Requirement is ~0.034 ETH for the generous gas limits, so we check/fund up to 0.05
        if (balance < parseEther("0.05")) {
             console.log("   ⚠️  Insufficient funds (< 0.05 ETH).");
             if (supplierKey) {
                 try {
                     const supplier = privateKeyToAccount(supplierKey);
                     const supplierWallet = createWalletClient({ chain: foundry, transport: http(rpcUrl), account: supplier });
                     
                     
                     // Check supplier balance
                     const supBal = await publicClient.getBalance({ address: supplier.address });
                     if (supBal < parseEther("0.05")) {
                         console.log(`   ❌ Supplier ${supplier.address} also poor (${formatEther(supBal)} ETH). Manual funding required.`);
                     } else {
                        console.log("   💸 Funding 0.05 ETH from Supplier...");
                        
                        // Retry loop for funding
                        let funded = false;
                        for (let attempt = 1; attempt <= 3; attempt++) {
                            try {
                                const tx = await supplierWallet.sendTransaction({
                                    to: senderAddress as Hex,
                                    value: parseEther("0.05"),
                                    chain: foundry, 
                                    account: supplier
                                });
                                console.log(`      Tx: ${tx}`);
                                await publicClient.waitForTransactionReceipt({ hash: tx });
                                console.log("      ✅ Funded.");
                                funded = true;
                                break; // Success
                            } catch (err: any) {
                                console.warn(`      ⚠️ Funding Attempt ${attempt} failed: ${err.message || err}`);
                                if (attempt < 3) {
                                    console.log("      ⏳ Waiting 15s before retry...");
                                    await sleep(15000);
                                }
                            }
                        }
                        if (!funded) console.error("   ❌ Funding failed after 3 attempts.");
                     }
                 } catch(e: any) {
                     console.error("   ❌ Supplier setup failed:", e.message);
                 }
             } else {
                 console.log("   ❌ No Supplier Key. Please fund manually.");
             }
             
             // Check balance again
             const newBal = await publicClient.getBalance({ address: senderAddress as Hex });
             if (newBal === 0n) {
                 console.log("   ❌ Still 0 balance. Skipping deployment.");
                 continue;
             }
        }

        // 4. Construct UserOp
        console.log("   🛠  Constructing UserOp...");
        const callData = encodeFunctionData({
            abi: accountAbi,
            functionName: 'execute',
            args: [ownerAccount.address, 0n, "0x"]
        });

        const nonce = await client.readContract({
            address: ENTRY_POINT_ADDRESS,
            abi: [{ inputs: [{ name: "sender", type: "address" }, { name: "key", type: "uint192" }], name: "getNonce", outputs: [{ name: "nonce", type: "uint256" }], stateMutability: "view", type: "function" }] as const,
            functionName: 'getNonce',
            args: [senderAddress as Hex, 0n]
        });


        // 5. Estimate Gas
        let finalUserOp: any; // Use explicit any to avoid TS type strictness on 'nonce' BigInt vs String
        
        try {
            // Alchemy requires valid hex for all fields
            const estimateOp = {
                sender: senderAddress as Hex,
                nonce: toHex(nonce), 
                initCode: initCode,
                callData: callData,
                accountGasLimits: "0x" as Hex,
                preVerificationGas: "0x0" as Hex,
                gasFees: "0x" as Hex,
                paymasterAndData: "0x" as Hex,
                signature: "0xfffffffffffffffffffffffffffffff0000000000000000000000000000000007aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1c" as Hex
            };

            const gasEstimate: any = await client.request({
                method: 'eth_estimateUserOperationGas' as any,
                params: [estimateOp, ENTRY_POINT_ADDRESS]
            });
            
            // Extract gas limits
            // Note: v0.7 estimate might define { verificationGasLimit, callGasLimit, preVerificationGas } or packed hex
            const verificationGasLimit = BigInt(gasEstimate.verificationGasLimit ?? gasEstimate.verificationGas ?? 1500000n);
            const callGasLimit = BigInt(gasEstimate.callGasLimit ?? 100000n);
            const accountGasLimits = concat([
                pad(toBytes(verificationGasLimit), { size: 16 }),
                pad(toBytes(callGasLimit), { size: 16 })
            ]);
            
            const preVerificationGas = BigInt(gasEstimate.preVerificationGas ?? 50000n);
            
            // Fees
            const block = await publicClient.getBlock();
            const priorityFeeRes: any = await publicClient.request({ method: 'eth_maxPriorityFeePerGas' as any });
            const maxPriorityFeePerGas = BigInt(priorityFeeRes);
            const maxFeePerGas = block.baseFeePerGas! * 2n + maxPriorityFeePerGas;
            
            const gasFees = concat([
                pad(toBytes(maxPriorityFeePerGas), { size: 16 }),
                pad(toBytes(maxFeePerGas), { size: 16 })
            ]);

            finalUserOp = {
                sender: senderAddress as Hex,
                nonce: toHex(nonce),
                initCode: initCode,
                callData: callData,
                accountGasLimits: toHex(accountGasLimits), 
                preVerificationGas: toHex(preVerificationGas), 
                gasFees: toHex(gasFees),
                paymasterAndData: "0x" as Hex,
                signature: "0x" as Hex
            };

        } catch (estParamsError: any) {
             console.log("      ⚠️ Estimation failed, using fallback (Unpacked Fields)...");
             
             // Define Gas Limits & Fees for Fallback
             // Adjusted to fit within balance AND meet Efficiency > 0.4 (Goldilocks zone)
             const fallbackVerifGas = 400000n; // 200k < Required < 600k
             const fallbackCallGas = 60000n;
             const fallbackPreVerifGas = 60000n;
             const fallbackMaxFee = parseEther("20", "gwei");
             const fallbackMaxPriority = parseEther("2", "gwei");


            // Calculate Hash (Requires PACKED structure for 4337 v0.7)
            // Fix: concat returns Uint8Array, we must convert to Hex string
            const accountGasLimits = toHex(concat([pad(toBytes(fallbackVerifGas), { size: 16 }), pad(toBytes(fallbackCallGas), { size: 16 })]));
            const gasFeesPacked = toHex(concat([pad(toBytes(fallbackMaxPriority), { size: 16 }), pad(toBytes(fallbackMaxFee), { size: 16 })]));
            
            // Construct Packed UserOp for Hashing (Contract expects this)
            // Note: readContract ABI expects native types (BigInt used for uint256), while raw Hex is used for bytes
            const packedUserOpForHashing = {
                sender: (senderAddress as Hex).toLowerCase() as Hex,
                nonce: nonce, // BigInt for ABI
                initCode: initCode.toLowerCase() as Hex,
                callData: callData.toLowerCase() as Hex,
                accountGasLimits: accountGasLimits,
                preVerificationGas: fallbackPreVerifGas, // BigInt for ABI
                gasFees: gasFeesPacked,
                paymasterAndData: "0x" as Hex,
                signature: "0x" as Hex
            };
            
            // Split initCode for Alchemy RPC (which expects factory/factoryData)
            const initCodeHex = packedUserOpForHashing.initCode;
            let factory: Hex | undefined;
            let factoryData: Hex | undefined;
            
            if (initCodeHex && initCodeHex.length > 2) {
                factory = initCodeHex.slice(0, 42) as Hex;
                factoryData = ("0x" + initCodeHex.slice(42)) as Hex;
            }

            // Construct Unpacked UserOp for Sending (Alchemy Bundler expects fields matching the provided schema)
            const unpackedUserOpForSending = {
                sender: packedUserOpForHashing.sender,
                nonce: toHex(packedUserOpForHashing.nonce), // Convert to Hex for JSON-RPC
                // initCode REMOVED in favor of factory/factoryData
                factory: factory,
                factoryData: factoryData,
                callData: packedUserOpForHashing.callData,
                callGasLimit: toHex(fallbackCallGas),
                verificationGasLimit: toHex(fallbackVerifGas),
                preVerificationGas: toHex(packedUserOpForHashing.preVerificationGas), // Convert to Hex
                maxFeePerGas: toHex(fallbackMaxFee),
                maxPriorityFeePerGas: toHex(fallbackMaxPriority),
                paymasterAndData: packedUserOpForHashing.paymasterAndData,
                signature: packedUserOpForHashing.signature
            };
            
    
            const userOpHash = await client.readContract({
                address: ENTRY_POINT_ADDRESS,
                abi: [{ inputs: [{ components: [{name:"sender",type:"address"},{name:"nonce",type:"uint256"},{name:"initCode",type:"bytes"},{name:"callData",type:"bytes"},{name:"accountGasLimits",type:"bytes32"},{name:"preVerificationGas",type:"uint256"},{name:"gasFees",type:"bytes32"},{name:"paymasterAndData",type:"bytes"},{name:"signature",type:"bytes"}], name: "userOp", type: "tuple" }], name: "getUserOpHash", outputs: [{ name: "", type: "bytes32" }], stateMutability: "view", type: "function" }] as const,
                functionName: 'getUserOpHash',
                args: [packedUserOpForHashing]
            });
            console.log(`   🔑 Hash: ${userOpHash}`);
    
            const fallbackSignature = await ownerAccount.signMessage({ message: { raw: userOpHash } });
            packedUserOpForHashing.signature = fallbackSignature;
            unpackedUserOpForSending.signature = fallbackSignature;
            
            // Send Unpacked
            try {
                 console.log("   📨 Sending (Fallback Unpacked)...");
                 const txHash = await client.request({
                     method: 'eth_sendUserOperation' as any,
                     params: [unpackedUserOpForSending, ENTRY_POINT_ADDRESS]
                 });
                 console.log(`   ✅ Sent! https://jiffyscan.xyz/userOpHash/${txHash}?network=sepolia`);
                 await sleep(5000);
            } catch (e: any) {
                console.error("   ❌ Execution Failed:", e.message || e);
                // Last Resort: Try Packed just in case (we did this before, but good to have toggle if unpacked fails)
            }
             
            // Skip the rest of the main loop logic for this iteration to avoid duplicate sending
            continue; 
        }
        // ---------------------------------------------------------
        // Happy Path (Estimation Succeeded) Logic
        // ---------------------------------------------------------
        
        // If we reached here, Estimation Succeeded and finalUserOp is set with PACKED fields
        // We need to calculcate hash, sign, and send.
        
        const userOpHash = await client.readContract({
            address: ENTRY_POINT_ADDRESS,
            abi: [{ inputs: [{ components: [{name:"sender",type:"address"},{name:"nonce",type:"uint256"},{name:"initCode",type:"bytes"},{name:"callData",type:"bytes"},{name:"accountGasLimits",type:"bytes32"},{name:"preVerificationGas",type:"uint256"},{name:"gasFees",type:"bytes32"},{name:"paymasterAndData",type:"bytes"},{name:"signature",type:"bytes"}], name: "userOp", type: "tuple" }], name: "getUserOpHash", outputs: [{ name: "", type: "bytes32" }], stateMutability: "view", type: "function" }] as const,
            functionName: 'getUserOpHash',
            args: [finalUserOp]
        });
        console.log(`   🔑 Hash: ${userOpHash}`);

        const signature = await ownerAccount.signMessage({ message: { raw: userOpHash } });
        finalUserOp.signature = signature;

        // 7. Send
        console.log("   📨 Sending (Estimation Succeeded)...");
        try {
            const txHash = await client.request({
                method: 'eth_sendUserOperation' as any,
                params: [finalUserOp, ENTRY_POINT_ADDRESS]
            });
            console.log(`   ✅ Sent! https://jiffyscan.xyz/userOpHash/${txHash}?network=sepolia`);

            await sleep(5000);

        } catch (e: any) {
            console.error("   ❌ Execution Failed:", e.message || e);
            if(e.details) console.error("      Details:", e.details);
        }
    }
}

main().catch(console.error);
