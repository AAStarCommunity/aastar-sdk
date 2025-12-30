
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { createPublicClient, createWalletClient, http, type Hex, parseEther, formatEther, parseAbi, type Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env.sepolia') });

// ABIs
const gtokenAbi = parseAbi([
    'function balanceOf(address) view returns (uint256)',
    'function mint(address, uint256) external'
]);

async function main() {
    console.log('🚀 Stage 3 Scenario 0: Token Distribution');

    // CONFIG
    const RPC_URL = process.env.SEPOLIA_RPC_URL;
    const SUPPLIER_KEY = process.env.PRIVATE_KEY_SUPPLIER as Hex;
    if (!RPC_URL || !SUPPLIER_KEY) throw new Error('Missing Config (Need PRIVATE_KEY_SUPPLIER)');

    const client = createPublicClient({ chain: foundry, transport: http(RPC_URL) });
    const account = privateKeyToAccount(SUPPLIER_KEY);
    const wallet = createWalletClient({ account, chain: foundry, transport: http(RPC_URL) });

    const GTOKEN = process.env.GTOKEN_ADDR as Address;
    
    // TARGETS
    // 1. DAO Admin (0x3C44...)
    const ADMIN_KEY = process.env.ADMIN_PRIVATE_KEY as Hex;
    const admin = privateKeyToAccount(ADMIN_KEY).address;

    // 2. Operator (AA Owner) (0x7099...)
    const OP_KEY = process.env.AA_OWNER_PRIVATE_KEY as Hex;
    const operator = privateKeyToAccount(OP_KEY).address;

    // 3. User (EOA) (0x15d3...)
    const USER_KEY = process.env.EOA_PRIVATE_KEY as Hex;
    const user = privateKeyToAccount(USER_KEY).address;

    const targets = [
        { name: 'DAO Admin', address: admin, amount: parseEther('100') }, // 100 GToken
        { name: 'Operator', address: operator, amount: parseEther('100') },
        { name: 'User', address: user, amount: parseEther('100') }
    ];

    console.log(`🏦 Supplier: ${account.address}`);

    for (const t of targets) {
        const bal = await client.readContract({ address: GTOKEN, abi: gtokenAbi, functionName: 'balanceOf', args: [t.address] });
        console.log(`   🔸 ${t.name} (${t.address}): ${formatEther(bal)} GToken`);

        if (bal < t.amount) {
            console.log(`      Minting ${formatEther(t.amount)} GToken...`);
            try {
                const tx = await wallet.writeContract({
                    address: GTOKEN, abi: gtokenAbi, functionName: 'mint', args: [t.address, t.amount]
                });
                console.log(`      ⏳ Tx: ${tx}`);
                await client.waitForTransactionReceipt({ hash: tx });
                console.log(`      ✅ Confirmed.`);
            } catch (e) {
                console.error(`      ❌ Failed to mint:`, e);
            }
        } else {
            console.log(`      ✅ Sufficient Balance.`);
        }
    }

    console.log('\n🏁 Distribution Complete.');
}

main().catch(console.error);
