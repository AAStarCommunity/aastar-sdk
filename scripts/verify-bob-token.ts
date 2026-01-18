
import { createPublicClient, http, parseAbi, type Address, getAddress } from 'viem';
import { sepolia } from 'viem/chains';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env.sepolia') });

async function main() {
    const rpcUrl = process.env.SEPOLIA_RPC_URL || process.env.RPC_URL;
    const client = createPublicClient({
        chain: sepolia,
        transport: http(rpcUrl)
    });

    const factory = getAddress(process.env.XPNTS_FACTORY_ADDRESS!);
    const bobEOA = getAddress('0xF7Bf79AcB7F3702b9DbD397d8140ac9DE6Ce642C');

    console.log(`🔍 Querying xPNTsFactory (${factory}) for Bob (${bobEOA})...`);
    const tAddr = await client.readContract({
        address: factory,
        abi: parseAbi(['function getTokenAddress(address) view returns (address)']),
        functionName: 'getTokenAddress',
        args: [bobEOA]
    });
    console.log(`📍 Token Address: ${tAddr}`);

    if (tAddr !== '0x0000000000000000000000000000000000000000') {
        const owner = await client.readContract({
            address: tAddr as Address,
            abi: parseAbi(['function owner() view returns (address)']),
            functionName: 'owner'
        });
        console.log(`👤 Token Owner:   ${owner}`);
    }
}

main();
