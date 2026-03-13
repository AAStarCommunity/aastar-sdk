# AirAccount SDK Examples

This directory contains example code demonstrating how to use the AirAccount SDK
(`@yaaa/sdk`) in your applications.

## Quick Start

### Installation

```bash
npm install @yaaa/sdk
```

### Browser Client Setup

```typescript
import { YAAAClient } from "@yaaa/sdk";

const yaaa = new YAAAClient({
  apiURL: "https://api.your-backend.com/v1",
  tokenProvider: () => localStorage.getItem("token"),
  bls: {
    seedNodes: ["https://signer1.aastar.io"],
  },
});
```

### Server Client Setup

```typescript
import {
  YAAAServerClient,
  MemoryStorage,
  LocalWalletSigner,
} from "@yaaa/sdk/server";

const client = new YAAAServerClient({
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
```

## Examples

### Browser / Frontend (`basic-usage.ts`)

Demonstrates the browser-side SDK:

- **KMS Passkey Registration** — WebAuthn registration backed by hardware KMS
- **KMS Passkey Login** — Biometric login with KMS key verification
- **Transaction with Passkey Assertion** — Sign & send with
  `LegacyPasskeyAssertion` format
- **BLS Node Discovery** — Find available BLS validator nodes
- **React/Next.js Integration** — Component example with state management

### Server / Backend (`server-usage.ts`)

Demonstrates the server-side SDK:

- **Quick Start** — Minimal setup with MemoryStorage + LocalWalletSigner
- **M4 Account Factory** — Using `createAccountWithDefaults` with guardian
  support
- **KMS Signer Integration** — Hardware-backed signing with `KmsManager` and
  `KmsSigner`
- **Custom ISignerAdapter** — Per-user KMS signing with `PasskeyAssertionContext`
- **Custom IStorageAdapter** — PostgreSQL adapter example
- **Account Management** — Create, query, multi-version accounts
- **Token Operations** — ERC20 info, balance, transfer calldata
- **Transfers** — ETH, ERC20, gasless (paymaster), KMS-signed, tiered (M4)
- **Paymaster Management** — Custom, Pimlico, SuperPaymaster (auto-detected)
- **BLS & Tiered Signatures** — Tier 1/2/3 signature routing for AirAccount
- **Guard Checker** — On-chain tier limits and daily allowance pre-validation
- **Multi-Version EntryPoint** — v0.6, v0.7, v0.8 side by side
- **Express.js Integration** — Full REST API example

## Architecture

```
┌─────────────┐
│   Browser    │  @yaaa/sdk (YAAAClient)
│   (SDK)      │  - PasskeyManager (WebAuthn)
└──────┬───────┘  - BLSManager
       │ HTTPS
       ▼
┌─────────────┐
│  Your API   │  @yaaa/sdk/server (YAAAServerClient)
│  (Backend)  │  - AccountManager
└──────┬───────┘  - TransferManager
       │          - BLSSignatureService
       ├─────► Bundler (Pimlico/Alchemy)
       ├─────► Paymaster / SuperPaymaster
       ├─────► BLS Validators (gossip network)
       └─────► KMS (kms1.aastar.io) — Hardware key mgmt
```

## Key Concepts

### KMS WebAuthn Flow

1. **Registration**: Backend → KMS `BeginRegistration` → Browser WebAuthn prompt
   → KMS `CompleteRegistration` → KMS creates signing key
2. **Login**: Backend → KMS `BeginAuthentication` → Browser WebAuthn prompt →
   Backend verifies credential
3. **Signing**: Every signing operation requires a `LegacyPasskeyAssertion`
   (AuthenticatorData + ClientDataHash + Signature in hex format)

### Signature Routing (M4 AirAccount)

| Tier | AlgId  | Signature Components            | Use Case              |
| ---- | ------ | ------------------------------- | --------------------- |
| 1    | `0x02` | Raw ECDSA (65 bytes)            | Small transactions    |
| 2    | `0x04` | P256 + BLS aggregate            | Medium transactions   |
| 3    | `0x05` | P256 + BLS + Guardian ECDSA     | Large transactions    |
| BLS  | `0x01` | Legacy BLS (prepended to pack)  | Default (non-tiered)  |

### Pluggable Adapters

The server SDK is framework-agnostic. You provide:

- **`IStorageAdapter`** — Your database (Postgres, Mongo, in-memory, etc.)
- **`ISignerAdapter`** — Your key management (KMS, HSM, local wallet, etc.)
- **`ILogger`** — Your logging (console, Winston, Pino, etc.)

## Running Examples

```bash
# Install dependencies
cd sdk
npm install

# Run the basic example (requires backend running)
npx ts-node examples/basic-usage.ts

# Run the server example
npx ts-node examples/server-usage.ts
```

## Integration Checklist

- [ ] Backend API running with `@yaaa/sdk/server`
- [ ] KMS endpoint configured (`kms1.aastar.io`)
- [ ] Bundler RPC endpoint configured (Pimlico/Alchemy)
- [ ] (Optional) BLS validator nodes configured
- [ ] (Optional) Paymaster configured for gasless transactions
- [ ] HTTPS enabled in production (required for WebAuthn/Passkey)
- [ ] CORS configured to allow your frontend domain

## Troubleshooting

### "Passkey not supported"

- Ensure you're using HTTPS (localhost is OK for development)
- Check browser compatibility (Chrome 67+, Safari 13+, Edge 18+)

### "KMS signing failed"

- Verify `KMS_API_KEY` is set correctly
- Check KMS key status (must be "ready")
- Ensure the passkey assertion is in Legacy hex format

### "Network request failed"

- Verify `apiURL` / `rpcUrl` is correct
- Check CORS settings on your backend
- Ensure backend is running

### "BLS nodes unavailable"

- Check `blsSeedNodes` configuration
- Verify BLS validator nodes are running and accessible
