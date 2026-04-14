# Paper3 v7.9 — Alchemy Controlled Baseline Run Book

**Branch**: `feat/paper3-controlled-baseline` (based on `0c48717`)
**Purpose**: Close the cross-system validity gap in v7.8 where the Alchemy baseline (n=50) was passively scanned from EP v0.6 + heterogeneous accounts.
**Output**: n≈20 controlled Alchemy Gas Manager samples on EP v0.7 + SimpleAccount, same conditions as V4/SuperPM.

---

## TL;DR

```bash
# One-time setup (5 min)
cp env.op-mainnet.controlled.example .env.op-mainnet.controlled
# Edit: ALCHEMY_PAYMASTER_POLICY_ID + ALCHEMY_RPC_URL_OP + JASON_AA

# Optional: validate Alchemy connectivity without submitting
bash scripts/run_alchemy_controlled.sh --dry-run

# Full run (~15 min for n=22 on OP mainnet)
bash scripts/run_alchemy_controlled.sh
```

---

## Pre-flight checklist

### 1. Alchemy account

- [ ] Alchemy app created on **Optimism Mainnet** (not sepolia)
- [ ] Sponsorship policy created in Gas Manager
  - [ ] EntryPoint: v0.7 (`0x0000000071727De22E5E9d8BAf0edAc6f37da032`)
  - [ ] Allowlist contains **Jason AA** (`0xe8ea...6898b` or your actual AA address)
  - [ ] Per-UO cap ≥ $0.05
  - [ ] Max count ≥ 30 (n=22 + 8 slack)
- [ ] Policy ID copied to `ALCHEMY_PAYMASTER_POLICY_ID`

### 2. cast wallet

- [ ] `cast wallet list` shows `optimism-deployer`
- [ ] You remember the password
- [ ] `DEPLOYER_ADDRESS` in `.env.op-mainnet` matches your deployer

### 3. Chain state

- [ ] Jason AA has sufficient **USDC balance** on OP Mainnet:
      need ≥ `n × 0.001 USDC = 0.022 USDC` for n=22
- [ ] Jason AA is already **deployed** (check on Optimistic Etherscan)
- [ ] **Do NOT fund Jason AA with ETH** — Alchemy pays gas via the sponsorship policy

### 4. Files in place

- [ ] `scripts/l4-alchemy-controlled-op-mainnet.ts` (new)
- [ ] `scripts/run_alchemy_controlled.sh` (new, executable)
- [ ] `env.op-mainnet.controlled.example` (new, template)
- [ ] `.env.op-mainnet.controlled` (your filled-in copy; **gitignored**)

---

## How it works (architecturally)

```
  ┌─────────────────────────────────────────────────────────────┐
  │  l4-alchemy-controlled-op-mainnet.ts                        │
  │                                                              │
  │   For i in 1..n:                                             │
  │     1. read Jason AA nonce from EntryPoint                   │
  │     2. alchemy_requestGasAndPaymasterAndData  (1 HTTP call)  │
  │        → returns {paymaster, paymasterData,                  │
  │                   all gas params}                            │
  │     3. pack paymasterAndData (EP v0.7 layout)                │
  │     4. compute userOpHash                                    │
  │     5. cast wallet decrypt + sign userOpHash                 │
  │     6. eth_sendUserOperation  (1 HTTP call, no retry)        │
  │     7. eth_getUserOperationReceipt  (poll)                   │
  │     8. append to CSV (v2 schema, Label=B1_ALCHEMY_CONTROLLED)│
  │     9. random delay 15-25s, next run                         │
  │                                                              │
  │   On failure: log, continue. Overprovision n=22 → target 20. │
  └─────────────────────────────────────────────────────────────┘
              │
              ▼
  ┌─────────────────────────────────────────────────────────────┐
  │  collect_paymaster_baselines.ts --tx-hashes-csv  (reverse)  │
  │                                                              │
  │   Read CSV tx hashes → re-fetch UserOperationEvent on-chain  │
  │   → extract `actualGasUsed` (the paper's primary metric)     │
  │   → output second CSV for stat_analysis.ts                   │
  └─────────────────────────────────────────────────────────────┘
```

**Key design decisions**:
- **No SDK modification**. Does not touch `PaymasterClient`, `BundlerCompat`, or anything in `packages/paymaster/` — follows the `scripts/03_test_standard_aa.ts` pattern.
- **No retry on Alchemy side**. Alchemy returns gas params it believes are correct; if the bundler rejects, the run logs the error and continues to the next one. Accepts ~5-10% failure rate; use overprovisioning.
- **cast wallet only**. Password is requested once from terminal; the derived key stays in-process for all subsequent runs in the same invocation.
- **CSV schema compatibility**. Output matches `gasless_data_collection.csv` v2 schema (`Timestamp,Label,TxHash,GasUsed(L2),L2ExecutionFee(Wei),L1DataFee(Wei),TotalCost(Wei),TotalCost(ETH),xPNTsConsumed,TokenName`), so `stat_analysis.ts` can consume it after a simple concatenation.

---

## Step-by-step run

### Step A — Dry run (validates Alchemy policy without spending)

```bash
bash scripts/run_alchemy_controlled.sh --dry-run
```

Expected output: after one successful `alchemy_requestGasAndPaymasterAndData` call, script prints:
```
✅ Sponsored!
   Paymaster:   0x2cc0c7981D846b9F2a16276556f6e8cb52BfB633
   PVG:         ...
   CallGas:     ...
   PMVerGas:    ...
🔬 DRY RUN: stopping before submit.
```

If the sponsorship request fails, fix the policy before proceeding. Common issues:
- Policy EntryPoint is v0.6 not v0.7
- Policy allowlist doesn't include Jason AA
- Policy max count exceeded

### Step B — Full run

```bash
bash scripts/run_alchemy_controlled.sh
```

Progress per run (~30-45 seconds each):
```
🚀 Run 1/22
   🔢 Nonce: ...
   ☁️  Requesting Alchemy sponsorship... ✅
   ✍️  userOpHash: 0x...
   📤 Submitting to Alchemy bundler...
   🎯 Submitted! userOpHash: 0x...
   ⏳ Waiting for receipt...
   🎉 Mined! Tx: 0x...
   📊 Recorded.
   ⏳ Random delay: 18s between runs...
```

Total wall-clock: `n × (60s submit + 15-25s delay)` ≈ **18-25 min for n=22**.

**You can Ctrl-C at any time.** Already-recorded runs remain in the CSV. Just re-run with a smaller `--n` to top up.

### Step C — Reverse extraction (automatic in orchestrator)

The orchestrator automatically runs step 2 after step 1 finishes. It calls the existing `collect_paymaster_baselines.ts --tx-hashes-csv` with the submitted CSV, extracting the `actualGasUsed` metric from on-chain `UserOperationEvent` logs (same metric used by the v7.8 paper).

Output:
```
packages/analytics/data/paper_gas_op_mainnet/YYYY-MM-DD/
  alchemy_controlled_simple_erc20.csv            ← from send step (receipt gasUsed)
  alchemy_controlled_actualgas.csv               ← from extract step (paper's primary metric)
  alchemy_controlled_simple_erc20.log            ← per-run log (incl. failures)
```

### Step D — Merge and analyze

```bash
# Append controlled baseline rows to the main gasless dataset
tail -n +2 packages/analytics/data/paper_gas_op_mainnet/YYYY-MM-DD/alchemy_controlled_actualgas.csv \
  >> packages/analytics/data/gasless_data_collection.csv

# Run stats (bootstrap CI + Cliff's delta)
pnpm tsx packages/analytics/scripts/stat_analysis.ts
```

Alternatively, before merging, inspect the new samples manually:
```bash
awk -F, 'NR>1 {print $4}' packages/analytics/data/paper_gas_op_mainnet/YYYY-MM-DD/alchemy_controlled_actualgas.csv | sort -n | head
```

Expected result (for a successful run on OP Mainnet current conditions):
- **mean `actualGasUsed`**: somewhere between 170k and 230k gas (much lower than v7.8 mixed-sample 257k, which was mostly EP v0.6 + Safe/ZeroDev accounts)
- **CI width**: much narrower than v7.8 (±<5k vs ±18k), because all samples use the same account + bundler + EP + selector

---

## Troubleshooting

### "Missing ALCHEMY_PAYMASTER_POLICY_ID"
Edit `.env.op-mainnet.controlled` — paste the UUID from Alchemy Dashboard.

### "Decryption failed for optimism-deployer"
Your cast wallet password was wrong. Try again; the prompt is interactive.

### "alchemy_requestGasAndPaymasterAndData failed: Error: sender is not in policy's allowlist"
Add Jason AA to the policy allowlist in Alchemy Dashboard.

### "eth_sendUserOperation failed: AA23 reverted" or similar paymaster error
Paymaster signature mismatch. This means the Alchemy-returned paymaster signature didn't validate on-chain. Usually due to:
- Policy was modified between fetch and submit (too long a delay)
- Sponsorship expired (~5 min TTL)
- Retry the same sample; should pass.

### "Timeout waiting for receipt"
Bundler didn't include the UserOp within 120s. On OP mainnet this is rare; if it happens, check Etherscan for the `userOpHash` (it may have mined). Adjust timeout in code if your bundler is slow.

### Overall success rate < 80%
Something systematic is wrong. Check `alchemy_controlled_simple_erc20.log` — the failure messages should cluster on one issue. Most common: Alchemy returned paymaster address != your pinned `ALCHEMY_PAYMASTER_ADDR` (contract upgraded). Update the env value and re-run.

---

## After the experiment

Once you have n ≥ 20 rows with Label `B1_ALCHEMY_CONTROLLED` in `alchemy_controlled_actualgas.csv`:

1. Tell me the file path and any notable observations (e.g., "n=20/22 succeeded, 2 timed out")
2. I'll:
   - Compare to v7.8 Alchemy baseline (mean 257,299, EP v0.6 mixed)
   - Compute proper within-EP-v0.7 contrast: Alchemy vs PaymasterV4 vs SuperPaymaster
   - Update v7.9 draft Abstract and §5.3 with the controlled cross-system comparison
   - No more "cross-system 混杂基线" reviewer ammunition

---

## Related files

- `/data/OP_Mainnet_Gas_Analysis_Report.md` — team-authored primary data source
- `/writing/paper3-SuperPaymaster-DSR-Rewrite/v7.9_phase1_complete_archaeology.md` — what's in the SDK, what we're building
- `/writing/paper3-SuperPaymaster-DSR-Rewrite/v7.9_external_paymaster_research.md` — Alchemy/Pimlico API reference
