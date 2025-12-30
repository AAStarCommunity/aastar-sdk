
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { createPublicClient, http, type Hex, parseAbi, type Address, keccak256, stringToBytes, formatEther } from 'viem';
import { foundry } from 'viem/chains';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env.sepolia') });

async function main() {
    const client = createPublicClient({ chain: foundry, transport: http(process.env.SEPOLIA_RPC_URL) });
    const REGISTRY = process.env.REGISTRY_ADDR as Address;
    const ADMIN_A = '0xCA8E22D78D5eF0598C67E4aF6D39BA6682a558e7' as Address;
    const ADMIN_B = '0x021ccDEED21A8ea540017188fB6D9a3BAaDc8C40' as Address;
    const SP = '0xd6EACcC89522f1d507d226495adD33C5A74b6A45' as Address;
    const APNTS = '0xD348d910f93b60083bF137803FAe5AF25E14B69d' as Address;

    const regAbi = parseAbi([
        'function hasRole(bytes32, address) view returns (bool)'
    ]);

    const spAbi = parseAbi([
        'function operators(address) view returns (uint128, uint96, bool, bool, address, uint32, address, uint256, uint256)'
    ]);

    const tokenAbi = parseAbi([
        'function balanceOf(address) view returns (uint256)',
        'function owner() view returns (address)'
    ]);

    const ROLE_PAYMASTER = keccak256(stringToBytes('PAYMASTER_SUPER'));

    console.log(`\n🔎 Verifying Token A @ ${APNTS}`);
    try {
        const owner = await client.readContract({ address: APNTS, abi: tokenAbi, functionName: 'owner' });
        console.log(`  Token Owner: ${owner}`);
    } catch (e) { console.log('  ❌ Failed to check owner'); }

    console.log(`\n🔎 Verifying SuperPaymaster @ ${SP}`);
    
    for (const admin of [{n: 'A', a: ADMIN_A}, {n: 'B', a: ADMIN_B}]) {
        console.log(`\n--- Admin ${admin.n} (${admin.a}) ---`);
        const eth = await client.getBalance({ address: admin.a });
        const pnts = await client.readContract({ address: APNTS, abi: tokenAbi, functionName: 'balanceOf', args: [admin.a] });
        console.log(`  ETH Balance: ${formatEther(eth)}`);
        console.log(`  aPNTs Balance: ${formatEther(pnts)}`);
        
        const isPay = await client.readContract({ address: REGISTRY, abi: regAbi, functionName: 'hasRole', args: [ROLE_PAYMASTER, admin.a] });
        console.log(`  Registry PAYMASTER_SUPER: ${isPay}`);
        
        const op = await client.readContract({ address: SP, abi: spAbi, functionName: 'operators', args: [admin.a] });
        console.log(`  SP isConfigured: ${op[2]}`);
        console.log(`  SP aPNTsBalance: ${formatEther(op[0])}`);
    }
}

main().catch(console.error);
