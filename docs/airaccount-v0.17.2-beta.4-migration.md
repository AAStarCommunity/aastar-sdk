# AirAccount v0.17.2-beta.4 — SDK migration notes

The AirAccount contract shipped **v0.17.2-beta.4** (bundler-compatibility fix). Guard-enabled accounts now work through a standard ERC-4337 bundler. This requires **three SDK-side changes**. Source of truth in the contract repo:
- Impact assessment: `AAStarCommunity/airaccount-contract` → `docs/beta4-impact-assessment.md`
- ABI capability map / SDK guide: `docs/abi/capabilities.md`, `docs/abi/sdk-integration.md`
- On-chain TX → capability → value: `docs/beta4-e2e-tx-capability-map.md`

## What changed (contract side)
The algorithm whitelist moved from the per-account guard onto the **account** (single source of truth, enforced in `validateUserOp`), and a new ERC-4337 v0.7 **`executeUserOp(userOp, userOpHash)`** entrypoint re-derives the signature algId in-frame. This eliminates the cross-`eth_call` transient dependency that made guard-enabled accounts fail bundler gas estimation (`AlgorithmNotApproved(0)`). On-chain verified on Sepolia: a guard-enabled account's self-paying UserOp landed via Pimlico (tx `0x48934dee021a7401d6196646dd07f023b3b18cd9a11aa110f4871971e3c74faf`).

## New Sepolia addresses (beta.4)
| Contract | Address |
|----------|---------|
| Factory | `0x3a9127a5f0b4ca734d54629d0c3ad9f52739c071` |
| Implementation | `0x0321Fa7261Ad5945e4B3f0c73aFD7D9392E39796` |
| Extension | `0x20FB2A65a52Fc6507FdD51260f055017a2BA2860` |
| AirAccountDelegate | `0x4bda4849b80cc444fb2da65beec0724005c6675c` |
| AgentRegistry | `0xe1320c35485b4d7817866a8d0d8f77dd58202253` |
| EntryPoint v0.7 | `0x0000000071727De22E5E9d8BAf0edAc6f37da032` |

Reused unchanged from beta.3: ValidatorRouter `0x3c2b06f5…`, SessionKeyValidator `0x655ca2e9…`, ForceExitModule `0xdb396ca2…`, BLSAlgorithm `0xB8212718…`, BLSAggregator `0xBAc3f249…`.

## Required SDK changes

### 1. Wrap bundler callData with the `executeUserOp` selector (REQUIRED for guard accounts via bundler)
When building a UserOp for a **guard-enabled** account, set:
```
userOp.callData = executeUserOp.selector ++ <execute|executeBatch calldata>
```
The EntryPoint v0.7 routes callData beginning with this selector to `account.executeUserOp(userOp, userOpHash)`. Selector:
```ts
import { toFunctionSelector } from "viem";
const EXECUTE_USER_OP_SELECTOR = toFunctionSelector(
  "executeUserOp((address,uint256,bytes,bytes,bytes32,uint256,bytes32,bytes,bytes),bytes32)"
);
const callData = concat([EXECUTE_USER_OP_SELECTOR, encodeFunctionData({ abi, functionName: "execute", args: [to, value, data] })]);
```
Only `execute` / `executeBatch` may be wrapped — the account reverts `UnsupportedInnerSelector` for anything else (incl. a nested `executeUserOp`). Owner-direct (non-bundler) `execute()` is unchanged. No-guard accounts can still use bare callData. Canonical working example: contract repo `scripts/e2e-v0172/12-userop-bundler.ts`.

### 2. Read the algorithm whitelist from the ACCOUNT, not the guard
- Was: `guard.approvedAlgorithms(algId)`
- Now: `account.approvedAlgorithms(algId)` (account getter). `account.guardApproveAlgorithm(algId)` is unchanged in signature (owner-only, writes the account).

### 3. Guard ABI renamed → consume the regenerated full ABI
The guard is now pure accounting:
- `checkTransaction(value, algId)` → **`recordSpend(value)`** (no algId)
- `checkTokenTransaction(token, amount, algId)` → **`recordTokenSpend(token, amount, algId)`**
- `approveAlgorithm` / `approvedAlgorithms` / `AlgorithmNotApproved` **removed** from the guard.

Most SDK code goes through the account and is unaffected. Consume the regenerated merged ABI `abi/AAStarAirAccountV7.full.json` (now includes `executeUserOp` + `approvedAlgorithms`; produced by the contract repo's `build-full-abi.mjs` / `pnpm gen:abi-docs`).

## Backward compatibility
Existing beta.3 accounts are non-upgradable EIP-1167 clones bound to the old impl — they keep old behavior (and the old bundler limitation). New accounts must be created from the beta.4 factory to use a standard bundler. No on-chain migration of existing accounts.

## Verification reference
beta.4 Sepolia E2E: Phase 08-12 = 45/45 (account creation, execute/batch, session keys, guardian recovery, ERC-7579 modules, and the guard-enabled bundler UserOp). All transactions Etherscan-verified — see the contract repo's `docs/beta4-e2e-tx-capability-map.md`.
