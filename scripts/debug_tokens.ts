import { createPublicClient, http, Hex, parseAbi, formatEther } from 'viem';
import { foundry } from 'viem/chains';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../env/.env.v3') });

async function main() {
    const rpc = process.env.SEPOLIA_RPC_URL;
    const oldApnts = "0xBD0710596010a157B88cd141d797E8Ad4bb2306b" as Hex;
    const bpnts = process.env.BPNTS_ADDRESS as Hex;
    const jason = process.env.ADDRESS_JASON_EOA as Hex;

    console.log(`🔎 Checking Tokens`);
    
    const client = createPublicClient({ chain: foundry, transport: http(rpc) });

    const checks = [
        { name: "Old APNTS", address: oldApnts },
        { name: "BPNTS", address: bpnts }
    ];

    for (const t of checks) {
        console.log(`\nChecking ${t.name}: ${t.address}`);
        const code = await client.getBytecode({ address: t.address });
        if (!code) {
            console.log("   ❌ No Code (Not deployed)");
            continue;
        }
        console.log("   ✅ Contract deployed");

        // Check Balance
        const abi = parseAbi(['function balanceOf(address) view returns (uint256)']);
        try {
            const bal = await client.readContract({ address: t.address, abi, functionName: 'balanceOf', args: [jason] });
            console.log(`   💰 Balance: ${formatEther(bal)}`);
        } catch(e) { console.log("   ❌ Read Balance Failed"); }
    }
}

main().catch(console.error);
