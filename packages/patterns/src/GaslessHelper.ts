import { type Address, type WalletClient, type Chain, type Transport } from 'viem';

export interface GaslessConfig {
    paymasterUrl: string;
    context?: {
        mode?: 'SPONSORED' | 'TOKEN' | 'CREDIT';
        token?: Address;
    };
}

/**
 * 🎯 GaslessHelper
 * 
 * Utility to configure Paymaster middleware for Smart Account Clients.
 * 
 * Usage:
 * ```typescript
 * const gaslessConfig = {
 *   paymasterUrl: "https://api.pimlico.io/v2/...",
 *   context: { mode: 'SPONSORED' }
 * };
 * 
 * // Note: In a real app, you'd pass this to createSmartAccountClient
 * // with middleware like `paymasterMiddleware(gaslessConfig)`
 * ```
 */
export class GaslessHelper {
    /**
     * Validate Gasless configuration
     */
    static validateConfig(config: GaslessConfig): boolean {
        if (!config.paymasterUrl || !config.paymasterUrl.startsWith('http')) {
            throw new Error('Invalid paymasterUrl');
        }
        return true;
    }

    /**
     * Create Paymaster context for UserOperation
     */
    static createPaymasterContext(config: GaslessConfig): any {
        this.validateConfig(config);
        
        return {
            sponsorshipPolicyId: config.context?.mode || 'SPONSORED',
            token: config.context?.token,
        };
    }

    /**
     * Get Paymaster URL for a given chain
     */
    static getPaymasterUrl(chainId: number, provider: 'PIMLICO' | 'ALCHEMY'): string {
        const urls: Record<string, string> = {
            'PIMLICO_11155111': `https://api.pimlico.io/v2/sepolia/rpc`,
            'ALCHEMY_11155111': `https://eth-sepolia.g.alchemy.com/v2/`,
            // Add more as needed
        };
        
        const key = `${provider}_${chainId}`;
        return urls[key] || '';
    }
}

/**
 * Note: Actual Gasless integration happens at Client creation time.
 * 
 * Example (pseudocode):
 * ```typescript
 * import { createSmartAccountClient } from 'viem/account-abstraction';
 * import { GaslessHelper } from '@aastar/patterns';
 * 
 * const gaslessConfig = {
 *   paymasterUrl: GaslessHelper.getPaymasterUrl(11155111, 'PIMLICO')
 * };
 * 
 * const client = createSmartAccountClient({
 *   // ... other config
 *   paymaster: {
 *     getPaymasterData: async (userOp) => {
 *       // Fetch from paymasterUrl
 *       const response = await fetch(gaslessConfig.paymasterUrl, {
 *         method: 'POST',
 *         body: JSON.stringify({
 *           method: 'pm_sponsorUserOperation',
 *           params: [userOp, context]
 *         })
 *       });
 *       return response.json();
 *     }
 *   }
 * });
 * ```
 */
