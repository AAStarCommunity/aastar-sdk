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
     * Pack PaymasterV4 Deposit-Only paymasterAndData
     * 
     * v0.7 EntryPoint packs: [paymaster(20)][verificationGas(16)][postOpGas(16)][paymasterData]
     * Contract extracts token at offset 52 = paymasterData[0:20]
     * 
     * So paymasterData format must be: [token(20)][validUntil(6)][validAfter(6)]
     * 
     * @param paymaster - Paymaster address (20 bytes)
     * @param paymentToken - ERC20 token address (20 bytes, FIRST in paymasterData!)
     * @param validUntil - Validity end timestamp (6 bytes)
     * @param validAfter - Validity start timestamp (6 bytes)
     */
    static packPaymasterV4DepositData(
        paymaster: Address,
        paymasterVerificationGasLimit: bigint,
        paymasterPostOpGasLimit: bigint,
        paymentToken: Address,
        validUntil: bigint,
        validAfter: bigint
    ): Hex {
        return concat([
            paymaster,
            pad(`0x${paymasterVerificationGasLimit.toString(16)}`, { dir: 'left', size: 16 }),
            pad(`0x${paymasterPostOpGasLimit.toString(16)}`, { dir: 'left', size: 16 }),
            paymentToken,
            pad(`0x${validUntil.toString(16)}`, { dir: 'left', size: 6 }),
            pad(`0x${validAfter.toString(16)}`, { dir: 'left', size: 6 })
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


        result.nonce = toCompactHex(result.nonce);
        result.preVerificationGas = toCompactHex(result.preVerificationGas);
        
        // Note: Alchemy usually accepts non-padded Quantities for nonce/preVerificationGas.
        // But let's verify if strict padding is required by using viem's pad
        
        // Alchemy v0.7 Validator seems to reject PADDED Quantities (leads to 'Invalid fields').
        // It accepts COMPACT HEX (e.g. 0x1 instead of 0x0...01).
        // Viem toHex produces compact hex.

        return result;
    }

    /**
     * Converts a PackedUserOperation to the Alchemy-specific v0.7 JSON format.
     * @param userOp - The packed UserOperation
     * @param options - Optional configuration
     * @param options.paymasterVerificationGasLimit - Gas limit for paymaster verification (default: 200000)
     * @param options.paymasterPostOpGasLimit - Gas limit for paymaster postOp (default: 200000)
     */
    static toAlchemyUserOperation(userOp: any, options?: {
        paymasterVerificationGasLimit?: bigint;
        paymasterPostOpGasLimit?: bigint;
    }): any {
        const result: any = {
            sender: userOp.sender,
            nonce: userOp.nonce,
            callData: userOp.callData,
            signature: userOp.signature
        };

        // 1. Unpack accountGasLimits: [verificationGasLimit(16)][callGasLimit(16)]
        if (userOp.accountGasLimits && userOp.accountGasLimits !== '0x') {
            const val = userOp.accountGasLimits.toString().startsWith('0x') ? userOp.accountGasLimits.slice(2) : userOp.accountGasLimits;
            const padded = val.padStart(64, '0');
            const verificationGasLimit = BigInt('0x' + padded.slice(0, 32));
            const callGasLimit = BigInt('0x' + padded.slice(32, 64));
            
            result.verificationGasLimit = `0x${verificationGasLimit.toString(16)}`;
            result.callGasLimit = `0x${callGasLimit.toString(16)}`;
        }

        // 2. Unpack gasFees: [maxPriorityFee(16)][maxFee(16)]
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
            result.factory = initCode.slice(0, 42); // First 20 bytes
            result.factoryData = '0x' + initCode.slice(42);
        }

        // 5. Unpack paymasterAndData -> paymaster + gas limits + paymasterData
        // Full format: [paymaster(20)][verificationGas(16)][postOpGas(16)][paymasterData]
        // paymasterData = [token(20)][validUntil(6)][validAfter(6)] = 32 bytes
        if (userOp.paymasterAndData && userOp.paymasterAndData !== '0x') {
            const pmd = userOp.paymasterAndData.toString().startsWith('0x') ? userOp.paymasterAndData.slice(2) : userOp.paymasterAndData;
            
            // Check if we have full format with gas limits (at least 20+16+16 = 52 bytes = 104 hex chars)
            if (pmd.length >= 104) {
                // Full v0.7 packed format
                result.paymaster = '0x' + pmd.slice(0, 40); // bytes 0-19 (20 bytes)
                const vGas = BigInt('0x' + pmd.slice(40, 72)); // bytes 20-35 (16 bytes)
                const pGas = BigInt('0x' + pmd.slice(72, 104)); // bytes 36-51 (16 bytes)
                result.paymasterVerificationGasLimit = `0x${vGas.toString(16)}`;
                result.paymasterPostOpGasLimit = `0x${pGas.toString(16)}`;
                result.paymasterData = '0x' + pmd.slice(104); // bytes 52+ (token + timestamps)
            } else if (pmd.length >= 40) {
                // Fallback: assume 52-byte format without gas limits (old format)
                result.paymaster = '0x' + pmd.slice(0, 40);
                result.paymasterData = '0x' + pmd.slice(40);
                const defaultGasLimit = 200000n;
                result.paymasterVerificationGasLimit = `0x${(options?.paymasterVerificationGasLimit || defaultGasLimit).toString(16)}`;
                result.paymasterPostOpGasLimit = `0x${(options?.paymasterPostOpGasLimit || defaultGasLimit).toString(16)}`;
            }
        }

        return result;
    }
}
