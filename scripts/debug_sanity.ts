
import { createPublicClient, http, type Hex } from 'viem';
import { foundry } from 'viem/chains';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.anvil') });

async function check() {
    const RPC = process.env.RPC_URL || 'http://127.0.0.1:8545';
    console.log(`Connecting to ${RPC}`);
    const client = createPublicClient({ chain: foundry, transport: http(RPC) });

    const addr = process.env.REGISTRY_ADDR as Hex;
    if (!addr) {
        console.error("No REGISTRY_ADDR in .env.anvil");
        return;
    }
    console.log(`Checking Registry at ${addr}...`);
    const code = await client.getBytecode({ address: addr });
    
    if (!code || code === '0x') {
        console.error("❌ NO CODE at Registry Address!");
    } else {
        console.log(`✅ Code found! Length: ${code.length}`);
    }

    const block = await client.getBlockNumber();
    console.log(`Current Block: ${block}`);
}

check().catch(console.error);
