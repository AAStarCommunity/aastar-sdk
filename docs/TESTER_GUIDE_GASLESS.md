# Paymaster V4 Gasless Test Guide

> For external testers to run a gasless UserOperation on Sepolia.

---

## Pre-configured Test Accounts

| Persona | AA Account | Paymaster | Token (Symbol) | Balance |
|---------|------------|-----------|----------------|---------|
| **ANNI** | `0xBC7626E94a215F6614d1B6aFA740787A2E50aaA4` | `0x82862...` | `0x424DA...` (dPNTs) | 100+ |
| **BOB** | `0x975961302a83090B1eb94676E1430B5baCa43F9E` | `0x317b5...` | `0x6007D...` (bPNTs) | 500+ |

---

## SDK Readiness & Preparation (NEW)

The SDK now provides a "One-Click" readiness check to avoid common Bundler rejections.

### 1. Check Readiness (Diagnostic)
Check if the Paymaster is staked, price is set, and user has deposit.

```typescript
const report = await PaymasterV4Client.checkGaslessReadiness(
    publicClient,
    entryPoint,
    paymasterAddress,
    userAA,
    tokenAddress
);

if (!report.isReady) {
    console.error("Issues found:", report.issues);
}
```

### 2. Auto-Prepare (Operator Only)
Automatically fix missing stake, deposit, or prices.

```typescript
const steps = await PaymasterV4Client.prepareGaslessEnvironment(
    operatorWallet,
    publicClient,
    entryPoint,
    paymasterAddress,
    tokenAddress,
    {
        tokenPriceUSD: 100000000n, // $1.00
        minStake: parseEther('0.1'),
        minDeposit: parseEther('0.3')
    }
);
console.log("Steps taken:", steps);
```

---

## Price Management APIs (For Operators)

The SDK provides these APIs in `PaymasterV4Client`:

```typescript
import { PaymasterV4Client } from '@aastar/paymaster';

// Write APIs (owner/operator only)
await PaymasterV4Client.updatePrice(walletClient, paymasterAddress);
await PaymasterV4Client.setTokenPrice(walletClient, paymasterAddress, tokenAddress, priceUSD);

// Read APIs (anyone)
const { price, updatedAt } = await PaymasterV4Client.getCachedPrice(publicClient, paymasterAddress);
const tokenPrice = await PaymasterV4Client.getTokenPrice(publicClient, paymasterAddress, tokenAddress);
```

---

## Zero-Friction Workflow (Simplified)

For a streamlined experience, we provide ready-to-use scripts for both **Admin** (Environment Setup) and **Developer** (Transaction Submission).

### 1. Admin / DevOps: One-Click Preparation
Ensure the Paymaster environment is fully ready (Staked, Funded, Priced).

```bash
# Checks 7+ readiness criteria and fixes them automatically
npx tsx examples/prepare-gasless.ts
```

**What it does:**
- Checks EntryPoint Stake & Deposit
- verifying Oracle ETH/USD price
- Checks Token Support & Price
- Auto-seeds user deposit if low

### 2. App Developer: One-Liner Submission
Submit a gasless transaction without worrying about Gas limits, fees, or Paymaster data encoding.

```typescript
// examples/simple-gasless-demo.ts
import { PaymasterV4Client } from '@aastar/paymaster';

// ... (Client setup) ...

// ✨ The Magic Line
const txHash = await PaymasterV4Client.submitGaslessUserOperation(
    publicClient,
    walletClient,      // Wrapper around User Private Key
    aaAccountAddress,  // Sender Address
    entryPointAddress,
    paymasterAddress,
    tokenAddress,
    bundlerUrl,
    callData
);

console.log("Transaction Hash:", txHash);
```

**Key Features:**
- **Auto-Gas Estimation**: Automatically simulates the UserOp with the Bundler.
- **Efficiency Guard**: Applies a **1.2x safety buffer** to estimated limits to satisfy Bundler efficiency rules (>0.4).
- **Auto-Signing**: Handles the v0.7 UserOp hashing and signing internally.

---

## Contact


If you encounter issues, reach out via the project's issue tracker or community channels.
