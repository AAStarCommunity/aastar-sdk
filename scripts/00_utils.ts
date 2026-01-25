import { Hex, Address, encodeAbiParameters, keccak256, createPublicClient, http, Chain } from 'viem';
import { sepolia, foundry, optimism, optimismSepolia } from 'viem/chains';

export const ENTRY_POINT_V07 = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";

export function packUint(high128: bigint, low128: bigint): Hex {
    return `0x${((high128 << 128n) | low128).toString(16).padStart(64, '0')}`;
}

export async function entryPointGetUserOpHash(client: any, op: any, ep: Address, chainId: number): Promise<Hex> {
    const packed = encodeAbiParameters(
        [
            { type: 'address' }, { type: 'uint256' }, { type: 'bytes32' }, { type: 'bytes32' },
            { type: 'bytes32' }, { type: 'uint256' }, { type: 'bytes32' }, { type: 'bytes32' }
        ],
        [
            op.sender, BigInt(op.nonce), 
            keccak256(op.initCode && op.initCode !== "0x" ? op.initCode : '0x'), 
            keccak256(op.callData),
            op.accountGasLimits, BigInt(op.preVerificationGas), op.gasFees,
            keccak256(op.paymasterAndData)
        ]
    );
    const enc = encodeAbiParameters(
        [{ type: 'bytes32' }, { type: 'address' }, { type: 'uint256' }],
        [keccak256(packed), ep, BigInt(chainId)]
    );
    return keccak256(enc);
}

export async function waitForUserOp(client: any, hash: Hex, maxRetries = 30) {
    for(let i=0; i<maxRetries; i++) {
        try {
            const res = await client.request({ method: 'eth_getUserOperationReceipt', params: [hash] });
            if (res) {
                console.log(`   ✅ Mined! Tx: ${(res as any).receipt.transactionHash}`);
                return res;
            }
        } catch {}
        await new Promise(r => setTimeout(r, 2000));
    }
    throw new Error(`Timeout waiting for UserOp: ${hash}`);
}

export function getNetworkConfig(network: string) {
    switch (network.toLowerCase()) {
        case 'sepolia':
            return { chain: sepolia, rpc: process.env.SEPOLIA_RPC_URL };
        case 'optimism':
            return { chain: optimism, rpc: process.env.OPTIMISM_RPC_URL };
        case 'op-sepolia':
        case 'optimism-sepolia':
            return { chain: optimismSepolia, rpc: process.env.OPTIMISM_SEPOLIA_RPC_URL };
        case 'local':
        case 'anvil':
            return { chain: foundry, rpc: "http://127.0.0.1:8545" };
        default:
            throw new Error(`Unsupported network: ${network}`);
    }
}
