# Installation

## Package Manager

AAStar SDK is available as npm packages. We recommend using **pnpm** for the best experience.

### Using pnpm (Recommended)

```bash
pnpm add @aastar/sdk
```

### Using npm

```bash
npm install @aastar/sdk
```

### Using yarn

```bash
yarn add @aastar/sdk
```

## Individual Packages

You can also install individual packages based on your needs:

```bash
# Core utilities and client creation
pnpm add @aastar/core

# Account Abstraction utilities
pnpm add @aastar/account

# Paymaster utilities
pnpm add @aastar/paymaster

# Token utilities (GToken, xPNTs, SBT)
pnpm add @aastar/tokens

# Identity and reputation
pnpm add @aastar/identity

# React hooks for DApps
pnpm add @aastar/dapp
```

## Peer Dependencies

The SDK requires the following peer dependencies:

```bash
pnpm add viem@^2.41.0
```

## TypeScript Configuration

For the best TypeScript experience, add these settings to your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  }
}
```

## Environment Setup

Create a `.env` file for your configuration:

```bash
# Network RPC URL
RPC_URL=https://rpc.sepolia.org

# Your private key (NEVER commit this!)
PRIVATE_KEY=0x...

# Contract addresses (optional, SDK provides defaults)
REGISTRY_ADDRESS=0x...
PAYMASTER_ADDRESS=0x...
```

## Verify Installation

Test your installation:

```typescript
import { getNetwork, CONTRACTS } from '@aastar/core';

const network = getNetwork('sepolia');
console.log('Network:', network.name);
console.log('Chain ID:', network.chainId);
console.log('Registry:', CONTRACTS.sepolia.registry);
```

## Next Steps

- [Quick Start Guide](/guide/quick-start)
- [Core Concepts](/guide/concepts/account-abstraction)
- [API Reference](/api/)
