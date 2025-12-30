import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createPublicClient, http, Hex } from 'viem';
import { foundry } from 'viem/chains';

// @ts-ignore
import { CONTRACTS } from '@aastar/shared-config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../../env/.env.v3');
dotenv.config({ path: envPath });

const PUBLIC_RPC = process.env.SEPOLIA_RPC_URL;
const contracts: any = CONTRACTS;

// Config
const REGISTRY_ADDRESS = (contracts?.sepolia?.core?.registry || "0xf384c592D5258c91805128291c5D4c069DD30CA6") as Hex;
const BPNTS_ADDRESS = (process.env.BPNTS_ADDRESS || contracts?.sepolia?.testTokens?.bPNTs) as Hex;

async function main() {
    console.log("🔍 Finding Paymaster for bPNTs (Group B)...");
    
    if (!PUBLIC_RPC) throw new Error("Missing RPC");
    const client = createPublicClient({ chain: foundry, transport: http(PUBLIC_RPC) });

    console.log(`   Registry: ${REGISTRY_ADDRESS}`);
    console.log(`   bPNTs:    ${BPNTS_ADDRESS}`);

    if (!BPNTS_ADDRESS) {
        console.error("❌ No bPNTs Address found.");
        return;
    }

    // 1. Get bPNTs Owner (Operator)
    let operator: Hex;
    try {
        operator = await client.readContract({
            address: BPNTS_ADDRESS,
            abi: [{inputs:[],name:"owner",outputs:[{name:"",type:"address"}],stateMutability:"view",type:"function"}],
            functionName: 'owner'
        }) as Hex;
        console.log(`   👤 bPNTs Owner (Operator): ${operator}`);
    } catch (e: any) {
        console.error("   ❌ Failed to get owner:", e.message);
        return;
    }

    // 2. Query Registry for Community
    try {
        // Broad ABI to catch return values
        const result: any = await client.readContract({
            address: REGISTRY_ADDRESS,
            abi: [{
                inputs: [{name: "", type: "address"}],
                name: "communities",
                outputs: [
                    {name: "name", type: "string"},
                    {name: "ens", type: "string"},
                    {name: "token", type: "address"},
                    {name: "sbt", type: "address"},
                    {name: "nodeType", type: "uint8"},
                    {name: "paymaster", type: "address"}
                ],
                stateMutability: "view",
                type: "function"
            }],
            functionName: 'communities',
            args: [operator]
        });
        
        console.log("   🏘️  Community Info:", result);

        let paymaster: Hex | undefined;

        if (Array.isArray(result)) {
            // Usually [name, ens, token, sbt, nodeType, paymaster]
            // Paymaster should be the last address or specifically result[5]
            if (result[5] && result[5].startsWith("0x")) {
                paymaster = result[5];
            }
        }

        if (paymaster && paymaster !== "0x0000000000000000000000000000000000000000") {
            console.log(`\n✅ FOUND PAYMASTER V4: ${paymaster}`);
            console.log(`👉 Update .env.v3: PAYMASTER_V4_ADDRESS=${paymaster}`);
        } else {
            console.warn("   ⚠️  Paymaster address in Registry is 0x0 or not found.");
            console.log("       This implies the Paymaster is NOT deployed or not registered.");
        }

    } catch (e: any) {
        console.log("   ❌ Query Registry failed:", e.message);
    }
}

main().catch(console.error);
