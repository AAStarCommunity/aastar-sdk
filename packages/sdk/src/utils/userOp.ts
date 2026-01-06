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
        // Strict allowlist for ERC-4337 v0.7 PackedUserOperation
        // Alchemy rejects requests with unknown fields.
        const result: any = {
            sender: userOp.sender,
            nonce: userOp.nonce,
            initCode: userOp.initCode,
            callData: userOp.callData,
            accountGasLimits: userOp.accountGasLimits,
            preVerificationGas: userOp.preVerificationGas,
            gasFees: userOp.gasFees,
            paymasterAndData: userOp.paymasterAndData,
            signature: userOp.signature
        };

        // Ensure all numeric fields are hex strings and padded
        // Helper to ensure '0x' prefix and valid hex string
        const toHexParams = (val: bigint | string | number) => {
            if (typeof val === 'bigint') return `0x${val.toString(16)}`;
            if (typeof val === 'number') return `0x${val.toString(16)}`;
            return val; // Assume hex string
        };

        result.nonce = toHexParams(result.nonce);
        result.preVerificationGas = toHexParams(result.preVerificationGas);
        
        // Note: Alchemy usually accepts non-padded Quantities for nonce/preVerificationGas.
        // But let's verify if strict padding is required by using viem's pad
        
        // Alchemy v0.7 Validator seems to reject PADDED Quantities (leads to 'Invalid fields').
        // It accepts COMPACT HEX (e.g. 0x1 instead of 0x0...01).
        // Viem toHex produces compact hex.
        
        const toCompactHex = (val: bigint | string | number) => {
             if (typeof val === 'bigint') return `0x${val.toString(16)}`;
             if (typeof val === 'number') return `0x${val.toString(16)}`;
             if (typeof val === 'string') {
                 // Remove leading zeros if present (but keep 0x)
                 if (val === '0x') return '0x'; // invalid quantity? Should be 0x0?
                 // JSON-RPC Quantity: 0x0
                 if (val === '0x0') return '0x0';
                 return val.replace(/^0x0+(?!$)/, '0x'); 
             }
             return val;
        };

        return result;
    }

    /**
     * Converts a PackedUserOperation to the Alchemy-specific v0.7 JSON format
     * which uses unpacked fields (legacy-style names) instead of packed bytes.
     */
    static toAlchemyUserOperation(userOp: any): any {
        const result: any = {
            sender: userOp.sender,
            nonce: userOp.nonce,
            callData: userOp.callData,
            signature: userOp.signature
        };

        // 1. Unpack accountGasLimits
        // bytes32 = [16 bytes verificationGasLimit][16 bytes callGasLimit]
        if (userOp.accountGasLimits && userOp.accountGasLimits !== '0x') {
            const val = userOp.accountGasLimits.toString().startsWith('0x') ? userOp.accountGasLimits.slice(2) : userOp.accountGasLimits;
            // Pad to 64 chars
            const padded = val.padStart(64, '0');
            const verificationGasLimit = BigInt('0x' + padded.slice(0, 32));
            const callGasLimit = BigInt('0x' + padded.slice(32, 64));
            
            result.verificationGasLimit = `0x${verificationGasLimit.toString(16)}`;
            result.callGasLimit = `0x${callGasLimit.toString(16)}`;
        }

        // 2. Unpack gasFees
        // bytes32 = [16 bytes maxPriorityFee][16 bytes maxFee]
        if (userOp.gasFees && userOp.gasFees !== '0x') {
             const val = userOp.gasFees.toString().startsWith('0x') ? userOp.gasFees.slice(2) : userOp.gasFees;
             const padded = val.padStart(64, '0');
             const maxPriorityFeePerGas = BigInt('0x' + padded.slice(0, 32));
             const maxFeePerGas = BigInt('0x' + padded.slice(32, 64));
             
             result.maxPriorityFeePerGas = `0x${maxPriorityFeePerGas.toString(16)}`;
             result.maxFeePerGas = `0x${maxFeePerGas.toString(16)}`;
        }
        
        // 3. PreVerificationGas (Direct copy but ensure hex)
        if (userOp.preVerificationGas) {
             result.preVerificationGas = `0x${BigInt(userOp.preVerificationGas).toString(16)}`;
        }

        // 4. Unpack initCode -> factory + factoryData
        if (userOp.initCode && userOp.initCode !== '0x') {
            const initCode = userOp.initCode.toString();
            // Factory is first 20 bytes (40 hex chars) + 0x = 42 chars
            result.factory = initCode.slice(0, 42);
            result.factoryData = '0x' + initCode.slice(42);
        }

        // 5. Unpack paymasterAndData -> paymaster + vars
        // Packed: [20 bytes paymaster][16 bytes gasLimit][16 bytes postOpGasLimit][paymasterData]
        if (userOp.paymasterAndData && userOp.paymasterAndData !== '0x') {
            const pmd = userOp.paymasterAndData.toString().startsWith('0x') ? userOp.paymasterAndData.slice(2) : userOp.paymasterAndData;
            // Need at least 20 bytes (40 chars)
            if (pmd.length >= 40) {
                result.paymaster = '0x' + pmd.slice(0, 40);
                
                // v0.7 spec: paymasterAndData IS packed.
                // But Alchemy wants unpacked.
                // [20 bytes paymaster]
                // [16 bytes paymasterVerificationGasLimit]
                // [16 bytes paymasterPostOpGasLimit]
                // [paymasterData]
                
                if (pmd.length >= 40 + 32 + 32) {
                     const pvgl = BigInt('0x' + pmd.slice(40, 72));
                     const ppogl = BigInt('0x' + pmd.slice(72, 104));
                     result.paymasterVerificationGasLimit = `0x${pvgl.toString(16)}`;
                     result.paymasterPostOpGasLimit = `0x${ppogl.toString(16)}`;
                     result.paymasterData = '0x' + pmd.slice(104);
                } else {
                    // Fallback if not fully 0.7 packed? (Should typically be)
                    // If native payment, pmd is 0x.
                    // If just paymaster (v0.6 style?), length might be just 40 chars.
                    result.paymasterData = '0x';
                }
            }
        }

        return result;
    }
}
