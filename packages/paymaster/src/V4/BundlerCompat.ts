import { type Address } from 'viem';

/**
 * Bundler types we support
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
 * Create a bundler client based on the bundler type
 * Returns a simple config object to avoid type conflicts
 */
export function createBundlerClient(bundlerUrl: string, entryPoint: Address): any {
    const bundlerType = detectBundlerType(bundlerUrl);
    
    return {
        type: bundlerType,
        url: bundlerUrl,
        entryPoint
    };
}
