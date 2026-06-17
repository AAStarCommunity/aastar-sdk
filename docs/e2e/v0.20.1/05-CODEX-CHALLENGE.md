# 05 · CODEX CHALLENGE — adversarial acceptance verdict (v0.20.1)

> This is a **performed** challenge-style acceptance, not a documented intent. The comprehensive
> on-chain transaction records ([03-RESULTS](./03-RESULTS.md)) + scenario criteria ([02-PLAN](./02-PLAN.md))
> were RPC-verified into [`logs/rpc-verify.json`](./logs/rpc-verify.json) and handed to an
> independent adversarial reviewer (`codex:codex-rescue`) which tried to REFUTE them on three axes:
> - **AXIS-1 REAL** — tx exists on-chain, `status` as claimed, receipt `to` matches the scenario's contract.
> - **AXIS-2 FEATURE-MET** — the load-bearing on-chain state delta / call result actually proves the feature.
> - **AXIS-3 SDK-WRAPPED** — the scenario op went through the SDK's scenario-level API (see the separate code audit on PR #84).

## How AXIS-1 was made verifiable

Codex's sandbox has no outbound network, so `scripts/e2e-acceptance-verify.ts` fetched the live
Sepolia ground truth into `logs/rpc-verify.json`: **25 tx receipts** (status/to/gasUsed/block/logs),
re-read **state** (`gasless.ethBalance=0`, recovery/weighted `approvalBitmap=0x3`), **live timelock
gates** (an `executeRecovery`/`executeWeightChange` eth_call that STILL reverts with the exact
selector — `0xaa40cfc6` RecoveryTimelockNotExpired / `0xac2edbf6` WeightChangeTimelockNotExpired,
both `matches=true`), and the **DVT/KMS service results** (`services.dvt.validate=0`/`negControl=1`;
`services.kms` recover==TEE address) with fresh run logs `dvt-run.txt` / `kms-run.txt`.

## Acceptance rounds

| Round | Verdict | Blockers found → fixed |
|---|---|---|
| 1 | REJECT | rpc-verify.json incomplete: missing B2/B3 propose/approve receipts, no timelock-revert proof, no DVT/KMS fields, no L2 state |
| 2 | REJECT | 2 left: KMS docs referenced a stale KeyId/addr (contradicted evidence); A1/B1 intermediate state was runner-asserted only |
| 3 | **ACCEPT** | KMS docs updated to the current KeyId `e3d3e7be…`/`0xD7820A31…`; A1/B1 L3 honestly scoped (receipt+event-log confirmed; intermediate read runner-asserted) |

## Final per-scenario verdict

| Scenario | AXIS-1 | AXIS-2 | Note |
|---|---|---|---|
| A1 Agent lifecycle | REAL | MET (scoped) | 3 txs success; register/revoke emitted AgentRegistry events; intermediate `isRegisteredAgent` runner-asserted |
| A2 Gasless | REAL | MET | bundle→EntryPoint; `account ETH==0` re-read on-chain |
| A3 DVT (+ ⛔ neg) | REAL | MET | `validate=0` accepted; tampered `=1` rejected (live verifier `0x68c381Ad`) |
| A4 KMS create→sign | REAL | MET | `recover==TEE address` (KeyId `e3d3e7be…`) |
| B1 Session keys | REAL | MET (scoped) | 5 txs success + events; intermediate `isSessionActive` runner-asserted |
| B2 Social recovery ⛔ | REAL | MET | 2-of-3 `approvalBitmap=0x3`; live `executeRecovery` reverts `RecoveryTimelockNotExpired` |
| B3 Weighted ⛔ | REAL | MET | 2-of-3 `approvalBitmap=0x3`; live `executeWeightChange` reverts `WeightChangeTimelockNotExpired` |

## Accepted scope-downs (release-gate acceptable)

- Recovery / weighted final `execute` after `executeAfter` not completed (2-day timelock) — the **gate** is proven.
- DVT is an `eth_call` (verifier acceptance), not a settled UserOp through the DVT path.
- Gasless uses the standalone PaymasterV4, not the v5.4 SuperPaymaster proxy.
- KMS positive signing uses a software passkey; `deleteKey` returns 400 (cleanup, flagged).

## Bottom line

**ACCEPT.** All core on-chain txs verified via `rpc-verify.json`; docs ↔ evidence consistent; every
runner-asserted item honestly labelled. **The v0.20.1 E2E evidence passes the release gate.**
