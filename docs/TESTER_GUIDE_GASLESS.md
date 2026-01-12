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
2.  **Efficiency Guard**: Applies optimized gas limits (no buffer for verification, 1.1x for execution) to pass strict Bundler rules.
3.  **Data Encoding**: Packs the Paymaster data (time validity, deposit info).
4.  **Signing**: Signs the UserOp with the user's private key (v0.7 compliant).
5.  **Submission**: Sends the packet to the Bundler.

```typescript
// 3. Submit Gasless UserOp (One-Liner)
const userOpHash = await PaymasterClient.submitGaslessUserOperation(
    client,            // Public Client for reads
    wallet,            // Wallet Client for signing
    aaAccountAddress,  // The User's AA Wallet Address
    entryPointAddress, // Global EntryPoint
    paymasterAddress,  // The Paymaster paying the fees
    tokenAddress,      // The Token the user is "spending" (conceptually)
    bundlerUrl,        // Where to send the UserOp
    callData           // The action from Step 2
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
