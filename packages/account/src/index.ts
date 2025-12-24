import { type Hex, type Address, encodeAbiParameters, keccak256 } from 'viem';

export * from './eoa.js';
export * from './accounts/simple.js';

/**
 * Common Pack Logic for v0.7 UserOperations
 */
export function packUserOpLimits(high: bigint, low: bigint): Hex {
    return `0x${((high << 128n) | low).toString(16).padStart(64, '0')}` as Hex;
}

/**
 * Local implementation of EntryPoint v0.7 getUserOpHash
 */
export function getUserOpHash(op: any, ep: Address, chainId: number): Hex {
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

/**
 * UserOperation Client for handling high-level flows
 */
export class UserOpClient {
    static async estimateGas(bundler: any, op: any, entryPoint: Address) {
        return bundler.request({
            method: 'eth_estimateUserOperationGas',
            params: [op, entryPoint]
        });
    }

    static async sendUserOp(bundler: any, op: any, entryPoint: Address) {
        return bundler.request({
            method: 'eth_sendUserOperation',
            params: [op, entryPoint]
        });
    }

    static async getReceipt(bundler: any, hash: Hex) {
        return bundler.request({
            method: 'eth_getUserOperationReceipt',
            params: [hash]
        });
    }
}
