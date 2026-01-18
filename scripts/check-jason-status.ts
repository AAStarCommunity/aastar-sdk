
import { createPublicClient, http, parseAbi, type Address, formatEther } from 'viem';
import { sepolia } from 'viem/chains';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env.sepolia') });

async function main() {
    const statePath = path.resolve(__dirname, '../scripts/l4-state.json');
    const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));

    const rpcUrl = process.env.SEPOLIA_RPC_URL || process.env.RPC_URL;
    const client = createPublicClient({
        chain: sepolia,
        transport: http(rpcUrl)
    });

    const epAddr = '0x0000000071727De22E5E9d8BAf0edAc6f37da032' as Address;

    for (const [name, op] of Object.entries(state.operators)) {
        const o: any = op;
        if (!o.paymasterV4 || o.paymasterV4 === 'N/A (Super)' || o.paymasterV4 === 'None') continue;

        console.log(`\n🔍 Checking Paymaster Status for ${name.toUpperCase()}...`);
        console.log(`🏦 Paymaster: ${o.paymasterV4}`);
        
        const aaMatch = state.aaAccounts.find((a: any) => a.opName.toLowerCase().includes(name.toLowerCase()));
        if (!aaMatch) {
            console.log(`❌ No AA account found for operator ${name}`);
            continue;
        }
        const aaAddr = aaMatch.address;
        const tokenAddr = o.tokenAddress;

        console.log(`👤 AA Account: ${aaAddr}`);
        console.log(`🪙  Token:      ${tokenAddr} (${o.symbol})`);

        try {
            // 1. EntryPoint
            const pmEntryPoint = await client.readContract({
                address: o.paymasterV4,
                abi: parseAbi(['function entryPoint() view returns (address)']),
                functionName: 'entryPoint'
            });
            console.log(`⚙️  EntryPoint:  ${pmEntryPoint.toLowerCase() === epAddr.toLowerCase() ? '✅ Matches' : '❌ MISMATCH (' + pmEntryPoint + ')'}`);

            // 2. Token Price
            const tokenPrice = await client.readContract({
                address: o.paymasterV4,
                abi: parseAbi(['function tokenPrices(address) view returns (uint256)']),
                functionName: 'tokenPrices',
                args: [tokenAddr]
            }) as bigint;
            console.log(`💰 Token Price: ${tokenPrice > 0n ? '✅ ' + tokenPrice : '❌ NOT SET'}`);

            // 3. AA Internal Balance
            const internalBalance = await client.readContract({
                address: o.paymasterV4,
                abi: parseAbi(['function balances(address,address) view returns (uint256)']),
                functionName: 'balances',
                args: [aaAddr, tokenAddr]
            }) as bigint;
            console.log(`💳 AA Balance:  ${internalBalance > 0n ? '✅ ' + formatEther(internalBalance) : '❌ ZERO'} ${o.symbol}`);

            // 4. EP Balance
            const epBalance = await client.readContract({
                address: epAddr,
                abi: parseAbi(['function balanceOf(address) view returns (uint256)']),
                functionName: 'balanceOf',
                args: [o.paymasterV4]
            }) as bigint;
            console.log(`⛽ EP Balance:  ${Number(epBalance) / 1e18} ETH`);

        } catch (e: any) {
            console.error(`❌ Error checking ${name}:`, e.message);
        }
    }
}

main();
