import { createPublicClient, http, Hex, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../env/.env.v3') });

async function main() {
    const rpc = process.env.SEPOLIA_RPC_URL;
    const accountC = process.env.TEST_SIMPLE_ACCOUNT_C as Hex;
    const jasonKey = process.env.PRIVATE_KEY_JASON as Hex;

    console.log(`Checking Account C: ${accountC}`);
    
    const client = createPublicClient({ chain: sepolia, transport: http(rpc) });
    const jasonAccount = privateKeyToAccount(jasonKey);
    console.log(`Jason Address (Signer): ${jasonAccount.address}`);

    const code = await client.getBytecode({ address: accountC });
    console.log(`Code Length: ${code ? code.length : 0}`);

    if (!code || code.length === 0) {
        console.error("❌ Account C is NOT deployed!");
        process.exit(1);
    }

    const abi = parseAbi(['function owner() view returns (address)']);
    try {
        const owner = await client.readContract({ address: accountC, abi, functionName: 'owner' });
        console.log(`Account Owner: ${owner}`);
        
        if (owner.toLowerCase() === jasonAccount.address.toLowerCase()) {
            console.log("✅ Ownership Match!");
        } else {
            console.error("❌ Ownership Mismatch!");
        }
    } catch (e) {
        console.error("❌ Could not read owner():", e);
    }
}

main().catch(console.error);
