# Paymaster V4 Gasless Test Guide

> For external testers to run a gasless UserOperation on Sepolia.

---

## Pre-configured Test Account

| Item | Value |
|------|-------|
| **AA Account** | `0x975961302a83090B1eb94676E1430B5baCa43F9E` |
| **Paymaster** | `0x317b58A4BeD90127B80Eb2516e9fC989BC2C7612` |
| **bPNTs Token** | `0x6007D382c16eB0456c639559A2A58defDb1091d8` |
| **Deposited Balance** | 500 bPNTs |

---

## Quick Start (No Installation)

If you have access to a pre-configured environment, run:

```bash
# From aastar-sdk directory
source .env.sepolia && npx tsx tests/l4-test-pmv4-submit.ts
```

---

## Full Setup (First Time)

### 1. Clone the SDK Repository

```bash
git clone https://github.com/AAStarCommunity/aastar-sdk.git
cd aastar-sdk
```

### 2. Install Dependencies

```bash
pnpm install
# or: npm install
```

### 3. Configure Environment

Create `.env.sepolia` in the project root:

```env
# Sepolia RPC (Alchemy)
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY

# Test Account Private Key (the AA account controller EOA)
PRIVATE_KEY_BOB=0x...your_private_key...

# Bundler URL (Alchemy)
BUNDLER_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY
```

> ⚠️ **Important**: Use the private key of the EOA that controls the AA account `0x975961...`.

### 4. Run the Gasless Test

```bash
source .env.sepolia && npx tsx tests/l4-test-pmv4-submit.ts
```

---

## What the Test Does

1. **Checks deposited bPNTs balance** on the Paymaster
2. **Constructs a gasless UserOperation** (ERC20 approve call)
3. **Submits to Alchemy Bundler**
4. **Waits for execution** and reports status

---

## Expected Output (Success)

```
📤 Test 3: Submit Paymaster V4 Gasless UserOp

AA Account: 0x975961302a83090B1eb94676E1430B5baCa43F9E
Paymaster: 0x317b58A4BeD90127B80Eb2516e9fC989BC2C7612

Step 1: Deposited balance: 500.0 bPNTs

Step 2: Constructing UserOp...

Step 3: Submitting to Bundler...
   ✅ UserOp submitted!

Step 4: Waiting for receipt...

✅ UserOp Executed!
   Transaction: 0x...
   Status: ✅ Success
```

---

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| `AA33 reverted` | Invalid Paymaster data or insufficient deposit | Check bPNTs balance |
| `Paymaster__InvalidOraclePrice` | Paymaster price cache not initialized | Owner calls `updatePrice()` |
| `entity stake/unstake delay too low` | Paymaster not staked | Owner stakes Paymaster |
| `ERC20InsufficientBalance` | Not enough bPNTs deposited | Deposit more bPNTs |

---

## SDK Price Management APIs (For Operators)

The SDK provides these APIs in `PaymasterV4Client`:

```typescript
import { PaymasterV4Client } from '@aastar/paymaster';

// Write APIs (owner/operator only)
await PaymasterV4Client.updatePrice(walletClient, paymasterAddress);
await PaymasterV4Client.setTokenPrice(walletClient, paymasterAddress, tokenAddress, priceUSD);

// Read APIs (anyone)
const { price, updatedAt } = await PaymasterV4Client.getCachedPrice(publicClient, paymasterAddress);
const tokenPrice = await PaymasterV4Client.getTokenPrice(publicClient, paymasterAddress, tokenAddress);

// Convenience
const wasUpdated = await PaymasterV4Client.ensurePriceInitialized(walletClient, publicClient, paymasterAddress);
```

---

## Contact

If you encounter issues, reach out via the project's issue tracker or community channels.
