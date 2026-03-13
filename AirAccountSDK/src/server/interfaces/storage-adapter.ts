/**
 * Account record stored by the SDK.
 */
export interface AccountRecord {
  userId: string;
  address: string;
  signerAddress: string;
  salt: number;
  deployed: boolean;
  deploymentTxHash: string | null;
  validatorAddress: string;
  entryPointVersion: string;
  factoryAddress: string;
  createdAt: string;
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
