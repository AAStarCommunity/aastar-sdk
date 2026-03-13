import { PasskeyManager } from "./auth/passkey/passkey.manager";
import { BLSManager } from "./core/bls/bls.manager";
import { BLSConfig } from "./core/bls/types";

export interface YAAAConfig {
  /** Backend API URL (e.g., https://api.yetanotheraa.com) */
  apiURL: string;
  /** Function to get the current auth token (JWT) */
  tokenProvider?: () => string | null;
  /** BLS Configuration */
  bls: BLSConfig;
}

export class YAAAClient {
  readonly passkey: PasskeyManager;
  readonly bls: BLSManager;

  constructor(private config: YAAAConfig) {
    // Initialize modules
    this.passkey = new PasskeyManager(config.apiURL, config.tokenProvider);
    this.bls = new BLSManager(config.bls);
  }
}
