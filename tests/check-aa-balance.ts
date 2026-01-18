import { createPublicClient, http, formatEther, type Address } from 'viem';
import { sepolia } from 'viem/chains';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env.sepolia') });

const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(process.env.RPC_URL!)
});

const statePath = path.resolve(__dirname, '../scripts/l4-state.json');
const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
const aaAddress = state.aaAccounts.find((a: any) => a.label === 'Jason (AAStar)_AA1')?.address as Address;

const balance = await publicClient.getBalance({ address: aaAddress });
console.log('AA Address:', aaAddress);
console.log('ETH Balance:', formatEther(balance), 'ETH');
console.log('Wei:', balance.toString());

if (balance < 10000000000000000n) {
    console.log('\n⚠️  Balance too low! Need at least 0.01 ETH for gas');
    console.log('   Please fund the account with Sepolia ETH');
} else {
    console.log('\n✅ Balance sufficient for gas payment');
}
