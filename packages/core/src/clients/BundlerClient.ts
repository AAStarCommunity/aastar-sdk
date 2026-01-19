import { type Address, type Hex } from 'viem';
import { AAStarError } from '../errors/index.js';

export interface UserOperationV07 {
    sender: Address;
    nonce: bigint;
    initCode: Hex;
    callData: Hex;
    accountGasLimits: Hex;
    preVerificationGas: bigint;
    gasFees: Hex;
    paymasterAndData: Hex;
    signature: Hex;
}

export interface BundlerResponse<T> {
    jsonrpc: '2.0';
    id: number;
    result?: T;
    error?: {
        code: number;
        message: string;
        data?: any;
    };
}

/**
 * BundlerClient
 * Low-level JSON-RPC client for ERC-4337 Bundlers.
 */
export class BundlerClient {
    constructor(
        public readonly url: string,
        public readonly entryPoint: Address
    ) {}

    /**
     * Standard JSON-RPC call helper
     */
    private async rpcCall<T>(method: string, params: any[]): Promise<T> {
        const payload = {
            jsonrpc: '2.0',
            id: Date.now(),
            method,
            params
        };

        return this.executeWithRetry(async () => {
            const response = await fetch(this.url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload, (_, v) => 
                    typeof v === 'bigint' ? '0x' + v.toString(16) : v
                )
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`HTTP ${response.status}: ${text}`);
            }

            const data = await response.json() as BundlerResponse<T>;
            
            if (data.error) {
                throw AAStarError.fromBundlerError(data.error);
            }

            if (data.result === undefined) {
                throw new AAStarError(
                    (data as any).code || 'INTERNAL_ERROR' as any,
                    `Bundler returned empty result for ${method}`
                );
            }

            return data.result;
        });
    }

    /**
     * Exponential Backoff with Jitter
     */
    private async executeWithRetry<T>(operation: () => Promise<T>, maxRetries = 3): Promise<T> {
        let lastError: any;
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await operation();
            } catch (error: any) {
                lastError = error;
                // Only retry on rate limits or network issues
                const isRetryable = error.code === 'E5006' || // BUNDLER_RATE_LIMIT
                                  error.code === 'E3001' || // NETWORK_TIMEOUT
                                  error.code === 'E3003' || // CONNECTION_REFUSED
                                  error.message?.includes('HTTP 429');

                if (!isRetryable || attempt === maxRetries) break;

                const delay = Math.min(1000 * Math.pow(2, attempt) + Math.random() * 1000, 10000);
                console.log(`[BundlerClient] 🔄 Retryable error detected. Attempt ${attempt + 1}/${maxRetries}. Retrying in ${Math.round(delay)}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        throw lastError;
    }

    /**
     * eth_sendUserOperation
     */
    async sendUserOperation(userOp: UserOperationV07): Promise<Hex> {
        return this.rpcCall<Hex>('eth_sendUserOperation', [userOp, this.entryPoint]);
    }

    /**
     * eth_estimateUserOperationGas
     */
    async estimateUserOperationGas(userOp: Partial<UserOperationV07>): Promise<any> {
        return this.rpcCall<any>('eth_estimateUserOperationGas', [userOp, this.entryPoint]);
    }

    /**
     * eth_getUserOperationReceipt (v0.7 support prep)
     */
    async getUserOperationReceipt(hash: Hex): Promise<any> {
        return this.rpcCall<any>('eth_getUserOperationReceipt', [hash]);
    }

    /**
     * eth_getUserOperationByHash
     */
    async getUserOperationByHash(hash: Hex): Promise<any> {
        return this.rpcCall<any>('eth_getUserOperationByHash', [hash]);
    }
}
