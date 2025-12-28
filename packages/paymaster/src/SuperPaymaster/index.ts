import { type Address, concat, pad, toHex } from 'viem';
import { SuperPaymasterV3ABI as SUPERPAYMASTER_ABI } from '@aastar/core';

export type PaymasterConfig = {
    paymasterAddress: Address;
    operator: Address;
    maxRate?: bigint;
    verificationGasLimit?: bigint;
    postOpGasLimit?: bigint;
};

const DEFAULT_VERIFICATION_GAS = 160000n;
const DEFAULT_POSTOP_GAS = 10000n;

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

            // V3.2.1 Layout: [Paymaster(20)] [VerGas(16)] [PostOpGas(16)] [Operator(20)] [MaxRate(32)]
            // Offset 72 starts MaxRate.
            const paymasterAndData = concat([
                config.paymasterAddress,
                pad(toHex(verGas), { size: 16 }),
                pad(toHex(postGas), { size: 16 }),
                config.operator,
                pad(toHex(maxRate), { size: 32 })
            ]);

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
        
        // operatorData structure: [token, treasury, isConfigured, isPaused, exchangeRate, ...]
        const token = operatorData[0] as Address;
        const isConfigured = operatorData[2] as boolean;
        const isPaused = operatorData[3] as boolean;
        
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
export class SuperPaymasterClient {
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
        treasury: Address, 
        exchangeRate: bigint
    ) {
        return wallet.writeContract({
            address: paymaster,
            abi: SUPERPAYMASTER_ABI,
            functionName: 'configureOperator',
            args: [token, treasury, exchangeRate],
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
