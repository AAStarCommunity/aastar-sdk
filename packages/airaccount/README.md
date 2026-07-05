# @aastar/airaccount — AirAccount SDK

> ERC-4337 Account Abstraction SDK with KMS WebAuthn, BLS Aggregate Signatures, and Tiered Signature Routing

A framework-agnostic, production-ready SDK for building Web3 applications with
hardware-backed passkey authentication and ERC-4337 smart accounts.

## Features

- **KMS WebAuthn** — Hardware-backed passkey authentication via `kms1.aastar.io`
- **BLS Aggregate Signatures** — Multi-node BLS signing with gossip discovery
- **ERC-4337 Account Abstraction** — Smart contract wallets (v0.6 / v0.7 / v0.8)
- **M4 Account Factory** — Built-in guardian support and daily spending limits
- **Tiered Signature Routing** — Tier 1 (ECDSA) / Tier 2 (P256+BLS) / Tier 3 (P256+BLS+Guardian)
- **SuperPaymaster** — Auto-detected on M4 deployments for gasless transactions
- **Pluggable Adapters** — Bring your own storage, signer, and logger
- **TypeScript First** — Full type safety and IntelliSense support

## Installation

```bash
npm install @aastar/airaccount
```

## Quick Start — Browser Client

```typescript
import { AirAccountClient } from "@aastar/airaccount";

// `apiURL` is the passkey RP backend. AAStar's official hosted RP will be
// `https://auth.aastar.io` (served by aNode); you can also point at your own
// backend implementing the standardized passkey contract.
const air = new AirAccountClient({
  apiURL: "https://auth.aastar.io",
  tokenProvider: () => localStorage.getItem("token"),
  bls: {
    seedNodes: ["https://signer1.aastar.io"],
  },
});

// Register with KMS-backed Passkey
const { user, token } = await air.passkey.register({
  email: "user@example.com",
  username: "JohnDoe",
});

// Login with Passkey
const result = await air.passkey.authenticate();

// Verify a transaction with Passkey (biometric prompt)
const verification = await air.passkey.verifyTransaction({
  to: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
  value: "0.01",
});
```

## Quick Start — Server Client

```typescript
import {
  AirAccountServerClient,
  MemoryStorage,
  LocalWalletSigner,
} from "@aastar/airaccount/server";

const client = new AirAccountServerClient({
  rpcUrl: "https://sepolia.infura.io/v3/YOUR_KEY",
  bundlerRpcUrl: "https://api.pimlico.io/v2/11155111/rpc?apikey=YOUR_KEY",
  chainId: 11155111,
  entryPoints: {
    v07: {
      entryPointAddress: "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
      factoryAddress: "0x914db0a849f55e68a726c72fd02b7114b1176d88",
    },
  },
  defaultVersion: "0.7",
  storage: new MemoryStorage(),
  signer: new LocalWalletSigner("0xYOUR_PRIVATE_KEY"),
});

// Create a smart account
const account = await client.accounts.createAccount("user-123");

// Execute a transfer
const result = await client.transfers.executeTransfer("user-123", {
  to: "0xRecipient",
  amount: "0.01",
});
```

## API Reference

### Browser SDK (`@aastar/airaccount`)

#### AirAccountClient

> `YAAAClient` remains as a deprecated alias of `AirAccountClient` for backward compatibility.

```typescript
const air = new AirAccountClient(config: AirAccountConfig);
```

| Property      | Type              | Description                          |
| ------------- | ----------------- | ------------------------------------ |
| `air.passkey` | `PasskeyManager`  | WebAuthn passkey authentication      |
| `air.bls`     | `BLSManager`      | BLS node discovery & message points  |

#### AirAccountConfig

> `YAAAConfig` remains as a deprecated alias of `AirAccountConfig`.

```typescript
interface AirAccountConfig {
  /**
   * Backend RP (relying party) API URL — required, no default.
   * AAStar's official hosted RP will be `https://auth.aastar.io` (served by aNode).
   * You can also point at your own backend implementing the standardized passkey contract.
   */
  apiURL: string;
  tokenProvider?: () => string | null;
  /** Optional overrides for the passkey backend route paths (defaults to `/auth/passkey/*`). */
  passkeyRoutes?: Partial<PasskeyRoutes>;
  bls: {
    seedNodes: string[];
    discoveryTimeout?: number;
  };
}
```

### Server SDK (`@aastar/airaccount/server`)

#### AirAccountServerClient

> `YAAAServerClient` remains as a deprecated alias of `AirAccountServerClient`.

```typescript
const client = new AirAccountServerClient(config: ServerConfig);
```

| Property            | Type                  | Description                              |
| ------------------- | --------------------- | ---------------------------------------- |
| `client.accounts`   | `AccountManager`      | Smart account creation & queries         |
| `client.transfers`  | `TransferManager`     | ETH/ERC20 transfers, gas estimation      |
| `client.bls`        | `BLSSignatureService` | BLS signing & tiered signatures          |
| `client.paymaster`  | `PaymasterManager`    | Paymaster config, SuperPaymaster         |
| `client.tokens`     | `TokenService`        | ERC20 info, balances, calldata           |
| `client.wallets`    | `WalletManager`       | EOA/KMS wallet management                |
| `client.ethereum`   | `EthereumProvider`    | RPC, bundler, contract interactions      |

#### ServerConfig

```typescript
interface ServerConfig {
  rpcUrl: string;
  bundlerRpcUrl: string;
  chainId: number;
  entryPoints: {
    v06?: EntryPointConfig;
    v07?: EntryPointConfig;
    v08?: EntryPointConfig;
  };
  defaultVersion?: "0.6" | "0.7" | "0.8";
  blsSeedNodes?: string[];
  blsDiscoveryTimeout?: number;
  kmsEndpoint?: string;
  kmsEnabled?: boolean;
  kmsApiKey?: string;
  storage: IStorageAdapter;
  signer: ISignerAdapter;
  logger?: ILogger;
}
```

### Pluggable Interfaces

#### IStorageAdapter

```typescript
interface IStorageAdapter {
  // Accounts
  getAccounts(): Promise<AccountRecord[]>;
  saveAccount(account: AccountRecord): Promise<void>;
  findAccountByUserId(userId: string): Promise<AccountRecord | null>;
  updateAccount(userId: string, updates: Partial<AccountRecord>): Promise<void>;
  // Transfers
  saveTransfer(transfer: TransferRecord): Promise<void>;
  findTransferById(id: string): Promise<TransferRecord | null>;
  findTransfersByUserId(userId: string): Promise<TransferRecord[]>;
  updateTransfer(id: string, updates: Partial<TransferRecord>): Promise<void>;
  // Paymasters
  getPaymasters(userId: string): Promise<PaymasterRecord[]>;
  savePaymaster(userId: string, paymaster: PaymasterRecord): Promise<void>;
  removePaymaster(userId: string, name: string): Promise<boolean>;
  // BLS
  getBlsConfig(): Promise<BlsConfigRecord | null>;
  updateSignerNodesCache(nodes: unknown[]): Promise<void>;
}
```

#### ISignerAdapter

```typescript
interface ISignerAdapter {
  getAddress(userId: string): Promise<string>;
  getSigner(userId: string, ctx?: PasskeyAssertionContext): Promise<ethers.Signer>;
  ensureSigner(userId: string): Promise<{ signer: ethers.Signer; address: string }>;
}
```

#### ILogger

```typescript
interface ILogger {
  debug(message: string, ...args: unknown[]): void;
  log(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}
```

### KMS Integration

```typescript
import { KmsManager } from "@aastar/airaccount/server";

const kms = new KmsManager({
  kmsEndpoint: "https://kms1.aastar.io",
  kmsApiKey: "your-api-key",
  kmsEnabled: true,
});

// Create KMS-backed ethers.Signer
const signer = kms.createKmsSigner(keyId, address, assertionProvider);

// Key management
await kms.createKey(description, passkeyPublicKey);
await kms.getKeyStatus(keyId);
await kms.pollUntilReady(keyId);

// Signing (requires passkey assertion)
await kms.signHash(hash, assertion, target);

// WebAuthn ceremonies
await kms.beginRegistration(params);
await kms.completeRegistration(params);
await kms.beginAuthentication(params);
```

### Transfer Params

```typescript
interface ExecuteTransferParams {
  to: string;
  amount: string;
  data?: string;
  tokenAddress?: string;           // ERC20 token address
  usePaymaster?: boolean;
  paymasterAddress?: string;
  paymasterData?: string;
  passkeyAssertion?: LegacyPasskeyAssertion;  // KMS signing
  p256Signature?: string;          // Tier 2/3
  guardianSigner?: ethers.Signer;  // Tier 3
  useAirAccountTiering?: boolean;  // Enable tiered routing
}
```

### Signature Tiers (M4 AirAccount)

| Tier | AlgId  | Components                       | Use Case            |
| ---- | ------ | -------------------------------- | ------------------- |
| 1    | `0x02` | Single ECDSA (`[0x02][r][s][v]`, 66 bytes) | Small transactions  |
| 2    | `0x04` | P256 + BLS aggregate             | Medium transactions |
| 3    | `0x05` | P256 + BLS + Guardian ECDSA      | Large transactions  |
| BLS  | `0x01` | Legacy BLS (prepended to pack)   | Default non-tiered  |

### ERC-4337 Utilities

```typescript
import { ERC4337Utils } from "@aastar/airaccount";

ERC4337Utils.packAccountGasLimits(verGasLimit, callGasLimit);
ERC4337Utils.unpackAccountGasLimits(packed);
ERC4337Utils.packGasFees(maxPriorityFee, maxFeePerGas);
ERC4337Utils.unpackGasFees(packed);
ERC4337Utils.packUserOperation(userOp);
ERC4337Utils.unpackUserOperation(packedOp);
```

### Built-in Adapters

| Adapter              | Description                                    |
| -------------------- | ---------------------------------------------- |
| `MemoryStorage`      | In-memory storage (dev/testing)                |
| `LocalWalletSigner`  | Single private key signer (dev/testing)        |
| `ConsoleLogger`      | Console output with prefix                     |
| `SilentLogger`       | No-op logger                                   |

## Examples

See the [examples](./examples) directory for complete usage:

- [Basic Usage](./examples/basic-usage.ts) — Browser: registration, login, transactions
- [Server Usage](./examples/server-usage.ts) — Backend: accounts, transfers, KMS, tiering, Express.js
- [Examples README](./examples/README.md) — Full guide with architecture and troubleshooting

## Architecture

```
┌─────────────┐
│   Browser    │  @aastar/airaccount (AirAccountClient)
│   (SDK)      │  - PasskeyManager (WebAuthn)
└──────┬───────┘  - BLSManager
       │ HTTPS
       ▼
┌─────────────┐
│  Your API   │  @aastar/airaccount/server (AirAccountServerClient)
│  (Backend)  │  - AccountManager, TransferManager
└──────┬───────┘  - BLSSignatureService, GuardChecker
       │          - KmsManager, PaymasterManager
       ├─────► Bundler (Pimlico/Alchemy)
       ├─────► Paymaster / SuperPaymaster
       ├─────► BLS Validators (gossip network)
       └─────► KMS (kms1.aastar.io)
```

## Browser Support

- Chrome/Edge 67+
- Safari 13+
- Firefox 60+

**Note**: WebAuthn/Passkey requires HTTPS (localhost is OK for development).

## Development

```bash
npm install    # Install dependencies
npm run build  # Build with tsup
npm test       # Run tests
npm run dev    # Watch mode
npm run lint   # ESLint
npm run format # Prettier
```

## License

MIT
