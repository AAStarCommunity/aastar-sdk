/**
 * eip6963.ts — EIP-6963 Multi Injected Provider Discovery for AirAccount.
 *
 * Announces AirAccount as an EIP-1193 wallet via the eip6963:announceProvider
 * DOM event, enabling DApps to auto-discover it without relying on window.ethereum.
 *
 * Reference: https://eips.ethereum.org/EIPS/eip-6963
 */

import type { AirAccountEIP1193Provider } from "./eip1193.js";

export interface EIP6963ProviderInfo {
  /** Globally unique wallet identifier (UUID v4). Must not change across sessions. */
  uuid: string;
  /** Human-readable wallet name displayed in DApp UI */
  name: string;
  /** Wallet icon as a data URI (SVG or PNG, base64) */
  icon: string;
  /** Reverse-DNS identifier, e.g. "community.aastar.airaccount" */
  rdns: string;
}

export interface EIP6963ProviderDetail {
  info: EIP6963ProviderInfo;
  provider: AirAccountEIP1193Provider;
}

// AirAccount default icon (minimal SVG placeholder)
const DEFAULT_ICON =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0OCA0OCI+PGNpcmNsZSBjeD0iMjQiIGN5PSIyNCIgcj0iMjQiIGZpbGw9IiMxQTFBMkUiLz48dGV4dCB4PSIxMiIgeT0iMzIiIGZvbnQtc2l6ZT0iMjQiIGZpbGw9IiNGRkYiPkFBPC90ZXh0Pjwvc3ZnPg==";

// Stable UUID for AirAccount — must not change between sessions per EIP-6963 spec
const AIRACCOUNT_UUID = "d4e5f6a7-b8c9-4d0e-8f2a-3b4c5d6e7f80";

/**
 * Announce AirAccount as an EIP-6963 wallet so DApps can auto-discover it.
 *
 * Call this once at app startup. Returns a cleanup function that removes the
 * event listener when the wallet is no longer available.
 *
 * @example
 * ```ts
 * const provider = new AirAccountEIP1193Provider({ ... });
 * const cleanup = announceAirAccount(provider);
 * // later: cleanup() to stop announcing
 * ```
 */
export function announceAirAccount(
  provider: AirAccountEIP1193Provider,
  info: Partial<EIP6963ProviderInfo> = {},
): () => void {
  const providerDetail: EIP6963ProviderDetail = Object.freeze({
    info: Object.freeze({
      uuid: AIRACCOUNT_UUID,
      name: "AirAccount",
      icon: DEFAULT_ICON,
      rdns: "community.aastar.airaccount",
      ...info,
    }),
    provider,
  });

  const announce = () => {
    window.dispatchEvent(
      new CustomEvent("eip6963:announceProvider", { detail: providerDetail }),
    );
  };

  // Announce immediately so DApps already listening receive it
  announce();

  // Re-announce whenever a DApp requests wallet discovery
  window.addEventListener("eip6963:requestProvider", announce);

  return () => window.removeEventListener("eip6963:requestProvider", announce);
}

/**
 * Listen for EIP-6963 wallet announcements from other providers in the page.
 * Useful for composing AirAccount with MetaMask fallback, etc.
 *
 * Returns a cleanup function to stop listening.
 */
export function watchProviders(
  onProvider: (detail: EIP6963ProviderDetail) => void,
): () => void {
  const handler = (event: Event) => {
    onProvider((event as CustomEvent<EIP6963ProviderDetail>).detail);
  };

  window.addEventListener("eip6963:announceProvider", handler);
  // Trigger all existing wallets to re-announce
  window.dispatchEvent(new Event("eip6963:requestProvider"));

  return () => window.removeEventListener("eip6963:announceProvider", handler);
}
