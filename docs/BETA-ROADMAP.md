# AAStar SDK — Beta Roadmap (Beta 1–5)

> Integration of the three upstream stacks — **AirAccount contract**, **SuperPaymaster**,
> **KMS** — into the SDK, staged from foundation → extension, simple → complex.
>
> **Maintained by:** jason · **Status as of:** 2026-06-14

---

## Core principles (acceptance bar)

1. **On-chain evidence over unit tests.** A capability is only "done" when there is a
   **Sepolia transaction hash, verifiable on Etherscan**, for its real flow. Unit tests
   (mocked) are supporting, NOT acceptance.
2. **Foundation first.** Beta1/2/3 must reach the on-chain-evidence bar **before** Beta4/5.
3. **Simple → complex.** Owner/guardian direct txs (no bootstrap) → sponsored gasless
   (needs SBT/xPNTs bootstrap) → full agent lifecycle → coverage tooling.
4. **Third-party challenge.** Every milestone's correctness + coverage is challenged by an
   independent model (Codex), not just self-asserted.
5. **No self-approve.** PRs merge only after an independent human/bot review approves.

Every capability flow lands a script under `tests/regression/onchain-evidence/` and appends
to **`docs/onchain-evidence.md`** (capability → tx hash → Etherscan link → block).

---

## Roadmap overview

| Beta | Scope | Code | On-chain evidence | Acceptance |
|---|---|---|---|---|
| **1** | Basic gasless (bundler-compat) | ✅ done (PR #56) | ⚠️ partial — executeUserOp **self-funded** tx exists; **sponsored** gasless NOT proven | sponsored gasless tx on Etherscan |
| **2** | Social recovery + related optimizations | ✅ done (PR #55) | ❌ none | recovery + P256-session flow tx hashes |
| **3** | Infra governance foundations (SP governance/timelock, weighted-sig, agent-registry) | ✅ done (PR #57) | ❌ none | governance/weighted/register flow tx hashes |
| **4** | **All agent capabilities** (full agent lifecycle) | ⬜ not started | ❌ none | end-to-end agent lifecycle tx hashes |
| **5** | **100% doc alignment** (KMS API + SP ABI + AirAccount ABI) | ⬜ not started | n/a | programmatic coverage % + gap list + Codex challenge + CI gate |

Existing on-chain evidence (Beta1, verified 2026-06-13, Sepolia):
- executeUserOp UserOp via bundler — tx `0x158843957c53e2633fe6e48569d289b63086ea5fd4a8de73ad51ee0ffce0eeae` (status 0x1, block 11051418, to EntryPoint). **Self-funded** (account paid its own gas).
- beta.4 account deploy — tx `0x104f97d43dd1f92e43b82cf1b877892c66357520f786f5505aedd2f317974e0d` (block 11051414, to factory `0x3a91…`).

---

## Phase 0 — Foundation hardening: on-chain evidence for Beta1/2/3 (DO FIRST)

Goal: replace "unit tests only" with **real Sepolia tx hashes** for everything already built.
Build a reusable on-chain harness (extending the working `tests/regression/l4-beta4-gasless.ts`)
+ a tx-evidence report. Parallelizable using distinct funded EOAs (JASON/ANNI/BOB/JACK/…) to
avoid same-EOA nonce conflicts.

### 0.1 — Beta2 on-chain (simplest: owner/guardian direct txs, no bootstrap) — PARALLELIZABLE
- [ ] 0.1.a Social recovery full flow: deploy beta.4 account → `addGuardian` ×2 → guardian
  `proposeRecovery(newOwner)` → 2nd guardian `approveRecovery` → after timelock
  `executeRecovery` (owner changes on-chain). Tx hash for each step. (Timelock = 2 days —
  for evidence, either use a short-timelock test deployment or capture propose/approve txs +
  document the timelock wait; verify `activeRecovery()` state on-chain.)
- [ ] 0.1.b P256/passkey session: `grantP256SessionDirect` (owner) → `isP256SessionActive` true
  → `revokeP256Session`. Tx hashes.
- [ ] 0.1.c secp256k1 session (regression for the tuple fix): `grantSessionDirect` → active →
  `revokeSession`. Tx hashes (proves the Session-tuple fix works on-chain, not just in unit tests).

### 0.2 — Beta3 on-chain (medium: direct + operator-gated) — PARALLELIZABLE
- [ ] 0.2.a Weighted-signature governance: `setWeightConfig` → `proposeWeightChange` →
  `approveWeightChange` → `executeWeightChange`. Tx hashes + on-chain `weightConfig()` read.
- [ ] 0.2.b Agent registry: `registerAgent` → `isRegisteredAgent` true → `getHumanOwner`. Tx hashes.
- [ ] 0.2.c SP governance (safe subset on a controllable SP, or read-only verification of the
  timelock state machine where writes need the protocol owner). Document which need owner rights.

### 0.3 — Beta1 hardening (hardest: sponsored gasless, needs bootstrap)
- [ ] 0.3.a Bootstrap sponsorship eligibility for a beta.4 account: SBT membership + xPNTs
  balance + community/operator registration (the SuperPaymaster sponsorship preconditions).
- [ ] 0.3.b Run a **SuperPaymaster-sponsored** gasless UserOp (paymasterAndData set; account
  pays 0 gas). Tx hash proving the paymaster sponsored it.

**Phase 0 deliverable:** `docs/onchain-evidence.md` with every flow → tx hash → Etherscan link,
and a re-runnable `tests/regression/onchain-evidence/` suite.

---

## Phase 1 — Beta4: all agent capabilities (on-chain proven)

Full agent lifecycle, each step with a tx hash:
- [ ] 1.1 Create agent account: `createAgentAccount` (factory) → verify address + ownership.
- [ ] 1.2 Register in AgentRegistry: `registerAgent` → `isRegisteredAgent` / `getHumanOwner` / `isValidAccount`.
- [ ] 1.3 ERC-8004 identity: `mintAgentIdentity` (official registry) → `bindERC8004AgentWallet`.
- [ ] 1.4 Agent session key: create/grant a P256 or agent session for the agent account.
- [ ] 1.5 **Agent signs a UserOp**: agent credential (KMS `sign-agent` / session) signs a
  userOpHash → submit via bundler → lands on-chain (the headline agent-economy flow).
- [ ] 1.6 Reputation: `submitAgentReputation` → `queryAgentReputation`.
- [ ] 1.7 KMS agent-key lifecycle on the live KMS (create-agent-key → sign-agent → refresh → revoke),
  using the test passkey from `~/Dev/aastar/AirAccount/.env.kms-test`.

**Beta4 deliverable:** an `agent-lifecycle` on-chain evidence report (every step → tx hash).

---

## Phase 2 — Beta5: 100% doc alignment (KMS + SP + AirAccount)

- [ ] 2.1 **Coverage checker** (`scripts/coverage/check-doc-coverage.ts`): parse
  - KMS `~/Dev/aastar/AirAccount/kms/docs/api/openapi.yaml` (every endpoint),
  - SuperPaymaster `~/Dev/aastar/SuperPaymaster/docs/abi/` (reference.md / selectors.md / JSON ABIs, every function),
  - AirAccount `~/Dev/aastar/airaccount-contract/docs/abi/` (every function),
  map each to an SDK wrapper (method/action/ABI fragment), and **output a real coverage % + a gap list** (machine-generated, not qualitative).
- [ ] 2.2 Close gaps to 100% — implement missing wrappers, OR mark **explicit exemptions**
  (internal-only / admin-only / not-deployed / HTML-page) with a documented reason. Known
  deferred: DVT on-chain BLS pubkey registry (needs YetAnotherAA-Validator `AAStarValidator`
  ABI synced into `@aastar/core`); KMS `/UnfreezeKey` (not yet in openapi).
- [ ] 2.3 **Codex independent challenge** of the coverage conclusion ("is it really 100%? what's missing?").
- [ ] 2.4 **CI drift gate**: a CI job runs the coverage checker; coverage dropping below the
  agreed threshold (100% minus documented exemptions) fails the build.

**Beta5 deliverable:** `docs/coverage-report.md` (per-doc coverage %, gap list, exemptions) + the CI gate.

---

## Execution / parallelization notes

- Phase 0.1 and 0.2 sub-tasks are independent on-chain flows → run in **parallel agents**,
  each with a **distinct funded EOA** (JASON / ANNI / BOB / JACK / BROWN / CHARLIE) and a
  unique CREATE2 salt so accounts and nonces don't collide.
- The working sign+submit machinery is already proven in `tests/regression/l4-beta4-gasless.ts`
  (EIP-191 owner sig over userOpHash; executeUserOp wrap; self-funded). Reuse it.
- 0.3 (sponsored gasless) and Phase 1 (agent lifecycle) have on-chain dependencies between
  steps → mostly sequential within a flow, but different flows can still parallelize.
- Phase 2 (coverage tooling) is analysis, not on-chain → can run alongside Phase 0/1.
- Every PR: build → unit test → **on-chain evidence run** → Codex challenge → PR (no self-approve).
