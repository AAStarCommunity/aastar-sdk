/**
 * Blockchain Network Configuration
 */

export const NETWORKS = {
  sepolia: {
    chainId: 11155111,
    name: 'Sepolia',
    /** Public RPC URL - users should use their own RPC providers in production */
    rpcUrl: 'https://rpc.sepolia.org',
    blockExplorer: 'https://sepolia.etherscan.io',
    nativeCurrency: {
      name: 'Sepolia ETH',
      symbol: 'ETH',
      decimals: 18,
    },
  },
} as const;

export type SupportedNetwork = keyof typeof NETWORKS;

/**
 * Get network configuration
 *
 * @param network - Network name
 * @returns Network configuration
 *
 * @example
 * ```ts
 * const network = getNetwork('sepolia');
 * console.log(network.chainId); // 11155111
 * ```
 */
export function getNetwork(network: SupportedNetwork) {
  return NETWORKS[network];
}

/**
 * Get RPC URL for a network
 *
 * @param network - Network name
 * @returns Public RPC URL
 *
 * @example
 * ```ts
 * const rpcUrl = getRpcUrl('sepolia');
 * ```
 */
export function getRpcUrl(network: SupportedNetwork) {
  return NETWORKS[network].rpcUrl;
}

/**
 * Get block explorer URL
 *
 * @param network - Network name
 * @returns Block explorer base URL
 *
 * @example
 * ```ts
 * const explorer = getBlockExplorer('sepolia');
 * // 'https://sepolia.etherscan.io'
 * ```
 */
export function getBlockExplorer(network: SupportedNetwork) {
  return NETWORKS[network].blockExplorer;
}

/**
 * Get transaction URL on block explorer
 *
 * @param network - Network name
 * @param txHash - Transaction hash
 * @returns Full transaction URL
 *
 * @example
 * ```ts
 * const url = getTxUrl('sepolia', '0x123...');
 * // 'https://sepolia.etherscan.io/tx/0x123...'
 * ```
 */
export function getTxUrl(network: SupportedNetwork, txHash: string): string {
  return `${getBlockExplorer(network)}/tx/${txHash}`;
}

/**
 * Get address URL on block explorer
 *
 * @param network - Network name
 * @param address - Contract or wallet address
 * @returns Full address URL
 *
 * @example
 * ```ts
 * const url = getAddressUrl('sepolia', '0xabc...');
 * // 'https://sepolia.etherscan.io/address/0xabc...'
 * ```
 */
export function getAddressUrl(network: SupportedNetwork, address: string): string {
  return `${getBlockExplorer(network)}/address/${address}`;
}

/**
 * Get chain ID for a network
 *
 * @param network - Network name
 * @returns Chain ID number
 *
 * @example
 * ```ts
 * const chainId = getChainId('sepolia');
 * // 11155111
 * ```
 */
export function getChainId(network: SupportedNetwork): number {
  return NETWORKS[network].chainId;
}
