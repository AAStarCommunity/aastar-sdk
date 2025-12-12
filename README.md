# AAStar SDK (v0.12)

The all-in-one SDK for the Mycelium Network.

## Features
*   **`@aastar/core`**: Base configurations and wrappers for `viem`.
*   **`@aastar/superpaymaster`**: Middleware for SuperPaymaster V3 (Asset-based Gas Sponsorship).

## Installation

```bash
pnpm install aastar
```

## Quick Start

### 1. Initialize Client
```typescript
import { createAAStarPublicClient, sepolia } from '@aastar/core';

const client = createAAStarPublicClient({
    chain: sepolia,
    rpcUrl: process.env.SEPOLIA_RPC_URL
});
```

### 2. SuperPaymaster Configuration
```typescript
import { getPaymasterMiddleware, checkEligibility } from '@aastar/superpaymaster';

const middleware = getPaymasterMiddleware({
    paymasterAddress: "0x...",
    operatorAddress: "0x...", // Your Community Node
    verificationGasLimit: 160000n,
    postOpGasLimit: 10000n
});

// Use in your Smart Account Config
const smartAccount = await createSmartAccountClient({
    ...
    paymasterMiddleware: middleware
});
```

## Development & Testing

### Setup
1. Copy `.env.example` to `.env` and fill in keys.
2. `pnpm install`
3. `pnpm build`

### Running Experiments (PhD Data Collection)
The script `scripts/run_experiment_data.ts` executes the 3-group comparison defined in the thesis.

```bash
npx tsx scripts/run_experiment_data.ts
```

### Prerequisites
For Group C (SuperPaymaster) tests:
1. Account must own a **MySBT** (Soulbound Token).
2. Account must have sufficient **xPNTs** (or GToken) balance.
*Use `scripts/setup_account.ts` (coming soon) or `mint-sbt-for-aa.js` reference logic to prepare accounts.*
