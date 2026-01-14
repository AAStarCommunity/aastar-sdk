# Faucet & Gasless Verification Plan (Sepolia)

This document outlines the systematic steps required to verify the Faucet API and SuperPaymaster gasless flow on Sepolia, mapping each step to the corresponding SDK/API capability.

## Overview
The goal is to provide a "one-click" experience for a new user to:
1. Receive initial ETH (for account buffer).
2. Receive a sponsored `ENDUSER` role (stake paid by community).
3. Receive gas tokens (`cPNTs`).
4. Execute a gasless transaction via `SuperPaymaster`.

---

## 📋 Step-by-Step Execution Plan

### Phase 1: Infrastructure & Admin Setup
| Step | Action | API / Contract | Status | Rationale |
| :--- | :--- | :--- | :--- | :--- |
| 1.1 | **Supplier Funding** | `supplierWallet.sendTransaction` | ✅ DONE | Ensure Admin has ETH for stakes and gas. |
| 1.2 | **Community Registration** | `Registry.registerRole` (COMMUNITY) | ✅ DONE | Admin must be a Community to sponsor users. |

### Phase 2: User Preparation (Faucet API)
| Step | Action | API / Contract | Status | Rationale |
| :--- | :--- | :--- | :--- | :--- |
| 2.1 | **ETH Funding** | `SepoliaFaucetAPI.fundETH` | ✅ DONE | Provide seed ETH to the new AA account. |
| 2.2 | **Sponsored Role** | `Registry.safeMintForRole` | ✅ DONE | Admin pays 0.35 GToken stake for User. |
| 2.3 | **Gas Token Funding** | `ERC20.transfer` | ✅ DONE | User needs tokens to use as service credit in SuperPaymaster. |

### Phase 3: Gasless Transaction Submission
| Step | Action | API / Contract | Status | Rationale |
| :--- | :--- | :--- | :--- | :--- |
| 3.1 | **Account Calculation** | `AccountFactory.getAddress` (v0.7) | ⚠️ FIXING | Need correct v0.7 salt and factory address. |
| 3.2 | **InitCode Generation**| `SuperPaymasterClient` | ⚠️ FIXING | Factory call to deploy the AA account on first use. |
| 3.3 | **Gasless UserOp** | `SuperPaymasterClient.submitGaslessTransaction` | ⏳ PENDING | Submit signed UserOp to the Bundler. |
| 3.4 | **Final Confirmation** | `bundlerClient.waitForUserOperationReceipt` | ⏳ PENDING | Verify transaction landed on Sepolia. |

---

## 🚫 Current Blockers & Resolution

### 1. `AA13 initCode failed or OOG`
- **Cause**: The script was using a v0.6 factory address logic with a v0.7 Bundler/EntryPoint. 
- **Resolution**: I am updating `test-faucet-and-gasless.ts` to use `paymasterFactory` (0xDaC3...) from the config, which is the verified v0.7 SimpleAccountFactory.

### 2. `getAddress` Revert
- **Cause**: ABI mismatch in the `readContract` call.
- **Resolution**: Adjusting the ABI to match v0.7 `SimpleAccountFactory` (owner, salt).

---

## 🛠️ API Coverage Audit
- [x] **Registry.safeMintForRole**: Verified as the correct "Sponsor Mode" API.
- [x] **SepoliaFaucetAPI**: Successfully handles ETH/Token prep.
- [x] **SuperPaymasterClient**: Handles V4 gasless submission.

**Next Action**: Apply the v0.7 Factory fix to `test-faucet-and-gasless.ts` and run the final verification.
