/**
 * AirAccount Server SDK - Usage Examples
 *
 * This example demonstrates how to integrate the AirAccount Server SDK
 * into your own Node.js backend (Express, Fastify, Koa, NestJS, etc.)
 * without any framework coupling.
 *
 * Install: npm install @yaaa/sdk
 * Import:  import { ... } from '@yaaa/sdk/server';
 */

import {
  YAAAServerClient,
  MemoryStorage,
  LocalWalletSigner,
  ConsoleLogger,
  EntryPointVersion,
  KmsManager,
} from "@yaaa/sdk/server";

import type {
  ServerConfig,
  IStorageAdapter,
  ISignerAdapter,
  AccountRecord,
  TransferRecord,
  PaymasterRecord,
  BlsConfigRecord,
  TokenInfo,
  PasskeyAssertionContext,
  LegacyPasskeyAssertion,
} from "@yaaa/sdk/server";

import { ethers } from "ethers";

// ============================================
// 1. Basic Setup — Quick Start
// ============================================

async function quickStart() {
  // Minimum viable setup: MemoryStorage + LocalWalletSigner
  // Good for development, testing, and prototyping.
  const client = new YAAAServerClient({
    rpcUrl: "https://sepolia.infura.io/v3/YOUR_KEY",
    bundlerRpcUrl: "https://api.pimlico.io/v2/11155111/rpc?apikey=YOUR_KEY",
    chainId: 11155111,
    entryPoints: {
      v06: {
        entryPointAddress: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",
        factoryAddress: "0xYOUR_FACTORY_ADDRESS",
        validatorAddress: "0xYOUR_VALIDATOR_ADDRESS",
      },
    },
    storage: new MemoryStorage(),
    signer: new LocalWalletSigner("0xYOUR_PRIVATE_KEY"),
  });

  // Create a smart account for a user
  const account = await client.accounts.createAccount("user-123");
  console.log("Smart account address:", account.address);

  // Execute a transfer
  const result = await client.transfers.executeTransfer("user-123", {
    to: "0xRecipientAddress",
    amount: "0.01",
  });
  console.log("Transfer ID:", result.transferId);
  console.log("UserOp Hash:", result.userOpHash);

  // Poll transfer status
  const status = await client.transfers.getTransferStatus(
    "user-123",
    result.transferId
  );
  console.log("Status:", status.statusDescription);
}

// ============================================
// 2. M4 Account Factory Setup
// ============================================

/**
 * M4 accounts use a different factory with built-in guardian support
 * and daily spending limits. No separate validator contract needed.
 */
async function m4Setup() {
  const client = new YAAAServerClient({
    rpcUrl: "https://sepolia.infura.io/v3/YOUR_KEY",
    bundlerRpcUrl: "https://api.pimlico.io/v2/11155111/rpc?apikey=YOUR_KEY",
    chainId: 11155111,
    entryPoints: {
      // M4 factory — uses createAccountWithDefaults/getAddressWithDefaults
      v07: {
        entryPointAddress: "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
        factoryAddress: "0x914db0a849f55e68a726c72fd02b7114b1176d88",
        // No validatorAddress → M4 ECDSA path (raw 65-byte signature)
      },
    },
    defaultVersion: "0.7",
    storage: new MemoryStorage(),
    signer: new LocalWalletSigner("0xPRIVATE_KEY"),
  });

  // M4 factory predicts address with: owner, salt, guardian1, guardian2, dailyLimit
  const account = await client.accounts.createAccount("user-m4");
  console.log("M4 account:", account.address);

  return client;
}

// ============================================
// 3. KMS Signer Integration
// ============================================

/**
 * KMS (kms1.aastar.io) provides hardware-backed key management
 * with WebAuthn passkey authentication for every signing operation.
 *
 * The KmsSigner requires a passkey assertion for each sign call,
 * passed via the assertionProvider callback.
 */
async function kmsSetup() {
  const kmsManager = new KmsManager({
    kmsEndpoint: "https://kms1.aastar.io",
    kmsApiKey: process.env.KMS_API_KEY,
    kmsEnabled: true,
  });

  // Create a KMS-backed signer
  // assertionProvider returns a LegacyPasskeyAssertion for each signing operation
  const kmsSigner = kmsManager.createKmsSigner(
    "key-id-from-kms", // KMS key ID
    "0xDerivedAddress", // Address from KMS
    async () => {
      // In production, this comes from the request context
      // (the user's WebAuthn assertion passed through the API)
      return {
        AuthenticatorData: "0x...",
        ClientDataHash: "0x...",
        Signature: "0x...",
      } satisfies LegacyPasskeyAssertion;
    }
  );

  // KmsSigner is an ethers.AbstractSigner — use it anywhere ethers expects a Signer
  const address = await kmsSigner.getAddress();
  console.log("KMS signer address:", address);

  // KMS key lifecycle
  const keyStatus = await kmsManager.getKeyStatus("key-id");
  console.log("Key status:", keyStatus.Status); // "creating" | "deriving" | "ready" | "error"

  // Wait for key to be ready after creation
  // const readyKey = await kmsManager.pollUntilReady("key-id", 30000);
}

// ============================================
// 4. Custom ISignerAdapter with KMS
// ============================================

/**
 * Implement ISignerAdapter for KMS-backed per-user signing.
 * The getSigner() method accepts an optional PasskeyAssertionContext,
 * which carries the user's WebAuthn assertion through the signing chain.
 */
class KmsSignerAdapter implements ISignerAdapter {
  private kmsManager: KmsManager;

  constructor(
    private userKeyMapping: Map<string, { keyId: string; address: string }>,
    kmsEndpoint: string,
    kmsApiKey: string
  ) {
    this.kmsManager = new KmsManager({
      kmsEndpoint,
      kmsApiKey,
      kmsEnabled: true,
    });
  }

  async getAddress(userId: string): Promise<string> {
    const keyInfo = this.userKeyMapping.get(userId);
    if (!keyInfo) throw new Error(`No KMS key for user ${userId}`);
    return keyInfo.address;
  }

  async getSigner(
    userId: string,
    ctx?: PasskeyAssertionContext
  ): Promise<ethers.Signer> {
    const keyInfo = this.userKeyMapping.get(userId);
    if (!keyInfo) throw new Error(`No KMS key for user ${userId}`);

    return this.kmsManager.createKmsSigner(
      keyInfo.keyId,
      keyInfo.address,
      async () => {
        if (!ctx?.passkeyAssertion) {
          throw new Error("Passkey assertion required for KMS signing");
        }
        return ctx.passkeyAssertion;
      }
    );
  }

  async ensureSigner(
    userId: string
  ): Promise<{ signer: ethers.Signer; address: string }> {
    const address = await this.getAddress(userId);
    const signer = await this.getSigner(userId);
    return { signer, address };
  }
}

// ============================================
// 5. Custom IStorageAdapter (PostgreSQL)
// ============================================

/**
 * In production you'll want a real database.
 * Implement IStorageAdapter for your stack (PostgreSQL, MongoDB, etc.)
 */
class PostgresStorage implements IStorageAdapter {
  constructor(private pool: any /* pg.Pool */) {}

  async getAccounts(): Promise<AccountRecord[]> {
    const { rows } = await this.pool.query("SELECT * FROM accounts");
    return rows;
  }

  async saveAccount(account: AccountRecord): Promise<void> {
    await this.pool.query(
      `INSERT INTO accounts (user_id, address, signer_address, salt, deployed,
       deployment_tx_hash, validator_address, entry_point_version, factory_address, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (user_id, entry_point_version) DO NOTHING`,
      [
        account.userId,
        account.address,
        account.signerAddress,
        account.salt,
        account.deployed,
        account.deploymentTxHash,
        account.validatorAddress,
        account.entryPointVersion,
        account.factoryAddress,
        account.createdAt,
      ]
    );
  }

  async findAccountByUserId(userId: string): Promise<AccountRecord | null> {
    const { rows } = await this.pool.query(
      "SELECT * FROM accounts WHERE user_id = $1 LIMIT 1",
      [userId]
    );
    return rows[0] ?? null;
  }

  async updateAccount(
    userId: string,
    updates: Partial<AccountRecord>
  ): Promise<void> {
    const setClauses: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    for (const [key, value] of Object.entries(updates)) {
      setClauses.push(`${camelToSnake(key)} = $${idx++}`);
      values.push(value);
    }
    values.push(userId);
    await this.pool.query(
      `UPDATE accounts SET ${setClauses.join(", ")} WHERE user_id = $${idx}`,
      values
    );
  }

  async saveTransfer(transfer: TransferRecord): Promise<void> {
    void transfer; // ... INSERT INTO transfers
  }
  async findTransfersByUserId(userId: string): Promise<TransferRecord[]> {
    const { rows } = await this.pool.query(
      "SELECT * FROM transfers WHERE user_id = $1",
      [userId]
    );
    return rows;
  }
  async findTransferById(id: string): Promise<TransferRecord | null> {
    const { rows } = await this.pool.query(
      "SELECT * FROM transfers WHERE id = $1",
      [id]
    );
    return rows[0] ?? null;
  }
  async updateTransfer(
    id: string,
    updates: Partial<TransferRecord>
  ): Promise<void> {
    void id;
    void updates;
  }

  async getPaymasters(userId: string): Promise<PaymasterRecord[]> {
    const { rows } = await this.pool.query(
      "SELECT * FROM paymasters WHERE user_id = $1",
      [userId]
    );
    return rows;
  }
  async savePaymaster(
    userId: string,
    paymaster: PaymasterRecord
  ): Promise<void> {
    void userId;
    void paymaster;
  }
  async removePaymaster(userId: string, name: string): Promise<boolean> {
    const { rowCount } = await this.pool.query(
      "DELETE FROM paymasters WHERE user_id = $1 AND name = $2",
      [userId, name]
    );
    return rowCount > 0;
  }

  async getBlsConfig(): Promise<BlsConfigRecord | null> {
    return null;
  }
  async updateSignerNodesCache(nodes: unknown[]): Promise<void> {
    void nodes;
  }
}

function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

// ============================================
// 6. Account Management
// ============================================

async function accountManagement(client: YAAAServerClient) {
  // Create account (idempotent — returns existing if already created)
  const account = await client.accounts.createAccount("user-abc");
  console.log("Account:", account.address);
  console.log("Deployed:", account.deployed);
  console.log("EntryPoint version:", account.entryPointVersion);

  // Create account with specific version
  const v6Account = await client.accounts.createAccount("user-v6", {
    entryPointVersion: EntryPointVersion.V0_6,
  });
  console.log("v0.6 account:", v6Account.address);

  // Get existing account with balance and nonce
  const existing = await client.accounts.getAccount("user-abc");
  if (existing) {
    console.log("Found:", existing.address);
    console.log("Balance:", existing.balance, "ETH");
    console.log("Nonce:", existing.nonce);
  }

  // Get wallet (EOA/KMS) address for a user
  const walletAddress = await client.wallets.getAddress("user-abc");
  console.log("Wallet (EOA/KMS) address:", walletAddress);
}

// ============================================
// 7. Token Operations
// ============================================

async function tokenOperations(client: YAAAServerClient) {
  const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";

  // Query token info from chain
  const info: TokenInfo = await client.tokens.getTokenInfo(USDC);
  console.log(`${info.symbol} (${info.name}) — ${info.decimals} decimals`);

  // Check token balance
  const balance = await client.tokens.getTokenBalance(
    USDC,
    "0xYourSmartAccount"
  );
  console.log("USDC balance (raw):", balance);

  // Formatted balance
  const formatted = await client.tokens.getFormattedTokenBalance(
    USDC,
    "0xYourSmartAccount"
  );
  console.log(`Balance: ${formatted.formattedBalance} ${formatted.token.symbol}`);

  // Validate a token address
  const valid = await client.tokens.validateToken(USDC);
  console.log("Is valid ERC20:", valid);

  // Generate ERC20 transfer calldata
  const calldata = client.tokens.generateTransferCalldata(
    "0xRecipient",
    "100.5",
    6 // USDC decimals
  );
  console.log("Transfer calldata:", calldata);
}

// ============================================
// 8. Transfers (ETH & ERC20)
// ============================================

async function transfers(client: YAAAServerClient) {
  const userId = "user-abc";

  // --- ETH transfer ---
  const ethTransfer = await client.transfers.executeTransfer(userId, {
    to: "0xRecipientAddress",
    amount: "0.01",
  });
  console.log("ETH Transfer:", ethTransfer.transferId);

  // --- ERC20 token transfer ---
  const tokenTransfer = await client.transfers.executeTransfer(userId, {
    to: "0xRecipientAddress",
    amount: "50",
    tokenAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  });
  console.log("Token Transfer:", tokenTransfer.transferId);

  // --- Gasless transfer with paymaster ---
  const gaslessTransfer = await client.transfers.executeTransfer(userId, {
    to: "0xRecipientAddress",
    amount: "0.01",
    usePaymaster: true,
    paymasterAddress: "0xYourPaymasterAddress",
  });
  console.log("Gasless Transfer:", gaslessTransfer.transferId);

  // --- Transfer with KMS passkey assertion ---
  const kmsTransfer = await client.transfers.executeTransfer(userId, {
    to: "0xRecipientAddress",
    amount: "0.01",
    passkeyAssertion: {
      AuthenticatorData: "0x...",
      ClientDataHash: "0x...",
      Signature: "0x...",
    },
  });
  console.log("KMS Transfer:", kmsTransfer.transferId);

  // --- AirAccount tiered transfer (M4) ---
  const tieredTransfer = await client.transfers.executeTransfer(userId, {
    to: "0xRecipientAddress",
    amount: "0.01",
    useAirAccountTiering: true, // Enable tier-based signature routing
    p256Signature: "0x...", // Required for Tier 2/3
    // guardianSigner: guardianEthSigner, // Required for Tier 3 only
  });
  console.log("Tiered Transfer:", tieredTransfer.transferId);

  // --- Check transfer status ---
  const status = await client.transfers.getTransferStatus(
    userId,
    ethTransfer.transferId
  );
  console.log("Status:", status.statusDescription);
  // Possible statuses:
  //   pending   → "Preparing transaction and generating signatures"
  //   submitted → "Transaction submitted to bundler, waiting for confirmation"
  //   completed → "Transaction confirmed on chain"
  //   failed    → "Transaction failed"

  if (status.explorerUrl) {
    console.log("Explorer:", status.explorerUrl);
  }

  // --- Transfer history with pagination ---
  const history = await client.transfers.getTransferHistory(userId, 1, 10);
  console.log(
    `Page 1: ${history.transfers.length} of ${history.total} transfers`
  );

  for (const tx of history.transfers) {
    console.log(
      `  ${tx.id}: ${tx.amount} ${tx.tokenSymbol ?? "ETH"} → ${tx.to} [${tx.status}]`
    );
  }

  // --- Gas estimation ---
  const gasEstimate = await client.transfers.estimateGas(userId, {
    to: "0xRecipientAddress",
    amount: "0.01",
  });
  console.log("Gas estimate:", gasEstimate);
}

// ============================================
// 9. Paymaster Management (SuperPaymaster)
// ============================================

async function paymasterManagement(client: YAAAServerClient) {
  const userId = "user-abc";

  // Add a custom paymaster
  await client.paymaster.addCustomPaymaster(
    userId,
    "my-paymaster",
    "0xPaymasterContractAddress",
    "custom"
  );

  // Add a Pimlico paymaster (with API key for sponsored transactions)
  await client.paymaster.addCustomPaymaster(
    userId,
    "pimlico-pm",
    "0xPimlicoPaymasterAddress",
    "pimlico",
    "pm_api_key_xxx"
  );

  // List available paymasters
  const paymasters = await client.paymaster.getAvailablePaymasters(userId);
  for (const pm of paymasters) {
    console.log(`  ${pm.name}: ${pm.address} (configured: ${pm.configured})`);
  }

  // Remove a paymaster
  const removed = await client.paymaster.removeCustomPaymaster(
    userId,
    "my-paymaster"
  );
  console.log("Removed:", removed);

  // Note: SuperPaymaster (v0.7/v0.8) is auto-detected on M4 deployments
  // and returns packed paymaster data format automatically
}

// ============================================
// 10. BLS Signatures & Tiered Signing
// ============================================

async function blsSignatures(client: YAAAServerClient) {
  // BLS signatures require seed nodes for the gossip network.
  // Configure them in the ServerConfig.

  // Generate BLS signature for a UserOp hash
  const userOpHash =
    "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
  const blsData = await client.bls.generateBLSSignature(
    "user-abc",
    userOpHash
  );
  console.log("BLS signature data:", blsData);

  // Pack signature for on-chain verification
  const packed = await client.bls.packSignature(blsData);
  console.log("Packed signature:", packed);

  // Generate tiered signature (AirAccount M4)
  // Tier 1: raw ECDSA (algId 0x02)
  // Tier 2: P256 + BLS aggregate (algId 0x04)
  // Tier 3: P256 + BLS + Guardian ECDSA (algId 0x05)
  const tieredSig = await client.bls.generateTieredSignature({
    tier: 2,
    userId: "user-abc",
    userOpHash,
    p256Signature: "0x...", // 64-byte P256 signature
  });
  console.log("Tiered (T2) signature:", tieredSig);
}

// ============================================
// 11. Guard Checker (On-Chain Pre-Validation)
// ============================================

/**
 * GuardChecker reads tier limits and guard status from the AirAccount contract
 * to determine which signature tier is required for a transaction.
 */
async function guardCheckerExample(client: YAAAServerClient) {
  const accountAddress = "0xYourSmartAccount";

  // Fetch tier configuration from contract
  // const tierConfig = await guardChecker.fetchTierConfig(accountAddress);
  // console.log("Tier 1 limit:", tierConfig.tier1Limit);
  // console.log("Tier 2 limit:", tierConfig.tier2Limit);

  // Fetch guard status
  // const guardStatus = await guardChecker.fetchGuardStatus(accountAddress);
  // console.log("Has guard:", guardStatus.hasGuard);
  // console.log("Daily remaining:", guardStatus.dailyRemaining);

  // Pre-check a transaction (determines required tier + algId)
  // const preCheck = await guardChecker.preCheck(accountAddress, ethers.parseEther("0.5"));
  // console.log("OK:", preCheck.ok);
  // console.log("Required tier:", preCheck.tier);
  // console.log("AlgId:", preCheck.algId);

  console.log(
    "GuardChecker is used internally by TransferManager for AirAccount tiering"
  );
  void accountAddress;
}

// ============================================
// 12. Multi-Version EntryPoint Support
// ============================================

async function multiVersion() {
  const client = new YAAAServerClient({
    rpcUrl: "https://sepolia.infura.io/v3/YOUR_KEY",
    bundlerRpcUrl: "https://api.pimlico.io/v2/11155111/rpc?apikey=YOUR_KEY",
    chainId: 11155111,
    entryPoints: {
      v06: {
        entryPointAddress: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",
        factoryAddress: "0xFACTORY_V6",
        validatorAddress: "0xVALIDATOR_V6",
      },
      v07: {
        entryPointAddress: "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
        factoryAddress: "0xFACTORY_V7",
        validatorAddress: "0xVALIDATOR_V7",
      },
    },
    defaultVersion: "0.7",
    storage: new MemoryStorage(),
    signer: new LocalWalletSigner("0xPRIVATE_KEY"),
  });

  // Create account with specific version
  const v6Account = await client.accounts.createAccount("user-1", {
    entryPointVersion: EntryPointVersion.V0_6,
  });
  console.log("v0.6 account:", v6Account.address);

  // Default version (v0.7 in this config)
  const defaultAccount = await client.accounts.createAccount("user-2");
  console.log("Default (v0.7) account:", defaultAccount.address);

  // Check configured default
  console.log("Default version:", client.ethereum.getDefaultVersion());
}

// ============================================
// 13. Express.js Integration Example
// ============================================

/*
import express from 'express';
import { YAAAServerClient, MemoryStorage, LocalWalletSigner } from '@yaaa/sdk/server';

const app = express();
app.use(express.json());

const client = new YAAAServerClient({
  rpcUrl: process.env.RPC_URL!,
  bundlerRpcUrl: process.env.BUNDLER_RPC_URL!,
  chainId: 11155111,
  entryPoints: {
    v07: {
      entryPointAddress: '0x0000000071727De22E5E9d8BAf0edAc6f37da032',
      factoryAddress: process.env.FACTORY_ADDRESS!,
      // No validatorAddress → M4 ECDSA path
    },
  },
  defaultVersion: '0.7',
  kmsEndpoint: process.env.KMS_ENDPOINT,
  kmsApiKey: process.env.KMS_API_KEY,
  kmsEnabled: true,
  storage: new MemoryStorage(), // Replace with your DB adapter
  signer: new LocalWalletSigner(process.env.PRIVATE_KEY!),
});

// Create account
app.post('/api/accounts', async (req, res) => {
  try {
    const { userId } = req.body;
    const account = await client.accounts.createAccount(userId);
    res.json(account);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Execute transfer (with passkey assertion from frontend)
app.post('/api/transfers', async (req, res) => {
  try {
    const { userId, to, amount, tokenAddress, usePaymaster, passkeyAssertion } = req.body;
    const result = await client.transfers.executeTransfer(userId, {
      to,
      amount,
      tokenAddress,
      usePaymaster,
      passkeyAssertion,  // LegacyPasskeyAssertion from KMS
    });
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Get transfer status
app.get('/api/transfers/:userId/:transferId', async (req, res) => {
  try {
    const { userId, transferId } = req.params;
    const status = await client.transfers.getTransferStatus(userId, transferId);
    res.json(status);
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

// Transfer history
app.get('/api/transfers/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const history = await client.transfers.getTransferHistory(userId, page, limit);
    res.json(history);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.listen(3000, () => console.log('Server running on :3000'));
*/

// ============================================
// Export for reference
// ============================================

export {
  quickStart,
  m4Setup,
  kmsSetup,
  accountManagement,
  tokenOperations,
  transfers,
  paymasterManagement,
  blsSignatures,
  guardCheckerExample,
  multiVersion,
};
