# 05 · CODEX CHALLENGE — adversarial verdict (v0.20.1)

> Independent adversarial review via `codex:codex-rescue`. Three axes — the standard two from the
> upstream acceptance system plus an SDK-specific one (the maintainer's hard requirement):
> - **AXIS-1 REAL** — the tx exists on-chain, mined, `status` as claimed (verify via Sepolia RPC / etherscan links in [03-RESULTS](./03-RESULTS.md)).
> - **AXIS-2 FEATURE-MET** — the load-bearing L2/L3 state delta actually happened.
> - **AXIS-3 SDK-WRAPPED** — the scenario op went through the SDK's scenario-level API, NOT a hand-written/copied upstream ABI.

## Challenge scope

The committed E2E rewrite (`feat/e2e-sdk-acceptance`, commits `e9c8f31` → `a1129be` → `dba0c4b`):
the 6 on-chain scenarios + the KMS create→sign scenario, the `_rpc.ts` harness, the
`AAStarError` change, and the `parseAbi(AIRACCOUNT_ABI)` finding.

## Findings & resolution

| # | Severity | Finding | Resolution |
|---|---|---|---|
| 1 | **High** | `beta4` `registerAgent`/`revokeAgent` were hand-encoded (`encodeFunctionData({abi: AgentRegistryABI})`) + raw `writeContract(execute)` — bypassing the SDK for the core agent-lifecycle scenario ops | **RESOLVED** (`dba0c4b`): added `AgentRegistryService.encodeRegisterAgentViaAccount`/`encodeRevokeAgentViaAccount` (compose registry call + account.execute); beta4 routes through them; +2 unit tests decoding the execute wrap. Re-verified live (register `0xeed08f22…`, revoke `0xcc46a79d…`). |

## Verdict (re-review after fix)

- **AXIS-3 SDK-WRAPPED — PASS.** Full-diff re-scan found **no remaining scenario-op bypass**
  (Critical/High/Medium/Low all clear). Remaining inline/minimal ABIs are legitimate setup:
  factory provisioning, `owner`/`guardianCount` preflight reads (`AA_SETUP_ABI`), expected-revert
  decoders, the DVT verifier `validate()` read (uses the `@aastar/core` ABI), and beta1 gasless
  driven by `PaymasterClient`/`UserOperationBuilder`/`wrapExecuteUserOp`.
- **AXIS-2 FEATURE-MET** — each scenario asserts its L2/L3 delta (balances/bitmaps/registration/
  recover-match); negative scenarios assert the exact revert.
- **AXIS-1 REAL** — every tx hash in [03-RESULTS](./03-RESULTS.md) is a live Sepolia tx (etherscan
  links). Codex's sandbox has no outbound network, so AXIS-1 is verified human/CI-side via the RPC.

Other axes (calldata correctness, `_rpc.ts` `baseFeeMultiplier:2` + fallback, `AAStarError`,
`AIRACCOUNT_ABI` usage elsewhere): **no findings**.

## Bottom line

**SDK-bypass audit: PASS.** All 7 scenarios are validated through the SDK's wrapped scenario-level
API, with real on-chain evidence, and the one bypass Codex found was fixed and re-verified.
