import { createPublicClient, createWalletClient, http, parseEther, formatEther, Hex, toHex, encodeFunctionData, parseAbi, concat, encodeAbiParameters, keccak256, Address, pad, toBytes } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';
import * as dotenv from 'dotenv';
import * as path from 'path';

(BigInt.prototype as any).toJSON = function () { return this.toString(); };
dotenv.config({ path: path.resolve(__dirname, '../../env/.env.anvil') });

const RPC_URL = process.env.SEPOLIA_RPC_URL;
const BUNDLER_RPC = process.env.ALCHEMY_BUNDLER_RPC_URL;
const ENTRY_POINT = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";
const ACCOUNT_B = process.env.TEST_SIMPLE_ACCOUNT_B as Hex;
const BPNTS = process.env.BPNTS_ADDRESS as Hex;
const PAYMASTER_V4 = process.env.PAYMASTER_V4_ADDRESS as Hex;
const RECEIVER = "0x93E67dbB7B2431dE61a9F6c7E488e7F0E2eD2B3e";

if (!BUNDLER_RPC) throw new Error("Missing Bundler Config");

async function main() {
    console.log("☁️  [04.3] Estimation via Bundler...");
    const publicClient = createPublicClient({ chain: foundry, transport: http(RPC_URL) });
    const bundlerClient = createPublicClient({ chain: foundry, transport: http(BUNDLER_RPC) });

    const erc20Abi = parseAbi(['function transfer(address, uint256) returns (bool)', 'function approve(address, uint256) returns (bool)']);
    const executeAbi = parseAbi(['function execute(address, uint256, bytes)']);

    // 1. Data (Transfer)
    const transferData = encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [RECEIVER, parseEther("1")] });
    const callData = encodeFunctionData({ abi: executeAbi, functionName: 'execute', args: [BPNTS, 0n, transferData] });
    
    const nonce = await publicClient.readContract({
        address: ENTRY_POINT, abi: parseAbi(['function getNonce(address, uint192) view returns (uint256)']),
        functionName: 'getNonce', args: [ACCOUNT_B, 0n]
    });

    // 2. Minimal UserOp for Estimate
    // PURE: No Gas Limits. No Packed fields.
    const minimalEstOp = {
        sender: ACCOUNT_B,
        nonce: toHex(nonce),
        callData,
        // Paymaster: We use minimal "0x + Address" or "0x + Address + highplaceholders"
        // Let's try JUST Paymaster Address first? No, v0.7 PaymasterAndData must be at least 52 bytes (20addr + 32limits)?
        // EntryPoint v0.7: paymasterAndData is bytes.
        // If we only provide address, validation might fail on length check.
        // Let's provide Address + Dummy Limits (32 bytes).
        paymasterAndData: concat([PAYMASTER_V4, pad("0x1", { size: 32 })]), // Just padding to check if it accepts
        signature: "0xfffffffffffffffffffffffffffffff0000000000000000000000000000000007aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1c" as Hex
    };

    console.log("   Sending to eth_estimateUserOperationGas...");
    try {
        const estRes: any = await bundlerClient.request({
            method: 'eth_estimateUserOperationGas',
            params: [minimalEstOp, ENTRY_POINT]
        });
        console.log("   ✅ Estimation Success!");
        console.log(estRes);
    } catch (e: any) {
        console.log("\n   ❌ Estimation Failed:");
        console.log(e.details || e.message);
        if (e.cause) console.log(e.cause);
    }
}
main().catch(console.error);
