# SDK E2E Acceptance System

A per-release, evidence-first acceptance system for the AAStar SDK, modelled on the
SuperPaymaster / airaccount-contract acceptance docs. **Its defining rule: every scenario is
driven through the SDK's wrapped scenario-level API — never hand-written or copied-from-upstream
ABIs — so each run proves the SDK wrapper works, not merely that the contract works.**

## The 5-document set (per release, under `docs/e2e/v<version>/`)

| Doc | Purpose |
|---|---|
| `01-TESTDATA.md` | Network, deployed addresses, actors, funding gate, upstream pins, pre-run checklist |
| `02-PLAN.md` | Scenario ↔ **SDK API** mapping + 3-layer (L1 receipt / L2 state / L3 feature) verification; setup carve-outs |
| `03-RESULTS.md` | Real on-chain tx hashes + gas + state deltas, per scenario |
| `04-CAPABILITY-MAP.md` | Feature ↔ tx binding, scoped claims + explicit scope-downs (no overstatement) |
| `05-CODEX-CHALLENGE.md` | Independent adversarial verdict (AXIS-1 REAL · AXIS-2 FEATURE-MET · AXIS-3 SDK-WRAPPED) |

Latest: **[v0.20.1](./v0.20.1/01-TESTDATA.md)** — 7 scenarios (agent / gasless / dvt / kms / session / recovery / weighted), all green, Codex PASS.

## Runners (`tests/regression/onchain-evidence/`)

```bash
pnpm exec tsx tests/regression/onchain-evidence/beta4-agent-lifecycle-e2e.ts   # agent (v0.19)
pnpm exec tsx tests/regression/onchain-evidence/beta1-sponsored-gasless.ts     # gasless
pnpm exec tsx tests/regression/onchain-evidence/dvt-realnode-e2e.ts            # dvt (needs nodes 3001/2/3)
pnpm exec tsx tests/regression/onchain-evidence/beta2-session.ts               # session
pnpm exec tsx tests/regression/onchain-evidence/beta2-recovery.ts              # recovery
pnpm exec tsx tests/regression/onchain-evidence/beta3-weighted-sig.ts          # weighted
KMS_E2E=1 pnpm exec tsx tests/regression/onchain-evidence/kms-account-e2e.ts   # kms create→sign
```

All runners use the resilient transport (`_rpc.ts`: fallback over `SEPOLIA_RPC_URL/2/3` +
`baseFeeMultiplier: 2`) so a single flaky/underpriced endpoint can't false-fail a run.

## Acceptance gate (release-blocking)

A release does NOT meet the bar until, for the target version's `docs/e2e/v<version>/`:

1. **02-PLAN** lists every scenario mapped to its SDK wrapper (no inline scenario ABIs).
2. **03-RESULTS** has a live Sepolia tx (status as expected) for every ✅/⛔ scenario op.
3. **04-CAPABILITY-MAP** scopes claims to what the tx mutated; scope-downs are explicit.
4. **05-CODEX-CHALLENGE** returns AXIS-1 REAL + AXIS-2 FEATURE-MET + AXIS-3 SDK-WRAPPED, all clear
   (iterate with `codex:codex-rescue` until clean).
5. Upstream pins in-sync (`pnpm run upstream:check` exit 0) — see [docs/RELEASE-CHECKLIST.md](../RELEASE-CHECKLIST.md).

Only then may the release be tagged + published.
