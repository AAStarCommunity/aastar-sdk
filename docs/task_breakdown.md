# SuperPaymaster Experiment Task Breakdown

Based on the PhD research requirements and the "Three-Step" (Prepare, Test, Analyze) strategy.

## Phase 0: Foundation & Configuration

- [x] **0.1. Environment Setup (`.env.v3`)**
    - [x] Create `projects/env/.env.v3`.
    - [x] Populate RPC variables (`SEPOLIA_RPC_URL`, `ALCHEMY_BUNDLER_RPC_URL`).
    - [x] Populate Account Key in .env.v3
    - [x] Populate Contract Addresses (Superseding `.env` if needed, but prioritizing `@aastar/shared-config`).

- [x] **0.2. SDK Architecture Refinement**
    - [x] Validate `@aastar/shared-config` integration for addresses (`SuperPaymaster`, `MySBT`, `GToken`).
    - [x] Ensure `@aastar/core` exports `viem` clients configured for Sepolia and all networks.


## Phase 1: Preparation (The "Ammo")

- [x] **1.1. Automated Preparation (The "Ammo") (`scripts/01_prepare_all.ts`)**
    - [x] **Unified Script**: Runs all checks below.
    - [x] **Account Check**: Computes addresses for A, B, C.
    - [x] **ETH Check**: Funds 0.05 ETH from Supplier if low.
    - [x] **Identity Check**: Checks MySBT balance for SuperPaymaster User (C). Mints if missing.
    - [x] **Asset Check**: Checks xPNTs (GToken) balance for SuperPaymaster User (C). Transfers if low.

## Phase 2: Testing (The Execution)
1. Transfer ERC20 Test in sepolia, op sepolia and op mainnet.
2. Perform 48 times ERC20 Transfers, 2 times per hour in random time in one hour.
3. Use Alchemy bundler RPC in .env.v3 as default bundler.
4. Use PIM as erc20 gas token in pimlico paymaster test.
5. Make all scripts for every test and use run_daily_experiment.ts to orchestrate the above scripts.
6. Transfer any ERC20(use aPNTs, get it from supplier) to target receiver: TEST_RECEIVER_ADDRESS in .env.v3.

- [/] **2.1. Baseline 1: EOA Transfers (`scripts/02_test_eoa.ts`)**
    - [ ] Use `PRIVATE_KEY_RELAYER` as test EOA, address: 0xb5600060e6de5E11D3636731964218E53caadf0E.
    - [ ] Log metrics.

- [ ] **2.2. Baseline 2: Standard AA (`scripts/03_test_standard_aa.ts`)**
    - [ ] Use `TEST_SIMPLE_ACCOUNT_A` + `pimlico/permissionless` ,https://docs.pimlico.io/references/bundler/endpoints/eth_sendUserOperation, use PIM as erc20 gas token, get it from supplier, token address: 0xFC3e86566895Fb007c6A0d3809eb2827DF94F751, use Alchemy bundler RPC in .env.v3
    - [ ] Perform 48 UserOps in 24 hours.
    - [ ] Log metrics.

- [ ] **2.3. Experiment: SuperPaymaster (`scripts/04_test_superpaymaster.ts`)**
    *Core of the PhD contribution.*
    - [ ] Use `TEST_SIMPLE_ACCOUNT_B` +Alchemy bundler + Paymaster (Verifying Paymaster V4.1，来自于@aastar/shared-config).
    - [ ] Use `TEST_SIMPLE_ACCOUNT_C` + `@aastar/superpaymaster` get address from @aastar/shared-config, use Alchemy bundler.
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
