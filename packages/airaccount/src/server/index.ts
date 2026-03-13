// ── Main facade ───────────────────────────────────────────────────
export { YAAAServerClient } from "./server-client";

// ── Config ────────────────────────────────────────────────────────
export { validateConfig } from "./config";
export type { ServerConfig, EntryPointVersionConfig } from "./config";

// ── Interfaces ────────────────────────────────────────────────────
export type {
  IStorageAdapter,
  AccountRecord,
  TransferRecord,
  PaymasterRecord,
  BlsConfigRecord,
} from "./interfaces/storage-adapter";
export type { ISignerAdapter, PasskeyAssertionContext } from "./interfaces/signer-adapter";
export type { ILogger } from "./interfaces/logger";
export { ConsoleLogger, SilentLogger } from "./interfaces/logger";

// ── Providers ─────────────────────────────────────────────────────
export { EthereumProvider } from "./providers/ethereum-provider";

// ── Services ──────────────────────────────────────────────────────
export { AccountManager } from "./services/account-manager";
export { TransferManager } from "./services/transfer-manager";
export type {
  ExecuteTransferParams,
  EstimateGasParams,
  TransferResult,
} from "./services/transfer-manager";
export { BLSSignatureService } from "./services/bls-signature-service";
export { GuardChecker } from "./services/guard-checker";
export { PaymasterManager } from "./services/paymaster-manager";
export { TokenService } from "./services/token-service";
export type { TokenInfo, TokenBalance } from "./services/token-service";
export { WalletManager } from "./services/wallet-manager";
export { KmsManager, KmsSigner } from "./services/kms-signer";
export type {
  KmsCreateKeyResponse,
  KmsSignHashResponse,
  LegacyPasskeyAssertion,
  KmsBeginRegistrationRequest,
  KmsBeginRegistrationResponse,
  KmsCompleteRegistrationRequest,
  KmsCompleteRegistrationResponse,
  KmsBeginAuthenticationRequest,
  KmsBeginAuthenticationResponse,
  KmsKeyStatusResponse,
  KmsDescribeKeyResponse,
} from "./services/kms-signer";

// ── Adapters ──────────────────────────────────────────────────────
export { MemoryStorage } from "./adapters/memory-storage";
export { LocalWalletSigner } from "./adapters/local-wallet-signer";

// ── Constants ─────────────────────────────────────────────────────
export {
  EntryPointVersion,
  ENTRYPOINT_ADDRESSES,
  ENTRYPOINT_ABI_V6,
  ENTRYPOINT_ABI_V7_V8,
  FACTORY_ABI_V6,
  FACTORY_ABI_V7_V8,
  ACCOUNT_ABI,
  VALIDATOR_ABI,
  ERC20_ABI,
  AIRACCOUNT_ADDRESSES,
  AIRACCOUNT_ABI,
  AIRACCOUNT_FACTORY_ABI,
  GLOBAL_GUARD_ABI,
} from "./constants/entrypoint";
export type { EntryPointConfig } from "./constants/entrypoint";

// ── Re-export shared types from core ──────────────────────────────
export type { UserOperation, PackedUserOperation, GasEstimate } from "../core/types";
export type {
  BLSSignatureData,
  BLSNode,
  BLSConfig,
  CumulativeT2SignatureData,
  CumulativeT3SignatureData,
} from "../core/bls/types";

// ── Tier routing ─────────────────────────────────────────────────
export {
  ALG_BLS,
  ALG_ECDSA,
  ALG_P256,
  ALG_CUMULATIVE_T2,
  ALG_CUMULATIVE_T3,
  resolveTier,
  algIdForTier,
} from "../core/tier";
export type { AlgId, TierLevel, TierConfig, GuardStatus, PreCheckResult } from "../core/tier";
