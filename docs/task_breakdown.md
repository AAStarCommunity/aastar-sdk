# SuperPaymaster Experiment Task Breakdown

Based on the PhD research requirements and the "Three-Step" (Prepare, Test, Analyze) strategy.

## Phase 0: Foundation & Configuration

- [ ] **0.1. Environment Setup (`.env.v3`)**
    - [ ] Create `projects/env/.env.v3`.
    - [ ] Populate RPC variables (`SEPOLIA_RPC_URL`, `ALCHEMY_BUNDLER_RPC_URL`).
    - [ ] Populate Account Keys:
        - `SUPPLIER_KEY` (Vault)
        - `OPERATOR_JASON_KEY` (AAStar Admin)
        - `OPERATOR_ANNI_KEY` (Bread Admin)
        - `RELAYER_KEY` (Baseline Tester)
    - [ ] Populate Contract Addresses (Superseding `.env` if needed, but prioritizing `shared-config`).

- [ ] **0.2. SDK Architecture Refinement**
    - [ ] Validate `@aastar/shared-config` integration for addresses (`SuperPaymaster`, `MySBT`, `GToken`).
    - [ ] Ensure `@aastar/core` exports `viem` clients configured for Sepolia.
    - [ ] Ensure `@aastar/superpaymaster` exports correct V3 middleware (`paymasterAndData` encoding).

## Phase 1: Preparation (The "Ammo")

- [ ] **1.1. Account Discovery & Funding Script (`scripts/01_prepare_accounts.ts`)**
    - [ ] Load all keys.
    - [ ] **Supplier Check**: Ensure Vault has ETH and GTokens.
    - [ ] **Operator Check**: Ensure Admins have ETH (for minting SBTs).
    - [ ] **Compute Addresses**: Calculate `SimpleAccount` addresses for:
        - `AA_Jason` (SuperPaymaster V3 User)
        - `AA_Anni` (Standard Paymaster User)
        - `AA_Baseline` (Self-Pay User)
    - [ ] **Fund ETH**: Supplier -> All Accounts (small amount for safety/deployment).
    - [ ] **Fund GTokens**: Supplier -> `AA_Jason` (xPNTs).

- [ ] **1.2. Identity Initialization (SBT Minting)**
    - [ ] Check if `AA_Jason` has `MySBT`.
    - [ ] If no: `Operator_Jason` calls `Registry` to mint SBT for `AA_Jason`.

## Phase 2: Testing (The Execution)

- [ ] **2.1. Baseline 1: EOA Transfers (`scripts/02_test_eoa.ts`)**
    - [ ] Use `RELAYER_KEY`.
    - [ ] Perform 20x ERC20 Transfers.
    - [ ] Perform 20x Batch Transfers.
    - [ ] Log metrics.

- [ ] **2.2. Baseline 2: Standard AA (`scripts/03_test_standard_aa.ts`)**
    - [ ] Use `AA_Anni` + Pimlico/Alchemy Paymaster (Verifying Paymaster V4.1).
    - [ ] Perform 20x UserOps.
    - [ ] Log metrics.

- [ ] **2.3. Experiment: SuperPaymaster (`scripts/04_test_superpaymaster.ts`)**
    *Core of the PhD contribution.*
    - [ ] Use `AA_Jason` + `@aastar/superpaymaster` Middleware.
    - [ ] Construct UserOp with `paymasterAndData` (V3 format).
    - [ ] Send to Bundler.
    - [ ] Log metrics (Gas Used, L1 Fee, Time).

- [ ] **2.4. Automation Runner (`scripts/run_daily_experiment.ts`)**
    - [ ] Orchestrate the above scripts.
    - [ ] Add random delays (simulation of real usage).
    - [ ] Output to `data/raw_experiment_data.csv`.

## Phase 3: Analysis (The Result)

- [ ] **3.1. Data Analysis (`scripts/05_analyze_data.ts`)**
    - [ ] Read CSV.
    - [ ] Compute Averages & Standard Deviation.
    - [ ] Compare Cost vs Baseline.
    - [ ] Compare Time vs Baseline.
    - [ ] Generate Markdown Table for Thesis.

## Appendix: Account Roles & Keys

| Role | Variable | Purpose |
| :--- | :--- | :--- |
| **Supplier** | `SUPPLIER_KEY` | Holds test ETH & GTokens. Funds others. |
| **Operator** | `OPERATOR_JASON_KEY` | Admin of AAStar. Mints SBTs. |
| **Relayer** | `RELAYER_KEY` | Performs EOA baseline tests. |
| **AA User 1**| `OWNER_JASON_KEY` | Controls SuperPaymaster AA. |
| **AA User 2**| `OWNER_ANNI_KEY` | Controls Standard Paymaster AA. |
