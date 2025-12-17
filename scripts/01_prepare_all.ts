import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createPublicClient, createWalletClient, http, parseAbi, parseEther, formatEther, getContract, maxUint256, Hex, Address, encodeAbiParameters, keccak256, toBytes } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// ABIs
const factoryAbi = [
  { inputs: [{ name: "owner", type: "address" }, { name: "salt", type: "uint256" }], name: "createAccount", outputs: [{ name: "ret", type: "address" }], stateMutability: "nonpayable", type: "function" }
] as const;

const paymasterFactoryAbi = [
    { inputs: [
        { name: "token", type: "address" },
        { name: "sbt", type: "address" },
        { name: "treasury", type: "address" },
        { name: "feeRate", type: "uint256" }
    ], name: "deployPaymaster", outputs: [{ name: "", type: "address" }], stateMutability: "nonpayable", type: "function" }
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
    { inputs: [{ name: "to", type: "address" }], name: "mint", outputs: [], stateMutability: "nonpayable", type: "function" }
] as const;

const entryPointAbi = [
    { inputs: [{ name: "account", type: "address" }], name: "balanceOf", outputs: [{ name: "", type: "uint256" }], stateMutability: "view", type: "function" },
    { inputs: [{ name: "account", type: "address" }], name: "depositTo", outputs: [], stateMutability: "payable", type: "function" }
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
    console.log("🚀 Starting Phase 1 Preparation: The Ammo (Deposits & setup)");
    
    // --- Setup Clients ---
    const rpcUrl = process.env.SEPOLIA_RPC_URL;
    console.log(`🔌 Connecting to RPC: ${rpcUrl}`);
    if (!rpcUrl) throw new Error("Missing SEPOLIA_RPC_URL");
    const client = createPublicClient({ 
        chain: CHAIN,
        transport: http(rpcUrl)
    });
    const client = createPublicClient({ chain: sepolia, transport: http(BUNDLER_RPC || RPC_URL) }); 

    // 2. Setup Operators
    const supplierKey = process.env.PRIVATE_KEY_SUPPLIER;
    const operatorKey = process.env.PRIVATE_KEY_JASON; 
    
    if (!supplierKey || !operatorKey) throw new Error("Missing Keys");

    const supplierAccount = privateKeyToAccount(parseKey(supplierKey));
    const operatorAccount = privateKeyToAccount(parseKey(operatorKey));
    
    const supplierWallet = createWalletClient({ chain: sepolia, transport: http(PUBLIC_RPC), account: supplierAccount });
    const operatorWallet = createWalletClient({ chain: sepolia, transport: http(PUBLIC_RPC), account: operatorAccount });

    console.log(`\n📋 Configuration:`);
    console.log(`   MySBT:    ${MYSBT_ADDRESS || "❌"}`);
    console.log(`   GToken:   ${GTOKEN_ADDRESS || "❌"}`);
    console.log(`   aPNTs:    ${APNTS_ADDRESS || "❌"}`);
    console.log(`   bPNTs:    ${BPNTS_ADDRESS || "❌"}`);
    console.log(`   PIM:      ${PIM_ADDRESS}`);
    console.log(`   Factory:  ${PAYMASTER_FACTORY_ADDRESS}`);
    
    const ownerKey = process.env.PRIVATE_KEY_JASON; 
    const ownerAccount = privateKeyToAccount(parseKey(ownerKey));

    const targets = [
        { 
            label: 'Baseline (A - Pimlico)', 
            address: process.env.TEST_SIMPLE_ACCOUNT_A as Hex,
            salt: 0n, 
            requireMySBT: false, 
            requireGToken: false,
            requirePIM: true
        },
        { 
            label: 'Standard (B - Paymaster V4/AOA)', 
            address: process.env.TEST_SIMPLE_ACCOUNT_B as Hex,
            salt: 1n, 
            requireMySBT: true, 
            requireBPNTs: true 
        },
        { 
            label: 'SuperPaymaster (C)', 
            address: process.env.TEST_SIMPLE_ACCOUNT_C as Hex,
            salt: 2n, 
            requireMySBT: true, 
            requireGToken: true,
            requireAPNTs: true 
        }
    ];

    console.log(`\n🔄 Processing ${targets.length} Accounts...`);

    for (const target of targets) {
        await sleep(500);
        console.log(`\n--------------------------------------------`);
        console.log(`👤 Target: ${target.label}`);

        let senderAddress = target.address;
        const ACCOUNT_FACTORY = '0x91E60e0613810449d098b0b5Ec8b51A0FE8c8985';

        if (!senderAddress) {
             console.warn(`   ⚠️  Address missing. Calculating...`);
             const factoryData = encodeFunctionData({ abi: factoryAbi, functionName: 'createAccount', args: [ownerAccount.address, target.salt] });
             const initCode = concat([ACCOUNT_FACTORY, factoryData]);
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
                     } catch (e) {}
                 }
                 if (!senderAddress) {
                     const match = (err.details || err.message).match(/0x[a-fA-F0-9]{40}/);
                     if (match) senderAddress = match[0] as Hex;
                 }
            }
        }
        
        if (senderAddress) console.log(`   📍 Address: ${senderAddress}`);

        // 1. ETH Check
        if (senderAddress) {
            const balance = await publicClient.getBalance({ address: senderAddress });
            if (balance < parseEther("0.05")) {
                 console.log("   📉 Low ETH. Funding...");
                 try {
                    const tx = await supplierWallet.sendTransaction({ to: senderAddress, value: parseEther("0.05") });
                    await publicClient.waitForTransactionReceipt({ hash: tx });
                    console.log(`      ✅ Funded ETH`);
                 } catch (e) { console.error("      ❌ ETH Fail", e); }
            }
        }

        // 2. Assets Check
        if (senderAddress) {
            // MySBT
            if (target.requireMySBT && MYSBT_ADDRESS) {
                 try {
                     const sbtBal = await publicClient.readContract({ address: MYSBT_ADDRESS, abi: sbtAbi, functionName: 'balanceOf', args: [senderAddress] });
                     if (sbtBal === 0n) {
                         console.log("   📉 Minting MySBT...");
                         const { request } = await publicClient.simulateContract({ account: operatorAccount, address: MYSBT_ADDRESS, abi: sbtAbi, functionName: 'mint', args: [senderAddress] });
                         const tx = await operatorWallet.writeContract(request);
                         await publicClient.waitForTransactionReceipt({ hash: tx });
                         console.log(`      ✅ Minted`);
                     }
                 } catch (e: any) { console.error(`      ⚠️ SBT Error: ${e.message}`); }
            }
            
            // aPNTs
            if ((target as any).requireAPNTs && APNTS_ADDRESS) {
                try {
                    const bal = await publicClient.readContract({ address: APNTS_ADDRESS, abi: erc20Abi, functionName: 'balanceOf', args: [senderAddress] });
                    if ((bal as bigint) < parseEther("10")) {
                        console.log("   📉 Transferring aPNTs...");
                        const { request } = await publicClient.simulateContract({ account: supplierAccount, address: APNTS_ADDRESS, abi: erc20Abi, functionName: 'transfer', args: [senderAddress, parseEther("50")] });
                        await supplierWallet.writeContract(request);
                        console.log(`      ✅ Sent aPNTs`);
                    }
                } catch(e: any) { console.error(`      ⚠️ aPNTs Error: ${e.message}`); }
            }

             // bPNTs
            if ((target as any).requireBPNTs && BPNTS_ADDRESS) {
                try {
                    const bal = await publicClient.readContract({ address: BPNTS_ADDRESS, abi: erc20Abi, functionName: 'balanceOf', args: [senderAddress] });
                    if ((bal as bigint) < parseEther("10")) {
                         console.log("   📉 Transferring bPNTs...");
                        const { request } = await publicClient.simulateContract({ account: supplierAccount, address: BPNTS_ADDRESS, abi: erc20Abi, functionName: 'transfer', args: [senderAddress, parseEther("50")] });
                        await supplierWallet.writeContract(request);
                        console.log(`      ✅ Sent bPNTs`);
                    }
                } catch(e:any) { console.error(`      ⚠️ bPNTs Error: ${e.message}`); }
            }

            // PIM
            if ((target as any).requirePIM && PIM_ADDRESS) {
                try {
                    const bal = await publicClient.readContract({ address: PIM_ADDRESS, abi: erc20Abi, functionName: 'balanceOf', args: [senderAddress] });
                    if ((bal as bigint) < parseEther("0.1")) {
                         console.log("   📉 Transferring PIM...");
                        const { request } = await publicClient.simulateContract({ account: supplierAccount, address: PIM_ADDRESS, abi: erc20Abi, functionName: 'transfer', args: [senderAddress, parseEther("1.0")] });
                        await supplierWallet.writeContract(request);
                        console.log(`      ✅ Sent PIM`);
                    }
                } catch(e:any) { console.error(`      ⚠️ PIM Error (Ignored): ${e.message}`); }
            }
        }
    }

    // 4. Verify/Deploy Paymaster V4.1 (AOA Mode for Group B)
    console.log(`\n--------------------------------------------`);
    console.log(`🏭 Verifying Paymaster V4.1 (Group B / AOA)...`);
    
    if (!BPNTS_ADDRESS) {
        console.error("❌ Stats: Missing bPNTs Address! Cannot deploy Paymaster V4 properly.");
    } else {
        let paymasterV4Address: Hex | undefined;

        try {
            // Predict address
            const { result } = await publicClient.simulateContract({
                address: PAYMASTER_FACTORY_ADDRESS,
                abi: paymasterFactoryAbi,
                functionName: 'deployPaymaster',
                args: [
                    BPNTS_ADDRESS, 
                    MYSBT_ADDRESS || "0x0000000000000000000000000000000000000000", 
                    supplierAccount.address, 
                    200n
                ],
                account: operatorAccount
            });
            paymasterV4Address = result;
            console.log(`   📍 Paymaster Address (for bPNTs): ${paymasterV4Address}`);

            const code = await publicClient.getBytecode({ address: paymasterV4Address });
            if (code && code.length > 2) {
                console.log("   ✅ Contract Deployed");
            } else {
                console.log("   🏗️  Deploying Paymaster...");
                const tx = await operatorWallet.writeContract({
                    address: PAYMASTER_FACTORY_ADDRESS,
                    abi: paymasterFactoryAbi,
                    functionName: 'deployPaymaster',
                    args: [BPNTS_ADDRESS, MYSBT_ADDRESS!, supplierAccount.address, 200n],
                    chain: sepolia,
                    account: operatorAccount
                });
                console.log(`      ✅ Deployed. Hash: ${tx}`);
                // await publicClient.waitForTransactionReceipt({ hash: tx }); // Skip wait to prevent timeout if slow
                console.log("      (Check explorer if pending)");
            }

            // 5. Deposit ETH
            const epBal = await publicClient.readContract({
                address: ENTRY_POINT_ADDRESS,
                abi: entryPointAbi,
                functionName: 'balanceOf',
                args: [paymasterV4Address]
            });
            console.log(`   💰 EntryPoint Deposit: ${formatEther(epBal)} ETH`);
            
            if (epBal < parseEther("0.1")) {
                console.log("   📉 Low Deposit. Depositing 0.2 ETH...");
                try {
                const tx = await supplierWallet.writeContract({
                    address: ENTRY_POINT_ADDRESS,
                    abi: entryPointAbi,
                    functionName: 'depositTo',
                    args: [paymasterV4Address],
                    value: parseEther("0.2")
                });
                console.log(`      ✅ Deposited. Hash: ${tx}`);
                } catch(e:any) { console.error("      ❌ Deposit Error:", e.message); }
            } else {
                console.log("      ✅ Deposit Sufficient");
            }

        } catch (e: any) {
            console.error("   ❌ Paymaster Init Failed:", e.message);
        }

        console.log("\n============================================");
        console.log("✅ SUMMARY OF PAYMASTERS");
        console.log("============================================");
        console.log(`1. Pimlico (Group A):        ${PIM_ADDRESS} (Token) via RPC`);
        console.log(`2. Paymaster V4 (Group B):   ${paymasterV4Address}`);
        console.log(`3. SuperPaymaster (Group C): ${SUPER_PAYMASTER_ADDRESS}`);
        console.log("============================================");
    }
}

main().catch(console.error);
