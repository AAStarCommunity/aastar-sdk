# SuperPaymaster Gasless Test Guide

[中文版入口](#SuperPaymaster-无感交易测试指南-中文版) | [English Version](#superpaymaster-gasless-test-guide)

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
这个脚本 
test-faucet-and-gasless.ts
 实际上是一个端到端的全链路集成测试。它的核心任务是验证在没有 ETH 的情况下，一个新用户如何通过我们的 SDK 和 SuperPaymaster 体系从“零”开始变成一个“可用”的社区成员。

以下是该脚本工作的详细步骤描述：

1. 身份初始化
新用户生成：脚本会随机生成一个 privateKey，代表一个全新的用户 EOA。
AA 地址预测：利用 SDK 的 user.createSmartAccount 方法，根据 EOA 地址和 salt 预测出对应的智能账户地址（AA Address）。
2. AA 账户预部署（这是解决 AA13 报错的关键）
直接部署：脚本让 Supplier（资助者）发起一笔传统的 L1 交易，通过 Factory 为用户部署这个 AA 合约。
目的：确保后续的 Gasless UserOp 在仿真时面对的是一个“已存在”的合约，从而彻底避免 Bundler 对 initCode 仿真的不稳定性。
3. Faucet 准备阶段 (SepoliaFaucetAPI)
这一步是脚本最核心的业务逻辑，它模拟了“水龙头”或“新人礼包”的过程：

注入 ETH：Admin 向 AA 账户转入极小额的 ETH（约 0.02），用于支付非 Gasless 场景下的基础费用（如某些合约交互）。
赞助角色注册 (Spo Forces API)：
问题：通常注册 ENDUSER 角色需要用户质押 0.5 GTokens，但新用户此时没有钱。
解决：Admin 调用 safeMintForRole。这是一种赞助模式，Admin 支付 GTokens 质押，直接将 ENDUSER 角色授予用户的 AA 账户。
注入 C-Points (aPNTs)：Admin 直接给用户 AA 地址转入 1000 个 aPNTs 代币。这些代币是用户后面发起 Gasless 交易时扣除的“虚拟燃料”。
4. Gasless 交易测试 (SuperPaymasterClient)
一旦用户拥有了 ENDUSER 角色和 aPNTs，脚本就开始测试真正的无感交易：

提交 UserOp：用户发起一个“转账回 Admin”的请求（作为测试动作）。
SuperPaymaster 介入：
SuperPaymaster 检查该 AA 用户是否拥有 ENDUSER 角色。
它会检查 AA 用户账户里的 aPNTs 余额是否足够支付 Gas。
执行：支付中心（SuperPaymaster）会为这笔交易担保并支付 Sepolia 网络原生的 Gas 费，而用户的 AA 账户则扣除相应的 aPNTs。
总结
你描述得很准确：

随机生成/使用指定 A Account。
不转 GToken 质押金，而是由 Admin “带”他完成社区注册（Sponsor Stake）。
转入 aPNTs (C-Points) 供其消费。
发起 Gasless 交易，验证整个“免 Gas”链路在真实 Sepolia 网络上是连通的。
这个脚本成功运行，标志着我们的 SDK 在处理 v0.7 账户的赞助注册 + 燃料资助 + 无感交易这一套业务逻辑上已经完全成熟。
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

---

## 🛠️ Synergy: Faucet + KMS (Hardware/Cloud Wallets)

If you are using a **KMS-backed AA account** (where the private key never leaves AWS/Google/Fireblocks), you can still use the full power of the Faucet and Gasless SDK.

### 1. Setup is "Keyless"
The **Faucet Setup** phase (`SepoliaFaucetAPI.prepareTestAccount`) DOES NOT require your user's private key.
- It only needs your **AA Address**.
- The `Admin` (Anni/Deployer) uses *their* key to grant you roles and fund you tokens.

**Code Sample: Faucet Setup (One-Time)**
```typescript
import { SepoliaFaucetAPI } from '@aastar/core';

await SepoliaFaucetAPI.prepareTestAccount(
    adminWallet, // WalletClient with Admin Key
    publicClient,
    {
        targetAA: '0xYourUserAddress', 
        token: CORE_ADDRESSES.aPNTs, 
        registry: CORE_ADDRESSES.registry,
        superPaymaster: CORE_ADDRESSES.superPaymaster,
        ethAmount: parseEther('0.02')
    }
);
```

**Workflow**: 
1. Provide your KMS AA Address to the Admin.
2. Owner/Admin runs the Faucet script for your address.
3. Your account is now "Gasless Ready" (has ENDUSER role + aPNTs).

### 2. Signing is "KMS-native"
The **Execution** phase (`SuperPaymasterClient.submitGaslessTransaction`) requires a signature, but it accepts a standard `viem` Client.
- You can wrap your KMS API into a custom `viem` `Account`.
- The SDK will call your KMS to sign the `UserOpHash`.

**Code Sample: Remote Signer (KMS) Integration**
```typescript
import { http, createPublicClient } from 'viem';
import { toAccount } from 'viem/accounts';
import { createEndUserClient, CORE_ADDRESSES } from '@aastar/sdk';

// 1. Define your Remote Signer (KMS) Wrapper
const kmsAccount = toAccount({
    address: '0xYourUserAAAddress',
    async signMessage({ message }) {
        // Implement your KMS call here (e.g., AWS KMS, Fireblocks)
        // message.raw is the hash (UserOpHash) to sign
        const sig = await remoteKmsSign(message.raw); 
        return sig; 
    }
});

// 2. Initialize SDK Client with Remote Account
const userClient = createEndUserClient({
    transport: http(rpcUrl),
    chain: sepolia,
    account: kmsAccount, 
    addresses: {
        registry: CORE_ADDRESSES.registry,
        entryPoint: CORE_ADDRESSES.entryPoint
    }
});

// 3. Execute Gasless Transaction
const result = await userClient.executeGasless({
    target: '0xTargetContract',
    data: '0xCallData',
    operator: '0xPaymasterOperatorAddress' 
});

console.log('UserOp Hash:', result.hash);
```

### 3. Combination Summary
| Phase | Requirement | Logic |
| :--- | :--- | :--- |
| **Preparation** | AA Address | **Keyless**: Admin sponsors your entry. |
| **Verification** | AA Address | **Public**: Check roles/balance via SDK. |
| **Execution** | KMS Signature | **Secure**: SDK requests signature from your KMS. |

> [!TIP]
> This separation allows developers to onboard "Air-Gapped" or "Enterprise" accounts into the SuperPaymaster ecosystem without ever touching their private keys.


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

---

# SuperPaymaster Gasless Test Guide (中文版)

> 本指南供外部测试人员在 Sepolia 测试网上运行 Gasless（无感）UserOperation 时参考。

---

## 预配置测试账户

测试账户通过 `l4-setup.ts` 动态配置，并存储在 `scripts/l4-state.json` 中。

关键测试角色：
- **Jason**: 使用 PaymasterV4, 代币: aPNTs
- **Bob**: 使用 PaymasterV4, 代币: bPNTs  
- **Anni**: 使用 SuperPaymaster, 代币: dPNTs
- **Charlie**: 使用 PaymasterV4, 代币: cPNTs

运行 `pnpm tsx scripts/l4-setup.ts` 可以查看当前的地址和状态。

---

## SDK 就绪检查与准备

SDK 现在提供了“一键式”就绪检查，以避免常见的 Bundler 拒绝风险。

### 1. 检查就绪状态 (诊断)
检查 Paymaster 是否质押、价格是否设置以及用户是否有存款。

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
    console.error("发现问题:", report.issues);
}
```

### 2. 自动准备 (仅限运营商)
自动修复缺失的质押、存款或价格。

```typescript
const steps = await PaymasterOperator.prepareGaslessEnvironment(
    operatorWallet,
    publicClient,
    entryPoint,
    paymasterAddress,
    tokenAddress,
    {
        tokenPriceUSD: 100000000n, // $1.00 (8 位小数)
        minStake: parseEther('0.05'),   
        minDeposit: parseEther('0.1')   
    }
);
console.log("采取的步骤:", steps);
```

---

## 极简开发工作流

### 1. 开发者：单行代码提交 (API 详解)

参考脚本：[`examples/simple-gasless-demo.ts`](../examples/simple-gasless-demo.ts)

#### 第一步：设置客户端
```typescript
const wallet = createWalletClient({ account, chain: sepolia, transport: http(rpcUrl) });
const client = createPublicClient({ chain: sepolia, transport: http(rpcUrl) });
```

#### 第二步：定义“用户意图” (CallData)
```typescript
const innerCall = PaymasterClient.encodeTokenTransfer(recipient, parseEther('0.01'));
const callData = PaymasterClient.encodeExecution(tokenAddress, 0n, innerCall);
```

#### 第三步：✨ 核心提交接口 ✨
`submitGaslessUserOperation` 函数处理了 AA 的所有复杂性：自动估算 Gas、动态获取网络 Gas 价格、应用效率保护机制。

```typescript
const userOpHash = await PaymasterClient.submitGaslessUserOperation(
    client,            // 公共客户端
    wallet,            // 钱包客户端 (用于签名)
    aaAccountAddress,  // 用户的 AA 钱包地址
    entryPointAddress, // 入口合约地址
    paymasterAddress,  // 支付中心地址
    tokenAddress,      // 用户支付的代币地址
    bundlerUrl,        // Bundler RPC 地址
    callData           // 业务操作数据
);
```

---

## 🛠️ 协同配合：水龙头 (Faucet) + KMS (硬件/云钱包)

如果你使用的是 **KMS 后端 AA 账户**（私钥不出 AWS/Google/Fireblocks），你仍然可以充分利用 Faucet 和 Gasless SDK。

### 1. 准备阶段是“无私钥”的
**Faucet 设置阶段** (`SepoliaFaucetAPI.prepareTestAccount`) **不需要**用户的私钥。
- 它只需要你的 **AA 地址**。
- 管理员 (Admin) 使用他们的密钥为你授予角色并资助代币。

**代码示例：水龙头准备 (一次性)**
```typescript
import { SepoliaFaucetAPI } from '@aastar/core';

await SepoliaFaucetAPI.prepareTestAccount(
    adminWallet, // 管理员钱包
    publicClient,
    {
        targetAA: '0xYourUserAddress', 
        token: CORE_ADDRESSES.aPNTs, 
        registry: CORE_ADDRESSES.registry,
        superPaymaster: CORE_ADDRESSES.superPaymaster,
        ethAmount: parseEther('0.02')
    }
);
```

### 2. 签名阶段是“KMS 原生”的
**执行阶段** (`SuperPaymasterClient.submitGaslessTransaction`) 需要签名逻辑，但它兼容任何 `viem` Signer。
- 你可以将 KMS API 封装进自定义的 `viem` `Account` 即可。

**代码示例：远程签名者 (KMS) 包装**
```typescript
const kmsAccount = toAccount({
    address: '0xYourUserAAAddress',
    async signMessage({ message }) {
        const sig = await remoteKmsSign(message.raw); 
        return sig; 
    }
});

const userClient = createEndUserClient({
    transport: http(rpcUrl),
    chain: sepolia,
    account: kmsAccount, 
    ...
});

const hash = await userClient.executeGasless({
    target: '0xTargetContract',
    data: '0xCallData',
    operator: '0xPaymasterOperatorAddress' 
});
```

---

## 自动化水龙头与验证脚本

运行以下脚本可以创建一个全新的 AA 账户，资助它，并立即执行无感交易验证：

```bash
npx tsx scripts/test-faucet-and-gasless.ts
```

**脚本功能：**
1. **身份**: 随机生成 EOA 密钥对。
2. **部署**: 通过传统交易预部署 AA 账户（提升 Bundler 模拟成功率）。
3. **Faucet**: 资助 0.02 ETH，使用 `safeMintForRole` 赞助 `ENDUSER` 角色（Admin 付质押金），并充值 aPNTs 燃料。
4. **提交**: 使用 `SuperPaymasterClient` 发起 Gasless 交易。

**结论**：该脚本成功运行，标志着 SDK 在处理 v0.7 账户的**赞助注册 + 燃料资助 + 无感交易**这一套业务逻辑上已经完全成熟。
