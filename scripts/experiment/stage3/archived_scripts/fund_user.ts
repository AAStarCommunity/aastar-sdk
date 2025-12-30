
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { createPublicClient, createWalletClient, http, type Hex, parseEther, type Address, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env.sepolia') });

async function main() {
    console.log('💸 Funding User with ETH...');
    const RPC_URL = process.env.SEPOLIA_RPC_URL;
    const SUPPLIER_KEY = process.env.PRIVATE_KEY_SUPPLIER as Hex;
    if (!RPC_URL || !SUPPLIER_KEY) throw new Error('Missing Config');

    const client = createPublicClient({ chain: foundry, transport: http(RPC_URL) });
    const account = privateKeyToAccount(SUPPLIER_KEY);
    const wallet = createWalletClient({ account, chain: foundry, transport: http(RPC_URL) });

    const ADMIN_FRESH = '0x0c52a28d94e411a01580d995eb0b0a90256e7eef32f7eaddfc9f0c889afd67ce';
    const USER_FRESH = '0x0a7108e34f0d05eddc6e80ee380f5d81dcae2030263f75e42a4c015f59ccd8a4';
    const ADMIN_B_FRESH = '0xa0fecea9e4754594e6c5a563fe1bd79a9192b7212d7425c2ab2158c1807d32a1';
    
    const adminA = privateKeyToAccount(ADMIN_FRESH as Hex).address;
    const userEOA = privateKeyToAccount(USER_FRESH as Hex).address;
    const adminB = privateKeyToAccount(ADMIN_B_FRESH as Hex).address;
    const userAA = '0x710a314F85b12A4Cbd0f141F576a40279Fe3a552' as Address;

    const targets = [adminA, userEOA, adminB, userAA];

    const GTOKEN = process.env.GTOKEN_ADDR as Address;
    const gtokenAbi = parseAbi(['function mint(address, uint256) external']);

    for (const t of targets) {
        console.log(`   🔸 Funding ETH to ${t}...`);
        const txEth = await wallet.sendTransaction({ to: t, value: parseEther('0.1') });
        await client.waitForTransactionReceipt({ hash: txEth });

        console.log(`   🔸 Minting GTokens to ${t}...`);
        const txG = await wallet.writeContract({
            address: GTOKEN, abi: gtokenAbi, functionName: 'mint', args: [t, parseEther('100')]
        });
        await client.waitForTransactionReceipt({ hash: txG });
    }
    console.log(`   ✅ Funded Admin and User.`);
}

main().catch(console.error);
