import { PasskeyManager, PasskeyRoutes } from "./auth/passkey/passkey.manager";
import { BLSManager } from "./core/bls/bls.manager";
import { BLSConfig } from "./core/bls/types";

export interface AirAccountConfig {
  /**
   * Backend RP (relying party) API URL — required, no default.
   *
   * AAStar's official hosted RP will be `https://auth.aastar.io` (served by
   * aNode, see AAStarCommunity/YetAnotherAA-Validator#81). You can also point
   * this at your own backend implementing the standardized passkey contract
   * (see `@aastar/passkey-server` / {@link PasskeyRoutes}).
   */
  apiURL: string;
  /** Function to get the current auth token (JWT) */
  tokenProvider?: () => string | null;
  /**
   * Optional overrides for the passkey backend route paths.
   *
   * Defaults to the standardized `@aastar/passkey-server` contract
   * (`/auth/passkey/*`). Override individual paths to point at a backend that
   * exposes different routes without changing SDK code.
   */
  passkeyRoutes?: Partial<PasskeyRoutes>;
  /** BLS Configuration */
  bls: BLSConfig;
}

export class AirAccountClient {
  readonly passkey: PasskeyManager;
  readonly bls: BLSManager;

  constructor(private config: AirAccountConfig) {
    // Initialize modules
    this.passkey = new PasskeyManager(
      config.apiURL,
      config.tokenProvider,
      config.passkeyRoutes
    );
    this.bls = new BLSManager(config.bls);
  }
}

/**
 * @deprecated Renamed to {@link AirAccountConfig}. This alias is kept for
 * backward compatibility and will be removed in a future major version.
 */
export type YAAAConfig = AirAccountConfig;

/**
 * @deprecated Renamed to {@link AirAccountClient}. This alias is kept for
 * backward compatibility and will be removed in a future major version.
 */
export const YAAAClient = AirAccountClient;
