# Technical Plan: SuperPaymaster & AAStar SDK Experiment

Based on the analysis of `projects/SuperPaymaster/scripts/gasless-test/test-gasless-viem-v2-final.js`, here is the detailed technical plan for implementing the SDK and the 3-category account experiment.

## 1. Paymaster Data Structure (SuperPaymaster V3/V4)
Unlike generic Paymasters, SuperPaymaster V3 uses a specific packed format for `paymasterAndData` to optimize for gas and community attribution.

**Format (72 bytes):**
1.  **Paymaster Address** (20 bytes)
2.  **Verification Gas Limit** (16 bytes, uint128) - Default 160k (Safe buffer over 120k actual)
3.  **PostOp Gas Limit** (16 bytes, uint128) - Default 10k
4.  **Operator Address** (20 bytes) - *The Community Node sponsoring the tx*

**Verification Logic:**
*   **On-chain**: Checks if `sender` holds `MySBT` (Soulbound Token) and has sufficient `xPNTs` (Gas Token) balance.
*   **Off-chain**: No HTTP signature required. Purely asset-based validation.

## 2. Experiment Groups & Setup

### Group A: Traditional EOA (Baseline)
*   **Identity**: `PRIVATE_KEY` (Account A) from `.env`.
*   **Mechanism**: Standard `eth_sendTransaction`.
*   **Setup**: Needs ETH for gas.

### Group B: Standard AA (Control)
*   **Identity**: `OWNER_PRIVATE_KEY` (Account B) controlling a Smart Account.
*   **Mechanism**: ERC-4337 UserOp.
*   **Paymaster**: Third-party Provider (e.g., Alchemy Gas Manager) or Bundler's native paymaster.
*   **Setup**: Needs a Policy ID or Paymaster RPC URL.

### Group C: SuperPaymaster AA (Treatment)
*   **Identity**: `OWNER2_PRIVATE_KEY` (Account C) controlling a Smart Account.
*   **Mechanism**: ERC-4337 UserOp with `SuperPaymaster`.
*   **Setup (Pre-requisites)**:
    1.  **Mint MySBT**: Account must own a generic or community-specific SBT.
    2.  **Token Balance**: Account must hold enough `xPNTs` (or `GTOKEN`) to cover the "Gas Credit".
*   **Flow**:
    1.  SDK constructs `paymasterAndData` with `OPERATOR` address.
    2.  SDK Estimates gas (Optimized: Verification 160k, PostOp 10k).
    3.  SDK Signs & Submits.

## 3. Implementation Roadmap

### Phase 1: SDK Update (`packages/superpaymaster`)
*   **Completed**: Implemented `getPaymasterMiddleware` taking `operatorAddress`.
*   **Completed**: Implemented V3 Packing Logic (`concat([pm, verGas, postOpGas, op])`).
*   **Completed**: Implemented `checkEligibility` helper.

### Phase 2: Experiment Script (`run_experiment_data.ts`)
*   **Initialization**: Load Keys from `.env` (using global `@env/.env`).
*   **Pre-Flight Check**:
    *   Check Group C eligibility.
    *   **Auto-Mint**: Logic inspired by `mint-sbt-for-aa.js`.
*   **Execution Loop (30 Runs)**:
    *   **Group A**: `walletClient.sendTransaction`.
    *   **Group B**: `smartAccountClient.sendUserOperation` (using Alchemy Provider).
    *   **Group C**: `smartAccountClient.sendUserOperation` (using SuperPaymaster Middleware).
*   **Data Recording**: Capture `receipt.gasUsed`, `effectiveGasPrice`.

## 4. Key Configuration (from `.env`)
```bash
# Identities
PRIVATE_KEY=...       # EOA / Deployer
OWNER_PRIVATE_KEY=... # Standard AA Owner
OWNER2_PRIVATE_KEY=...# SuperPaymaster AA Owner

# Contracts (Sepolia)
SUPER_PAYMASTER_ADDRESS=0x34671Bf95159bbDAb12Ac1DA8dbdfEc5D5dC1c24
MYSBT_ADDRESS=0xD1e6BDfb907EacD26FF69a40BBFF9278b1E7Cf5C
GAS_TOKEN_ADDRESS=0xfb56CB85C9a214328789D3C92a496d6AA185e3d3
OPERATOR_ADDRESS=0x411BD567E46C0781248dbB6a9211891C032885e5
```

## 5. Account Preparation Strategy

| Group | Identity (Key) | Mechanism | Preparation & Requirements | Transaction Execution |
| :--- | :--- | :--- | :--- | :--- |
| **A: Traditional EOA** | `PRIVATE_KEY` | `eth_sendTx` | **Needs ETH**: Transfer Sepolia ETH from Faucet or Deployer. | `walletClient.sendTransaction` |
| **B: Standard AA** | `OWNER_PRIVATE_KEY` | ERC-4337 | **Needs ETH/Paymaster**: Needs ETH (if self-pay) or Paymaster Policy (if sponsored). | `smartAccountClient.sendUserOperation` (Generic) |
| **C: SuperPaymaster** | `OWNER2_PRIVATE_KEY` | ERC-4337 | **Needs MySBT + xPNTs**: <br>1. **Mint SBT**: Must own a Soulbound Token.<br>2. **Fund xPNTs**: Must have gas token balance.<br>*SDK `checkEligibility` verifies this.* | `smartAccountClient.sendUserOperation` <br> (with `getPaymasterMiddleware`) |

