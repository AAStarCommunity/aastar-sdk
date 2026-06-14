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
- **Update (⛔ #52 partly outdated):** `RequirementChecker` IS already re-exported from `@aastar/core`'s index (`export * from './requirementChecker.js'`) — the dynamic `import('@aastar/core')` workaround is unnecessary. No export change needed.
- **Solution (shipped Beta3.1 Wave 1):** added `checkResources(wallet, mode: OperatorMode, options?): Promise<ResourceReport>` matching the codebase's real paymaster model — `AOA` = independent operator → `ROLE_PAYMASTER_AOA` + role stake; `AOA+` = shared SuperPaymaster operator → `ROLE_PAYMASTER_SUPER` + role stake + community SBT. **Stake is the on-chain `roleStakes(roleId, operator)` Registry getter, NOT plain GToken `balanceOf`** (Codex-caught: an earlier draft muddled balance vs stake and gave AOA no role check). Per-mode structured `checks` + actionable `issues[]`. Thresholds overridable via `{ requiredStake }`.

---

## P1

### P1.4 — `configureSBTRules()` / `getCommunityStats()` are stubs → 🔨 IMPLEMENTED (partial — contract gaps surfaced)
- **Evidence:** `packages/community/src/index.ts:307,334` both `throw new Error('Not implemented yet…')`.
- **Challenge → confirmed:** MySBT has **NO per-community rule setter**. Its only rule-like setters are protocol-global, owner/DAO-authorized: `setMinLockAmount(uint256)` and `setMintFee(uint256)`. There is NO `setMaxSupply` (`MAX_MEMBERSHIPS` is an immutable per-holder cap, not a configurable supply). So "per-community SBT rules" is a **contract gap**, not an SDK gap.
- **Solution (shipped Beta3.1 Wave 2):** `configureSBTRules` maps `minStake → setMinLockAmount` and `mintPrice → setMintFee` (two txs; documented as GLOBAL, owner/DAO-permissioned — removed an incorrect `ROLE_COMMUNITY` pre-check that would have blocked the legitimate owner); throws a clear contract-gap error when `maxSupply` is requested (needs a new MySBT `setMaxSupply()`). `getCommunityStats` aggregates ONLY real getters: `hasRole(ROLE_COMMUNITY)`, `GTokenStaking.getLockedStake`, `getCreditLimit`, `globalReputation`, `getRoleConfig`, `getRoleUserCount`, `totalStaked`, optional `xPNTs.totalSupply`. **Documented gaps (no getter exists, not invented):** per-community member count and per-member average reputation (MySBT has no community→members reverse index).

### P1.5 — Registry queries (`updateCommunity / getCommunities / getCommunityProfile / isRegisteredCommunity`) → 🔨 PARTIAL + a hard limit
- **Evidence:** `isRegisteredCommunity` / `getCommunities` today are **static-config helpers** (`packages/core/src/communities.ts`, `contracts.ts`), not on-chain registry queries. On-chain `getCommunityByName/ENS` getters are unwrapped.
- **Challenge / hard limit:** **`getCommunityProfile` rich metadata is NOT readable on-chain** — the deployed v5 Registry stores `roleMetadata` as an internal mapping with no public getter (the same limitation found during Beta1 hardening; MySBT only stores the community address, not name/website/logo). So this requirement **cannot be fully satisfied in the SDK** as written.
- **Solution (shipped Beta3.1 Wave 2):** (a) added on-chain wrappers verified against `Registry.json`: `getCommunityByName(name)→address`, `getCommunityByENS(ensName)→address`, `getRoleStake(roleId,user)`, `getEffectiveStake(user,roleId)` (note the deliberate arg-order difference, asserted in tests). (b) **rich profile via event→calldata back-trace (free, own RPC):** `getCommunityProfile(community)` = `getLogs(RoleRegistered, {roleId: keccak256("COMMUNITY"), user: community})` → take latest log → `getTransaction` → `decodeFunctionData` the `registerRole`/`safeMintForRole` calldata → extract `roleData` → decode the `CommunityRoleData` tuple `(name, ensName, website, description, logoURI, stakeAmount)`. **Layout CONFIRMED** against the SDK's own encoder `packages/sdk/src/utils/roleData.ts` (not assumed). Returns `null` when no log. (NOT a contract change.)
- **⚠️ Pre-existing bug found (NOT yet fixed):** the legacy `communityByName`/`communityByENS` wrappers in `registry.ts` call function names that **do not exist** in the deployed v5 ABI (real names are `getCommunityByName`/`getCommunityByENS`) — they would revert on-chain. New wrappers are correct; legacy ones left in place + commented to avoid breaking the type surface. **Also dangling (would revert):** `ReputationSystem` `getCommunityScore`/`getUserScore` and `Registry` `getRoleMembers` are wired in the SDK factories but absent from the deployed ABIs.
- **⛔ #52 gaps not SDK-fixable (documented, not invented):** `isRegisteredCommunity(addr)` → use `hasRole(ROLE_COMMUNITY, addr)`; `getCommunities()` enumeration → no on-chain list getter (stays static-config); `getMembership/isMember` → via `getUserRoles`/`hasRole`/`getRoleStake`.

### P1.6 — `getMySBTId` / per-community `getReputation` → 🔨 FIXED (claim was HALF wrong)
- **Verification result (Beta3.1 Wave 2):** the "already shipped" claim was **inaccurate**.
  - `getMySBTId` (`packages/identity/src/mysbt.ts:35`) was a **do-nothing stub** — body was `return null` with no contract call. The YAA #52 ask was **legitimate**, not outdated. **Fixed:** now calls `getUserSBT(user)` via `MySBTABI`, returns the tokenId or `null` on the `0` sentinel / error. +6 tests.
  - `getReputationBreakdown(user, community, timestamp)` (`reputation.ts:37`/`:235`) **was** correct — returns `{baseScore, nftBonus, activityBonus, multiplier}`, ABI/selector/arg-order all verified. +3 tests.
- **Status:** safe to close now (after the getMySBTId fix), but it was NOT a no-op.

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
