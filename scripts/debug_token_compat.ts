import { createPublicClient, http, Hex, parseAbi, formatEther } from 'viem';
import { foundry } from 'viem/chains';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../env/.env.anvil') });

async function main() {
    const rpc = process.env.SEPOLIA_RPC_URL;
    const superPaymaster = process.env.SUPER_PAYMASTER_ADDRESS as Hex;
    const jason = process.env.ADDRESS_JASON_EOA as Hex;

    console.log(`🔎 Checking Paymaster Token Config`);
    console.log(`   Paymaster: ${superPaymaster}`);
    console.log(`   Jason: ${jason}`);
    
    const client = createPublicClient({ chain: foundry, transport: http(rpc) });

    // 1. Get APNTS_TOKEN from Paymaster
    try {
        const pmAbi = parseAbi(['function APNTS_TOKEN() view returns (address)']);
        const pmToken = await client.readContract({ address: superPaymaster, abi: pmAbi, functionName: 'APNTS_TOKEN' });
        console.log(`   🏦 Paymaster's APNTS_TOKEN: ${pmToken}`);
        
        // 2. Check Jason's balance of this token
        const erc20Abi = parseAbi(['function balanceOf(address) view returns (uint256)', 'function symbol() view returns (string)']);
        const bal = await client.readContract({ address: pmToken, abi: erc20Abi, functionName: 'balanceOf', args: [jason] });
        const symbol = await client.readContract({ address: pmToken, abi: erc20Abi, functionName: 'symbol' }).catch(() => "???");
        console.log(`   💰 Jason's Balance: ${formatEther(bal)} ${symbol}`);
        
        // 3. Check other candidates
        const candidates = [
            { name: "Old APNTS", addr: "0xBD0710596010a157B88cd141d797E8Ad4bb2306b" as Hex },
            { name: "BPNTS", addr: process.env.BPNTS_ADDRESS as Hex }
        ];

        for (const c of candidates) {
            if (c.addr.toLowerCase() === pmToken.toLowerCase()) continue;
            try {
                const b = await client.readContract({ address: c.addr, abi: erc20Abi, functionName: 'balanceOf', args: [jason] });
                const s = await client.readContract({ address: c.addr, abi: erc20Abi, functionName: 'symbol' }).catch(() => "???");
                console.log(`   ❓ ${c.name} (${c.addr}): ${formatEther(b)} ${s}`);
            } catch (e) { console.log(`   ❌ ${c.name}: Error reading balance`); }
        }

    } catch (e) {
        console.error("❌ Error reading APNTS_TOKEN:", e);
    }
}

main().catch(console.error);
