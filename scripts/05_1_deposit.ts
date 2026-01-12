import { createPublicClient, createWalletClient, http, parseEther, formatEther, Hex, toHex, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../env/.env.anvil') });

const RPC_URL = process.env.SEPOLIA_RPC_URL;
const SUPER_PAYMASTER = process.env.SUPER_PAYMASTER_ADDRESS as Hex;
const ANNI_KEY = process.env.PRIVATE_KEY_ANNI as Hex;
const ENTRY_POINT = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";

async function main() {
    console.log("🏦 [05.1] Executing Manual Deposit for SuperPaymaster...");
    const client = createPublicClient({ chain: foundry, transport: http(RPC_URL) });
    const wallet = createWalletClient({ account: privateKeyToAccount(ANNI_KEY), chain: foundry, transport: http(RPC_URL) });

    const epAbi = parseAbi(['function depositTo(address) payable', 'function balanceOf(address) view returns (uint256)']);

    // 1. Check Balance
    const balance = await client.readContract({ address: ENTRY_POINT, abi: epAbi, functionName: 'balanceOf', args: [SUPER_PAYMASTER] });
    console.log(`   💰 Current EntryPoint Deposit: ${formatEther(balance)} ETH`);

    if (balance >= parseEther("0.05")) {
        console.log("   ✅ Deposit Sufficient. Skipping.");
        return;
    }

    // 2. Deposit
    console.log("   ⚠️  Adding 0.05 ETH...");
    const feeData = await client.estimateFeesPerGas();
    const maxPriority = (feeData.maxPriorityFeePerGas || parseEther("2", "gwei")) * 3n; // Aggressive
    const maxFee = (feeData.maxFeePerGas || parseEther("30", "gwei")) * 2n;

    const hash = await wallet.writeContract({
        address: ENTRY_POINT, abi: epAbi, functionName: 'depositTo', args: [SUPER_PAYMASTER],
        value: parseEther("0.05"),
        maxPriorityFeePerGas: maxPriority, maxFeePerGas: maxFee
    });
    console.log(`   🚀 Tx Sent: ${hash}`);
    
    // 3. Wait
    console.log("   ⏳ Waiting for confirmation...");
    const receipt = await client.waitForTransactionReceipt({ hash, confirmations: 1 });
    console.log(`   ✅ Confirmed in block ${receipt.blockNumber}`);
}
main();
