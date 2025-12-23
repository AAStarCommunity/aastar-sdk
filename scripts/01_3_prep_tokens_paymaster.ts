import { createPublicClient, createWalletClient, http, parseEther, formatEther, type Hex, type Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { ERC20Client } from '../packages/tokens/src/index.ts';
import { FinanceClient } from '../packages/finance/src/index.ts';

dotenv.config({ path: path.resolve(__dirname, '../../env/.env.v3') });
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

const publicClient = createPublicClient({ chain: CHAIN, transport: http(RPC_URL) });
const anni = createWalletClient({ account: privateKeyToAccount(ANNI_KEY), chain: CHAIN, transport: http(RPC_URL) });
const jason = createWalletClient({ account: privateKeyToAccount(JASON_KEY), chain: CHAIN, transport: http(RPC_URL) });

const targets = [
    { name: "Baseline (A)", addr: process.env.TEST_SIMPLE_ACCOUNT_A as Address, needAPNTs: true },
    { name: "Standard (B)", addr: process.env.TEST_SIMPLE_ACCOUNT_B as Address, needBPNTs: true },
    { name: "SuperPaymaster (C)", addr: process.env.TEST_SIMPLE_ACCOUNT_C as Address, needAPNTs: true, needBPNTs: true },
];

async function main() {
    console.log("🚀 [01.3] Distributing Tokens & Funding Paymaster (Refactored)...\n");

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
    if (ADDR.PAYMASTER_V4 && ADDR.ENTRY_POINT) {
        console.log("\n🏦 Checking Paymaster Deposit...");
        const deposit = await FinanceClient.getEntryPointBalance(publicClient, ADDR.ENTRY_POINT, ADDR.PAYMASTER_V4);
        console.log(`   Deposit: ${formatEther(deposit)} ETH`);

        if (deposit < parseEther("0.05")) {
             console.log(`   Depositing 0.1 ETH from Anni...`);
             const hash = await FinanceClient.depositToEntryPoint(anni, ADDR.ENTRY_POINT, ADDR.PAYMASTER_V4, parseEther("0.1"));
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
        const bal = await ERC20Client.balanceOf(publicClient, tokenAddr, to);
        
        if (bal < amount) {
            console.log(`   Sending ${formatEther(amount)} ${label} to ${to}...`);
            const hash = await ERC20Client.transfer(senderWallet, tokenAddr, to, amount);
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
