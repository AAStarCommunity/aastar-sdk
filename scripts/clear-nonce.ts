import { createWalletClient, http, parseEther, createPublicClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env.sepolia') });

async function clearNonce() {
    const pk = process.env.PRIVATE_KEY_SUPPLIER;
    if (!pk) throw new Error("No PK");
    
    const account = privateKeyToAccount(pk as `0x${string}`);
    const client = createWalletClient({
        account,
        chain: sepolia,
        transport: http(process.env.RPC_URL)
    });
    
    const publicClient = createPublicClient({
        chain: sepolia,
        transport: http(process.env.RPC_URL)
    });

    const nonce = 1716;
    console.log(`🚀 Sending NOP for nonce ${nonce} from ${account.address}...`);
    
    // Get current gas price and boost it
    const gasPrice = await publicClient.getGasPrice();
    const boostedGasPrice = (gasPrice * 150n) / 100n;
    
    const hash = await client.sendTransaction({
        to: account.address,
        value: 0n,
        nonce,
        gasPrice: boostedGasPrice,
    });
    
    console.log(`✅ NOP Sent: ${hash}`);
    console.log(`⏳ Waiting for confirmation...`);
    await publicClient.waitForTransactionReceipt({ hash });
    console.log(`🎉 Nonce ${nonce} cleared!`);
}

clearNonce().catch(console.error);
