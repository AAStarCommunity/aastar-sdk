import { createPublicClient, http, parseAbiItem } from 'viem';
import { foundry } from 'viem/chains';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../env/.env.v3') });
const RPC_URL = process.env.SEPOLIA_RPC_URL;

async function main() {
    const txHash = "0x0b4f7ef79728287e03892523e0d887aa14e604926fa762323b3afb38f6e21966";
    const client = createPublicClient({ chain: foundry, transport: http(RPC_URL) });
    const receipt = await client.getTransactionReceipt({ hash: txHash });
    
    console.log("🔍 Checking Tx Logs...");
    receipt.logs.forEach(log => {
        console.log(`Address: ${log.address}`);
        // ERC20 Transfer topic
        if (log.topics[0] === "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef") {
             console.log("   -> Is ERC20 Transfer!");
        }
    });
}
main();
