import { createPublicClient, http, Hex, parseAbi } from 'viem';
import { foundry } from 'viem/chains';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../env/.env.v3') });

async function main() {
    const rpc = process.env.SEPOLIA_RPC_URL;
    const accountC = process.env.TEST_SIMPLE_ACCOUNT_C as Hex;

    console.log(`Checking EntryPoint for Account C: ${accountC}`);
    
    const client = createPublicClient({ chain: foundry, transport: http(rpc) });

    const abi = parseAbi(['function entryPoint() view returns (address)']);
    try {
        const ep = await client.readContract({ address: accountC, abi, functionName: 'entryPoint' });
        console.log(`EntryPoint Address: ${ep}`);
        
        if (ep === "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789") {
            console.log("⚠️  Version: v0.6");
        } else if (ep === "0x0000000071727De22E5E9d8BAf0edAc6f37da032") {
            console.log("✅ Version: v0.7");
        } else {
            console.log("❓ Unknown Version");
        }
    } catch (e) {
        console.error("❌ Could not read entryPoint():", e);
    }
}

main().catch(console.error);
