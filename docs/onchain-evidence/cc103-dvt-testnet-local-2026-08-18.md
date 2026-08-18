# On-chain evidence — CC-103 committee wire + DVT `testnet-local` co-sign (2026-08-18)

Two things are recorded here:

1. the **CC-103 committee per-signer wire** verified against the LIVE `AAStarCommitteeValidator`, and
2. the **DVT-dependent regression set re-run against locally-hosted DVT nodes**, which is how the
   mandatory `tier3-composite-e2e` release gate was greened while `dvt1/2/3.aastar.io` were returning
   HTTP 530 (cloudflared tunnel down; the node services themselves bind `127.0.0.1:3001-3003`).

Network: Sepolia (11155111). SDK branch `feat/cc103-committee-per-signer-wire` (PR #319).

## DVT node set used

Started by @repo:dvt with `docker-compose.testnet.yml` + a local mesh overlay, detached, no tunnel.
The `nodeId`s are the **already-registered** ones — a local instance must sign with keys whose public
keys are registered on the validator, or the aggregate cannot verify. Verified `isRegistered` on
`0x539B9681aFd5BFbCaa655Fe4c6BdcFe1fa7864bC`:

| endpoint | nodeId | `isRegistered` on 0x539B | `/health` |
|---|---|---|---|
| `http://127.0.0.1:3001` | `0x1f5e41c69465733eeb19341d95853ee6d9295a9e6698f5398d70e509be8f326d` | ✅ | ok |
| `http://127.0.0.1:3002` | `0xe3a4a3af3973b65bc95dd962e767e17592dfb331f3544209676271b188fd9f80` | ✅ | ok |
| `http://127.0.0.1:3003` | `0x96d64ba8240694153c757707732a11ff175380065ddacb6406094c9d5fa5cfce` | ✅ | ok |

`0x539B.getRegisteredNodeCount()` = **11**. Selected via `AASTAR_DVT_ENV=testnet-local`
(`DVT_CONFIG.environments`, mirrored by the DVT repo's `deploy/sdk-dvt-config.testnet.json`).

**No on-chain governance action was taken.** This is the LEGACY T3 path (router `0xA6bdfD17…` →
verifier `0x539B…`); `committeeActive()` stays `false` and `setEpochLength` was NOT flipped. Flipping
belongs to committee E2E (CC-104) and would open the worst intermediate state — see below.

## Committee wire conformance (read-only, no tx)

`tests/regression/onchain-evidence/cc103-committee-e2e.ts` against `AAStarCommitteeValidator`
`0x1A8Db639b5d8Bd5742edB083656EDD56f416cd64`, block **11512203**.

| # | Scenario | Expected | Result |
|---|---|---|---|
| 1 | `TREE_DEPTH` read from chain, never assumed (CC-103 Q4) | 14 → `perSigner = 64 + 14×32 = 512` | ✅ |
| 2 | Every node in the active set yields a 14-sibling proof | 3/3 | ✅ |
| 3 | Each REAL proof folds to the LIVE `runningRoot` | `0xc4c85fc981b683e695983d86586f15a0c93ea0e95e5efd378073d2c3aa3a9be5` | ✅ |
| 4 | SDK-encoded payload re-parses under a mirror of the contract's parser (offsets, stride, slot bound, strictly-ascending) and the re-parsed proofs still fold to that root | round-trip exact | ✅ |
| 5 | **`accountId` absent** from the payload (CC-103 B2) | first word is the signer count | ✅ |
| 6 | Legacy framing byte-identical to pre-committee | unchanged | ✅ |

**Not covered:** a positive `validate()`. `committeeActive() == false` and `requiredQuorum()` returns
the fail-closed sentinel `type(uint256).max`. Unblocking needs BOTH `setEpochLength(N≠0)` AND
`snapshotEpoch()` — with only the flip, `committeeActive` is true but nothing validates.

## DVT-dependent regression set, on `testnet-local`

| Scenario (user story) | Runner | Expected | Result | Evidence |
|---|---|---|---|---|
| A user sends a **Tier-3 composite** (P256 passkey + DVT BLS aggregate + guardian) — the MANDATORY gate for any T2/T3 packing change | `tier3-composite-e2e` | `validateUserOp == 0`; old pre-#234 format rejected | ✅ **PASS** | account `0x4d4754dC80D1FE337C657DC0ba1ad903B6347250` · userOpHash `0x8873551ad4a56f12f1f104baea7faf473d9de063d5dc43e79a4bf3a9d9005818` · composite 514 B (algId `0x05`) · 3/3 co-signed · `validate(new)=0`, `validate(old)=1` |
| The SDK's own node **discovery** finds ≥2 external nodes and the `{ userOp, ownerAuth }` body co-signs + aggregates | `v022-dvt-sdk-path-e2e` | 3 nodes discovered, aggregate 256 B | ✅ **PASS** | 3/3 co-signed, aggregate 256 B |
| An operator **registers** a DVT node (idempotent re-run) | `dvt-register-e2e` | `isRegistered=true`, operator owns node | ✅ **PASS** | node `0xad6e924e88001358fa3f642f55ed844da89a06fc8f37c2cf42870d5c88979f82`, operator `0x084b5F85A5149b03aDf9396C7C94D8B8F328FB36` |
| A community **onboards** a fresh DVT node end-to-end with JASON paying (stake + registerWithProof), plus a dry-run that sends no tx | `dvt-onboard-e2e` | staked + registered; dryRun sends nothing | ✅ **PASS** | register tx `0x1e98792e9bf85faff8b130aeda6197085e149a7cbfa0237f396c88b0249076c0` |

### Negative controls

| Check | Expected | Result |
|---|---|---|
| Old pre-#234 cumulative format (messagePoint + mpSig re-inserted, +321 B) | REJECTED | ✅ `validateUserOp = 1` |
| `/signature/sign` with `userOp` but no `ownerAuth` | 403 fail-closed | ✅ (verified by @repo:dvt on the same stack) |
| Bare 65-byte `ownerAuth` (untagged) | rejected by the account | ✅ `isValidOwnerAuth = 0xffffffff` |

## The `ownerAuth` framing defect this run exposed

Every node initially answered `403 owner authorization required`. The DVT forwards `ownerAuth`
verbatim to `account.isValidOwnerAuth`, which selects its branch from the LEADING TAG BYTE and rejects
anything not exactly 66 bytes. The evidence runners were sending the bare 65-byte EIP-191 signature.
Confirmed against the live account rather than inferred:

```
isValidOwnerAuth(raw 65B)      = 0xffffffff   REJECTED
isValidOwnerAuth(0x01 ‖ sig)   = 0xa0cf00cf   ACCEPTED
```

The **production path was never affected** — `transfer-manager.ts` uses `packOwnerAuthEcdsa` and
`bls.manager.ts` documents the requirement (#257/#261). Only the evidence runners had re-derived the
frame by hand; they now call the same SDK packer. Note `ownerAuth` plays two roles: the node wants the
tagged 66 bytes, on-chain signature material wants the raw 65 — kept as separate variables.

## Still red — each with a proven cause, both "test pinned to a v0.20.0-era artifact"

| Runner | Cause | Tracking |
|---|---|---|
| `dvt-realnode-e2e` | Hard-pins `EXPECTED_VERIFIER = 0xAF525A161CB17e0A1b6254ef0B8d8473bdA05174` (v0.20.0) while canonical moved to `0x539B…` at v0.27.0 DVT-unification. The pin is a deliberate guard against silent retargeting, so flipping it is a human decision. | FU-13 |
| `v0.23.0-row10-handleops` | Its account `0xA063c7B5810fc2f9f0e5198376c83b6B57c80d0c` is `ACCOUNT_VERSION 0.20.0`, which **predates `isValidOwnerAuth`** (added v0.23.0, #159) — the call reverts, so the node's owner-gate fails closed and returns 403 no matter how `ownerAuth` is framed. Correct `ownerAuth` cannot fix it; the runner needs a v0.23.0+ account. | FU-14 |

Neither is a regression from PR #319; both were verified against the same stack that greened the four
runners above.
