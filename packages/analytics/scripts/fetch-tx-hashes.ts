
import { createClient, http } from 'viem';
import { optimismSepolia } from 'viem/chains';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load ENV
dotenv.config({ path: path.resolve(process.cwd(), '.env.op-sepolia') });

const RPC_URL = process.env.OP_SEPOLIA_RPC_URL || 'https://opt-sepolia.g.alchemy.com/v2/9bwo2HaiHpUXnDS-rohIK';
const BUNDLER_URL = RPC_URL;

const client = createClient({
    chain: optimismSepolia,
    transport: http(BUNDLER_URL)
});

const userOpHashes = [
    '0x6b3839b4d67d0b07026a885be5d6f85817165ee75b3c31cb375d3d3d7e785e01',
    '0xb392056d1e4ab4480ea674cc047380c72731dd4646189c83e65e66af4e3a5abd',
    '0x1a4ebca70b2b36c05e3f79cd37b4c3ebcde65dc0bec4af5e279621ef3d95bdb8'
];

async function main() {
    console.log('Fetching receipts for UserOps on OP Sepolia...');
    
    for (const hash of userOpHashes) {
        try {
            const receipt: any = await client.request({ 
                method: 'eth_getUserOperationReceipt', 
                params: [hash] 
            });
            
            if (receipt) {
                console.log(`UserOp: ${hash}`);
                console.log(`TxHash: ${receipt.receipt.transactionHash}`);
                console.log('---');
            } else {
                console.log(`UserOp: ${hash} - Receipt NOT FOUND`);
            }
        } catch (e) {
            console.error(`Error fetching ${hash}:`, e);
        }
    }
}

main();
