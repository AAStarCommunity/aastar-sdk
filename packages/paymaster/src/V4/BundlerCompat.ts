/**
 * Bundler Type Detection and Compatibility Layer
 */

export enum BundlerType {
    ALCHEMY = 'alchemy',
    PIMLICO = 'pimlico',
    STACKUP = 'stackup',
    CANDIDE = 'candide',
    UNKNOWN = 'unknown'
}

/**
 * Detect bundler type from URL
 */
export function detectBundlerType(bundlerUrl: string): BundlerType {
    const url = bundlerUrl.toLowerCase();
    if (url.includes('alchemy.com')) return BundlerType.ALCHEMY;
    if (url.includes('pimlico.io')) return BundlerType.PIMLICO;
    if (url.includes('stackup')) return BundlerType.STACKUP;
    if (url.includes('candide.dev')) return BundlerType.CANDIDE;
    return BundlerType.UNKNOWN;
}

/**
 * Create appropriate bundler client based on type
 */
export async function createBundlerClient(bundlerUrl: string, entryPoint: Address, chain: any) {
    const type = detectBundlerType(bundlerUrl);
    
    switch (type) {
        case BundlerType.PIMLICO:
            // Dynamically import Pimlico client
            const { createPimlicoClient } = await import('permissionless/clients/pimlico');
            return {
                type: BundlerType.PIMLICO,
                client: createPimlicoClient({
                    transport: http(bundlerUrl),
                    entryPoint: {
                        address: entryPoint,
                        version: '0.7' as const
                    }
                })
            };
            
        case BundlerType.ALCHEMY:
        case BundlerType.STACKUP:
        case BundlerType.UNKNOWN:
        default:
            // Use standard viem wallet client for Alchemy/Stackup
            const { createWalletClient, http } = await import('viem');
            return {
                type,
                client: createWalletClient({
                    chain,
                    transport: http(bundlerUrl)
                })
            };
    }
}
