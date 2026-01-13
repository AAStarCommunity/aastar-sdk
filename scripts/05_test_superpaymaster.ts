
import { http, parseEther, formatEther, type Hex, Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { 
    createEndUserClient, 
    parseKey, 
    CORE_ADDRESSES 
} from '../packages/sdk/src/index.ts';
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
const SIGNER_KEY = (process.env.PRIVATE_KEY_JASON || process.env.USER_KEY) as Hex;
const ACCOUNT_ADDRESS = (process.env.TEST_SIMPLE_ACCOUNT_C) as Address;
const RECEIVER = "0x93E67dbB7B2431dE61a9F6c7E488e7F0E2eD2B3e";

async function main() {
    console.log(`🚀 Group C: SuperPaymaster (Network: ${NETWORK})`);
    
    if (!SIGNER_KEY) throw new Error("Missing Private Key (PRIVATE_KEY_JASON)");
    if (!ACCOUNT_ADDRESS) throw new Error("Missing TEST_SIMPLE_ACCOUNT_C");

    const account = privateKeyToAccount(parseKey(SIGNER_KEY));
    const user = createEndUserClient({ transport: http(RPC_URL), account });

    console.log(`   👤 Signer: ${account.address}`);
    console.log(`   🏭 Smart Account: ${ACCOUNT_ADDRESS}`);

    try {
        console.log("   ⚡ Executing Gasless Transfer (via SuperPaymaster)...");
        // The SDK will probe the Registry and find the SuperPaymaster role.
        // It handles all the packing and estimation internally.
        const result = await user.executeGasless({
            target: RECEIVER,
            data: '0x',
            value: parseEther("0")
        });

        console.log(`   ⏳ UserOp Hash: ${result.hash}`);
        
        const receipt = await user.waitForTransactionReceipt({ hash: result.hash });
        console.log(`   ✅ Success! Tx: ${receipt.transactionHash}`);
        console.log(`   ⛽ Gas Used: ${receipt.gasUsed.toString()}`);
    } catch (error: any) {
        console.error("   ❌ SuperPaymaster Test Failed:", error.message.split('\n')[0]);
    }
}

main().catch(console.error);
