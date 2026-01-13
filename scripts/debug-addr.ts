import { privateKeyToAccount } from 'viem/accounts';
import * as dotenv from 'dotenv';
import * as path from 'path';

import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function check() {
    const envPath = path.resolve(__dirname, '../.env.sepolia');
    dotenv.config({ path: envPath });
    
    const pk = process.env.PRIVATE_KEY_SUPPLIER;
    const pkJason = process.env.PRIVATE_KEY_JASON;
    
    if (pk) {
        const account = privateKeyToAccount(pk as `0x${string}`);
        console.log(`Supplier Address: ${account.address}`);
    }
    
    if (pkJason) {
        const accountJason = privateKeyToAccount(pkJason as `0x${string}`);
        console.log(`Jason Address:    ${accountJason.address}`);
    }

    const token = '0x60dDD2b4BEb69d9760bBF90e05C34A716736840D';
    // Use public client to check owner
    const { createPublicClient, http } = await import('viem');
    const { sepolia } = await import('viem/chains');
    const client = createPublicClient({ chain: sepolia, transport: http('https://ethereum-sepolia-rpc.publicnode.com') });
    
    try {
        const owner = await client.readContract({
            address: token as `0x${string}`,
            abi: [{ type: 'function', name: 'owner', inputs: [], outputs: [{ type: 'address' }] }],
            functionName: 'owner'
        });
        console.log(`Token Owner:     ${owner}`);
    } catch (e) {
        console.log("Failed to fetch owner via viem, check if contract is Ownable");
    }
}

check();
