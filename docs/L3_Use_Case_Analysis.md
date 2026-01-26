# L3 SDK Refinement & Gap Analysis

## Overview
This document analyzes the current state of the L3 SDK against the "Complete Lifecycle Patterns Design" requirements. It identifies gaps, proposes architectural refinements, and outlines a prioritized implementation roadmap.

## 1. Gap Analysis: Current vs. Target

| Role / Pattern | Current State (`USER_CASE_DESIGN.md`) | Target State ("Complete Lifecycle") | Status | Priority |
| :--- | :--- | :--- | :--- | :--- |
| **End User** | Focus on Mint SBT & Gasless TX. Basic client. | **Complete Lifecycle**: Register -> Gasless -> Reputation -> Exit. Query capabilities. | 🔄 Partial | **P0** |
| **Community Admin** | `CommunityLaunchpad` exists. | **Governance & Exit**: Transfer to Multisig, Reputation Rules management. | 🔄 Partial | **P0** |
| **Paymaster Operator** | `OperatorLifecycle` covers setup. | **Exit Strategy**: Withdraw funds, initiate exit. Dynamic config. | 🔄 Partial | **P0** |
| **SuperPaymaster Operator** | Basic client exists (V4). | **Dedicated Manager**: Register, Treasury config, liquidity management. | ❌ Missing | **P1** |
| **Protocol Admin** | Basic scripts. | **Governance**: Global param updates, DAO transfer. | ❌ Missing | **P1** |
| **DVT Operator** | Placeholder in scripts. | **Node Manager**: BLS Key gen, validator set management. | ❌ Missing | **P2** |
| **Reputation Manager** | Basic scoreboard. | **Rule Engine**: Dynamic rule configuration & scoring. | ❌ Missing | **P2** |

## 2. Architectural Refinements

### 2.1 Unified Lifecycle Pattern
Move from ad-hoc "Client" classes to structured "Lifecycle" patterns.
*   **Old**: `UserClient` mixed basic wallet ops with business logic.
*   **New**: `UserLifecycle` extends `UserClient` patterns but strictly follows `onboard` -> `operate` -> `exit` flow.

### 2.2 Gasless-First Design
Gasless should be a configuration option, not a separate class.
```typescript
interface GaslessConfig {
  paymasterUrl: string;
  policy: 'CREDIT' | 'TOKEN' | 'SPONSORED';
}
```
*   **Implementation**: All Lifecycle classes (User, Operator) accept `GaslessConfig` in constructor.
*   **Middlestream**: Use `PaymasterClient` middleware automatically if config is present.

### 2.3 Strict Typing
Enforce return types (e.g., `Promise<Hash>`, `Promise<OnboardResult>`) to standardize API responses for frontend consumers.

## 3. Detailed Refinement Plan (P0 Priorities)

### 3.1 UserLifecycle (The "All-in-One" User)
*   **Goal**: Consolidate `EndUserClient` and disjoint scripts into one clean class.
*   **Key Methods**:
    *   `onboard(community, stakeAmount)`: Wraps Approve GToken -> Stake -> Mint SBT.
    *   `enableGasless(config)`: Activates smart account features.
    *   `leaveCommunity()`: Handles unstaking and SBT burning.

### 3.2 OperatorLifecycle (Enhanced)
*   **Goal**: Add missing "Exit" capabilities to existing logic.
*   **Updates**:
    *   Add `withdrawAllFunds()`: Sweeps ETH and GTokens.
    *   Add `initiateExit()`: Formal unstake process from Registry.

### 3.3 ProtocolGovernance (New Core)
*   **Goal**: Centralize admin functions currently scattered in scripts.
*   **Key Methods**:
    *   `setGlobalParameters()`
    *   `transferToDAO()`

## 4. Documentation Strategy
*   **One Doc Per Pattern**: Create dedicated `.md` files for each Lifecycle pattern in `docs/l3-patterns/`.
*   **Scenario-Driven**: Docs should lead with "How to [Scenario]" rather than method lists.

## 5. Next Steps
1.  **Refactor**: Create `UserLifecycle.ts` implementing the new design.
2.  **Enhance**: Update `OperatorLifecycle.ts` with exit methods.
3.  **Create**: Implement `ProtocolGovernance.ts`.
4.  **Verify**: Build `examples/l3-complete-demo.ts` to test the full flow.
