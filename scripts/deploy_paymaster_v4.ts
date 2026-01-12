import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { 
  createPublicClient, 
  createWalletClient, 
  http, 
  Hex, 
  parseEther, 
  formatEther
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';

// @ts-ignore
import { CONTRACTS } from '@aastar/shared-config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../../env/.env.anvil');
dotenv.config({ path: envPath });

// --- Config ---
const contracts: any = CONTRACTS;
const PUBLIC_RPC = process.env.SEPOLIA_RPC_URL;
const PAYMASTER_FACTORY_ADDRESS = (process.env.PAYMASTER_FACTORY_ADDRESS || contracts?.sepolia?.core?.paymasterFactory || "0x65Cf6C4ab3d40f3C919b6F3CADC09Efb72817920") as Hex;
const BPNTS_ADDRESS = (process.env.BPNTS_ADDRESS || contracts?.sepolia?.testTokens?.bPNTs || contracts?.sepolia?.testTokens?.xPNTs_B) as Hex;
const MYSBT_ADDRESS = (process.env.MYSBT_ADDRESS || contracts?.sepolia?.tokens?.mySBT || contracts?.sepolia?.core?.MySBT) as Hex;

// ABIs
const paymasterFactoryAbi = [
    { inputs: [
        { name: "token", type: "address" },
        { name: "sbt", type: "address" },
        { name: "treasury", type: "address" },
        { name: "feeRate", type: "uint256" }
    ], name: "deployPaymaster", outputs: [{ name: "", type: "address" }], stateMutability: "nonpayable", type: "function" },
    { inputs: [{ name: "token", type: "address" }], name: "getPaymaster", outputs: [{ name: "", type: "address" }], stateMutability: "view", type: "function" }
] as const;

// Helper
function parseKey(key: string | undefined): Hex {
    if (!key) throw new Error("Private Key is undefined");
    if (!key.startsWith("0x")) {
         if (key.length === 64) return `0x${key}` as Hex;
         throw new Error(`Private Key must start with 0x. Got: ${key}`);
    }
    return key as Hex;
}

async function main() {
    console.log("🏭 Deploying/Finding Paymaster V4 (Target B - AOA)...");

    if (!PUBLIC_RPC) throw new Error("Missing RPC");
    const publicClient = createPublicClient({ chain: foundry, transport: http(PUBLIC_RPC) });

    const supplierKey = process.env.PRIVATE_KEY_SUPPLIER;
    const operatorKey = process.env.PRIVATE_KEY_JASON;
    if (!supplierKey || !operatorKey) throw new Error("Missing Keys");

    const operatorAccount = privateKeyToAccount(parseKey(operatorKey)); // Operator deploys
    const supplierAccount = privateKeyToAccount(parseKey(supplierKey)); // Supplier is Treasury

    const operatorWallet = createWalletClient({ chain: foundry, transport: http(PUBLIC_RPC), account: operatorAccount });

    console.log(`   Config:`);
    console.log(`   Factory:  ${PAYMASTER_FACTORY_ADDRESS}`);
    console.log(`   bPNTs:    ${BPNTS_ADDRESS}`);
    console.log(`   MySBT:    ${MYSBT_ADDRESS}`);
    console.log(`   Treasury: ${supplierAccount.address}`);
    console.log("-----------------------------------------");

    if (!BPNTS_ADDRESS) {
        console.error("❌ Missing bPNTs Address.");
        return;
    }

    // 1. Try getPaymaster(token)
    try {
        const pm = await publicClient.readContract({
            address: PAYMASTER_FACTORY_ADDRESS,
            abi: paymasterFactoryAbi,
            functionName: 'getPaymaster',
            args: [BPNTS_ADDRESS]
        });
        if (pm && pm !== '0x0000000000000000000000000000000000000000') {
            console.log(`✅ Found Existing Paymaster: ${pm}`);
            console.log("👉 Please update .env.anvil -> PAYMASTER_V4_ADDRESS");
            return;
        }
    } catch (e: any) {
        console.log("ℹ️  getPaymaster not supported or failed. Attempting deployment...");
    }

    // 2. Deploy
    try {
        console.log("🏗️  Simulating deployPaymaster...");
        const { result } = await publicClient.simulateContract({
            address: PAYMASTER_FACTORY_ADDRESS,
            abi: paymasterFactoryAbi,
            functionName: 'deployPaymaster',
            args: [
                BPNTS_ADDRESS, 
                MYSBT_ADDRESS!, 
                supplierAccount.address, 
                200n
            ],
            account: operatorAccount
        });
        console.log(`✅ Simulation Success. Result Address: ${result}`);
        
        console.log("🚀 Executing Deployment Transaction...");
        const tx = await operatorWallet.writeContract({
            address: PAYMASTER_FACTORY_ADDRESS,
            abi: paymasterFactoryAbi,
            functionName: 'deployPaymaster',
            args: [BPNTS_ADDRESS, MYSBT_ADDRESS!, supplierAccount.address, 200n],
            chain: foundry,
            account: operatorAccount
        });
        console.log(`⏳ Waiting for Receipt (Tx: ${tx})...`);
        const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
        console.log(`✅ Deployed!`);
        
        // Try getPaymaster again or infer from logs if simulate gave address.
        // But simulation result IS the address.
        console.log(`\n🎉 PAYMASTER V4 ADDRESS: ${result}`);
        console.log("👉 Please update .env.anvil -> PAYMASTER_V4_ADDRESS");

    } catch (e: any) {
        console.error(`❌ Deployment Failed: ${e.message}`);
        if (e.message.includes("reverted")) {
             console.log("💡 Tip: Maybe it IS already deployed? The Factory might restrict 1 paymaster per token.");
             console.log("   Try checking if 'getPaymaster' works again or double check shared config.");
        }
    }
}

main().catch(console.error);
