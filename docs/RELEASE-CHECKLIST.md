# Release & Feature-Acceptance Checklist — @aastar/sdk

**MANDATORY** before any publish, and whenever an upstream cuts a release/redeploy. Modeled on
`airaccount-contract/docs/RELEASE_CHECKLIST.md` + `acceptance-guide.md`: a release is NOT accepted
on green gates — it is accepted only when the **business features are proven on-chain, per scenario,
and an adversarial review (mine first, then Codex) returns REAL + FEATURE-MET for every tx.**

> This file exists because gaps kept recurring (status-only evidence, only-the-changed-surface E2E,
> business context never recorded, Codex used as the primary reviewer, publish-on-rote with no smoke
> check). Codify it; don't re-learn it. Every release leaves a recorded evidence artifact that IS the
> input to the challenge.

## 0. Order of operations — HARD RULE
Understand the COMPLETE diff → adjust the SDK API for every change → static gates green →
**full business-scenario on-chain E2E (incl. negatives), recorded** → **self-review FIRST, then Codex
challenge for REAL + FEATURE-MET** → record → human-gated publish → **`npm i` smoke check via the real
consumer path**.
- NEVER run the E2E before the API is actually updated.
- NEVER report "verified" on `status=0x1` alone — decode + prove the post-state (FEATURE-MET).
- NEVER call a release "done" before publish AND the smoke check pass.
- NEVER hand to Codex before doing my OWN adversarial review.

## 1. Understand the diff — at SIGNATURE / struct level
- [ ] Authoritative source: the per-version deploy record (`docs/DEPLOYMENT-v<X>.md`) > moving git tag > CHANGELOG table.
- [ ] `pnpm run upstream:check` — radar diffs version + addresses + function/EVENT/error SIGNATURES with tuples expanded. Param/struct changes (e.g. InitConfig tuple, TokenConfig uint128) MUST surface here.
- [ ] Manually diff every changed function's full signature + struct against the upstream forge artifact `out/<C>.sol/<C>.json`.

## 2. Adjust the SDK API for EVERY change (ABI diff → API)
- [ ] Added → wrapper or explicit `NOT_IMPLEMENTED` stub (track the deferral). Removed/relocated → re-route (#30 class). Param/event change → update EVERY encoding site (`rg` the whole repo) + decoders. Re-vendor ABIs (account+factory+extension+validator), addresses, pins, CHANGELOG.

## 3. Static gates (all green)
- [ ] `pnpm -r build` · `pnpm run check:addresses` · coverage 100% · `pnpm -r test` · `pnpm run upstream:check` 4/4 · `viem.getAddress` strict on every changed address.

## 4. On-chain E2E — FULL business-scenario set (NOT just the change), recorded
Run the WHOLE evidence scenario set on the **released** version against the live contracts — every
business surface, NOT only the surface you touched: account-create, sponsored gasless, session keys,
weighted/tiered sig, agent lifecycle, social recovery (ECDSA **and** P-256 passkey), mixed-sig
consensus, P-256 main-account create (server-client), KMS, DVT. INCLUDE **negative scenarios**
(wrong sig → rejected, under-tier → reverted, unauthorized → reverted).

For EACH tx, record a **BUSINESS-SCENARIO row** to `docs/onchain-evidence/<version>.md` — modeled on
airaccount-contract's `E2E_RESULTS`: this doc is the **input to the challenge**.

| Scenario (user story) | Feature | Assumptions / params (limits, algId, inputs) | Expected outcome | Result | Tx (etherscan) |
|---|---|---|---|---|---|

For each: `status=0x1` is NOT enough — decode + assert the post-state (the FEATURE actually happened):
- [ ] `tx.to` == the canonical contract; calldata decodes against the NEW ABI with the right fields.
- [ ] deploys: deployed addr == the SDK's `getAddress()` prediction (CREATE2 consistency).
- [ ] the on-chain POST-STATE proves the feature (e.g. `getGuardianP256Key` returns the set key, `guardianCount` changed, recovery event with `guardianIdx` fired, tier limits updated).
- [ ] negatives: the op REVERTED for the right reason.
Tool: `scripts/upstream/verify-onchain-evidence.ts` (extend per surface).

## 5. Adversarial review — MINE first, then Codex; REAL + FEATURE-MET bar
- [ ] **My OWN review FIRST** (see [[feedback_self_review_before_codex]]): read `git diff main...HEAD` line-by-line; cross-check every constant/type/slot/selector/encoding against the contract source; hunt the recurring bug classes (wrong constant, precision loss → CREATE2/fund-stranding, encoding/selector mismatch, missing validation, whitelist/algId omission, residual stale shapes, predicted≠deployed); review the **evidence** — does each tx prove the business feature? Fix my own findings.
- [ ] **THEN Codex** (`codex:codex-rescue`) multi-round over the diff AND the recorded txs: per-tx verify **REAL** (Sepolia RPC: status, `to`, gas) AND **FEATURE-MET** (post-state proves the business feature) AND negatives correctly reverted.
- [ ] **Bar met only when REAL + FEATURE-MET for EVERY tx.** Paste the verdict into the evidence doc.

## 6. Record + Release
- [ ] Append a row to `docs/UPSTREAM-SYNC.md` (for upstream syncs) + ensure the evidence doc is complete.
- [ ] Bump via `update-version.sh`; `CHANGELOG.md`; tag + GitHub release (release body = CHANGELOG + address table + test counts + headline E2E tx + the Codex verdict).
- [ ] **`npm publish` is HUMAN-GATED.** Only the umbrella `@aastar/sdk` is published — the per-package `@aastar/core`/`@aastar/airaccount`/… are `private` (bundled), do NOT publish them.
- [ ] **`npm i @aastar/sdk@<ver>` smoke check via the REAL consumer path** (the umbrella + subpaths: `@aastar/sdk/kms`, `/airaccount`, `/core` — NOT the private sub-packages). Import the new surface + confirm it resolves. A release is "complete" only after this passes.

---

## 7. Known Oversights — DO NOT repeat (each release re-checks)
Real misses that shipped this development cycle:
1. **`status=0x1` treated as proof.** Decode + prove the post-state (FEATURE-MET).
2. **"Comprehensive E2E" run as only-the-changed-surface.** Run the FULL scenario set + negatives.
3. **Tx records were technical, not business.** Record scenario (user story) + assumptions + params + expected outcome per tx.
4. **Codex challenged code, not "is the business feature delivered."** Demand REAL + FEATURE-MET per tx.
5. **Leaned on Codex as the primary reviewer.** Do my OWN adversarial review FIRST.
6. **Published on rote, skipped the smoke check** (0.23.0). Run §6 `npm i` via the umbrella subpaths every time.
7. **A latent struct-type bug (TokenConfig uint256 vs uint128) reverted on-chain** until the E2E caught it — manually diff struct field types vs the forge artifact (§1).
8. **Wrong algId constant (`ALG_PASSKEY_P256=1` vs `0x03`) bricked the whitelist** — cross-check every contract constant by value, not name.
9. **README pointed consumers at private/stale sub-packages** — install instructions must be `@aastar/sdk` + subpaths only.

> Definition of done: a consumer can `npm i @aastar/sdk@latest`, the business feature works on-chain
> (proven per scenario, negatives revert), and the adversarial challenge (mine + Codex) returns
> REAL + FEATURE-MET for every tx.
