import { createPublicClient, createWalletClient, http, parseAbi, parseEther, formatEther, getContract, maxUint256, Hex, Address, encodeAbiParameters, keccak256, toBytes } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.v3
dotenv.config({ path: path.resolve(__dirname, '../../env/.env.v3') });

const RPC_URL = process.env.SEPOLIA_RPC_URL;
if (!RPC_URL) throw new Error("Missing SEPOLIA_RPC_URL");

const CHAIN = sepolia;

// Accounts
const SUPPLIER_KEY = process.env.PRIVATE_KEY_SUPPLIER as Hex;
const ANNI_KEY = process.env.PRIVATE_KEY_ANNI as Hex; // Community Admin

if (!SUPPLIER_KEY || !ANNI_KEY) throw new Error("Missing Private Keys");

// Contracts
const ADDR = {
    GTOKEN: process.env.GTOKEN_ADDRESS as Address,
    STAKING: process.env.GTOKEN_STAKING_ADDRESS as Address,
};

// ABI
const ABI = {
    ERC20: parseAbi([
        'function balanceOf(address) view returns (uint256)',
        'function transfer(address, uint256) returns (bool)',
        'function approve(address, uint256) returns (bool)',
        'function allowance(address, address) view returns (uint256)',
    ]),
};

const publicClient = createPublicClient({ chain: CHAIN, transport: http(RPC_URL) });
const supplier = createWalletClient({ account: privateKeyToAccount(SUPPLIER_KEY), chain: CHAIN, transport: http(RPC_URL) });
const anni = createWalletClient({ account: privateKeyToAccount(ANNI_KEY), chain: CHAIN, transport: http(RPC_URL) });

async function main() {
    console.log("🚀 [01.1] Checking GToken & Staking Approval for Anni...\n");
    console.log(`Anni: ${anni.account.address}`);
    console.log(`GToken: ${ADDR.GTOKEN}`);
    console.log(`Staking: ${ADDR.STAKING}`);

    // 1. Check GToken Balance
    const gToken = getContract({ address: ADDR.GTOKEN, abi: ABI.ERC20, client: publicClient });
    const bal = await gToken.read.balanceOf([anni.account.address]);
    console.log(`👉 Anni GToken Balance: ${formatEther(bal)}`);

    if (bal < parseEther("100")) {
        console.log("   Funding Anni with 1000 GTokens from Supplier...");
        const hash = await supplier.writeContract({
            address: ADDR.GTOKEN, abi: ABI.ERC20, functionName: 'transfer', args: [anni.account.address, parseEther("1000")]
        });
        console.log(`   ⏳ Tx: ${hash}`);
        await publicClient.waitForTransactionReceipt({ hash });
        console.log("   ✅ Funded.");
    } else {
        console.log("   ✅ Balance Sufficient.");
    }

    // 2. Check Approval
    const allowance = await gToken.read.allowance([anni.account.address, ADDR.STAKING]);
    console.log(`👉 Anni -> Staking Allowance: ${formatEther(allowance)}`);

    if (allowance < parseEther("1000")) {
        console.log("   Approving Staking...");
        const hash = await anni.writeContract({
            address: ADDR.GTOKEN, abi: ABI.ERC20, functionName: 'approve', args: [ADDR.STAKING, maxUint256]
        });
        console.log(`   ⏳ Tx: ${hash}`);
        await publicClient.waitForTransactionReceipt({ hash });
        console.log("   ✅ Approved.");
    } else {
        console.log("   ✅ Approval Sufficient.");
    }
}

main().catch(console.error);
