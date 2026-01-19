import { type Address, concat, pad, toHex, keccak256, encodeAbiParameters, type Hex, toBytes } from 'viem';

export type PaymasterV4MiddlewareConfig = {
    paymasterAddress: Address;
    gasToken: Address;
    verificationGasLimit?: bigint;
    postOpGasLimit?: bigint;
};

export type GaslessReadinessReport = {
    isReady: boolean;
    issues: string[];
    details: {
        paymasterStake: bigint;
        paymasterDeposit: bigint;
        ethUsdPrice: bigint;
        tokenSupported: boolean;
        tokenPrice: bigint;
        userTokenBalance: bigint;
        userPaymasterDeposit: bigint;
    };
};

const DEFAULT_VERIFICATION_GAS_V4 = 1500000n; // ~1.5M for safety
const DEFAULT_POSTOP_GAS_V4 = 300000n; // ~300k for postOp logic

/**
 * Constructs the middleware for Paymaster V4.
 * Returns the `paymasterAndData` hex string.
 */
export function getPaymasterV4Middleware(config: PaymasterV4MiddlewareConfig) {
    return {
        sponsorUserOperation: async (args: { userOperation: any }) => {
            const verGas = config.verificationGasLimit ?? DEFAULT_VERIFICATION_GAS_V4;
            const postGas = config.postOpGasLimit ?? DEFAULT_POSTOP_GAS_V4;

            // Layout: [Paymaster(20)] [VerGas(16)] [PostOpGas(16)] [Token(20)]
            const paymasterAndData = concat([
                config.paymasterAddress,
                pad(toHex(verGas), { size: 16 }),
                pad(toHex(postGas), { size: 16 }),
                config.gasToken
            ]);

            return {
                paymasterAndData,
                verificationGasLimit: verGas,
                preVerificationGas: args.userOperation.preVerificationGas
            };
        }
    };
}

/**
 * Build paymasterAndData for gasless UserOperation.
 * Layout: [Paymaster(20)] [VerificationGasLimit(16)] [PostOpGasLimit(16)] [Token(20)] [ValidUntil(6)] [ValidAfter(6)]
 */
export function buildPaymasterData(
    paymasterAddress: Address,
    token: Address,
    options?: {
        validityWindow?: number;
        verificationGasLimit?: bigint;
        postOpGasLimit?: bigint;
    }
): `0x${string}` {
    const validityWindow = options?.validityWindow ?? 3600;
    const verGas = options?.verificationGasLimit ?? 200000n; // Increased for estimation
    const postGas = options?.postOpGasLimit ?? 100000n;
    
    const now = Math.floor(Date.now() / 1000);
    const validUntil = now + validityWindow;
    const validAfter = now - 100; // 100 seconds grace period

    return concat([
        paymasterAddress,
        pad(toHex(verGas), { size: 16 }),
        pad(toHex(postGas), { size: 16 }),
        token,
        pad(toHex(validUntil), { size: 6 }),
        pad(toHex(validAfter), { size: 6 })
    ]);
}

/**
 * Build paymasterAndData for SuperPaymaster V3.
 * Layout: [Paymaster(20)] [verGas(16)] [postGas(16)] [operator(20)] [maxRate(32)]
 * Total: 104 bytes
 * 
 * IMPORTANT: SuperPaymaster contract generates validUntil internally using:
 *   validUntil = cachedPrice.updatedAt + priceStalenessThreshold
 * Do NOT include validUntil/validAfter in paymasterAndData!
 */
export function buildSuperPaymasterData(
    paymasterAddress: Address,
    operator: Address,
    options?: {
        verificationGasLimit?: bigint;
        postOpGasLimit?: bigint;
        maxRate?: bigint;
    }
): `0x${string}` {
    const verGas = options?.verificationGasLimit ?? 80000n;
    const postGas = options?.postOpGasLimit ?? 100000n;
    const maxRate = options?.maxRate ?? ((1n << 256n) - 1n); // Default: max uint256, no rate limit
    
    return concat([
        paymasterAddress,
        pad(toHex(verGas), { size: 16 }),
        pad(toHex(postGas), { size: 16 }),
        operator,
        pad(toHex(maxRate), { size: 32 }) // Optional rate commitment (rug pull protection)
    ]);
}

/**
 * Helper to format UserOp for Alchemy/Standard Bundlers (v0.7 Decomposed)
 */
export function formatUserOpV07(userOp: any) {
    const result: any = {
        sender: userOp.sender,
        nonce: toHex(userOp.nonce),
        callData: userOp.callData,
        preVerificationGas: toHex(userOp.preVerificationGas),
        signature: userOp.signature
    };

    // Only include factory/factoryData if account is NOT deployed (initCode not empty)
    if (userOp.initCode && userOp.initCode !== '0x' && userOp.initCode.length > 2) {
        result.initCode = userOp.initCode;
        if (userOp.initCode.length > 42) {
            result.factory = userOp.initCode.slice(0, 42);
            result.factoryData = '0x' + userOp.initCode.slice(42);
        } else {
            result.factory = '0x0000000000000000000000000000000000000000';
            result.factoryData = '0x';
        }
    }
    // If account is deployed, don't include any factory fields at all

    // Unpack accountGasLimits: [verificationGasLimit(16)][callGasLimit(16)]
    if (userOp.accountGasLimits && userOp.accountGasLimits !== '0x') {
        const packed = userOp.accountGasLimits.replace('0x', '').padStart(64, '0');
        result.verificationGasLimit = '0x' + BigInt('0x' + packed.slice(0, 32)).toString(16);
        result.callGasLimit = '0x' + BigInt('0x' + packed.slice(32, 64)).toString(16);
    }

    // Unpack gasFees: [maxPriorityFee(16)][maxFee(16)]
    if (userOp.gasFees && userOp.gasFees !== '0x') {
        const packed = userOp.gasFees.replace('0x', '').padStart(64, '0');
        result.maxPriorityFeePerGas = '0x' + BigInt('0x' + packed.slice(0, 32)).toString(16);
        result.maxFeePerGas = '0x' + BigInt('0x' + packed.slice(32, 64)).toString(16);
    }

    // Unpack paymasterAndData: [paymaster(20)][verificationGas(16)][postOpGas(16)][paymasterData]
    if (userOp.paymasterAndData && userOp.paymasterAndData !== '0x') {
        const packed = userOp.paymasterAndData.replace('0x', '');
        if (packed.length >= 104) {
            result.paymaster = '0x' + packed.slice(0, 40);
            result.paymasterVerificationGasLimit = '0x' + BigInt('0x' + packed.slice(40, 72)).toString(16);
            result.paymasterPostOpGasLimit = '0x' + BigInt('0x' + packed.slice(72, 104)).toString(16);
            result.paymasterData = '0x' + packed.slice(104);
        }
    }

    return result;
}

export function getUserOpHashV07(userOp: any, entryPoint: Address, chainId: bigint): Hex {
    const hashedUserOp = keccak256(encodeAbiParameters(
        ['address', 'uint256', 'bytes32', 'bytes32', 'bytes32', 'uint256', 'bytes32', 'bytes32'].map(t => ({ type: t } as any)),
        [
            userOp.sender,
            userOp.nonce,
            keccak256(toBytes(userOp.initCode as Hex)),
            keccak256(toBytes(userOp.callData as Hex)),
            userOp.accountGasLimits as Hex,
            toHex(userOp.preVerificationGas),
            userOp.gasFees as Hex,
            keccak256(toBytes(userOp.paymasterAndData as Hex))
        ]
    ));
    return keccak256(encodeAbiParameters(
        ['bytes32', 'address', 'uint256'].map(t => ({ type: t } as any)),
        [hashedUserOp, entryPoint, chainId]
    ));
}

/**
 * Tune gas limit using a dynamic nominal ceiling to satisfy Bundler efficiency (0.4)
 * Target: Actual / Limit >= targetEfficiency
 */
export function tuneGasLimit(estimate: bigint, nominalActual: bigint, targetEfficiency = 0.45): bigint {
    if (estimate === 0n) return 0n;
    // targetEfficiency = actual / ceiling => ceiling = actual / targetEfficiency
    const ceiling = (nominalActual * 100n) / BigInt(Math.floor(targetEfficiency * 100));
    // Return the more restrictive limit to ensure efficiency ratio is met
    return estimate < ceiling ? estimate : ceiling;
}
