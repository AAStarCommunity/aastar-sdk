
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { createPublicClient, createWalletClient, http, parseEther, formatEther, type Address, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env.sepolia') });

/**
 * Stage 3 Setup Script (Final)
 * ----------------------------
 * 1. Verify Connectivity
 * 2. Verify Contracts (V3.1.1)
 * 3. Fund Accounts (Admin, EOA, AA Owner) from Supplier
 */

const MIN_BALANCE = parseEther('0.05');

async function main() {
    console.log('🚀 Stage 3 Setup: Verification & Funding...');

    // CONFIG
    const RPC_URL = process.env.SEPOLIA_RPC_URL;
    const SUPPLIER_KEY = process.env.PRIVATE_KEY_SUPPLIER as Hex; // From global env output
    if (!RPC_URL) throw new Error('❌ Missing RPC_URL');
    if (!SUPPLIER_KEY) throw new Error('❌ Missing PRIVATE_KEY_SUPPLIER');

    const client = createPublicClient({ chain: foundry, transport: http(RPC_URL) });
    const supplier = privateKeyToAccount(SUPPLIER_KEY);
    const wallet = createWalletClient({ account: supplier, chain: foundry, transport: http(RPC_URL) });

    console.log(`🏦 Supplier: ${supplier.address}`);
    const supplierBal = await client.getBalance({ address: supplier.address });
    console.log(`   Balance: ${formatEther(supplierBal)} ETH`);

    // ACCOUNTS TO FUND
    const ADMIN_KEY = process.env.ADMIN_PRIVATE_KEY as Hex;
    const EOA_KEY = process.env.EOA_PRIVATE_KEY as Hex;
    const AA_OWNER_KEY = process.env.AA_OWNER_PRIVATE_KEY as Hex;

    const targets = [
        { name: 'Admin/Deployer', key: ADMIN_KEY },
        { name: 'Group A (EOA)', key: EOA_KEY },
        { name: 'AA Owner', key: AA_OWNER_KEY }
    ];

    for (const t of targets) {
        if (!t.key) {
            console.warn(`⚠️ Missing key for ${t.name}`);
            continue;
        }
        const account = privateKeyToAccount(t.key);
        const bal = await client.getBalance({ address: account.address });
        console.log(`🔹 ${t.name}: ${account.address} (${formatEther(bal)} ETH)`);

        if (bal < MIN_BALANCE) {
            console.log(`   💸 Funding 0.05 ETH...`);
            try {
                const tx = await wallet.sendTransaction({
                    to: account.address,
                    value: MIN_BALANCE
                });
                console.log(`   ⏳ Sent: ${tx} (Waiting for receipt...)`);
                await client.waitForTransactionReceipt({ hash: tx });
                console.log(`   ✅ Confirmed.`);
            } catch (e) {
                console.error(`   ❌ Failed to fund:`, e);
            }
        } else {
            console.log(`   ✅ Sufficient balance.`);
        }
    }

    // CONTRACT VERIFICATION
    console.log('\n--- Contract Verification ---');
    const contracts = [
        { name: 'Registry', addr: process.env.REGISTRY_ADDR },
        { name: 'SuperPaymaster', addr: process.env.SUPER_PAYMASTER },
        { name: 'PaymasterV4', addr: process.env.PAYMASTER_V4_ADDRESS },
        { name: 'GToken', addr: process.env.GTOKEN_ADDR },
        { name: 'xPNTs', addr: process.env.XPNTS_ADDR },
        { name: 'MySBT', addr: process.env.MYSBT_ADDR },
    ];

    for (const c of contracts) {
        if (!c.addr) {
            console.error(`❌ Missing address for ${c.name}`);
            continue;
        }
        const code = await client.getBytecode({ address: c.addr as Address });
        if (code && code !== '0x') {
            console.log(`✅ ${c.name}: ${c.addr}`);
        } else {
            console.error(`❌ ${c.name}: NO CODE at ${c.addr}`);
        }
    }

    console.log('\n🏁 Setup Complete.');
}

main().catch(console.error);
