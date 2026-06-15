# Contract Gaps Proposal — MySBT & Registry (Beta3.1 SDK Integration)

> **Status:** Proposal / feasibility assessment. READ-ONLY analysis of contract source.
> **No `.sol` files were edited; no branch switch; no commit.**
> **Contract source assessed:**
> - `SuperPaymaster/contracts/src/tokens/MySBT.sol` (`MySBT-3.2.0`)
> - `SuperPaymaster/contracts/src/core/Registry.sol` (`Registry-5.3.3`)
> **Directive applied:** *"Where there is contract SPACE, add the setter back; where there is NO space, solve via event indexing (SDK side)."*

---

## Key upgradeability facts (decides every verdict)

| Contract | Upgradeable? | Storage gap? | Consequence for adding storage |
|---|---|---|---|
| **MySBT** | **NO.** `contract MySBT is ERC721, ReentrancyGuard, Pausable, IVersioned` (MySBT.sol:33). No `Initializable`/`UUPSUpgradeable`. Core pointers are `immutable` set in the constructor (`GTOKEN`, `GTOKEN_STAKING`, `REGISTRY` — MySBT.sol:119-123, 177-188). | **NONE.** No `uint256[N] __gap` exists anywhere in the file. | Any new storage var is **source-feasible but only takes effect on a FRESH redeploy**. There is no proxy upgrade path. A redeploy abandons all live SBT state (`userToSBT`, `sbtData`, `_m`, `membershipIndex` — MySBT.sol:113-117) unless every token is migrated. **Treat MySBT storage as frozen.** |
| **Registry** | **YES.** `contract Registry is Ownable, ReentrancyGuard, Initializable, UUPSUpgradeable, IRegistry` (Registry.sol:15); `_authorizeUpgrade(address) onlyOwner` (Registry.sol:559). | **YES — `uint256[50] private __gap;` (Registry.sol:564)**, 50 free slots. Note `blacklistNonce` (Registry.sol:562) sits *before* the gap as a normal appended slot, so the gap is intact at 50. | New `mapping`/scalar storage can be appended safely via UUPS upgrade; each `mapping` consumes 1 slot, so decrement `__gap` accordingly. **Registry has real room.** |

**This is the load-bearing distinction:** "add the setter back" is only cheap/safe for **Registry**. For **MySBT** there is no space *and no upgrade path*, so anything requiring new MySBT storage is a redeploy-class change, not a setter add-back.

A second principle constrains Gap 1: **event indexing can only substitute for a READ (deriving state from emitted history). It cannot substitute for a config WRITE** — a rule setter is an input, not a derivable output. So a "config" gap is either ADD-SETTER (if there is space) or DEFER/off-chain — never EVENT-INDEX.

---

## Summary table

| # | Gap | Verdict | Storage-gap room | Effort |
|---|---|---|---|---|
| 1 | MySBT per-community SBT rule config (`mapping(community => RuleConfig)`) | **DEFER / not in MySBT.** No MySBT space + no upgrade path. If genuinely needed, ADD-SETTER **in Registry** (has `__gap`). Cannot be event-indexed (it's a write). | MySBT: none. Registry: yes (50). | MySBT: redeploy-class (high). Registry: low–medium (1 mapping + setter + event). |
| 2 | MySBT `setMaxSupply` (settable cap) | **DO NOT ADD (keep constant).** `MAX_MEMBERSHIPS` is an intentional per-holder gas-DoS guard, not a supply cap. Making it settable reintroduces unbounded-loop risk. No total-supply cap exists or was removed. | MySBT: none anyway. | n/a — recommend no change. |
| 3 | community→members reverse index / member count | **EVENT-INDEX (SDK side).** Events already exist and the SDK already uses the back-trace pattern. On-chain reverse index is unbounded-array + removal-gas cost, and MySBT is non-upgradeable. | n/a. | Low (SDK only); already partially built. |

---

## Gap 1 — MySBT per-community SBT rule config

### Current state
- **Global-only economic rules** live in MySBT as two scalars:
  - `uint256 public minLockAmount = 0.3 ether;` (MySBT.sol:129)
  - `uint256 public mintFee = 0.1 ether;` (MySBT.sol:130)
- **Existing setters (the only ones that exist), both `onlyDAO`:**
  - `setMinLockAmount(uint256 a)` (MySBT.sol:524-529) → emits `MinLockAmountUpdated` (MySBT.sol:101).
  - `setMintFee(uint256 f)` (MySBT.sol:531-535) → emits `MintFeeUpdated` (MySBT.sol:102).
  - Access control modifier: `onlyDAO` = `msg.sender == daoMultisig` (MySBT.sol:163-166); `daoMultisig` is itself settable via `setDAOMultisig` (MySBT.sol:537-542).
- **No per-community config struct exists.** The only per-community-ish struct is `CommunityMembership { address community; uint256 joinedAt; bool isActive; string metadata; }` (MySBT.sol:47-52) — that is **per-(token, community) membership state**, not a per-community *rule* config. There is no `mapping(address => RuleConfig)` and nothing to extend in place.
- Communities are **not first-class entities in MySBT at all** — MySBT only knows memberships keyed by `tokenId`. Communities ARE first-class in **Registry**: `roleConfigs` (Registry.sol:31, per-*role* not per-community), `communityByName`/`communityByENS` (Registry.sol:40-41), `roleMembers[ROLE_COMMUNITY]` (Registry.sol:35).

### Upgradeability
- MySBT: **non-upgradeable, no gap** (see top table). A new `mapping(address => RuleConfig)` is source-legal but only live on a full redeploy + SBT migration → redeploy-class effort.
- Registry: **UUPS + `__gap[50]`** → a new mapping is a safe, cheap append.

### Verdict: **DEFER in MySBT; if needed, ADD-SETTER in Registry**
Rationale, by evidence:
1. Cannot event-index it — a rule config is a write/input, not a value derivable from emitted logs.
2. Cannot cheaply add to MySBT — no gap, no proxy; would strand all live SBTs unless migrated.
3. The upgradeable, community-aware home is **Registry** (`__gap[50]`, already owns `communityByName`, `roleMembers[ROLE_COMMUNITY]`). MySBT mints already flow **through** Registry (`Registry.registerRole → MYSBT.mintForRole`, Registry.sol:265; `safeMintForRole → MYSBT.airdropMint`, Registry.sol:342), so Registry is the natural enforcement point for per-community overrides.

**Important scoping note:** moving rule *enforcement* to per-community would also require MySBT (which today reads its own `minLockAmount`/`mintFee`) to consult the per-community values — but note MySBT v3 already delegates all staking/financial logic to Registry (`burnSBT` comment "Staking is handled by Registry", MySBT.sol:362; `mintForRole` does "No staking/burning here (Registry handles that)", MySBT.sol:219-229). So the economic rule genuinely belongs in Registry, and MySBT needs no change for enforcement. This is therefore a **planned Registry upgrade**, not a MySBT setter add-back.

### Proposed Solidity (Registry, applied via UUPS upgrade — DRAFT, do not auto-apply)
```solidity
// --- add near the other per-community structs (Registry.sol:20) ---
struct CommunitySBTRule {
    uint256 minLockAmount;  // overrides MySBT.minLockAmount for this community
    uint256 mintFee;        // overrides MySBT.mintFee for this community
    bool    isSet;          // false => fall back to MySBT global defaults
}

// --- new storage: append AFTER blacklistNonce, BEFORE __gap, and shrink the gap ---
// (consumes 1 slot; change `uint256[50] private __gap;` -> `uint256[49] private __gap;`)
mapping(address => CommunitySBTRule) internal communitySBTRules;

event CommunitySBTRuleUpdated(
    address indexed community,
    uint256 minLockAmount,
    uint256 mintFee
);

/// @notice Set per-community SBT economic overrides.
/// @dev Access control mirrors configureRole (Registry.sol:365-371):
///      the community's own role owner OR the contract owner may set it.
///      Here we gate on the community itself or contract owner.
function setCommunitySBTRule(address community, CommunitySBTRule calldata rule)
    external
{
    // Only the community account itself or the protocol owner can configure.
    if (msg.sender != community && msg.sender != owner()) revert Unauthorized();
    if (!hasRole[ROLE_COMMUNITY][community]) revert RoleNotGranted(ROLE_COMMUNITY, community);
    communitySBTRules[community] = CommunitySBTRule(rule.minLockAmount, rule.mintFee, true);
    emit CommunitySBTRuleUpdated(community, rule.minLockAmount, rule.mintFee);
}

/// @notice Read effective per-community rule, falling back to MySBT globals.
function getCommunitySBTRule(address community)
    external view returns (uint256 minLockAmount_, uint256 mintFee_)
{
    CommunitySBTRule memory r = communitySBTRules[community];
    if (r.isSet) return (r.minLockAmount, r.mintFee);
    return (MYSBT.minLockAmount(), MYSBT.mintFee()); // requires these getters on IMySBT
}
```
- **Access-control modifier chosen:** the `configureRole` pattern (community owner OR protocol `owner()`), reusing the existing `Unauthorized` / `RoleNotGranted` errors (Registry.sol:55, 60). Reuse `onlyOwner` instead if the team wants this to be DAO-only.
- **New event needed for the SDK:** yes — `CommunitySBTRuleUpdated`, so the SDK can index current rules without an archive scan.
- **`__gap` impact:** `uint256[50] private __gap;` → `uint256[49] private __gap;` (1 mapping slot consumed).
- **Caveat:** `getCommunitySBTRule`'s fallback calls `MYSBT.minLockAmount()/mintFee()`; `IMySBT` must expose those (the public vars exist on MySBT but confirm they are in the interface). If the team prefers zero MySBT/interface coupling, store the global defaults in Registry too.

**Recommendation:** ship only if a concrete product need for per-community SBT economics is confirmed; otherwise keep the global `setMinLockAmount`/`setMintFee` and DEFER. Do **not** touch MySBT for this.

---

## Gap 2 — MySBT `setMaxSupply`

### Current state
- `uint256 public constant MAX_MEMBERSHIPS = 50;` (MySBT.sol:161), with the explicit doc comment: *"Maximum number of community memberships per SBT (gas cap for burnSBT loop)."* (MySBT.sol:160).
- It is a **per-holder membership cap**, enforced on join in both mint paths:
  - `mintForRole`: `if (_m[tokenId].length >= MAX_MEMBERSHIPS) revert TooManyMemberships();` (MySBT.sol:273-274).
  - `airdropMint`: same check (MySBT.sol:339-340).
- The cap exists to bound **two unbounded loops over a holder's memberships**:
  - `burnSBT` iterates `_m[tid]` deactivating each membership (MySBT.sol:353-359).
  - `deactivateAllMemberships` iterates all memberships (MySBT.sol:411-419).
- **There is NO total-supply cap anywhere.** `nextTokenId` increments unbounded (MySBT.sol:128, 244, 308). So "maxSupply" as a *token-supply* cap was never present and was not removed — it is a different, non-existent feature.

### Upgradeability
- MySBT non-upgradeable, no gap. Any change is redeploy-class regardless.

### Verdict: **DO NOT ADD a settable cap (keep `constant`)**
- The immutability is **intentional and security-motivated**, and the reason is visible in code: a per-holder cap is the only thing bounding the `burnSBT` (MySBT.sol:354) and `deactivateAllMemberships` (MySBT.sol:414) loops. If `MAX_MEMBERSHIPS` became a large settable value, a holder could accumulate enough memberships that `burnSBT` exceeds the block gas limit and **bricks role exit** (`Registry.exitRole → MYSBT.burnSBT`, Registry.sol:306) — a DoS.
- This is **not** an SDK-surfaced "removed setter"; it is a deliberate constant. No event-indexing applies (nothing to derive).
- **If** the team ever wants it tunable, the only safe form keeps a hard upper bound and `onlyDAO`, e.g.:
  ```solidity
  // NOT RECOMMENDED — documented for completeness only.
  uint256 public maxMemberships = 50;
  uint256 constant MAX_MEMBERSHIPS_CEILING = 50; // loop-gas safety ceiling, never exceeded
  function setMaxMemberships(uint256 n) external onlyDAO {
      if (n == 0 || n > MAX_MEMBERSHIPS_CEILING) revert InvalidAmount();
      maxMemberships = n; // can only LOWER the effective cap; never weakens the gas guard
  }
  ```
  Even this requires a redeploy (no gap) and adds a storage slot for no real benefit, so the recommendation stands: **keep the constant**.

---

## Gap 3 — community→members reverse index / member count

### Current state
- **No reverse index in MySBT.** Memberships are stored forward-only, keyed by token: `mapping(uint256 => CommunityMembership[]) private _m;` (MySBT.sol:115) and `mapping(uint256 => mapping(address => uint256)) public membershipIndex;` (MySBT.sol:116). To list "members of community X" you would have to scan every token — there is no `community => holders[]` map.
- **Registry has a per-ROLE member list, not per-community:** `mapping(bytes32 => address[]) internal roleMembers;` (Registry.sol:35) with count getter `getRoleUserCount(bytes32 roleId) → roleMembers[roleId].length` (Registry.sol:527). This enumerates *all* `ROLE_ENDUSER` holders globally; it cannot filter by community. The community link only exists inside the per-user `roleMetadata`/registration calldata (`EndUserRoleData { address community; ... }`, Registry.sol:21; decoded at Registry.sol:511-515).

### Events already available to index against (confirmed from source)
- **MySBT:**
  - `MembershipAdded(uint256 indexed tokenId, address indexed community, string metadata, uint256 timestamp)` (MySBT.sol:73-78) — emitted on join/reactivate (MySBT.sol:268, 279, 335, 345).
  - `MembershipDeactivated(uint256 indexed tokenId, address indexed community, uint256 timestamp)` (MySBT.sol:80-84) — emitted on leave/burn (MySBT.sol:357, 397, 417).
  - `SBTMinted(address indexed user, uint256 indexed tokenId, address indexed firstCommunity, uint256 timestamp)` (MySBT.sol:58-63) — joins `tokenId → holder` (since `MembershipAdded` carries `tokenId`, not the holder address). Holder is also readable via `sbtData[tid].holder` / `ownerOf(tid)`.
- **Registry:**
  - `RoleRegistered(roleId, user, burnAmount, timestamp)` — emitted on register (Registry.sol:267, 344). For `ROLE_ENDUSER` the community is recoverable from the originating `registerRole` calldata (`EndUserRoleData.community`).
  - `RoleExited(roleId, user, exitFee, timestamp)` (Registry.sol:325) — removal signal.

### Already solved by the SDK — DO NOT duplicate
The SDK already implements exactly the `RoleRegistered → tx → decode calldata` back-trace:
- `getCommunityProfile` in `packages/core/src/actions/registry.ts:453-533` (documented at registry.ts:40-42: *"recovered via the event->calldata back-trace pattern: locate the `RoleRegistered(ROLE_COMMUNITY, community)` log, fetch the originating transaction, then decode its `registerRole` calldata"*). It uses `getLogs` + `decodeFunctionData(RegistryABI, ...)` (registry.ts:469, 499).

So the indexing infrastructure for membership derivation **already exists**; member enumeration just extends the same pattern.

### Upgradeability
- MySBT non-upgradeable → an on-chain reverse index there is redeploy-class.
- Even in Registry (which has a gap), a `community => address[]` index adds an **unbounded array** plus swap-pop removal gas on every enduser join/exit — non-trivial and growth-unbounded.

### Verdict: **EVENT-INDEX (SDK side)**
Strongest-evidence verdict of the three:
1. The needed events already exist on both contracts (cited above).
2. The SDK already does the back-trace for community profiles — member enumeration is the same technique.
3. An on-chain reverse index costs unbounded array storage + removal-loop gas, and the most natural home (MySBT) cannot take new storage without a redeploy.

### Event-indexing spec for the SDK
- **Active members of community `C`** = holders whose latest membership event for `C` is `MembershipAdded` (not yet `MembershipDeactivated`):
  1. `getLogs(MembershipAdded, { args: { community: C } })` → set of `tokenId`s joined to `C` (with timestamps).
  2. `getLogs(MembershipDeactivated, { args: { community: C } })` → `tokenId`s that left/were burned.
  3. Active set = added minus those whose last event is a deactivation (compare by block/log order per `tokenId`).
  4. Resolve `tokenId → holder` via `SBTMinted(user, tokenId)` logs, or call `sbtData(tokenId).holder` / `ownerOf(tokenId)` (MySBT.sol:114, 439-441).
- **Member count** = size of the active set above. (No on-chain counter; derived.)
- **Cross-check / alternative source:** Registry `RoleRegistered(ROLE_ENDUSER, user)` + decode `EndUserRoleData.community` from calldata, minus `RoleExited(ROLE_ENDUSER, user)` — same machinery already in `getCommunityProfile`.
- **Suggested SDK surface:** add `getCommunityMembers({ community, fromBlock, toBlock })` and `getCommunityMemberCount(...)` to the registry/community actions, reusing the `getLogs` helper already in `registry.ts`. No contract change required.

---

## Bottom line

- **Gap 1 (per-community rule):** can't be event-indexed (it's a write); can't cheaply go in MySBT (no gap/no proxy). If product-justified, **ADD-SETTER in Registry** (consume 1 `__gap` slot, `CommunitySBTRuleUpdated` event, `configureRole`-style access control). Otherwise **DEFER** — global `setMinLockAmount`/`setMintFee` stay.
- **Gap 2 (`setMaxSupply`):** **keep the constant.** `MAX_MEMBERSHIPS` is a deliberate per-holder gas-DoS guard for the `burnSBT`/`deactivateAllMemberships` loops; making it large+settable can brick role exit. No supply cap was ever removed.
- **Gap 3 (member enumeration):** **EVENT-INDEX.** Events exist (`MembershipAdded`/`MembershipDeactivated`/`SBTMinted`; `RoleRegistered`/`RoleExited`) and the SDK already runs this exact back-trace in `getCommunityProfile`. Add SDK-side `getCommunityMembers`/`getCommunityMemberCount`; no contract change.
</content>
</invoke>
