import * as dotenv from 'dotenv';
import path from 'path';
import { createPublicClient, http, createWalletClient, type Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia, anvil } from 'viem/chains';

// Setup Env based on TARGET_ENV
const TARGET_ENV = process.env.TARGET_ENV || 'anvil';
const envFile = TARGET_ENV === 'anvil' ? '.env.anvil' : '.env.sepolia';
dotenv.config({ path: path.resolve(process.cwd(), envFile) });
dotenv.config({ path: path.resolve(process.cwd(), '.env') }); // Global fallback

export async function getTestSetup() {
    const rpcUrl = process.env.RPC_URL || (TARGET_ENV === 'anvil' ? 'http://127.0.0.1:8545' : process.env.SEPOLIA_RPC_URL);
    const pk = process.env.OWNER_PRIVATE_KEY || process.env.PRIVATE_KEY;
    if (!pk) throw new Error("Missing PRIVATE_KEY in env");

    const chain = TARGET_ENV === 'anvil' ? anvil : sepolia;
    const account = privateKeyToAccount(pk as `0x${string}`);
    
    return {
        account,
        chain,
        rpcUrl,
        TARGET_ENV
    };
}
