
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { createPublicClient, http, type Hex, parseAbi, keccak256, stringToBytes, type Address } from 'viem';
import { sepolia } from 'viem/chains';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env.sepolia') });

async function main() {
    const client = createPublicClient({ chain: sepolia, transport: http(process.env.SEPOLIA_RPC_URL) });
    const addr = '0x021ccDEED21A8ea540017188fB6D9a3BAaDc8C40' as Address;
    const REGISTRY = process.env.REGISTRY_ADDR as Address;
    const abi = parseAbi(['function hasRole(bytes32, address) view returns (bool)']);
    
    const ROLE_COMMUNITY = keccak256(stringToBytes('COMMUNITY'));
    const ROLE_PAYMASTER = keccak256(stringToBytes('PAYMASTER_SUPER'));

    const hasComm = await client.readContract({ address: REGISTRY, abi, functionName: 'hasRole', args: [ROLE_COMMUNITY, addr] });
    const hasPay = await client.readContract({ address: REGISTRY, abi, functionName: 'hasRole', args: [ROLE_PAYMASTER, addr] });

    console.log(`👤 Admin B: ${addr}`);
    console.log(`🏢 Has ROLE_COMMUNITY: ${hasComm}`);
    console.log(`💰 Has ROLE_PAYMASTER_SUPER: ${hasPay}`);
}

main().catch(console.error);
