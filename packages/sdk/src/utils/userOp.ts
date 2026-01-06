import { type Address, type Hex, concat, pad, keccak256, encodeAbiParameters, parseAbiParameters, type PublicClient } from 'viem';

/**
 * ERC-4337 v0.7 Packed UserOperation structure.
 */
export interface PackedUserOperation {
    sender: Address;
    nonce: Hex;
    initCode: Hex;
    callData: Hex;
    accountGasLimits: Hex; // bytes32 (packed verificationGasLimit and callGasLimit)
    preVerificationGas: Hex;
    gasFees: Hex; // bytes32 (packed maxPriorityFeePerGas and maxFeePerGas)
    paymasterAndData: Hex;
    signature: Hex;
}

export interface UserOpGasParams {
    verificationGasLimit: bigint;
    callGasLimit: bigint;
    preVerificationGas: bigint;
    maxPriorityFeePerGas: bigint;
    maxFeePerGas: bigint;
}

export interface PaymasterGasParams {
    paymasterGasLimit: bigint;
    paymasterPostOpGasLimit: bigint;
}

export class UserOperationBuilder {
    /**
     * Packs verificationGasLimit and callGasLimit into a bytes32 Hex string.
     */
    static packAccountGasLimits(verificationGasLimit: bigint, callGasLimit: bigint): Hex {
        return concat([
            pad(`0x${verificationGasLimit.toString(16)}`, { dir: 'left', size: 16 }),
            pad(`0x${callGasLimit.toString(16)}`, { dir: 'left', size: 16 })
        ]) as Hex;
    }

    /**
     * Packs maxPriorityFeePerGas and maxFeePerGas into a bytes32 Hex string.
     */
    static packGasFees(maxPriorityFeePerGas: bigint, maxFeePerGas: bigint): Hex {
        return concat([
            pad(`0x${maxPriorityFeePerGas.toString(16)}`, { dir: 'left', size: 16 }),
            pad(`0x${maxFeePerGas.toString(16)}`, { dir: 'left', size: 16 })
        ]) as Hex;
    }

    /**
     * Packs Paymaster parameters into the v0.7 paymasterAndData format.
     */
    static packPaymasterAndData(
        paymaster: Address,
        paymasterGasLimit: bigint,
        paymasterPostOpGasLimit: bigint,
        paymasterData: Hex = '0x'
    ): Hex {
        return concat([
            paymaster,
            pad(`0x${paymasterGasLimit.toString(16)}`, { dir: 'left', size: 16 }),
            pad(`0x${paymasterPostOpGasLimit.toString(16)}`, { dir: 'left', size: 16 }),
            paymasterData
        ]) as Hex;
    }

    /**
     * Computes the UserOperation hash for signing.
     */
    static async getUserOpHash({
        userOp,
        entryPoint,
        chainId,
        publicClient
    }: {
        userOp: PackedUserOperation;
        entryPoint: Address;
        chainId: number;
        publicClient: PublicClient;
    }): Promise<Hex> {
        return await (publicClient as any).readContract({
            address: entryPoint,
            abi: [{
                type: 'function',
                name: 'getUserOpHash',
                inputs: [{
                    type: 'tuple',
                    components: [
                        { name: 'sender', type: 'address' },
                        { name: 'nonce', type: 'uint256' },
                        { name: 'initCode', type: 'bytes' },
                        { name: 'callData', type: 'bytes' },
                        { name: 'accountGasLimits', type: 'bytes32' },
                        { name: 'preVerificationGas', type: 'uint256' },
                        { name: 'gasFees', type: 'bytes32' },
                        { name: 'paymasterAndData', type: 'bytes' },
                        { name: 'signature', type: 'bytes' }
                    ]
                }],
                outputs: [{ type: 'bytes32' }],
                stateMutability: 'view'
            }],
            functionName: 'getUserOpHash',
            args: [userOp]
        }) as Hex;
    }

    /**
     * Formats a PackedUserOperation into a JSON-RPC compatible object with hex-encoded strings.
     */
    static jsonifyUserOp(userOp: any): any {
        const result: any = { ...userOp };
        // Ensure all numeric fields are hex strings
        if (typeof result.nonce === 'bigint') result.nonce = `0x${result.nonce.toString(16)}`;
        if (typeof result.preVerificationGas === 'bigint') result.preVerificationGas = `0x${result.preVerificationGas.toString(16)}`;
        return result;
    }
}
