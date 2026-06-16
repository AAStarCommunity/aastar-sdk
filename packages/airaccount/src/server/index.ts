// ── Main facade ───────────────────────────────────────────────────
export { YAAAServerClient } from "./server-client";

// ── Config ────────────────────────────────────────────────────────
export { validateConfig, sepoliaV07Config } from "./config";
export type { ServerConfig, EntryPointVersionConfig, AirAccountVersion } from "./config";

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
export { ModuleManager } from "./services/module-manager";
export { buildInstallModuleHash, buildUninstallModuleHash } from "./services/module-manager";
export type { InstallModuleParams, UninstallModuleParams, ModuleTypeId } from "./services/module-manager";
export { SessionKeyService, packSecp256k1SessionSignature, packP256SessionSignature } from "./services/session-key-service";
export type { GrantSessionParams, GrantP256SessionParams, SessionInfo, AgentSessionConfig, AgentSessionInfo } from "./services/session-key-service";
export { GuardStateReader } from "./services/guard-state-reader";
export type { GuardState, TokenGuardState } from "./services/guard-state-reader";
export { computeOapdSalt, getOapdAddress, getOapdAddressWithChainId, isOapdDeployed } from "./utils/oapd";
export type { OapdConfig } from "./utils/oapd";
export {
  wrapExecuteUserOp,
  isExecuteUserOpWrapped,
  EXECUTE_USER_OP_SELECTOR,
  EXECUTE_SELECTOR,
  EXECUTE_BATCH_SELECTOR,
} from "./utils/execute-user-op";
export { TransferManager } from "./services/transfer-manager";
export type {
  ExecuteTransferParams,
  EstimateGasParams,
  TransferResult,
} from "./services/transfer-manager";
export { BLSSignatureService } from "./services/bls-signature-service";
export { GuardChecker } from "./services/guard-checker";
export { PaymasterManager, PaymasterPriceStalenessError } from "./services/paymaster-manager";
export { ForceExitService, L2_TYPE } from "./services/force-exit-service";
export type { PendingExit, L2Type } from "./services/force-exit-service";
export {
  RecoveryService,
  RECOVERY_THRESHOLD,
  RECOVERY_TIMELOCK_SECONDS,
  MAX_GUARDIANS,
} from "./services/recovery-service";
export type { ActiveRecovery } from "./services/recovery-service";
export { EIP7702DelegateService, AIR_ACCOUNT_DELEGATE_ADDRESS } from "./services/eip7702-delegate-service";
export type { DelegateInitParams, EIP7702Authorization } from "./services/eip7702-delegate-service";
export {
  WeightedSignatureService,
  WEIGHT_CHANGE_THRESHOLD,
  WEIGHT_CHANGE_TIMELOCK_SECONDS,
  WEIGHT_CHANGE_EXPIRY_SECONDS,
} from "./services/weighted-signature-service";
export type { WeightConfig, PendingWeightChange } from "./services/weighted-signature-service";
export { AgentRegistryService } from "./services/agent-registry-service";
export type { CreateAgentAccountParams } from "./services/agent-registry-service";
export { ERC8004Service, ERC8004_ADDRESSES, erc8004AddressesForChain } from "./services/erc8004-service";
export type {
  SetAgentWalletParams,
  MintAgentIdentityParams,
  BindERC8004AgentWalletParams,
  SubmitAgentReputationParams,
  QueryAgentReputationParams,
  AgentReputationSummary,
} from "./services/erc8004-service";
export { TokenService } from "./services/token-service";
export type { TokenInfo, TokenBalance } from "./services/token-service";
export { WalletManager } from "./services/wallet-manager";
export { KmsManager, KmsSigner } from "./services/kms-signer";
export type {
  KmsCreateKeyRequest,
  KmsCreateKeyResponse,
  KmsSignHashResponse,
  LegacyPasskeyAssertion,
  WebAuthnAssertion,
  KmsBeginRegistrationRequest,
  KmsBeginRegistrationResponse,
  KmsCompleteRegistrationRequest,
  KmsCompleteRegistrationResponse,
  KmsBeginAuthenticationRequest,
  KmsBeginAuthenticationResponse,
  KmsKeyStatusResponse,
  KmsDescribeKeyResponse,
  KmsSignTypedDataRequest,
  KmsSignTypedDataResponse,
  KmsEip712Domain,
  KmsEip712TypeDef,
  KmsEip712FieldValue,
  KmsBeginGrantSessionAuthRequest,
  KmsBeginGrantSessionAuthResponse,
  KmsSignGrantSessionRequest,
  KmsSignGrantSessionResponse,
  KmsSignP256GrantSessionRequest,
  // P1 core key management
  KmsEthereumTransaction,
  KmsSignRequest,
  KmsSignResponse,
  KmsGetPublicKeyResponse,
  KmsDeriveAddressResponse,
  KmsListKeysResponse,
  KmsDeleteKeyResponse,
  KmsChangePasskeyResponse,
} from "./services/kms-signer";

// ── Shared KMS HTTP transport ─────────────────────────────────────
export { KmsHttpClient, DEFAULT_KMS_ENDPOINT } from "./services/kms-http-client";
export type { KmsHttpClientOptions } from "./services/kms-http-client";

// ── WebAuthn challenge-binding ceremony (#49 / Beta3) ─────────────
export {
  P256PasskeySigner,
  runWebAuthnCeremony,
  runAuthenticationCeremony,
  runGrantSessionCeremony,
  beginAuthenticationChallenge,
  beginGrantSessionChallenge,
  buildAuthenticationCredential,
  buildClientDataJSON,
  buildAuthenticatorData,
  base64UrlEncode,
  base64UrlDecode,
  DEFAULT_RP_ID,
  DEFAULT_ORIGIN,
  DEFAULT_CREDENTIAL_ID,
} from "./services/webauthn-ceremony";
export type {
  PasskeyCeremonySigner,
  WebAuthnAuthenticationCredential,
  BuildCredentialOptions,
  BeginCeremonyResponse,
  RunCeremonyOptions,
} from "./services/webauthn-ceremony";

// ── KMS Agent keys (TEE-JWT credentials) ──────────────────────────
export { KmsAgentService } from "./services/kms-agent-service";
export type {
  KmsCreateAgentKeyRequest,
  KmsCreateAgentKeyResponse,
  KmsSignAgentRequest,
  KmsSignAgentResponse,
  KmsRefreshAgentCredentialRequest,
  KmsRefreshAgentCredentialResponse,
  KmsRevokeAgentCredentialRequest,
  KmsRevokeAgentCredentialResponse,
} from "./services/kms-agent-service";

// ── KMS P256 session keys (ERC-4337 UserOp signing) ───────────────
export { KmsSessionService } from "./services/kms-session-service";
export type {
  CreateP256SessionKeyRequest,
  CreateP256SessionKeyResponse,
  SignP256UserOpRequest,
  SignP256UserOpResponse,
  RevokeP256SessionKeyRequest,
  RevokeP256SessionKeyResponse,
} from "./services/kms-session-service";

// ── KMS SuperPaymaster convenience signers (v0.20.0) ──────────────
export { KmsPaymentSigner } from "./services/kms-payment-signer";
export type {
  KmsPaymentAuth,
  KmsPaymentSignatureResponse,
  KmsSignMicropaymentVoucherRequest,
  KmsSignGTokenAuthorizationRequest,
  KmsSignX402PaymentRequest,
} from "./services/kms-payment-signer";

// ── KMS monitoring + operator admin ───────────────────────────────
export { KmsMonitorService } from "./services/kms-monitor-service";
export type {
  KmsHealthResponse,
  KmsVersionResponse,
  KmsQueueStatusResponse,
  KmsRollbackCounterResponse,
  KmsStatsResponse,
  KmsPurgeKeyResponse,
  KmsAttestationResponse,
  KmsAttestationManifestResponse,
  KmsAttestationProofResponse,
} from "./services/kms-monitor-service";

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
  // M7 module ABIs
  AGENT_SESSION_KEY_VALIDATOR_ABI,
  TIER_GUARD_HOOK_ABI,
  AIR_ACCOUNT_COMPOSITE_VALIDATOR_ABI,
  FORCE_EXIT_MODULE_ABI,
  // M6 inherited ABIs
  SESSION_KEY_VALIDATOR_ABI,
  CALLDATA_PARSER_REGISTRY_ABI,
  AIR_ACCOUNT_DELEGATE_ABI,
  MODULE_TYPE,
  ALG_ID,
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
