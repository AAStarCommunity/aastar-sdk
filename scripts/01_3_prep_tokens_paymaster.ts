import { createPublicClient, createWalletClient, http, parseAbi, parseEther, formatEther, getContract, Hex, Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../env/.env.anvil') });
const RPC_URL = process.env.SEPOLIA_RPC_URL;
if (!RPC_URL) throw new Error("Missing SEPOLIA_RPC_URL");

const CHAIN = sepolia;
const ANNI_KEY = process.env.PRIVATE_KEY_ANNI as Hex;
const JASON_KEY = process.env.PRIVATE_KEY_JASON as Hex;

const ADDR = {
    APNTS: process.env.APNTS_ADDRESS as Address,
    BPNTS: process.env.BPNTS_ADDRESS as Address,
    PAYMASTER_V4: process.env.PAYMASTER_V4_ADDRESS as Address,
    ENTRY_POINT: process.env.ENTRY_POINT_V07 as Address,
};

const ABI = {
    ERC20: parseAbi([
        'function balanceOf(address) view returns (uint256)',
        'function transfer(address, uint256) returns (bool)',
    ]),
    ENTRY_POINT: parseAbi([
        'function depositTo(address account) payable',
        'function balanceOf(address account) view returns (uint256)',
    ]),
};

const publicClient = createPublicClient({ chain: CHAIN, transport: http(RPC_URL) });
const anni = createWalletClient({ account: privateKeyToAccount(ANNI_KEY), chain: CHAIN, transport: http(RPC_URL) });
const jason = createWalletClient({ account: privateKeyToAccount(JASON_KEY), chain: CHAIN, transport: http(RPC_URL) });

const targets = [
    { name: "Baseline (A)", addr: process.env.TEST_SIMPLE_ACCOUNT_A as Address, needAPNTs: true },
    { name: "Standard (B)", addr: process.env.TEST_SIMPLE_ACCOUNT_B as Address, needBPNTs: true },
    { name: "SuperPaymaster (C)", addr: process.env.TEST_SIMPLE_ACCOUNT_C as Address, needAPNTs: true, needBPNTs: true },
];

async function main() {
    console.log("🚀 [01.3] Distributing Tokens & Funding Paymaster...\n");

    // 1. Tokens
    for (const t of targets) {
        if (!t.addr) continue;
        
        if (t.needBPNTs) {
            await checkAndTransfer(ADDR.BPNTS, anni, t.addr, parseEther("50"), "bPNTs");
        }
        if (t.needAPNTs) {
            await checkAndTransfer(ADDR.APNTS, jason, t.addr, parseEther("50"), "aPNTs");
        }
    }

    // 2. Paymaster Deposit
    if (ADDR.PAYMASTER_V4) {
        console.log("\n🏦 Checking Paymaster Deposit...");
        const ep = getContract({ address: ADDR.ENTRY_POINT, abi: ABI.ENTRY_POINT, client: publicClient });
        const deposit = await ep.read.balanceOf([ADDR.PAYMASTER_V4]);
        console.log(`   Deposit: ${formatEther(deposit)} ETH`);

        if (deposit < parseEther("0.05")) {
             console.log(`   Depositing 0.1 ETH from Anni...`);
             const hash = await anni.writeContract({
                 address: ADDR.ENTRY_POINT, abi: ABI.ENTRY_POINT, functionName: 'depositTo', 
                 args: [ADDR.PAYMASTER_V4], value: parseEther("0.1")
             });
             console.log(`   ⏳ Sent: ${hash}`);
             await publicClient.waitForTransactionReceipt({ hash });
             console.log(`   ✅ Deposited`);
        } else {
             console.log(`   ✅ Deposit Sufficient`);
        }
    }
}

async function checkAndTransfer(tokenAddr: Address, senderWallet: any, to: Address, amount: bigint, label: string) {
    if (!tokenAddr) { console.log(`   ⚠️ Skipping ${label} (No Address)`); return; }
    try {
        const token = getContract({ address: tokenAddr, abi: ABI.ERC20, client: publicClient });
        const bal = await token.read.balanceOf([to]);
        
        if (bal < amount) {
            console.log(`   Sending ${formatEther(amount)} ${label} to ${to}...`);
            const hash = await senderWallet.writeContract({
                address: tokenAddr, abi: ABI.ERC20, functionName: 'transfer', args: [to, amount]
            });
            console.log(`   ⏳ Tx: ${hash}`);
            await publicClient.waitForTransactionReceipt({ hash });
            console.log(`   ✅ Sent`);
        } else {
             console.log(`   ✅ ${label} Balance: ${formatEther(bal)}`);
        }
    } catch(e) {
        console.log(`   ⚠️ ${label} Error: ${e}`);
    }
}

main().catch(console.error);
