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
import { PaymasterOperator } from '@aastar/paymaster';

const report = await PaymasterOperator.checkGaslessReadiness(
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
const steps = await PaymasterOperator.prepareGaslessEnvironment(
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
import { PaymasterOperator } from '@aastar/paymaster';

// Write APIs (owner/operator only)
await PaymasterOperator.updatePrice(walletClient, paymasterAddress);
await PaymasterOperator.setTokenPrice(walletClient, paymasterAddress, tokenAddress, priceUSD);

// Read APIs (anyone) - also available in PaymasterOperator for convenience
const { price, updatedAt } = await PaymasterOperator.getCachedPrice(publicClient, paymasterAddress);
const tokenPrice = await PaymasterOperator.getTokenPrice(publicClient, paymasterAddress, tokenAddress);

// 4. Instant Bill (via TxHash) - No scanning required
const fee = await PaymasterClient.getTransactionFee(publicClient, txHash, paymasterAddress);
console.log(`Cost: ${fee.tokenCost} dPNTs`);
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
```typescript
// examples/simple-gasless-demo.ts
import { PaymasterClient } from '@aastar/paymaster';

// ... (Client setup) ...

// ✨ The Magic Line
const userOpHash = await PaymasterClient.submitGaslessUserOperation(
    publicClient,
    walletClient,      // Wrapper around User Private Key
    aaAccountAddress,  // Sender Address
    entryPointAddress,
    paymasterAddress,
    tokenAddress,
    bundlerUrl,
    callData
);

console.log("UserOp Hash:", userOpHash);
// Note: To see the Transaction Hash, you must wait for the Bundler to mine the UserOp.
```

**Key Features:**
- **Auto-Gas Estimation**: Automatically simulates the UserOp with the Bundler.
- **Efficiency Guard**: Applies tuned gas limits (no buffer for verification, 1.1x for call) to satisfy Bundler efficiency rules (>0.4).
- **Auto-Signing**: Handles the v0.7 UserOp hashing and signing internally.

---

## Contact


---

## Appendix: Real Transaction Analysis

Below is an analysis of a fulfilled Gasless Transaction (executed via `l4-test-jason1-gasless.ts` on Sepolia).

**Transaction Hash**: `0xa3179a3464ac9d14681f051b9ea7f194834cfd9b65f6897415195a28656ce1cb`  
**Etherscan Link**: [View on Sepolia Etherscan](https://sepolia.etherscan.io/tx/0xa3179a3464ac9d14681f051b9ea7f194834cfd9b65f6897415195a28656ce1cb)

### Data Breakdown

| Field | Value / Description | Interpretation |
| :--- | :--- | :--- |
| **Status** | `Success` | The transaction was mined and executed successfully. |
| **From** | `0x4a1627CACf9bFb16ed955738b9932d511644e489` (Bundler EOA) | The Bundler/Relayer that submitted the batch. This is NOT the user. |
| **To** | `0x0000000071727De22E5E9d8BAf0edAc6f37da032` (EntryPoint v0.7) | The central EntryPoint contract that constructs and executes the AA call. |
| **Transaction Action** | Transfer 0.1 dPNTs | The verified "User Intent". The AA account successfully called the Token contract. |
| **ERC-20 Tokens** | `0xECD9C07f648B09CFb78906302822Ec52Ab87dd70` (Jason AA1) → `0xEcAACb915f7D92e9916f449F7ad42BD0408733c9` (Anni) | **The Core Action**: Jason AA1 transferred 0.1 dPNTs to Anni. |
| **Gas Usage** | `165,824` / `409,844` (40.46%) | The Paymaster sponsored the gas. The Bundler overestimated (Limit), but actual usage was fair. |
| **Internal Txns** | Transfer 0.0000189 ETH (Refund) | The **Paymaster** (via EntryPoint) refunding the Bundler for the ETH gas cost. |
| **Burnt Fees** | `0.00000000047...` ETH | The portion of the gas fee burnt by the network (EIP-1559). |

### Key Takeaways
1. **User Pays Zero ETH**: The `From` address (Bundler) paid the ETH gas. The Internal Transaction shows the Bundler getting reimbursed.
2. **User Spent dPNTs**: The `ERC-20 Token Transfer` shows the user moving `dPNTs`. This likely covers the service fee (gas + premium) in a real "Pay with Token" model, though in this "Gasless" mode, the dPNTs might just be the payload or a separate fee payment.
### Frequently Asked Questions (Analysis)

#### 1. Why is "From" the Bundler, not the User?
In Account Abstraction (ERC-4337), the User does not send the transaction directly.
- **The Envelope**: The Bundler (`0x4a16...`) sends the Ethereum Transaction to the `EntryPoint`. They pay the ETH gas.
- **The Letter**: The `EntryPoint` opens the envelope and executes your **UserOperation**.
- **The Result**: Etherscan shows the "Envelope" (Bundler -> EntryPoint) as the top-level transaction. Your action (Token Transfer) is an *Internal Transaction* or *Log Event* triggered inside.

#### 2. Where is the Gas Fee? "Value: 0 ETH"?
- The `Transaction Fee` shown on Etherscan (e.g., 0.000016 ETH) is paid by the **Bundler**.
- The **Paymaster** refunds the Bundler (visible in "Internal Transactions" as a transfer from Paymaster to Bundler).
- **Your Cost (in Tokens)**: Since this Paymaster uses a "Deposit Model", the fee is deducted from your internal balance within the Paymaster contract.
    - **Visibility**: This deduction does NOT show up as an ERC-20 Transfer (because tokens didn't move wallets, only internal counters changed).
    - **Verification**: Look at the **Logs** tab for the `PostOpProcessed` event. It explicitly lists `tokenCost` (the amount of dPNTs deducted).

#### 3. Why is there only one ERC-20 Transfer?
- The transfer you see (`0.1 dPNTs` from Jason to Anni) is your **Actual execution payload**.
- If the Paymaster used "Token Paymaster Mode 1" (pulling tokens from your wallet), you would see a second transfer for the fee.
#### 4. "I can't see the Deducted Amount!" (How to Read Logs)
You mentioned you couldn't find the deduction. It is in **Log Index 2** (on Etherscan Logs tab).
- **Event Signature (Topic 0)**: `0x62544d7f...` (`PostOpProcessed`).
- **Data Field**: Contains 3 values (32 bytes each).
    1. **ActualGasCost (ETH)**: `0xc5ba77775be` -> `0.00001358 ETH` (The actual reimbursed amount).
    2. **TokenCost (dPNTs)**: `0x99ffeb21efcb3b` -> `43346900000000000` (Raw Units).
       - Assuming 18 decimals: **0.0433469 dPNTs**.
    3. **ProtocolRevenue**: Same as above (no markup in this test).

**Summary**: Your deposit was deducted by **0.0433 dPNTs**.
