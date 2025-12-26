# SDK Testing Coverage TODO

This document tracks the test cases and scenarios that were skipped or identified for future coverage during the SDK regression enhancement phase (v2.1.0).

## 1. Skipped Scenarios: Test 5 (V2 Regression)

Test 5 in `run_sdk_regression.sh` was skipped due to persistent `RoleAlreadyGranted` errors arising from local blockchain state conflicts.

### Tracked Interfaces
- `Registry.registerRoleSelf(bytes32 roleId, bytes roleData)`
- `SuperPaymaster.notifyDeposit(address community, uint256 amount)`

### Background Context
The test attempts to register the `ROLE_COMMUNITY` and `ROLE_PAYMASTER_SUPER` roles. Even with `hasRole` guards, the transaction reverts if the address is already registered in a previous run with different metadata or state.

### Action Plan
- [ ] Reset local Anvil state (`forge script scripts/SetupV3...` with fresh accounts).
- [ ] Re-enable Test 5 in `run_sdk_regression.sh`.
- [ ] Verify `notifyDeposit` balance updates on-chain.

## 2. Technical Debt: Core Constants Synchronization

- **Role Hash Discrepancy**: Standardize the generation of hashes across `core/constants.ts` and `Registry.sol`.
- **Wallet Client Export**: `createAAStarWalletClient` is currently omitted from `core` in favor of SDK-level role clients (`createAdminClient`). Evaluate if a generic public wallet constructor belongs in `core`.

---
*Created: 2025-12-26*
