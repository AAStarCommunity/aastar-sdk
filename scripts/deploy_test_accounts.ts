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
import { sepolia } from 'viem/chains';

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
        chain: sepolia,
        transport: http(BUNDLER_RPC) // Bundler RPC for UserOp methods
    });
    
    // For normal reads/funds
    const publicClient = createPublicClient({ chain: sepolia, transport: http(rpcUrl) });
    
    // Owner Account
    const ownerAccount = privateKeyToAccount(parseKey(process.env.PRIVATE_KEY_JASON));
    console.log(`Owner: ${ownerAccount.address}`);

    // Supplier (Optional)
    const supplierKey = process.env.PRIVATE_KEY_SUPPLIER ? parseKey(process.env.PRIVATE_KEY_SUPPLIER) : undefined;

    // --- Process 3 Accounts ---
    const salts = [0n, 1n, 2n];
    const labels = ['Baseline (A)', 'Standard (B)', 'SuperPaymaster (C)'];

    for (let i = 0; i < 3; i++) {
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
        if (balance < parseEther("0.01")) {
             console.log("   ⚠️  Insufficient funds (< 0.01 ETH).");
             if (supplierKey) {
                 try {
                     const supplier = privateKeyToAccount(supplierKey);
                     const supplierWallet = createWalletClient({ chain: sepolia, transport: http(rpcUrl), account: supplier });
                     
                     // Check supplier balance
                     const supBal = await publicClient.getBalance({ address: supplier.address });
                     if (supBal < parseEther("0.02")) {
                         console.log(`   ❌ Supplier ${supplier.address} also poor (${formatEther(supBal)} ETH). Manual funding required.`);
                     } else {
                        console.log("   💸 Funding 0.02 ETH from Supplier...");
                        const tx = await supplierWallet.sendTransaction({
                            to: senderAddress as Hex,
                            value: parseEther("0.02"),
                            chain: sepolia, 
                            account: supplier
                        });
                        console.log(`      Tx: ${tx}`);
                        await publicClient.waitForTransactionReceipt({ hash: tx });
                        console.log("      ✅ Funded.");
                     }
                 } catch(e: any) {
                     console.error("   ❌ Funding failed:", e.message);
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

        const partialUserOp = {
            sender: senderAddress as Hex,
            nonce: toHex(nonce), // Must be hex
            initCode: initCode, 
            callData: callData,
            accountGasLimits: "0x" as Hex, // Alchemy might prefer valid placeholder or Just 0x
            preVerificationGas: "0x0" as Hex, // Hex 0, not decimal "0"
            gasFees: "0x" as Hex,
            paymasterAndData: "0x" as Hex,
            signature: "0x" as Hex
        };

        // 5. Estimate Gas
        let userOp: any;
        try {
            // Alchemy requires valid hex for all fields even in dummy op
            const dummyOp = {
                ...partialUserOp,
                signature: "0xfffffffffffffffffffffffffffffff0000000000000000000000000000000007aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1c" as Hex
            };

            const gasEstimate: any = await client.request({
                method: 'eth_estimateUserOperationGas' as any,
                params: [dummyOp, ENTRY_POINT_ADDRESS]
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

            userOp = {
                ...partialUserOp,
                accountGasLimits: toHex(accountGasLimits), // Ensure Hex String
                preVerificationGas: toHex(preVerificationGas), // Ensure Hex String
                gasFees: toHex(gasFees) // Ensure Hex String
            };

        } catch (estParamsError: any) {
             console.log("      ⚠️ Estimation failed, using fallback...");
             // console.error(estParamsError);
             const accountGasLimits = toHex(concat([pad(toBytes(1500000n), { size: 16 }), pad(toBytes(100000n), { size: 16 })]));
             const gasFees = toHex(concat([pad(toBytes(parseEther("2", "gwei")), { size: 16 }), pad(toBytes(parseEther("20", "gwei")), { size: 16 })]));
             userOp = {
                ...partialUserOp,
                accountGasLimits,
                preVerificationGas: toHex(100000n),
                gasFees
            };
        }

        // 6. Sign
        const userOpHash = await client.readContract({
            address: ENTRY_POINT_ADDRESS,
            abi: [{ inputs: [{ components: [{name:"sender",type:"address"},{name:"nonce",type:"uint256"},{name:"initCode",type:"bytes"},{name:"callData",type:"bytes"},{name:"accountGasLimits",type:"bytes32"},{name:"preVerificationGas",type:"uint256"},{name:"gasFees",type:"bytes32"},{name:"paymasterAndData",type:"bytes"},{name:"signature",type:"bytes"}], name: "userOp", type: "tuple" }], name: "getUserOpHash", outputs: [{ name: "", type: "bytes32" }], stateMutability: "view", type: "function" }] as const,
            functionName: 'getUserOpHash',
            args: [userOp]
        });
        console.log(`   🔑 Hash: ${userOpHash}`);

        const signature = await ownerAccount.signMessage({ message: { raw: userOpHash } });
        userOp.signature = signature;

        // 7. Send
        console.log("   📨 Sending...");
        try {
            const txHash = await client.request({
                method: 'eth_sendUserOperation' as any,
                params: [userOp, ENTRY_POINT_ADDRESS]
            });
            console.log(`   ✅ Sent! https://jiffyscan.xyz/userOpHash/${txHash}?network=sepolia`);

            await sleep(5000);

        } catch (e: any) {
            console.error("   ❌ Execution Failed:", e.message || e);
        }
    }
}

main().catch(console.error);
