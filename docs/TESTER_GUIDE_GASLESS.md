# Paymaster V4 Gasless Test Guide

> For external testers to run a gasless UserOperation on Sepolia.

---

## Pre-configured Test Accounts

Test accounts are dynamically configured via `l4-setup.ts` and stored in `scripts/l4-state.json`.

Key test personas:
- **Jason**: Uses PaymasterV4, Token: aPNTs
- **Bob**: Uses PaymasterV4, Token: bPNTs  
- **Anni**: Uses SuperPaymaster, Token: dPNTs
- **Charlie**: Uses PaymasterV4, Token: cPNTs

Run `pnpm tsx scripts/l4-setup.ts` to view current addresses and status.

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
        tokenPriceUSD: 100000000n, // $1.00 (8 decimals)
        minStake: parseEther('0.05'),   // Reduced from 0.2 ETH
        minDeposit: parseEther('0.1')   // Minimum deposit required
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

### 2. App Developer: One-Liner Submission (Code Walkthrough)

To understand how to integrate Gasless features into your app, look at `examples/simple-gasless-demo.ts`. This script demonstrates the "Zero-Friction" Developer Experience (DX).

**Reference Script**: [`examples/simple-gasless-demo.ts`](../examples/simple-gasless-demo.ts)

#### Step 1: Setup Client & Wallet
Standard `viem` setup. You need a `WalletClient` (to sign the UserOp) and a `PublicClient` (to read data).

```typescript
// 1. Setup Clients
const wallet = createWalletClient({ account, chain: sepolia, transport: http(rpcUrl) });
const client = createPublicClient({ chain: sepolia, transport: http(rpcUrl) });
```

#### Step 2: Define "User Intent" (CallData)
Instead of dealing with raw ABI encoding, use the SDK's semantic builders.

```typescript
// 2A. Inner Action: Transfer 0.01 dPNTs
const innerCall = PaymasterClient.encodeTokenTransfer(recipient, parseEther('0.01'));

// 2B. Outer Action: Execute via AA
const callData = PaymasterClient.encodeExecution(
    tokenAddress, 
    0n, 
    innerCall
);
```

#### Step 3: ✨ The Magic Line (Submission) ✨
This is the core of the SDK. The `submitGaslessUserOperation` function handles all the complexity of Account Abstraction:
1.  **Gas Estimation**: Automatically calls the Bundler to estimate usage.
2.  **Dynamic Gas Pricing**: Fetches current network gas prices and applies 1.5x buffer for volatility (no hardcoded values).
3.  **Efficiency Guard**: Applies optimized gas limits (no buffer for verification, 1.1x for execution) to pass strict Bundler rules.
4.  **Data Encoding**: Packs the Paymaster data (time validity, deposit info).
5.  **Signing**: Signs the UserOp with the user's private key (v0.7 compliant).
6.  **Submission**: Sends the packet to the Bundler.

```typescript
// 3. Submit Gasless UserOp (One-Liner)
// No need to specify gas prices - SDK auto-fetches from network!
const userOpHash = await PaymasterClient.submitGaslessUserOperation(
    client,            // Public Client for reads
    wallet,            // Wallet Client for signing
    aaAccountAddress,  // The User's AA Wallet Address
    entryPointAddress, // Global EntryPoint
    paymasterAddress,  // The Paymaster paying the fees
    tokenAddress,      // The Token the user is "spending" (conceptually)
    bundlerUrl,        // Where to send the UserOp
    callData           // The action from Step 2
    // Optional: Pass custom gas prices via options if needed
);
```

#### Step 4: Wait for Receipt
The `userOpHash` is just a tracking ID. You must wait for the Bundler to bundle it into a real Ethereum Transaction.

```typescript
// 4. Wait for Execution
const receipt = await bundlerClient.waitForUserOperationReceipt({ 
    hash: userOpHash 
});
console.log(`mined in tx: ${receipt.receipt.transactionHash}`);
```

#### Step 5: Instant Bill (Get Cost)
Since the fee is deducted from an internal Paymaster balance (not an external ERC-20 transfer), users might wonder "How much did I pay?".
The `getTransactionFee` helper instantly decodes the `PostOpProcessed` log from the receipt to give you the exact cost.

```typescript
// 5. Instant Bill (No scanning required)
const feeInfo = PaymasterClient.getFeeFromReceipt(receipt.receipt, paymasterAddress);
console.log(`[Instant Bill] Cost: ${formatEther(feeInfo.tokenCost)} dPNTs`);
```

---

---

## Advanced: Remote Signing (KMS / MPC)

If your AA Account's private key is stored in a KMS (AWS, Google) or MPC Node, you cannot export it. **Good news**: The SDK is compatible with any signer.

**How to integrate:**
1.  Create a custom `viem` Account that calls your KMS.
2.  Pass this account to `createWalletClient`.
3.  The SDK uses `wallet.account.signMessage(...)` internally.

```typescript
// Example: Custom KMS Account
import { toAccount } from 'viem/accounts';

const kmsAccount = toAccount({
    address: '0xYourAAAddress',
    async signMessage({ message }) {
        // 1. Send 'message.raw' (the UserOpHash) to your KMS API
        const signature = await myKmsClient.sign(message.raw); 
        // 2. Return the signature
        return signature; 
    },
    // Implement other required methods (signTransaction, etc.) if needed
});

const wallet = createWalletClient({ account: kmsAccount, ... });

// Now just call the SDK as normal!
await PaymasterClient.submitGaslessUserOperation(..., wallet, ...);
```

---

---

## SuperPaymaster Integration (Credit-Based Gasless)

SuperPaymaster allows users to pay gas using credits provided by an **Operator**. This model is ideal for ecosystem projects where a central entity (the Operator) sponsors transactions for its users.

### 1. The SuperPaymaster Flow
1.  **Operator Config**: An Operator (e.g., Anni) configures a credit line in the SuperPaymaster contract.
2.  **User Action**: A user (UserOp Sender) initiates a transaction.
3.  **Submission**: The app submits the UserOp specifying the `operator` address.
4.  **Execution**: SuperPaymaster verifies the Operator's credit and sponsors the gas.

### 2. Developer Workflow

We provide a dedicated `SuperPaymasterClient` that abstracts gas estimation and operator data packing.

**Reference Script**: [`examples/simple-superpaymaster-demo.ts`](../examples/simple-superpaymaster-demo.ts)

#### Step 1: Configure App & Operator
You need the **User's** account (Signer) and the **Operator's** address.

```typescript
import { SuperPaymasterClient } from '@aastar/paymaster';

const APP_CONFIG = {
    superPaymaster: '0x...',       // Contract Address
    operator: '0x...',             // Operator Address (Provider)
    token: '0x...'                 // Logic Token (optional context)
};
```

#### Step 2: Submit with Dynamic Gas Tuning
The `SuperPaymasterClient.submitGaslessTransaction` method automatically:
-   **Estimates Gas**: Queries the Bundler.
-   **Tunes Limits**: Adjusts `verificationGasLimit` to satisfy Bundler efficiency rules (> 0.4 ratio) while ensuring safe execution for Paymaster logic.
-   **Packs Data**: Encodes the Operator address into the `paymasterAndData` field.

```typescript
const userOpHash = await SuperPaymasterClient.submitGaslessTransaction(
    client,            // Public Client
    wallet,            // Wallet (Signer - Local or KMS)
    userAA,            // User's AA Address
    entryPoint,        // EntryPoint Address
    bundlerUrl,        // Bundler RPC
    {
        token: APP_CONFIG.token,
        recipient: recipientAddress,
        amount: parseEther('1'),
        operator: APP_CONFIG.operator,
        paymasterAddress: APP_CONFIG.superPaymaster
    }
);
```

### 3. Using KMS / MPC Signers
Just like the standard Paymaster usage, `SuperPaymasterClient` supports any `viem` Wallet Client.

If your User keys are in a KMS (AWS, Google, Fireblocks):
1.  Create a custom `viem` Account that forwards `signMessage` calls to your KMS.
2.  Pass this account to `createWalletClient`.
3.  Pass the `wallet` to `SuperPaymasterClient`.

*(See "Advanced: Remote Signing" section above for code example).*

---


---

---

## Automated Faucet & Verification Script (New)

We have implemented a **SepoliaFaucetAPI** that automates the tedious setup process for new test accounts (Funding ETH, Registering EndUser, Minting Tokens, Depositing to Paymaster).

### Verification Script
Run the following script to create a fresh AA account, fund it, and execute a gasless transaction immediately:

```bash
npx tsx scripts/test-faucet-and-gasless.ts
```

**What it does:**
1.  **Identity**: Generates a random private key (Brand new user).
2.  **Faucet**: Uses `SepoliaFaucetAPI.prepareTestAccount` to:
    -   Fund 0.02 ETH (if needed).
    -   Register `ENDUSER` role (attempts via Admin key; logs warning if no permission).
    -   Mint `cPNTs` tokens (for SuperPaymaster).
    -   Deposit tokens to Paymaster V4 (if needed).
3.  **Action**: Calculates the AA address (undeployed).
4.  **Submission**: Uses `SuperPaymasterClient` (with factory support) to deploy and execute a gasless transaction in one step.

> **Note**: Requires `PRIVATE_KEY` (Deployer) or `PRIVATE_KEY_ANNI` in `.env.sepolia` to have Admin/Minter privileges. If specific permissions fail (like GrantRole), the script attempts to proceed.

### 4. Code Sample: Using Faucet & KMS
For a complete example of how to combine the Faucet (for setup) and a Mock KMS (for signing), refer to `scripts/test-kms-gasless.ts`.

#### Faucet Setup (One-Time)
```typescript
import { SepoliaFaucetAPI } from '@aastar/core';

await SepoliaFaucetAPI.prepareTestAccount(
    adminWallet, // WalletClient with Admin Key
    publicClient,
    {
        targetAA: '0x...', 
        token: '0x...',       // GToken Address
        registry: '0x...',    // Registry Address
        // Optional:
        tokenAmount: parseEther('1000') 
    }
);
```

#### KMS / Remote Signer Integration
To use a remote signer (AWS KMS, Fireblocks, MPC), creates a custom `viem` account.

```typescript
import { toAccount } from 'viem/accounts';

const remoteSigner = toAccount({
    address: '0xYourWalletAddress',
    async signMessage({ message }) {
        // message.raw is the UserOpHash
        const sig = await myKmsClient.sign(message.raw); 
        // Ensure signature is valid 65-byte hex (r, s, v)
        return sig; 
    },
    async signTransaction(tx) {
        throw new Error("Not supported for Gasless");
    }
});

const wallet = createWalletClient({ account: remoteSigner, ... });

// Pass this wallet to SuperPaymasterClient
const userOpHash = await SuperPaymasterClient.submitGaslessTransaction(..., wallet, ...);
```


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
