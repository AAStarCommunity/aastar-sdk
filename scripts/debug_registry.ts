import { createPublicClient, http, Hex, parseAbi, keccak256 } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../env/.env.v3') });

async function main() {
    const rpc = process.env.SEPOLIA_RPC_URL;
    const jasonKey = process.env.PRIVATE_KEY_JASON as Hex;
    const jason = privateKeyToAccount(jasonKey).address;
    const superPaymaster = process.env.SUPER_PAYMASTER_ADDRESS as Hex;

    console.log(`🔎 Checking Registry Roles for Jason`);
    console.log(`   Jason: ${jason}`);
    console.log(`   Paymaster: ${superPaymaster}`);
    
    const client = createPublicClient({ chain: sepolia, transport: http(rpc) });

    // 1. Get Registry Address from Paymaster
    const pmAbi = parseAbi(['function REGISTRY() view returns (address)']);
    const registryAddress = await client.readContract({ address: superPaymaster, abi: pmAbi, functionName: 'REGISTRY' });
    console.log(`   🏛️  Registry: ${registryAddress}`);

    // 2. Check Roles
    const regAbi = parseAbi(['function hasRole(bytes32, address) view returns (bool)']);
    
    const COMMUNITY_ROLE = keccak256(new TextEncoder().encode("COMMUNITY"));
    const ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000";

    const isCommunity = await client.readContract({ address: registryAddress, abi: regAbi, functionName: 'hasRole', args: [COMMUNITY_ROLE, jason] });
    const isAdmin = await client.readContract({ address: registryAddress, abi: regAbi, functionName: 'hasRole', args: [ADMIN_ROLE, jason] });
    
    console.log(`   🏙️  Is COMMUNITY? ${isCommunity}`);
    console.log(`   🔑 Is ADMIN? ${isAdmin}`);
}

main().catch(console.error);
