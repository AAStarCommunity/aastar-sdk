# Beta 3.1 — YAA (Registry Portal) requirements: verdicts, challenges & plan

> Source: aastar-sdk#52 (YAA↔SDK gap matrix, ~75% covered). YAA = `~/Dev/aastar/YetAnotherAA`,
> a frontend for users / community operators / external users, built on `@aastar/*`.
>
> For each requirement: a **verdict** (✅ have / 🔨 partial-fix / 🆕 build / ⛔ #52 outdated),
> an evidence cite, a **challenge** (is it right / better way?), and the chosen solution.
> Acceptance bar inherited from BETA-ROADMAP: unit tests + (where on-chain) a Sepolia tx hash.

## Legend
✅ already shipped · 🔨 exists but buggy/partial → fix · 🆕 missing → build · ⛔ #52 claim is outdated/wrong

---

## P0 (hard blockers for the YAA operator portal)

### P0.1 — `CommunityClient.issueXPNTs()` is broken → 🔨 FIX
- **Evidence:** `packages/community/src/index.ts:282` calls `createXPNTs(string,uint256,uint256)` via inline `parseAbi` and returns `0x000…000` (`:293`). The real factory fn is `deployxPNTsToken(name,symbol,communityName,communityENS,exchangeRate,paymasterAOA)` — already correct in `packages/core/src/actions/factory.ts:88`.
- **Challenge:** none — clear bug (wrong fn, wrong ABI source [violates "ABIs from @aastar/core"], zero-address return).
- **Solution:** rewrite `issueXPNTs` to call `xPNTsFactoryActions(factory).deployxPNTsToken(...)` and parse the deploy event (`xPNTsDeployed`/`TokenDeployed`) from the receipt to return the real token address. Add a unit test (mock event decode) + ideally a Sepolia tx hash.

### P0.2 — SBT batch mint → 🆕 BUILD (with a challenge)
- **Evidence:** MySBT exposes only `airdropMint` / `mintForRole` — **no on-chain batch**.
- **Challenge:** a naive `batchAirdropMint` that loops `airdropMint` is **N transactions, N signatures, N gas** — NOT atomic. Calling it "batch" is misleading. Also `mintOrAddMembership` mixes two contract calls (mint vs addMembership) — that branching is arguably YAA-domain, not raw SDK.
- **Better solution:** (a) provide `batchAirdropMint(items[], { onProgress, continueOnError })` that is explicitly a **sequential N-tx helper** with per-item result + progress callback + nonce management, and document it is not atomic; (b) if atomicity matters, recommend a **Multicall3 aggregate** path (1 tx) — check whether MySBT calls are `onlyOwner` (multicall must come from the owner) and offer it as an opt-in; (c) implement `mintOrAddMembership` as a thin helper that reads existing SBT then routes to mint vs addMembership.

### P0.3 — `RequirementChecker` export + `checkResources(wallet, mode)` → 🔨 EXPORT + FACADE
- **Evidence:** `packages/core/src/requirementChecker.ts` has the class but it is **not re-exported from `@aastar/core`'s index** (consumers use a dynamic `import('@aastar/core')` to reach it).
- **Challenge:** `checkResources(wallet, mode)` with a string `mode` is loosely typed. Better: a typed `OperatorMode = 'AOA' | 'AOA+'` enum and a structured `ResourceReport` result (per-resource status + remediation hints), not a boolean.
- **Solution:** export `RequirementChecker` from the core index; add `checkResources(wallet, mode: OperatorMode): Promise<ResourceReport>` aggregating role/stake/SBT/token/deposit checks with actionable issues (reuse the PaymasterV4 `checkGaslessReadiness` pattern).

---

## P1

### P1.4 — `configureSBTRules()` / `getCommunityStats()` are stubs → 🔨 IMPLEMENT (with a challenge)
- **Evidence:** `packages/community/src/index.ts:307,334` both `throw new Error('Not implemented yet…')`.
- **Challenge:** `getCommunityStats` is a **multi-contract aggregation** (registry + staking + reputation) — that's analytics, arguably belonging in `@aastar/analytics`, not `@aastar/community`. And `configureSBTRules` depends on what MySBT actually exposes for rule config — need to confirm the contract supports it (if not, it's not an SDK gap, it's a contract gap).
- **Solution:** implement `configureSBTRules` only against the real MySBT rule-setters (confirm they exist; else mark contract-gap). Implement `getCommunityStats` as an aggregation; consider housing it in `@aastar/analytics` and re-exporting, to keep `community` lean.

### P1.5 — Registry queries (`updateCommunity / getCommunities / getCommunityProfile / isRegisteredCommunity`) → 🔨 PARTIAL + a hard limit
- **Evidence:** `isRegisteredCommunity` / `getCommunities` today are **static-config helpers** (`packages/core/src/communities.ts`, `contracts.ts`), not on-chain registry queries. On-chain `getCommunityByName/ENS` getters are unwrapped.
- **Challenge / hard limit:** **`getCommunityProfile` rich metadata is NOT readable on-chain** — the deployed v5 Registry stores `roleMetadata` as an internal mapping with no public getter (the same limitation found during Beta1 hardening; MySBT only stores the community address, not name/website/logo). So this requirement **cannot be fully satisfied in the SDK** as written.
- **Solution:** (a) add on-chain registry-contract query wrappers for what IS readable (`getCommunityByName/ENS`, role config, stake, membership); (b) for the rich profile, give YAA the honest options: **the Registry contract must add a metadata getter**, OR YAA indexes the `registerRole(roleData)` event / an off-chain store. Document clearly.

### P1.6 — `getMySBTId` / per-community `getReputation` → ⛔ OUTDATED, ALREADY SHIPPED
- **Evidence:** `getMySBTId` exists at `packages/identity/src/mysbt.ts:35`; per-community breakdown = `getReputationBreakdown(user, community, timestamp)` at `packages/core/src/actions/reputation.ts:37`.
- **Solution:** verify both work (add a test / read), then **close this #52 item as outdated**.

---

## P2

### P2.7 — ethers→viem adapter + Safe multisig → 🆕 GUIDANCE + EXAMPLE
- **Challenge:** YAA may be on ethers; SDK is viem. Rather than ship an adapter the SDK has to maintain, provide a documented pattern + a runnable example.
- **Solution:** a `docs/` adapter guide (ethers Signer → viem WalletClient) + a verified `@safe-global` signing example; only ship an adapter helper if YAA truly can't bridge.

### P2.8 — `CANONICAL_ADDRESSES` vs `@aastar/shared-config` single source → 🔨 CLARIFY
- **Challenge:** double-maintaining addresses is a real drift risk.
- **Solution:** pick ONE source of truth (recommend `@aastar/core` `CANONICAL_ADDRESSES`) and have `shared-config` derive from it (or vice-versa), documented; add a CI check that they don't diverge.

---

## End-user infra line (mostly already done)
| Ask | Verdict |
|---|---|
| `executeUserOp` callData wrap in `TransferManager` | ✅ shipped (PR #54, `transfer-manager.ts` `wrapExecuteUserOp` flag) |
| beta.4 ABI/address follow-up | ✅ shipped (PR #54/#56) |
| CHANGELOG ↔ code alignment | ✅ shipped (PR #53) |
| paymasterData format (PMv4 72B vs SuperPaymaster 104B) hidden by PaymasterManager | 🔨 partial — packers exist; add a unified `PaymasterManager` that auto-selects the format by paymaster type |
| `APNTS_TOKEN` runtime resolution | 🔨 confirm/add a runtime resolver (SP `pendingAPNTsToken` read exists) |

---

## Beta 3.1 implementation order (wave-based; test each wave before the next)
1. **Wave 1 (P0):** P0.1 issueXPNTs fix → P0.3 RequirementChecker export + checkResources → P0.2 batchAirdropMint. Test wave.
2. **Wave 2 (P1):** P1.5 registry query wrappers (+ document the getCommunityProfile limit) → P1.4 configureSBTRules/getCommunityStats → P1.6 verify+close. Test wave.
3. **Wave 3 (P2 + infra):** P2.8 single-source addresses → P2.7 adapter guide → paymasterData unify → APNTS resolver. Test wave.

Every SDK change: unit test + (where it touches chain) a Sepolia tx hash appended to `docs/onchain-evidence.md`. YAA-side changes kept minimal; surfaced separately. Each requirement was challenged above — confirmed deviations: batch is N-tx (not atomic), getCommunityProfile rich metadata is a contract-gap (not SDK-fixable), getCommunityStats may live in `@aastar/analytics`.
