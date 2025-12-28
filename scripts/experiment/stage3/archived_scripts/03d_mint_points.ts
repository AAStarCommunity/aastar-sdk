
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { createPublicClient, createWalletClient, http, type Hex, parseAbi, parseEther, type Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env.sepolia') });

async function main() {
    console.log('🚀 Stage 3 Scenario 03d: Minting Community Points');
    
    // CONFIG
    const RPC_URL = process.env.SEPOLIA_RPC_URL;
    const ADMIN_A_KEY = '0x0c52a28d94e411a01580d995eb0b0a90256e7eef32f7eaddfc9f0c889afd67ce' as Hex;
    const ADMIN_B_KEY = '0xa0fecea9e4754594e6c5a563fe1bd79a9192b7212d7425c2ab2158c1807d32a1' as Hex;
    const USER_AA = '0x710a314F85b12A4Cbd0f141F576a40279Fe3a552' as Address;
    
    if (!RPC_URL) throw new Error('Missing RPC_URL');

    const client = createPublicClient({ chain: sepolia, transport: http(RPC_URL) });

    const XPNTS_FACTORY = process.env.XPNTS_FACTORY_ADDR as Address;
    const factoryAbi = parseAbi(['function communityToToken(address) view returns (address)']);

    const APNTS = await client.readContract({ address: XPNTS_FACTORY, abi: factoryAbi, functionName: 'communityToToken', args: [privateKeyToAccount(ADMIN_A_KEY).address] });
    const BPNTS = await client.readContract({ address: XPNTS_FACTORY, abi: factoryAbi, functionName: 'communityToToken', args: [privateKeyToAccount(ADMIN_B_KEY).address] });

    console.log(`📍 aPNTs Token: ${APNTS}`);
    console.log(`📍 bPNTs Token: ${BPNTS}`);

    const tokenAbi = parseAbi(['function mint(address, uint256) external', 'function balanceOf(address) view returns (uint256)']);

    const minting = [
        { name: 'aPNTs (Admin A)', key: ADMIN_A_KEY, token: APNTS },
        { name: 'bPNTs (Admin B)', key: ADMIN_B_KEY, token: BPNTS }
    ];

    for (const m of minting) {
        console.log(`\n--- Minting ${m.name} ---`);
        const account = privateKeyToAccount(m.key);
        const wallet = createWalletClient({ account, chain: sepolia, transport: http(RPC_URL) });

        const tx = await wallet.writeContract({
            address: m.token, abi: tokenAbi, functionName: 'mint', args: [USER_AA, parseEther('100')]
        });
        console.log(`   ⏳ Transaction: ${tx}`);
        await client.waitForTransactionReceipt({ hash: tx });
        
        const bal = await client.readContract({ address: m.token, abi: tokenAbi, functionName: 'balanceOf', args: [USER_AA] });
        console.log(`   ✅ Success. New Balance: ${bal}`);
    }

    console.log('\n🏁 Scenario 03d Complete.');
}

main().catch(console.error);
