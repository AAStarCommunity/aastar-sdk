
import { http, parseEther, formatEther, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { 
    createAdminClient, 
    parseKey 
} from '../packages/sdk/src/index.ts';
import { getNetworkConfig } from './00_utils.js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Dynamic Env Loading
const NETWORK = process.env.EXPERIMENT_NETWORK || 'anvil';
const envFile = NETWORK === 'sepolia' ? '.env.sepolia' : '.env.anvil';
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

const RPC_URL = process.env.RPC_URL || (NETWORK === 'sepolia' ? process.env.SEPOLIA_RPC_URL : "http://127.0.0.1:8545");
const RELAYER_KEY = (process.env.PRIVATE_KEY_RELAYER || process.env.PRIVATE_KEY_JASON || process.env.ADMIN_KEY) as Hex;
const RECEIVER = "0x93E67dbB7B2431dE61a9F6c7E488e7F0E2eD2B3e";

async function main() {
    console.log(`🚀 Baseline 1: EOA Transfer (Network: ${NETWORK})`);
    
    if (!RELAYER_KEY) throw new Error("Missing Private Key (PRIVATE_KEY_RELAYER or ADMIN_KEY)");
    const account = privateKeyToAccount(parseKey(RELAYER_KEY));
    const admin = createAdminClient({ transport: http(RPC_URL), account });

    console.log(`   👤 Sender: ${account.address}`);
    
    const balanceBefore = await admin.getBalance({ address: account.address });
    console.log(`   💰 Balance: ${formatEther(balanceBefore)} ETH`);

    try {
        const hash = await admin.sendTransaction({
            to: RECEIVER,
            value: parseEther("0.0001"), 
        });
        console.log(`   ⏳ Transaction sent: ${hash}`);
        
        const receipt = await admin.waitForTransactionReceipt({ hash });
        console.log(`   ✅ Success! Status: ${receipt.status}`);
        console.log(`   ⛽ Gas Used: ${receipt.gasUsed.toString()}`);
        console.log(`   💸 Effective Gas Price: ${formatEther(receipt.effectiveGasPrice)} ETH`);
    } catch (error: any) {
        console.error("   ❌ EOA Test Failed:", error.message.split('\n')[0]);
    }
}

main().catch(console.error);
