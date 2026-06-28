import type { Address } from 'viem';

/**
 * Default x402 facilitator registry (mirrors `@aastar/core` `DEFAULT_DVT_NODES`).
 *
 * `contract` is the deployed `X402Facilitator` (used as the EIP-712 `verifyingContract` for the
 * direct-path `X402PaymentAuthorization`, and as the on-chain recipient for the eip-3009 path).
 * `urls` are the hosted facilitator HTTP services (`/x402/{verify,settle,supported}`) — these are
 * operated by DVT nodes (migration tracked in YetAnotherAA-Validator#130) and are filled in once
 * dvt1/2/3 deploy the `x402-facilitator` module. A developer can always override via
 * `new X402Client({ facilitator: { url } })`.
 */
export interface X402FacilitatorEnv {
  chainId: number;
  /** Deployed X402Facilitator contract (EIP-712 domain verifyingContract + eip-3009 recipient). */
  contract: Address;
  /** Hosted facilitator service base URLs (each appends `/x402/...`). Empty until DVT deploys. */
  urls: string[];
}

export const DEFAULT_X402_FACILITATORS: Readonly<Record<number, X402FacilitatorEnv>> = {
  // Sepolia — X402Facilitator v5.4.1 (X402Facilitator-1.0.0), proven on-chain via settleX402PaymentDirect.
  11155111: {
    chainId: 11155111,
    contract: '0xfe1DB01e1d6622e722B92ed5993af61325DB92aF',
    // Hosted services pending the DVT x402-facilitator module (YetAnotherAA-Validator#130).
    // Expected: ["https://dvt1.aastar.io/x402", "https://dvt2.aastar.io/x402", "https://dvt3.aastar.io/x402"].
    urls: [],
  },
};

/** The deployed X402Facilitator contract for a chain (throws if unknown — callers must pass one). */
export function getX402FacilitatorContract(chainId: number): Address {
  const env = DEFAULT_X402_FACILITATORS[chainId];
  if (!env) throw new Error(`x402: no default X402Facilitator for chainId ${chainId}; pass facilitatorContract explicitly`);
  return env.contract;
}

/** Hosted facilitator service URLs for a chain (empty until DVT deploys the module). */
export function getX402FacilitatorUrls(chainId: number): string[] {
  return DEFAULT_X402_FACILITATORS[chainId]?.urls ?? [];
}
