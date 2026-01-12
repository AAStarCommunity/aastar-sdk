import { createPublicClient, http, Hex } from 'viem';
import { foundry } from 'viem/chains';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../env/.env.anvil') });

const RPC_URL = process.env.SEPOLIA_RPC_URL;
const ACCOUNT_B = process.env.TEST_SIMPLE_ACCOUNT_B as Hex;

async function main() {
    console.log("🔍 [04.0] Checking Deployment Status...");
    const client = createPublicClient({ chain: foundry, transport: http(RPC_URL) });
    
    const code = await client.getBytecode({ address: ACCOUNT_B });
    console.log(`   📝 Code Size: ${code ? code.length : 0}`);
    
    if (!code || code.length <= 2) {
        console.log("   ⚠️  Account B is NOT deployed! UserOp MUST include InitCode.");
    } else {
        console.log("   ✅ Account B is deployed.");
    }
}
main();
