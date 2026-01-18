import { type Address, type PublicClient, type Transport, type Chain } from 'viem';

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
 * Minimal interface to satisfy basic Pimlico/Bundler needs 
 * without bringing in heavy permissionless types that might conflict
 */
export interface BundlerConfig {
    type: BundlerType;
    url: string;
    entryPoint: Address;
}

/**
 * Create a bundler client config
 */
export function createBundlerClient(bundlerUrl: string, entryPoint: Address): BundlerConfig {
    const bundlerType = detectBundlerType(bundlerUrl);
    
    return {
        type: bundlerType,
        url: bundlerUrl,
        entryPoint
    };
}
