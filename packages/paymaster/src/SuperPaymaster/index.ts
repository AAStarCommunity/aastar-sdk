import { type Address } from 'viem';
import { type PublicClient, SuperPaymasterABI as SUPERPAYMASTER_ABI, encodeSuperPaymasterData, SUPER_PAYMASTER_MIN_POST_OP_GAS } from '@aastar/core';

export type PaymasterConfig = {
    paymasterAddress: Address;
    operator: Address;
    maxRate?: bigint;
    verificationGasLimit?: bigint;
    postOpGasLimit?: bigint;
    /**
     * Operator's configured xPNTs token (`operators(operator).xPNTsToken`). REQUIRED by
     * SuperPaymaster 5.5.0; harmless on 5.4.2 (it reads only the first 104 bytes). Without it the
     * middleware emits the legacy 104-byte layout, which 5.5.0 rejects.
     */
    token?: Address;
    /** 5.5.0 flags byte (SUPER_PAYMASTER_FLAGS); requires `token`. */
    flags?: number;
};

const DEFAULT_VERIFICATION_GAS = 160000n;
// MIN_POST_OP_GAS on both 5.4.2 and 5.5.0. The old default (10k) was below it and every op built
// with it was sigFailed by the deployed contract.
const DEFAULT_POSTOP_GAS = SUPER_PAYMASTER_MIN_POST_OP_GAS;

/**
 * Constructs the middleware for SuperPaymaster.
 * Returns the `paymasterAndData` hex string.
 */
export function getSuperPaymasterMiddleware(config: PaymasterConfig) {
    return {
        sponsorUserOperation: async (args: { userOperation: any }) => {
            const verGas = config.verificationGasLimit ?? DEFAULT_VERIFICATION_GAS;
            const postGas = config.postOpGasLimit ?? DEFAULT_POSTOP_GAS;
            const maxRate = config.maxRate ?? 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffn;

            // 5.4.x: [Paymaster(20)][VerGas(16)][PostOpGas(16)][Operator(20)][MaxRate(32)]
            // 5.5.0: ... [MaxRate(32)][Token(20)][Flags(1)] — emitted when config.token is set.
            const paymasterAndData = encodeSuperPaymasterData({
                paymaster: config.paymasterAddress,
                operator: config.operator,
                verificationGasLimit: verGas,
                postOpGasLimit: postGas,
                maxRate,
                token: config.token,
                flags: config.flags
            });

            return {
                paymasterAndData,
                verificationGasLimit: verGas,
                preVerificationGas: args.userOperation.preVerificationGas, 
            };
        }
    };
}

/**
 * Enhanced eligibility check for SuperPaymaster V3.
 * Validates that user has sufficient credit with the given operator.
 *
 * NOTE (5.5.0): credit is OFF by default and ops are normally paid from the user's escrowed
 * xPNTs balance, so `credit == 0` does NOT mean "cannot be sponsored" on 5.5.0. Use
 * `superPaymasterLensActions(lens).dryRunValidation` for a real pre-flight answer there.
 */
export async function checkEligibility(
    client: any, 
    paymaster: Address, 
    user: Address, 
    operator: Address
): Promise<{ eligible: boolean; credit?: bigint; token?: Address }> {
    try {
        // 1. Fetch operator's configured token
        const operatorData = await client.readContract({
            address: paymaster,
            abi: SUPERPAYMASTER_ABI,
            functionName: 'operators',
            args: [operator]
        });
        
        // operators() returns (aPNTsBalance, isConfigured, isPaused, xPNTsToken, reputation,
        // minTxInterval, treasury, totalSpent, totalTxSponsored) — identical shape on 5.4.2 and
        // 5.5.0 (M-11 §2.6: 0 same-selector shape changes). The previous indices read
        // aPNTsBalance as the token and were off by one for the two flags.
        const token = operatorData[3] as Address;
        const isConfigured = operatorData[1] as boolean;
        const isPaused = operatorData[2] as boolean;
        
        if (!isConfigured || isPaused) {
            return { eligible: false };
        }
        
        // 2. Check available credit
        const credit = await client.readContract({
            address: paymaster,
            abi: SUPERPAYMASTER_ABI,
            functionName: 'getAvailableCredit',
            args: [user, token]
        });
        
        return { 
            eligible: (credit as bigint) > 0n, 
            credit: credit as bigint,
            token
        };
    } catch (e) {
        console.warn('Eligibility check failed:', e);
        return { eligible: false };
    }
}

/**
 * Admin Client for SuperPaymaster V3
 */
export class SuperPaymasterAdminClient {
    private client: any;
    private paymasterAddress: Address;

    constructor(client: any, paymasterAddress: Address) {
        this.client = client;
        this.paymasterAddress = paymasterAddress;
    }

    async getOperator(operator: Address) {
        return this.client.readContract({
            address: this.paymasterAddress,
            abi: SUPERPAYMASTER_ABI,
            functionName: 'operators',
            args: [operator]
        });
    }

    static async configureOperator(
        wallet: any,
        paymaster: Address,
        token: Address,
        treasury: Address
    ) {
        return wallet.writeContract({
            address: paymaster,
            abi: SUPERPAYMASTER_ABI,
            functionName: 'configureOperator',
            args: [token, treasury],
            chain: wallet.chain
        } as any);
    }

    static async setOperatorPaused(wallet: any, paymaster: Address, operator: Address, paused: boolean) {
        return wallet.writeContract({
            address: paymaster,
            abi: SUPERPAYMASTER_ABI,
            functionName: 'setOperatorPaused',
            args: [operator, paused],
            chain: wallet.chain
        } as any);
    }

    static async updateReputation(wallet: any, paymaster: Address, operator: Address, score: bigint) {
        return wallet.writeContract({
            address: paymaster,
            abi: SUPERPAYMASTER_ABI,
            functionName: 'updateReputation',
            args: [operator, score],
            chain: wallet.chain
        } as any);
    }

    static async setAPNTsToken(wallet: any, paymaster: Address, token: Address) {
        return wallet.writeContract({
            address: paymaster,
            abi: SUPERPAYMASTER_ABI,
            functionName: 'setAPNTsToken',
            args: [token],
            chain: wallet.chain
        } as any);
    }

    static async setXPNTsFactory(wallet: any, paymaster: Address, factory: Address) {
        return wallet.writeContract({
            address: paymaster,
            abi: SUPERPAYMASTER_ABI,
            functionName: 'setXPNTsFactory',
            args: [factory],
            chain: wallet.chain
        } as any);
    }
}
