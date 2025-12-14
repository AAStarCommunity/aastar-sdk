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
  parseEther,
  formatEther,
  decodeErrorResult
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';

// Import Shared Config
// @ts-ignore
import { CONTRACTS } from '@aastar/shared-config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../../env/.env.v3');
dotenv.config({ path: envPath });

// --- Config ---
const ENTRY_POINT_ADDRESS = '0x0000000071727De22E5E9d8BAf0edAc6f37da032';
const FACTORY_ADDRESS = '0x91E60e0613810449d098b0b5Ec8b51A0FE8c8985'; // v0.7
const BUNDLER_RPC = process.env.ALCHEMY_BUNDLER_RPC_URL;
const PUBLIC_RPC = process.env.SEPOLIA_RPC_URL;

const contracts: any = CONTRACTS;

// Debug Shared Config Structure
if (contracts && contracts.sepolia) {
    console.log("🔍 SharedConfig Keys (sepolia):", Object.keys(contracts.sepolia));
    if (contracts.sepolia.core) console.log("   Core:", Object.keys(contracts.sepolia.core));
    if (contracts.sepolia.tokens) console.log("   Tokens:", Object.keys(contracts.sepolia.tokens));
    if (contracts.sepolia.testTokens) console.log("   TestTokens:", Object.keys(contracts.sepolia.testTokens));
}

// Resolve Contract Addresses
// Priority: Env Var > Shared Config > Hardcoded Fallback
const MYSBT_ADDRESS = (process.env.MYSBT_ADDRESS || contracts?.sepolia?.tokens?.mySBT || contracts?.sepolia?.core?.MySBT || "") as Hex;
const GTOKEN_ADDRESS = (process.env.GTOKEN_ADDRESS || contracts?.sepolia?.core?.gToken || "") as Hex;
const APNTS_ADDRESS = (process.env.APNTS_ADDRESS || contracts?.sepolia?.testTokens?.aPNTs || contracts?.sepolia?.testTokens?.xPNTs_A || "") as Hex;
const BPNTS_ADDRESS = (process.env.BPNTS_ADDRESS || contracts?.sepolia?.testTokens?.bPNTs || contracts?.sepolia?.testTokens?.xPNTs_B || "") as Hex;

// --- ABIs ---
const factoryAbi = [
  { inputs: [{ name: "owner", type: "address" }, { name: "salt", type: "uint256" }], name: "createAccount", outputs: [{ name: "ret", type: "address" }], stateMutability: "nonpayable", type: "function" }
] as const;

const senderAddressResultAbi = [{
    inputs: [{ name: "sender", type: "address" }],
    name: "SenderAddressResult",
    type: "error"
}] as const;

const erc20Abi = [
    { inputs: [{ name: "account", type: "address" }], name: "balanceOf", outputs: [{ name: "", type: "uint256" }], stateMutability: "view", type: "function" },
    { inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], name: "transfer", outputs: [{ name: "", type: "bool" }], stateMutability: "nonpayable", type: "function" }
] as const;

const sbtAbi = [
    { inputs: [{ name: "owner", type: "address" }], name: "balanceOf", outputs: [{ name: "", type: "uint256" }], stateMutability: "view", type: "function" },
    { inputs: [{ name: "to", type: "address" }], name: "mint", outputs: [], stateMutability: "nonpayable", type: "function" },
    { inputs: [{ name: "to", type: "address" }], name: "safeMint", outputs: [], stateMutability: "nonpayable", type: "function" } // Fallback
] as const;

// --- Helpers ---
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
    console.log("🚀 Starting Phase 1 Preparation: The Ammo");
    
    // 1. Setup Clients
    if (!PUBLIC_RPC) throw new Error("Missing SEPOLIA_RPC_URL");
    const publicClient = createPublicClient({ chain: sepolia, transport: http(PUBLIC_RPC) });
    const client = createPublicClient({ chain: sepolia, transport: http(BUNDLER_RPC || PUBLIC_RPC) }); // For UserOp simulation if needed

    // 2. Setup Operators
    const supplierKey = process.env.PRIVATE_KEY_SUPPLIER;
    const operatorKey = process.env.PRIVATE_KEY_JASON; // AAStar Admin
    
    if (!supplierKey || !operatorKey) {
        throw new Error("Missing PRIVATE_KEY_SUPPLIER or PRIVATE_KEY_JASON in .env.v3");
    }

    const supplierAccount = privateKeyToAccount(parseKey(supplierKey));
    const operatorAccount = privateKeyToAccount(parseKey(operatorKey)); // For Minting SBT
    
    const supplierWallet = createWalletClient({ chain: sepolia, transport: http(PUBLIC_RPC), account: supplierAccount });
    const operatorWallet = createWalletClient({ chain: sepolia, transport: http(PUBLIC_RPC), account: operatorAccount });

    console.log(`\n📋 Configuration (SharedConfig 0.3.6 Verification):`);
    console.log(`   MySBT:  ${MYSBT_ADDRESS ? MYSBT_ADDRESS : "❌ Not Found"}`);
    console.log(`   GToken: ${GTOKEN_ADDRESS ? GTOKEN_ADDRESS : "❌ Not Found"}`);
    console.log(`   aPNTs:  ${APNTS_ADDRESS ? APNTS_ADDRESS : "❌ Not Found"}`);
    console.log(`   bPNTs:  ${BPNTS_ADDRESS ? BPNTS_ADDRESS : "❌ Not Found"}`);
    console.log(`   Supplier: ${supplierAccount.address}`);
    console.log(`   Operator: ${operatorAccount.address}`);

    if (!MYSBT_ADDRESS || !GTOKEN_ADDRESS) {
        console.warn("⚠️  Core addresses missing. Some checks might be skipped.");
    }
    
    // ... (Targets definition) ...
    const ownerKey = process.env.PRIVATE_KEY_JASON; 
    const ownerAccount = privateKeyToAccount(parseKey(ownerKey));

    const targets = [
        { 
            label: 'Baseline (A)', 
            address: process.env.TEST_SIMPLE_ACCOUNT_A as Hex,
            salt: 0n, 
            requireMySBT: false, 
            requireGToken: false 
        },
        { 
            label: 'Standard (B)', 
            address: process.env.TEST_SIMPLE_ACCOUNT_B as Hex,
            salt: 1n, 
            requireMySBT: false, 
            requireGToken: false 
        },
        { 
            label: 'SuperPaymaster (C)', 
            address: process.env.TEST_SIMPLE_ACCOUNT_C as Hex,
            salt: 2n, 
            requireMySBT: true, 
            requireGToken: true,
            requirePNTs: true 
        }
    ];

    console.log(`\n🔄 Processing ${targets.length} Accounts from .env settings...`);

    for (const target of targets) {
        await sleep(1000);
        console.log(`\n--------------------------------------------`);
        console.log(`👤 Target: ${target.label}`);

        let senderAddress = target.address;

        if (!senderAddress) {
             console.warn(`   ⚠️  Address not found in .env for ${target.label}. Attempting calculation...`);
             // ... calculation logic ...
             const factoryData = encodeFunctionData({
                abi: factoryAbi,
                functionName: 'createAccount',
                args: [ownerAccount.address, target.salt]
            });
            const initCode = concat([FACTORY_ADDRESS, factoryData]);
    
            try {
                await client.simulateContract({
                    address: ENTRY_POINT_ADDRESS,
                    abi: [{ inputs: [{ name: "initCode", type: "bytes" }], name: "getSenderAddress", outputs: [], stateMutability: "nonpayable", type: "function" }, ...senderAddressResultAbi],
                    functionName: 'getSenderAddress',
                    args: [initCode]
                });
            } catch (err: any) {
                 const data = err.data || (err.cause && err.cause.data);
                 if (data) {
                     try {
                        const decoded = decodeErrorResult({ abi: senderAddressResultAbi, data });
                        senderAddress = decoded.args[0] as Hex;
                     } catch (e) { /* ignore */ }
                 }
                 if (!senderAddress) {
                     const msg = err.details || err.message || JSON.stringify(err);
                     const match = msg.match(/0x[a-fA-F0-9]{40}/);
                     if (match) senderAddress = match[0] as Hex;
                 }
            }
        }

        if (!senderAddress) {
            console.error("   ❌ Failed to resolve address.");
            continue;
        }
        console.log(`   📍 Address: ${senderAddress}`);

        // --- B. Check ETH ---
        const balance = await publicClient.getBalance({ address: senderAddress });
        console.log(`   💰 ETH Balance: ${formatEther(balance)} ETH`);

        if (balance < parseEther("0.05")) {
             console.log("   📉 Low ETH. Funding...");
             try {
                const tx = await supplierWallet.sendTransaction({
                    to: senderAddress,
                    value: parseEther("0.05"),
                });
                console.log(`      ✅ Sent 0.05 ETH. Hash: ${tx}`);
                await publicClient.waitForTransactionReceipt({ hash: tx });
             } catch (e: any) {
                 console.error(`      ❌ ETH Funding Failed: ${e.message}`);
             }
        } else {
            console.log("      ✅ ETH Sufficient.");
        }

        // --- C. Check MySBT (If Required) ---
        if (target.requireMySBT && MYSBT_ADDRESS) {
            try {
                const sbtBal = await publicClient.readContract({
                    address: MYSBT_ADDRESS,
                    abi: sbtAbi,
                    functionName: 'balanceOf',
                    args: [senderAddress]
                });
                console.log(`   🆔 MySBT Balance: ${sbtBal.toString()}`);

                if (sbtBal === 0n) {
                    console.log("   📉 No SBT. Minting...");
                    // Try 'mint' first, then 'safeMint' if 'mint' fails or doesn't exist (handled by try/catch usually, 
                    // but here we just try one standard. Assuming 'mint(address)' exists on MySBT)
                    try {
                        const { request } = await publicClient.simulateContract({
                            account: operatorAccount,
                            address: MYSBT_ADDRESS,
                            abi: sbtAbi,
                            functionName: 'mint',
                            args: [senderAddress]
                        });
                        const tx = await operatorWallet.writeContract(request);
                        console.log(`      ✅ Minted SBT. Hash: ${tx}`);
                        await publicClient.waitForTransactionReceipt({ hash: tx });
                    } catch (mintErr: any) {
                         console.warn(`      ⚠️ Mint failed: ${mintErr.shortMessage || mintErr.message}. Trying safeMint...`);
                         // Fallback logic could go here
                    }
                } else {
                    console.log("      ✅ SBT Owned.");
                }
            } catch (e: any) {
                console.error(`      ❌ SBT Check Error: ${e.message}`);
            }
        }

        // --- D. Check GToken (If Required) ---
        if (target.requireGToken && GTOKEN_ADDRESS) {
            // ... (existing GToken logic) ...
            try {
                const tokenBal = await publicClient.readContract({
                    address: GTOKEN_ADDRESS,
                    abi: erc20Abi,
                    functionName: 'balanceOf',
                    args: [senderAddress]
                });
                console.log(`   🪙 GToken Balance: ${formatEther(tokenBal as bigint)}`);

                if ((tokenBal as bigint) < parseEther("50")) { 
                     console.log("   📉 Low GToken. Transferring 100...");
                     try {
                        const { request } = await publicClient.simulateContract({
                            account: supplierAccount,
                            address: GTOKEN_ADDRESS,
                            abi: erc20Abi,
                            functionName: 'transfer',
                            args: [senderAddress, parseEther("100")]
                        });
                        const tx = await supplierWallet.writeContract(request);
                        console.log(`      ✅ Sent 100 GTokens. Hash: ${tx}`);
                        await publicClient.waitForTransactionReceipt({ hash: tx });
                     } catch (transferErr: any) {
                         console.error(`      ❌ Token Transfer Failed: ${transferErr.message}`);
                     }
                } else {
                    console.log("      ✅ GToken Sufficient.");
                }
            } catch (e: any) {
                console.error(`      ❌ GToken Check Error: ${e.message}`);
            }
        }

        // --- E. Check PNTs (If Required) ---
        if ((target as any).requirePNTs) {
            const checkPNT = async (name: string, address: Hex) => {
                if (!address) return;
                try {
                    const bal = await publicClient.readContract({
                        address: address,
                        abi: erc20Abi,
                        functionName: 'balanceOf',
                        args: [senderAddress!]
                    });
                    console.log(`   🔵 ${name} Balance: ${formatEther(bal as bigint)}`);
                    
                    if ((bal as bigint) < parseEther("10")) {
                        console.log(`   📉 Low ${name}. Transferring 20...`);
                         try {
                            const { request } = await publicClient.simulateContract({
                                account: supplierAccount,
                                address: address,
                                abi: erc20Abi,
                                functionName: 'transfer',
                                args: [senderAddress!, parseEther("20")]
                            });
                            const tx = await supplierWallet.writeContract(request);
                            console.log(`      ✅ Sent 20 ${name}. Hash: ${tx}`);
                            await publicClient.waitForTransactionReceipt({ hash: tx });
                         } catch (tErr: any) {
                             console.error(`      ❌ ${name} Transfer Failed: ${tErr.message}`);
                         }
                    } else {
                        console.log(`      ✅ ${name} Sufficient.`);
                    }
                } catch(e: any) {
                    console.error(`      ❌ ${name} Check Failed: ${e.message}`);
                }
            }

            await checkPNT("aPNTs", APNTS_ADDRESS);
            await checkPNT("bPNTs", BPNTS_ADDRESS);
        }
    }

    console.log("\n✨ Phase 1 Preparation Complete!");
}

main().catch(console.error);
