# Upstream Sync & Release Acceptance — @aastar/sdk

**MANDATORY** whenever any upstream (AirAccount contracts / SuperPaymaster / KMS / DVT
validator) cuts a new release **or does a tag-invisible redeploy**. The SDK is a thin
ABI/address/API-pinned integration layer; **"sync" is NOT "bump addresses"** — it is a
verifiable acceptance ending in **decoded on-chain proof** and a **published** package.

> This checklist exists because the same gaps kept being re-discovered by Codex each sync
> (shallow `status=success` evidence, a missed struct-param change, surfaces never re-run,
> no publish). Codify it; don't re-learn it. Each sync MUST leave a recorded evidence artifact.

## 0. Order of operations — HARD RULE
Understand the COMPLETE diff → adjust the SDK API for **every** change → gates green →
**decode-verified** on-chain E2E across **ALL** surfaces → Codex adversarial rounds until
clean → record → (human-gated) publish.
- NEVER run the E2E before the API is actually updated (the E2E confirms; it is not a discovery tool).
- NEVER report "verified" on `status=0x1` alone — decode the calldata/CREATE2/topic0.
- NEVER call a sync "complete" before publish — until then npm serves the OLD version and consumers have the old addresses.

## 1. Understand the upstream diff — at SIGNATURE / struct level
- [ ] Authoritative source: the per-version **deploy record** (`docs/DEPLOYMENT-v<X>.md`) **>** moving git tag **>** CHANGELOG table (which may hold several stale "Deployed" tables — the radar once read the wrong one).
- [ ] `pnpm run upstream:check` — radar diffs version + addresses + **function/EVENT/error SIGNATURES with tuples expanded**. A param/struct change (e.g. factory `InitConfig` gaining fields) MUST surface here.
- [ ] **Manually** diff every changed function's full signature + every struct against the upstream forge artifact `out/<C>.sol/<C>.json` (the radar is a backstop, not the only check). Especially the **factory `InitConfig` tuple**.
- [ ] Classify each change: **added** / **removed-or-relocated** / **param-or-event-shape-changed**.

## 2. Adjust the SDK API for EVERY change (ABI diff → API)
- [ ] **Added** fn → wrapper, or an explicit `NOT_IMPLEMENTED` stub if deferred (track the deferral in an issue).
- [ ] **Removed / relocated** fn → re-route (#30 class: encode against the account / new target via fallback; never leave an ABI-absent wrapper that reverts on-chain).
- [ ] **Param / struct change** → update **EVERY** encoding site — `rg` the whole repo (`InitConfig`, `approvedAlgIds`, `address[3]`, `encodeAbiParameters`, hardcoded ABI strings, test scaffolds). One missed site = wrong CREATE2 address or revert.
- [ ] **Event shape change** → update vendored ABIs + decoders/types (topic0 moves).
- [ ] Re-vendor ABIs: **account + FACTORY + extension + validator** → `packages/core/src/abis/`. Addresses → `addresses.ts` (single source) + `config.*.json`. Version pins → README table + `addresses.ts` header. `CHANGELOG.md`.

## 3. Static gates (all green)
- [ ] `pnpm -r build` · `pnpm run check:addresses` · `pnpm exec tsx scripts/coverage/check-doc-coverage.ts` (100%) · `pnpm -r test` · `pnpm run upstream:check` (all in-sync).
- [ ] `viem.getAddress` strict EIP-55 on every changed address; each verbatim-equal to the deploy record.

## 4. On-chain E2E — ALL surfaces, DECODE-verified (THE acceptance)
Run **every** relevant evidence script in `tests/regression/onchain-evidence/` against the
synced version on the live testnet, producing **real tx**:
- [ ] `beta2-recovery` (account-create + social recovery)
- [ ] `beta1-sponsored-gasless` (SuperPaymaster sponsored UserOp)
- [ ] `beta2-session` (session keys)
- [ ] `beta3-weighted-sig` (weighted / tiered signatures)
- [ ] `beta4-agent-lifecycle-e2e` (agent account)
- [ ] `kms-account-e2e` (KMS / TEE path)
- [ ] `dvt-realnode-e2e` (DVT BLS `validate`) — requires validator nodes' BLS keys registered on the **new** verifier; if blocked, file an upstream issue and record the block (do not silently skip).

For **each** tx, `status=0x1` is NOT enough — **decode and assert** (use
`scripts/upstream/verify-onchain-evidence.ts`):
- [ ] `tx.to` == the canonical synced contract address;
- [ ] the calldata decodes against the **NEW** ABI with the right fields present (e.g. `InitConfig` has the 8 fields incl. `guardianP256X/Y`);
- [ ] for deploys: the deployed account address == the SDK's `getAddress()` **prediction** (CREATE2 consistency — a 6-vs-8-field encoding mismatch diverges the address);
- [ ] event `topic0` == the **NEW** event signature.
- [ ] **Record** all tx hashes + decode results to `docs/onchain-evidence/<version>.md`.

## 5. Adversarial review
- [ ] Codex (`codex:codex-rescue`) **multi-round** over the diff AND the recorded on-chain evidence; iterate challenge → fix → re-challenge until a clean APPROVE.

## 6. Record + Release
- [ ] Append a row to `docs/UPSTREAM-SYNC.md` (upstream versions, date, what changed, evidence link).
- [ ] Bump `@aastar/sdk` (+ affected packages) via `update-version.sh`; `CHANGELOG.md`; tag + GitHub release stating the compatible upstream versions.
- [ ] **`npm publish` is HUMAN-GATED.** Until published, the sync is NOT live (npm serves the old version). **A sync is "complete" only after publish + a clean `npm i` smoke check against the new contracts.**

---
> Definition of done: a consumer can `npm i @aastar/sdk@latest` and it works on-chain against
> the NEW contracts — proven by **decoded** evidence, not status codes, and reviewed by Codex.
