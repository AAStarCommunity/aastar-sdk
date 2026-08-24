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
- **NEVER publish from local before review — HOTFIXES ARE NOT EXEMPT.** "Production-bricking" /
  "urgent" / "the user reported the exact root cause" do NOT waive §5. Every publish (patch included)
  goes through a PR + self-review + Codex/human approval BEFORE `npm publish`. This rule exists because
  publishing a hotfix from local without review shipped incomplete fixes MORE than once (0.33.1 fixed the
  Tier-1 double-sign but a Codex review of it immediately found Tier-2/3 still broken → 0.33.2; the #258
  M1 "fix" likewise missed the Tier-1 case → #259). A signing/auth-path change is the LEAST exempt of all.
  If production is down, the fastest SAFE path is still: PR → Codex → merge → publish — not a local publish
  you have to re-patch.

## 1. Understand the diff — at SIGNATURE / struct level
- [ ] Authoritative source: the per-version deploy record (`docs/DEPLOYMENT-v<X>.md`) > moving git tag > CHANGELOG table.
- [ ] `pnpm run upstream:check` — radar diffs version + addresses + function/EVENT/error SIGNATURES with tuples expanded. Param/struct changes (e.g. InitConfig tuple, TokenConfig uint128) MUST surface here.
- [ ] Manually diff every changed function's full signature + struct against the upstream forge artifact `out/<C>.sol/<C>.json`.

## 2. Adjust the SDK API for EVERY change (ABI diff → API)
- [ ] Added → wrapper or explicit `NOT_IMPLEMENTED` stub (track the deferral). Removed/relocated → re-route (#30 class). Param/event change → update EVERY encoding site (`rg` the whole repo) + decoders. Re-vendor ABIs (account+factory+extension+validator), addresses, pins, CHANGELOG.

## 3. Static gates (all green)
- [ ] `pnpm -r build` · `pnpm run check:addresses` · coverage 100% · `pnpm -r test` · `pnpm run upstream:check` 4/4 · `viem.getAddress` strict on every changed address.
- [ ] **The three upstream-ABI gates, run with `REQUIRE_UPSTREAM=1`:**
      ```bash
      REQUIRE_UPSTREAM=1 pnpm run abi:sync && \
      REQUIRE_UPSTREAM=1 pnpm run check:abi && \
      pnpm run check:abi-drift:strict
      ```
      These compare against the upstream repos checked out as **siblings** (`../SuperPaymaster`,
      `../airaccount-contract`, `../../mycelium/launch`), `forge build`-ed. They are **not** CI gates
      and cannot be: a runner has none of those repos, and without the flag all three degrade to a
      skip-and-**pass**, printing "in sync with upstream" after comparing against zero artifacts.
      `REQUIRE_UPSTREAM=1` turns that vacuous pass into a hard failure — **always use it here**, so a
      forgotten `forge build` or a missing sibling checkout fails loudly instead of green-lighting a
      release. Rationale is recorded in `.github/workflows/ci.yml`.

      `check:abi-drift:strict` (`--strict`; `REQUIRE_UPSTREAM=1` implies it) closes the finer hole:
      the flag alone only catches "**no** upstream `out/` at all", and an upstream that was
      `forge clean`ed still leaves the other repos' `out/` in place — so `Registry` /
      `BLSAggregator` slid into `skipped` and the gate printed PASS after checking 12 ABIs instead
      of 30 (CC-50). Strict mode fails per contract whose upstream `src/` declares it but whose
      artifact is missing, fails when any `MUST_VERIFY` contract was not actually compared, and
      prints the full checked / skipped-with-reason inventory. **Read the `checked N` line** — a
      PASS with a shrunken count is not a verification.

      Strict mode additionally binds PROVENANCE (CC-50 round-4), because "checked 30, here are
      their sha256s" still could not say *green against what*: the gate once printed all four
      MUST_VERIFY ✅ while the SuperPaymaster worktree had 23 uncommitted changes, `Registry.sol`
      and `BLSAggregator.sol` among them. The chain it now enforces, end to end:

      | link | how |
      |---|---|
      | SDK ABI ⇄ upstream artifact | signature-set comparison (the original drift check) |
      | artifact ⇄ on-disk source | solc `metadata.sources[*].keccak256` recomputed over the working tree |
      | source ⇄ committed revision | `git status --porcelain` must be empty |
      | revision ⇄ reviewed revision | `scripts/upstream-abi-pin.json` → `repos[].revision` |
      | vendored copy ⇄ reviewed copy | `scripts/upstream-abi-pin.json` → `contracts[].abiSha256` |

      Break any link and `--strict` exits 1. **Re-syncing an ABI and updating the pin file are the
      same commit** — that is what makes an ABI swap a reviewable diff instead of a silent one.

      Round-5 closed the remaining hole: a link that is MISSING rather than broken. An artifact with
      no `metadata.sources`, a source the artifact names but that is not on disk, an artifact that
      records no in-repo source at all, or an `out/` that belongs to no git checkout (a tarball,
      a `git archive`, a downloaded CI artifact) each used to be *printed* and never failed — so
      `--strict` could exit 0 having hashed zero source bytes, print `--- upstream revisions (0) ---`,
      tick all four MUST_VERIFY, and still claim *"every artifact hash-matches the sources it
      records"*. Every one of those is now a hard failure for a MUST_VERIFY contract
      (`MUST-VERIFY PROVENANCE INCOMPLETE`), and the unconditional PASS sentence is only printed when
      the whole chain held for all of them. `scripts/repcredit/abi-drift-provenance.test.ts` builds
      a synthetic upstream repo per case and pins both halves: that the fixture reproduces the
      bypassed state, and that the run now fails on it.

      Round-7 removed the last guess and the last overclaim. A MUST_VERIFY artifact must **declare**
      its own source — `metadata.settings.compilationTarget` must be an object with **exactly one
      entry** whose value is the contract name; missing / malformed / empty / naming another
      contract / declaring extra targets / claiming it twice all fail closed
      (`MAIN SOURCE UNDECLARED` / `MAIN SOURCE AMBIGUOUS`), with no `sourceName` or `<Name>.sol`
      fallback to land on an unrelated but correctly-hashed sibling. One correct claim beside an
      extra target fails too: choosing the matching entry out of several is still a guess.
      And because source coverage is enforced for MUST_VERIFY only, the green sentence now reads
      *"all N must-verify artifacts hash-match every source they record"* and any other checked
      artifact with an unestablished binding is printed as an explicit
      `NOT RELEASE-SCOPE CAVEAT` line — **a PASS never claims more than the run enforced.**
- [ ] **The RepCredit evidence-runner gates, with the real YAAA HTTP suite REQUIRED:**
      ```bash
      pnpm run repcredit:typecheck && \
      pnpm run repcredit:abi:check && \
      REPCREDIT_YAAA_HTTP_TEST=1 \
        REPCREDIT_YAAA_DIR=../YetAnotherAA-Validator \
        pnpm run repcredit:test
      ```
      **The flag is not optional here.** Without it, a missing YAAA checkout, a missing/stale
      `dist/main.js`, or a node that fails to boot makes the entire real-HTTP suite — the only
      thing that proves the SDK's HMAC client gets past the upstream admission gate — `it.skip`
      itself, and `repcredit:test` still reports green. `REPCREDIT_YAAA_HTTP_TEST=1` converts every
      one of those into a failure. The same job runs in CI (`repcredit-yaaa-http`) against a pinned
      upstream ref; run it here too, because the release is cut from a local checkout.

      **The reviewed YAAA revision lives in this repo**, not in your shell:
      `scripts/upstream-abi-pin.json` → `services["YetAnotherAA-Validator"].revision`. In required
      mode that pin is authoritative and `REPCREDIT_YAAA_REV` **cannot** redirect the run at another
      commit — disagreeing with the pin is a hard failure, which also makes a drift between the pin
      and the ref `.github/workflows/ci.yml` checks out impossible to miss. (Round-5 LOW-1: with the
      expected revision living only in the environment, a local run with the variable unset verified
      against whatever happened to be checked out — measurably several DVT commits past the revision
      the report named — and reported green.) A local run may still set `REPCREDIT_YAAA_REV` to
      narrow to another commit while a cross-repo round is in flight; the run prints the resolved
      revision **and where it came from**. Moving the reviewed revision means editing the pin in the
      commit that reviews it. The upstream checkout must also be **clean**: the guard pin reads the
      committed blob via `git show`, and a dirty tree makes the built `dist/` unattributable, so
      both are refused rather than silently accepted (CC-50).

      Set `REPCREDIT_ANVIL_TEST=1` as well. It makes the real-anvil `extractRevertData` regression
      a failure rather than a skip when `anvil` is not on PATH. That suite drives REAL viem against
      a REAL chain because the bug it locks down — reading the contract address / decoded args
      instead of the revert bytes on the `readContract` path — is invisible to hand-built error
      objects, and it silently disabled one of the two accepted outcomes of the post-slash BLS
      liveness control (CC-50 round-4 HIGH-1).

      **Two prerequisites of the CI half live OUTSIDE this repo and cannot be verified from it**
      (reviewer INFO, CC-50 round-3): the `repcredit-yaaa-http` job must be a **required** status
      check on the branch protection rule, and `secrets.YAAA_CHECKOUT_TOKEN` must be present. The
      main `test` job's `repcredit:test` step has no YAAA checkout, so it skips the 9 real-HTTP
      cases and exits 0 — the strength of the whole chain is those two settings. Confirm both
      before cutting a release.
- [ ] **`pnpm run check:browser` (MANDATORY, run AFTER the `@aastar/sdk` build) — no Node-only builtin (`child_process`/`fs`/…) statically imported by any browser-facing subpath.** This exists because 0.42.0 shipped a `node:child_process` leak into `@aastar/sdk/operator` that broke downstream browser builds — unit tests run in Node and a narrow-import browser smoke tree-shook it out, so nothing caught it pre-publish. Never publish with this red.

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
Named runners (see `docs/e2e/README.md`): the **Tier-2/3 device-passkey composite** acceptance is
`tests/regression/onchain-evidence/tier3-composite-e2e.ts` (P256 + DVT BLS aggregate + guardian → on-chain
`validateUserOp == 0`, with a real-component negative that isolates the cumulative-format length check, #234).
Any change to the cumulative signature packing (`packCumulativeT2/T3Signature`) or the tiered submit path
MUST re-green this runner before release.

**Removed-function / ABI-drift regression guard (#254):** `tests/regression/onchain-evidence/v022-preparetransfer-guard-read-e2e.ts` drives the REAL guard-checker `preCheck` (the full `prepareTransfer` tiering read path — `guard()`, `tier1Limit()`/`tier2Limit()`, guard daily allowance, `approvedAlgorithms`) against a deployed v0.22.0 account. It exists because #254 shipped twice-incomplete: an upstream sync REMOVED account functions (`getConfigDescription`) but not every SDK caller / human-readable `AIRACCOUNT_ABI` declaration was updated, and unit tests mock the provider so the revert-on-missing-function never surfaced. **Any change that touches `AIRACCOUNT_ABI`, typed-reads, guard-checker, or syncs the account contract MUST re-green this runner** — it reverts the moment an account/guard read function the SDK calls is absent on-chain. RULE: when an upstream sync removes a contract function, grep EVERY caller across packages AND run the full business path (prepareTransfer), not just `validateUserOp`.

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
