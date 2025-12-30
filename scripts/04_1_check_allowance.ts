import { createPublicClient, createWalletClient, http, parseEther, formatEther, Hex, toHex, encodeFunctionData, parseAbi, concat, encodeAbiParameters, keccak256, Address, pad, toBytes } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';
import * as dotenv from 'dotenv';
import * as path from 'path';

(BigInt.prototype as any).toJSON = function () { return this.toString(); };
dotenv.config({ path: path.resolve(__dirname, '../../env/.env.v3') });

const RPC_URL = process.env.SEPOLIA_RPC_URL;
const BPNTS = process.env.BPNTS_ADDRESS as Hex;
const PAYMASTER_V4 = process.env.PAYMASTER_V4_ADDRESS as Hex;
const ACCOUNT_B = process.env.TEST_SIMPLE_ACCOUNT_B as Hex;
const SIGNER_KEY = process.env.PRIVATE_KEY_JASON as Hex; 

async function main() {
    console.log("🔍 [04.1] Checking Allowance for Group B...");
    const client = createPublicClient({ chain: foundry, transport: http(RPC_URL) });
    const signer = privateKeyToAccount(SIGNER_KEY);
    const wallet = createWalletClient({ account: signer, chain: foundry, transport: http(RPC_URL) });

    const erc20Abi = parseAbi([
        'function allowance(address, address) view returns (uint256)',
        'function approve(address, uint256) returns (bool)'
    ]);

    const allow = await client.readContract({ address: BPNTS, abi: erc20Abi, functionName: 'allowance', args: [ACCOUNT_B, PAYMASTER_V4] });
    console.log(`   💎 Allowance: ${formatEther(allow)} bPNTs`);
    
    // NOTE: We cannot simply use 'wallet.writeContract' for Account B, strictly speaking, 
    // because Account B is a Smart Contract Account (SimpleAccount). 
    // It must authorize transfers via UserOp.
    // However, if we know the Singer Key controls Account B, we can only verify if the ALLOWANCE exists on chain.
    // If allowance is 0, we must send an 'Approve' UserOp.
    
    // This script only diagnose state.
    if (allow < parseEther("100")) {
        console.log("   ❌ Allowance checks failed. You must run an Approval UserOp first.");
        // We will handle Approval in a separate atomic script or manually.
    } else {
        console.log("   ✅ Allowance Sufficient.");
    }
}
main();
