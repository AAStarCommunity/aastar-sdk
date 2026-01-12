import { createPublicClient, createWalletClient, http, parseEther, formatEther, Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../env/.env.anvil') });

const RPC_URL = process.env.SEPOLIA_RPC_URL;
const RELAYER_KEY = process.env.PRIVATE_KEY_RELAYER as Hex || process.env.PRIVATE_KEY_JASON as Hex;
const RECEIVER = "0x93E67dbB7B2431dE61a9F6c7E488e7F0E2eD2B3e";

if (!RPC_URL || !RELAYER_KEY) throw new Error("Missing Config for EOA Test");

async function main() {
    console.log("🚀 Starting Baseline 1: EOA Transfer...");
    
    const account = privateKeyToAccount(RELAYER_KEY);
    const client = createWalletClient({
        account,
        chain: foundry,
        transport: http(RPC_URL)
    });
    const publicClient = createPublicClient({ 
        chain: foundry, 
        transport: http(RPC_URL) 
    });

    console.log(`   👤 Sender: ${account.address}`);
    
    const balanceBefore = await publicClient.getBalance({ address: account.address });
    console.log(`   💰 Balance: ${formatEther(balanceBefore)} ETH`);

    try {
        const hash = await client.sendTransaction({
            to: RECEIVER,
            value: parseEther("0.0001"), 
        });
        console.log(`   ⏳ Transaction sent: ${hash}`);
        
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        console.log(`   ✅ Success!`);
        console.log(`   ⛽ Gas Used: ${receipt.gasUsed.toString()}`);
        console.log(`   💸 Effective Gas Price: ${formatEther(receipt.effectiveGasPrice)} ETH`);
    } catch (error) {
        console.error("   ❌ EOA Test Failed:", error);
    }
}

main().catch(console.error);
