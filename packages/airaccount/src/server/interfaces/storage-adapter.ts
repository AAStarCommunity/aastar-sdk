/**
 * Account record stored by the SDK.
 */
export interface AccountRecord {
  userId: string;
  address: string;
  signerAddress: string;
  /**
   * CREATE2 salt. Canonically persisted as a DECIMAL STRING (lossless, like dailyLimit) — the
   * full-config / P-256 path (#118 M2) writes it this way so a large salt (> 2^53) neither truncates
   * as a JS number nor fails JSON serialization as a bigint. The deploy-time rebuild reconstructs it
   * with `BigInt(account.salt)`, which MUST match the salt used to predict the address
   * (`_getSalt(owner, salt, configHash)`) or funds sent to the predicted address are stranded.
   * `number | bigint` retained for back-compat with the legacy create paths.
   */
  salt: string | number | bigint;
  deployed: boolean;
  deploymentTxHash: string | null;
  validatorAddress: string;
  entryPointVersion: string;
  factoryAddress: string;
  createdAt: string;
  /**
   * Daily transfer limit in wei, stored as a decimal string (bigint serialization).
   * "0" or undefined means no guard / no limit.
   * Written into the factory config at account creation time.
   */
  dailyLimit?: string;
  /**
   * Guardian addresses and their acceptance signatures.
   * Present only for accounts created via createAccountWithGuardians().
   * Required by transfer-manager to reconstruct initCode using createAccountWithDefaults.
   */
  guardian1?: string;
  guardian1Sig?: string;
  guardian2?: string;
  guardian2Sig?: string;
  /**
   * Full-config (8-field InitConfig) guardian slots — each is either an ECDSA address or a
   * P-256 (passkey) public key (x, y). Present ONLY for accounts created via
   * createAccountWithP256Guardians() (the factory's createAccount(owner, salt, config) path).
   * transfer-manager rebuilds the byte-identical InitConfig from these at first-UserOp deploy
   * time so the deployed CREATE2 address matches the create-time prediction.
   */
  guardianSpecs?: Array<{ ecdsa: string } | { p256: { x: string; y: string } }>;
  /**
   * Resolved approvedAlgIds written into the init config (full-config path). Persisted so the
   * deploy-time InitConfig is reconstructed EXACTLY (no re-defaulting). Paired with guardianSpecs.
   */
  approvedAlgIds?: number[];
  /**
   * minDailyLimit floor (wei, decimal string) written into the init config (full-config path).
   * Paired with guardianSpecs for exact deploy-time reconstruction.
   */
  minDailyLimit?: string;
}

/**
 * Transfer record stored by the SDK.
 */
export interface TransferRecord {
  id: string;
  userId: string;
  from: string;
  to: string;
  amount: string;
  data?: string;
  userOpHash: string;
  bundlerUserOpHash?: string;
  transactionHash?: string;
  status: "pending" | "submitted" | "completed" | "failed";
  error?: string;
  nodeIndices: number[];
  tokenAddress?: string;
  tokenSymbol?: string;
  createdAt: string;
  submittedAt?: string;
  completedAt?: string;
  failedAt?: string;
}

/**
 * Paymaster configuration record.
 */
export interface PaymasterRecord {
  id?: string;
  name: string;
  address: string;
  apiKey?: string;
  type: "pimlico" | "stackup" | "alchemy" | "custom";
  endpoint?: string;
  createdAt?: string;
}

/**
 * BLS configuration record.
 */
export interface BlsConfigRecord {
  signerNodes?: {
    nodes: Array<{
      nodeId: string;
      nodeName: string;
      apiEndpoint: string;
      status: string;
      lastSeen?: string;
    }>;
  };
  discovery?: {
    seedNodes?: Array<{ endpoint: string }>;
    discoveryTimeout?: number;
  };
}

/**
 * Pluggable storage adapter — replaces NestJS DatabaseService.
 * SDK only manages accounts, transfers, paymasters, and BLS config.
 * User authentication is NOT handled by the SDK.
 */
export interface IStorageAdapter {
  // Accounts
  getAccounts(): Promise<AccountRecord[]>;
  saveAccount(account: AccountRecord): Promise<void>;
  findAccountByUserId(userId: string): Promise<AccountRecord | null>;
  updateAccount(userId: string, updates: Partial<AccountRecord>): Promise<void>;

  // Transfers
  saveTransfer(transfer: TransferRecord): Promise<void>;
  findTransfersByUserId(userId: string): Promise<TransferRecord[]>;
  findTransferById(id: string): Promise<TransferRecord | null>;
  updateTransfer(id: string, updates: Partial<TransferRecord>): Promise<void>;

  // Paymasters
  getPaymasters(userId: string): Promise<PaymasterRecord[]>;
  savePaymaster(userId: string, paymaster: PaymasterRecord): Promise<void>;
  removePaymaster(userId: string, name: string): Promise<boolean>;

  // BLS config
  getBlsConfig(): Promise<BlsConfigRecord | null>;
  updateSignerNodesCache(nodes: unknown[]): Promise<void>;
}
