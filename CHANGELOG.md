# Changelog

All notable changes to this project will be documented in this file.

## [0.31.0] - 2026-06-30
**SDK Code Integrity Hash**: `6dcbb82886c5e4c9fccfe4bee17fa6b7fa42f75ab88c65a52f44037a1f341982`
*(Excludes metadata/markdown to ensure stability / 排除文档文件以确保哈希稳定)*

**Feature: `createAccountWithPasskey` — KMS relay-mode passkey-at-birth account creation.** (aastar-sdk#249)

Closes the gap 0.30.0 left: v0.22.0 passkey-at-birth was only proven for EOA owners (DIRECT mode,
`msg.sender == owner`). A KMS owner key lives in a TEE and cannot send a raw tx, so production accounts
need RELAY mode (owner EIP-191-signs the `CREATE_ACCOUNT` digest, a deployer relays + pays gas).

- **[FEAT]** `@aastar/core`: `buildCreateAccountHash({chainId, factory, owner, salt, ownerP256X,
  ownerP256Y, config, nonce, deadline}) → Hex` — byte-exact replica of the factory's internal
  `_getConfigHash` + `CREATE_ACCOUNT` preimage (the part integrators must NOT hand-roll). Returns the
  inner hash; the signer applies EIP-191. `configHashFromInitConfig` exported too.
- **[FEAT]** `@aastar/airaccount`: `AccountManager.createAccountWithPasskey(userId, {ownerP256X/Y,
  p256Guardians?, ecdsaGuardians?, dailyLimit, approvedAlgIds, salt?, deadlineSeconds?}, {deployerWallet,
  signerCtx?})` — `ensureSigner` → `createNonces` → `buildCreateAccountHash` → `signer.signMessage`
  (KMS owner key, EIP-191, signed as raw bytes) → relay `createAccount` via the deployer → deployed
  `AccountRecord`. Fails fast on `guardian == owner` / duplicate guardians (else the predicted address
  could be pre-funded but undeployable).
- **[TEST]** On-chain Sepolia v0.22.0 relay deploy (`docs/onchain-evidence/v0.31.0-createaccount-passkey.md`):
  account `0xC51DBbBb…`, relay tx `0xf6d5f34…`, `p256KeyX()==passkey`, `validator()!=0`, `createNonces
  0→1` — a successful relay deploy proves `buildCreateAccountHash` is byte-exact. Codex §5 caught + fixed
  a HIGH (digest must be signed as raw bytes, not a hex string — KMS path) + a MEDIUM (guardian validation).

> Contract follow-up: airaccount-contract#155 — expose `_getConfigHash` as a public view (drift-safety;
> not a blocker, the on-chain e2e + golden tests pin the SDK replica).

## [0.30.0] - 2026-06-30
**SDK Code Integrity Hash**: `b676f07e0469f20003de75c6920db13ef63abc15e015a91bb7ec6f18f95e191c`
*(Excludes metadata/markdown to ensure stability / 排除文档文件以确保哈希稳定)*

**Sync: airaccount-contract v0.22.0 — factory `createAccount`/`getAddress` breaking ABI; passkey + validator at birth.** (aastar-sdk#244)

Minor bump (new factory surface; wrapper changes are backward-compatible so existing callers keep working).

- **[FEAT]** Factory wrapper (`@aastar/sdk/core`): `createAccount` and `getAddress`/`getAddressWithChainId`
  gained OPTIONAL `ownerP256X` / `ownerP256Y` (+ `nonce` / `deadline` / `ownerSig` for `createAccount`),
  defaulting to **direct mode** (no passkey, `ownerSig "0x"`). Passing `ownerP256X/Y` injects the owner
  WebAuthn passkey **at account birth** (no post-deploy `setP256Key`); the validator router is wired at
  birth too (no `setValidator`). New `createNonces(owner)` read helper for the KMS-relay deploy mode.
- **[CHORE]** ABIs re-vendored to v0.22.0: factory JSON (8-arg `createAccount`, 5-arg `getAddress`/
  `getAddressWithChainId`, `createNonces`), the human-readable `AIRACCOUNT_FACTORY_ABI`, and the
  `AAStarAirAccountV7` account ABI (+`validatorRouter()`, `initialize` 4→6 args). `upstream:check`
  reports AirAccount **abis: in-sync**.
- **[CHORE]** Sepolia v0.22.0 addresses (all on-chain verified): factory
  `0x0eb0E7a61d5D9e03bc3578f8C1b0d9f40cc0a5B9`, impl `0x1cE314101E218D28bb6c6D16d6C259A4a1E67578`,
  extension `0xF736C229fE6f0cb9C864A4298E2755b7a0A19691`, agentRegistry
  `0x19d89A661F41c353c119d90F76BB7151E03F0D91`. README pin → v0.22.0.
- **[FIX]** Gasless deploy-inside-initCode now **fails loud** (createAccount direct mode requires
  `msg.sender == owner`, unavailable in initCode) instead of emitting silently-reverting calldata.
  Pre-deployed accounts (the common path) are unaffected; KMS-relay ownerSig tracked in #246.
- **[TEST]** On-chain Sepolia v0.22.0 acceptance (3 paths, evidence `docs/onchain-evidence/v0.22.0.md`):
  WebAuthn passkey-at-birth (`validateUserOp(0x0a)==0`, `p256KeyX()==supplied`), guardian tier-raise,
  raw-P256 `0x05`. Selector-parity unit test + e2e raw-ABI callers updated to v0.22.0.

> Out of scope (separate upstream syncs): KMS openapi 0.27.2→0.27.3, DVT v1.6.0→v1.7.0.

## [0.29.7] - 2026-06-29
**SDK Code Integrity Hash**: `697a060bdd8836d7f6326cb5c9efeb4ce057cafa33e7f7383a5ced8afb011879`
*(Excludes metadata/markdown to ensure stability / 排除文档文件以确保哈希稳定)*

**Fix: WebAuthn passkey submit robustness (#240 review).**

Follow-up hardening for the device-passkey prepare/submit wrap shipped in v0.29.6:

- **[FIX]** `submitPreparedTransfer` (WebAuthn path): the one-time prepared entry is now deleted only
  AFTER `generateWebAuthnTieredSignature` succeeds. A DVT-unreachable / guardian-sign failure no longer
  discards it, so the caller can resubmit without re-running `prepareTransfer` + a fresh WebAuthn
  ceremony (consistent with the #237 principle on the WebAuthn path).
- **[FIX]** `BLSSignatureService.generateWebAuthnTieredSignature`: the Tier-3 `guardianSigner` presence
  check now runs BEFORE the DVT `generateBLSSignature` round-trip — a missing guardian fails fast with
  no wasted `/signature/sign` network call.
- **[CHORE]** Moved the `GuardianSigner` / `DeviceWebAuthnAssertion` interface declarations below the imports.
- **[TEST]** WebAuthn submit preserves the prepared entry on an async signing failure (DVT down) → resubmittable.

## [0.29.6] - 2026-06-29
**SDK Code Integrity Hash**: `566c183cd0597b45668192461753cbd184f2e1b789de50a2ed9485eac92f2277`
*(Excludes metadata/markdown to ensure stability / 排除文档文件以确保哈希稳定)*

**Feat: device-passkey Tier-2/3 prepare/submit wrap — zero manual packing.** (aastar-sdk#234)

Builds on the v0.29.5 WebAuthn packers: integrators no longer hand-assemble the composite. For a
`useWebAuthnPasskey` Tier-2/3 transfer the SDK derives the on-chain passkey factor from the device
WebAuthn assertion, fetches + aggregates the DVT BLS co-signatures, and packs the `0x09`/`0x0a`
composite internally.

- **[FEAT]** `ExecuteTransferParams.useWebAuthnPasskey` — `prepareTransfer` skips the KMS ceremony and
  returns `userOpHash` as the WebAuthn challenge (the frontend runs ONE `navigator.credentials.get`
  with `challenge = userOpHash`). `PreparedTransfer.challengeId` / `publicKeyOptions` are now optional.
- **[FEAT]** `submitPreparedTransfer({ transferId, deviceWebAuthn, guardianSigner })` — new
  `deviceWebAuthn` param (the 3 `AuthenticatorAssertionResponse` fields); `webAuthnAssertion` is now
  optional (the WebAuthn path needs no KMS owner ceremony). Tier-≥2 fail-fast if `deviceWebAuthn` is
  missing; Tier-3 fail-fast if `guardianSigner` is missing.
- **[FEAT]** `BLSSignatureService.generateWebAuthnTieredSignature(...)` + `DeviceWebAuthnAssertion` type.
- The packed composite is byte-identical to the on-chain-verified `tier3-webauthn-composite-e2e`
  (`validateUserOp(0x0a) == 0` on Sepolia v0.21.0). Unit tests cover the routing + fail-fasts.

## [0.29.5] - 2026-06-29
**SDK Code Integrity Hash**: `0092c68ff4b7a762cb9a0e54351a7198413cffe34afbd5a14d22f637e7e6b120`
*(Excludes metadata/markdown to ensure stability / 排除文档文件以确保哈希稳定)*

**Feat: device-passkey Tier-2/3 — WebAuthn cumulative signature packers + v0.21.0 address sync.** (aastar-sdk#234, airaccount-contract#147/#148)

Device WebAuthn passkeys cannot raw-sign `userOpHash` (the authenticator signs
`authenticatorData ‖ sha256(clientDataJSON)`), so the deployed v0.21.0 AirAccount verifies the
WebAuthn assertion on-chain (Coinbase `webauthn-sol` / OZ stance) under new algIds `0x09`
(`ALG_CUMULATIVE_T2_WA`) / `0x0a` (`ALG_CUMULATIVE_T3_WA`). This release adds the SDK packing for
that path and syncs the deployment.

- **[FEAT]** New packers (exported via `@aastar/sdk/kms`): `packWebAuthnBlob(assertion, userOpHash)`
  → `abi.encode(authenticatorData, clientDataJSONPrefix, clientDataJSONSuffix, r, s)` (splits
  clientDataJSON around `base64url(challenge)`, verifies `challenge == userOpHash`, decodes the DER
  signature with low-S normalization); `packCumulativeT2WA(waBlob, blsPayload)` →
  `[0x09][waBlobLen u32 BE][waBlob][blsPayload]`; `packCumulativeT3WA(waBlob, blsPayload, guardianSig)`
  → `[0x0a]…[blsPayload][guardianECDSA(65)]`; `packBlsPayload(nodeIds, blsSig)` helper.
- **[CHORE]** Address sync to **v0.21.0** (Sepolia, all on-chain verified): `airAccountFactoryV7`
  `0x3891c6543af966B11F772448228c7eC1906EF382`, `airAccountV7Impl`
  `0x55fcEdC0902f192e4118E682b4f58582eaE78A73`, `airAccountExtension`
  `0x8928E1b549a81303105E2CB15713FE2718e11bb5`, `agentRegistry`
  `0x6C598985B2f5deDFad0F34951147C4b1D37ea582`. No external ABI change (WebAuthn is internal
  `_validateSignature` dispatch).
- **[TEST]** `tier3-webauthn-composite-e2e.ts` — on-chain acceptance on Sepolia: a synthetic WebAuthn
  assertion (software P-256, challenge=userOpHash) + DVT BLS aggregate + guardian, packed as `0x0a`,
  returns `validateUserOp == 0` (ACCEPTED); wrong-challenge negative rejected. Plus packer unit tests
  (round-trip, low-S, challenge mismatch, layout).

> NOTE: the integrator-ergonomic wiring (`submitPreparedTransfer` deriving the WebAuthn blob from the
> device assertion automatically) is intentionally deferred — integrators use the packers directly for
> now (see #234 integration guide); the submit wrapping lands after YAA confirms the flow.

## [0.29.4] - 2026-06-29
**SDK Code Integrity Hash**: `fb593ca9f3c50fad9431c765b9dfc01ebe12874a905a9627fe3aa605e3336e9b`
*(Excludes metadata/markdown to ensure stability / 排除文档文件以确保哈希稳定)*

**Fix: Tier-2/3 device-passkey transfers reverted on-chain with `AA24 signature error` (two stacked bugs).** (aastar-sdk#234)

A `useAirAccountTiering: true` transfer above `tier1Limit` produced a UserOperation the deployed
v0.20.3 AirAccount rejected. Two independent defects, both now fixed and verified on-chain (Sepolia):

- **[FIX] Tiering precedence (silent fallback).** A weighted/composite AirAccount can report
  `validator() == address(0)` (validation is in-account via the weight config), which made
  `detectSignatureStrategy` return `useECDSA = true`. `resolveSignStrategy` gated tier resolution on
  `!useECDSA`, so a tier-2/3 op **silently** emitted a single inline-ECDSA (`0x02`, 66 B) signature —
  under-weight for tier ≥ 2 → opaque on-chain `AA24`. An explicit `useAirAccountTiering: true` is now
  authoritative over the ECDSA heuristic (the `!useECDSA` gate is removed; a resolved tier forces
  `useECDSA = false`), and requesting tiering with no `TierGuardChecker` configured now throws loudly
  instead of falling back to inline ECDSA (`packages/airaccount/src/server/services/transfer-manager.ts`).
- **[FIX] Cumulative signature format drift.** The deployed contract (`_validateCumulativeTier2/3`,
  issue #45 Fix 1 since v0.18) recomputes the message point on-chain from `userOpHash` and strictly
  parses the BLS-payload length, so the cumulative format is `T2 0x04 = [P256 r][P256 s][nodeIdsLen]
  [nodeIds][blsSig]` and `T3 0x05 = … [blsSig][guardianECDSA]`. The SDK packer still emitted
  `messagePoint(256) + messagePointSignature(65)` — 321 extra bytes the strict-length parse rejects
  (`AA24` even once a `0x04`/`0x05` is produced). Removed from `packCumulativeT2/T3Signature`,
  `CumulativeT2SignatureData`, and `BLSSignatureService.generateTieredSignature`.
- **[FIX] `submitPreparedTransfer` could not receive the device-passkey P256 signature.** Tier-2/3 needs
  `p256Signature` (the device's P256 `r‖s` over `userOpHash`), which can only be produced AFTER
  `prepareTransfer` returns the hash — but `submitPreparedTransfer` only threaded `guardianSigner`, so the
  two-phase device-passkey flow had no way to supply it. Added `p256Signature?` to `submitPreparedTransfer`
  (threaded into signing like `guardianSigner`) + a Tier-≥2 fail-fast (no gas / no consumed assertion) when
  it is missing.
- **[TEST]** New `tier3-composite-e2e.ts` on-chain acceptance (software P256 + 3-node DVT BLS aggregate
  + guardian, no browser/KMS): the SDK-packed `0x05` composite returns `validateUserOp == 0` (ACCEPTED)
  on Sepolia, while the old `+messagePoint` format returns `1` (REJECTED, with real components — isolating
  the length/format drift). Plus a Tier-1 no-op guard (tiered tier-1 == raw inline ECDSA) and structural
  cumulative-format parity assertions pinned to the contract layout.

## [0.29.3] - 2026-06-29
**SDK Code Integrity Hash**: `fff93b190696af4601b39f6be5110eb1b291a7e3be1dffc23906766f6fb1a1f4`
*(Excludes metadata/markdown to ensure stability / 排除文档文件以确保哈希稳定)*

**Fix: `estimateUserOperationGas` masked bundler estimation failures and inflated the prefund (`InsufficientBalance`).**

`EthereumProvider.estimateUserOperationGas` (the AirAccount/KMS server gas-estimation path, bundled into
`@aastar/sdk/kms`) wrapped the bundler's `eth_estimateUserOperationGas` call in a **silent `catch {}`** that, on
any failure, fell through to a flat **4,000,000 (`0x3d0900`) `verificationGasLimit`**. Because that fallback is
fed straight into the submitted UserOperation (`transfer-manager.ts` build path), a failed estimate produced a
hugely inflated required prefund and surfaced downstream as a confusing `InsufficientBalance` — while the *real*
cause (bundler 401 / down / un-simulatable userOp) was swallowed and never logged (aastar-sdk#229).

This was two distinct problems: the **trigger** is caller/environment-side (the bundler estimation call must
actually succeed — bundler URL/API-key/userOp params), and the **SDK defect** is that it hid that failure behind
a magic constant instead of surfacing it.

- **[FIX]** Success path now adds a configurable safety buffer (default **10%**) on top of the bundler estimate for
  `callGasLimit` / `verificationGasLimit` (`preVerificationGas`, the deterministic calldata cost, is left
  untouched) — the dynamic estimate-plus-buffer behavior expected of an SDK
  (`packages/airaccount/src/server/providers/ethereum-provider.ts`).
- **[FIX]** Failure path no longer swallows the error: it `logger.warn`s the **real** bundler error (plus a hint to
  check the bundler URL/key and userOp params) before falling back, so the true cause is visible.
- **[FEAT]** New optional `ServerConfig` fields: `gasEstimateBufferPercent` (default 10, set 0 to disable) and
  `fallbackGasLimits` (default keeps the 4M `verificationGasLimit`, which AirAccount's BLS verification + factory
  deployment genuinely need and some bundlers cannot simulate — now overridable per deployment).
- **[TEST]** `ethereum-provider-rpc.test.ts`: buffer applied to estimate, `bufferPercent: 0` passthrough,
  `logger.warn` invoked on bundler failure (not silent), and custom `fallbackGasLimits` honored.

## [0.29.2] - 2026-06-29
**SDK Code Integrity Hash**: `9e582ff891ef75709f616d5aeb82b864fa67e47567703149b7248789a6ca9901`
*(Excludes metadata/markdown to ensure stability / 排除文档文件以确保哈希稳定)*

**Fix: `TIER_PROFILES` weighted-config rejected on-chain by AirAccount v0.20.3 (`InsecureWeightConfig`).**

The three shipped tier profiles (`web3-newbie` / `trader` / `conservative`) and
`DEFAULT_WEIGHT_CONFIG` set `passkeyWeight = 3` with `tier1Threshold = 3`. The account contract's
`_validateWeightConfig` requires **every individual weight to be strictly `< tier1Threshold`**, so
`setWeightConfig` (and therefore `profileSetupCalls`) reverted `InsecureWeightConfig` on-chain —
tiering could not be armed (aastar-sdk#227).

This is **not** a contract bug, and it does **not** contradict the "T1 = one passkey" product model.
"One passkey" is a UX statement: a single WebAuthn gesture causes the KMS TEE to transparently emit
**both** the P256 passkey signature **and** the owner-ECDSA signature. The contract deliberately
forbids any single factor from reaching a tier alone (so the KMS-held owner key must always co-sign,
preventing a stolen passkey from controlling the account). The on-chain rule has existed unchanged
since v0.16.0 (M6.1) — it was **not** introduced by v0.20.3.

- **[FIX]** `DEFAULT_WEIGHT_CONFIG.passkeyWeight` `3 → 2` (`packages/airaccount/src/core/tier/profile.ts`).
  All three `TIER_PROFILES` spread this default, so the single change fixes all of them. The full
  config is now `passkey 2 / ecdsa 2 / bls 2 / guardian 1·1·1, thresholds 3/5/6`, which satisfies
  `_validateWeightConfig` (every weight `< 3`). On-chain proven: `passkeyWeight=2` → `setWeightConfig`
  passes; `passkeyWeight=3` → `InsecureWeightConfig` (aastar-sdk#227).
- **[TEST]** Added a root-cause guard in `profile.test.ts` that validates **every shipped
  `TIER_PROFILE` + `DEFAULT_WEIGHT_CONFIG`** against the contract's exact `_validateWeightConfig` rule
  (non-zero + monotonic thresholds, every weight `< tier1Threshold`). The bug escaped because the
  on-chain evidence test used a hand-rolled config (`tier1Threshold = 4`) and never exercised the real
  profiles; this guard prevents that class of regression.
- **[DOC]** Corrected the stale `passkey = 3` rationale comment in `profile.ts`. The companion
  contract-side doc fix (`AAStarAgentStorageLayout` struct still says "default: 3") is tracked in
  airaccount-contract#146.
- **[FOLLOW-UP]** Tier-band tuning (`tier2`/`tier3`) interacts with the always-present P256+ECDSA base
  weight (=4); making "T2 requires BLS / T3 requires guardian" strict needs `tier2=5/tier3=7` and a
  live T2/T3 transfer-flow verification. Deferred to the contract/product owner — unchanged this release.

## [0.29.1] - 2026-06-28
**SDK Code Integrity Hash**: `6996672d55aaa7891b7515e02c3cf932cf577f52d36092cd3ab1e298c8872fb1`
*(Excludes metadata/markdown to ensure stability / 排除文档文件以确保哈希稳定)*

**Upstream sync: AirAccount v0.20.2 → v0.20.3 (gasless self-call redeploy).**

AirAccount v0.20.3 (upstream #140) adds `onlyOwnerOrSelf` to four tier/weight config
functions (`setTierLimits`, `modifyTierLimitsWithGuardians`, `setWeightConfig`,
`modifyTierLimitsWithMixedGuardians`) so they can be submitted as SuperPaymaster-sponsored
UserOps via `execute()`. **Modifier-only change → zero ABI delta**; no SDK API change.
But `ACCOUNT_VERSION`/`FACTORY_VERSION` bumped → bytecode changed → redeploy.

- **[ADDRESS]** `CANONICAL_ADDRESSES[11155111]` AirAccount stack re-pointed to v0.20.3
  (all on-chain verified): impl `0x91Ee5a7…` (`ACCOUNT_VERSION "0.20.3"`), extension
  `0xC3F4Ff…`, factory `0x78775786…` (`FACTORY_VERSION "0.20.2"`, `implementation()→0x91Ee5a7`),
  agentRegistry `0x33B3287…`. The remaining v0.20.0 stack (validators/aggregator/session/
  parsers) was not redeployed and is unchanged. (PR #225, closes #224.)
- **[EVIDENCE]** Full AirAccount business-scenario set re-run on live Sepolia against the new
  addresses — `docs/onchain-evidence/0.29.1.md`: P-256 account-create, P-256 guardian +
  EIP-7212 recovery, mixed-sig guardian + `modifyTierLimitsWithMixedGuardians`, weighted-sig
  + `setWeightConfig`, SuperPaymaster-sponsored gasless, ECDSA social recovery; plus negatives
  (timelock reverts). Both v0.20.3 `onlyOwnerOrSelf` surfaces FEATURE-MET on-chain.
- SuperPaymaster (v5.4.1-rc.1) and launch upstreams re-scanned against fresh `forge build` —
  no SDK-relevant ABI change.

## [0.29.0] - 2026-06-28
**x402 signature-required settlement + DVT-hosted facilitator (live).**

> **BREAKING (x402)** — `FacilitatorConfig.createAuthHeaders` now takes `{ endpoint, body }` and
> returns the headers for that request (was `() => { verify, settle, supported }`), so it can sign the
> exact request bytes (the §4 HMAC). `X402Client.createPayment` also changed signing semantics (below).

- **[BREAKING/FIX] x402 settlement signing aligned with the deployed `X402Facilitator`** (#39, YetAnotherAA-Validator#130):
  - **direct (xPNTs)**: payer signs an `X402PaymentAuthorization` (EIP-712, domain `name="X402Facilitator"`,
    `version="1"`, `verifyingContract=facilitator`); settled via `settleX402PaymentDirect(...,signature)`.
  - **eip-3009 (USDC)**: payer signs a **`ReceiveWithAuthorization`** (was `TransferWithAuthorization`), recipient =
    the facilitator contract, with the recipient-bound derived nonce `keccak256(abi.encode(payTo, maxFee, salt))`
    (the C-03 fix). `extra` now carries `settlement`/`maxFee`/`salt`.
  - `settleViaFacilitator`/`verifyViaFacilitator` default `requirements` to `payload.accepted` and merge its
    `extra`, so the facilitator always receives the settlement fields.
- **[ADDED]** `createX402AuthHeaders(secret)` — the §4 stateless-HMAC auth (`X-X402-Timestamp` +
  `X-X402-Auth = HMAC-SHA256(secret, "${ts}.${rawBody}")`) on `/x402/settle`, opt-in per node.
- **[ADDED]** `DEFAULT_X402_FACILITATORS` — the DVT-hosted facilitator services, now **live** on
  `https://dvt{1,2,3}.aastar.io/x402` (each node a distinct, provisioned operator).
- **[ADDED]** `signX402PaymentAuthorization`, `deriveEip3009Nonce`, `getX402FacilitatorContract/Urls`.
- **[TEST]** Cross-repo conformance: `createPayment` emits **byte-identical** `paymentPayload`+`paymentRequirements`
  (signatures included) to the DVT golden fixtures (`packages/x402/conformance/fixtures.json`), for direct + eip-3009,
  and `createX402AuthHeaders` matches the HMAC vector. **Live round-trip proven**: createPayment → `/x402/verify`
  (`isValid`) → `/x402/settle` → on-chain tx `0x95e41bd1…`, recipient received `amount − feeBPS` exactly (9.8 aPNTs).
  (61 x402 tests; full §4 business regression was run at 0.28.0 and is unchanged by this x402-only delta.)

## [0.28.0] - 2026-06-28
**Upstream sync (4/4): AirAccount v0.20.2 · SuperPaymaster v5.4.1-rc.1 · KMS openapi 0.26.1 · DVT v1.6.0.**

> **BREAKING** — the AirAccount module-governance helpers changed signature to match the
> v0.20.2 mixed-sig (ECDSA + P-256) encoding. See migration notes below (upstream #209).

- **[BREAKING]** `@aastar/airaccount` `ModuleManager.encodeInstall` / `encodeUninstall` and the
  standalone `buildInstallModuleHash` / `buildUninstallModuleHash` now implement the AirAccount
  **v0.20.2** encoding (installModule/uninstallModule relocated to `AirAccountExtension`,
  fallback-routed):
  - `installModule` initData is `abi.encode(uint8[] signerIdxs, bytes[] sigs, bytes moduleInitData)`
    when `sigsRequired > 0`, and raw `moduleInitData` when `sigsRequired == 0` (backward compatible).
  - `uninstallModule` deInitData is **always** `abi.encode(uint8[] signerIdxs, bytes[] sigs)`; the
    module deInit-data passthrough was **removed** upstream, and uninstall now needs
    `min(guardianCount, 2)` sigs (0-guardian accounts degrade to owner-only).
  - the guardian digest is now
    `keccak256(abi.encode(GUARDIAN_SIG_VERSION=4, chainId, account, opLabel, opData)).toEthSignedMessageHash()`
    with `opData` folding the on-chain **`moduleManagementNonce()`** (replay guard, upstream #75).
    `buildInstallModuleHash`/`buildUninstallModuleHash` take a required `nonce: bigint` — read it via
    the new `ModuleManager.readModuleNonce(account)`. `InstallModuleParams`/`UninstallModuleParams`
    now carry `signerIdxs` + `guardianSigs` (P-256 WebAuthn assertion blobs accepted) instead of the
    old `guardianSig1`/`guardianSig2`/`moduleDeInitData`. 13 byte-exact decode-roundtrip tests added.
- **[ADDED]** `@aastar/core` SuperPaymaster actions `queueSlash`, `cancelSlash`, `initBLSAggregator`
  (v5.4.1-rc.1). The two-step slash guard (#249) means `slashOperator` / `executeSlashWithBLS` now
  **revert with `SlashPending()` unless `queueSlash` was called first**.
- **[ADDED]** module-governance encoders/digests completing the v0.20.2 surface (#209):
  `ModuleManager.encodeProposeModuleInstall` (timelocked two-step install — same encoding as
  installModule) and `encodeSetModuleTimelockGuardianSigs` + `buildSetModuleTimelockHash`
  (weakening path, `min(guardianCount,2)` sigs). **P-256 guardian** challenge builders
  `buildInstallModuleP256Challenge` / `buildUninstallModuleP256Challenge` /
  `buildSetModuleTimelockP256Challenge` (`_p256GuardianChallenge` — folds the `"P256_GUARDIAN"`
  domain, no EIP-191 prefix) so passkey guardians can co-sign module ops. 20 byte-exact tests total.
- **[SYNC]** addresses — SuperPaymaster full Sepolia redeploy (~18 keys) + AirAccount v0.20.2
  (impl/extension/factory/agentRegistry); re-vendored `SuperPaymaster.json` (+3 fns),
  `AAStarAirAccountV7.json` (+13 recovery/guardian/P-256 fns), `AirAccountExtension.json`
  (+installModule/uninstallModule). `config.sepolia.json` realigned to the upstream deployment record.
  Every changed address validated strict EIP-55. **On-chain verified (Sepolia)**: all synced contracts
  deployed; `superPaymaster.version() == "SuperPaymaster-5.4.1"`. Radar 4/4 in-sync.
- **[ADDED]** adopted Mycelium community `PNTsPaymasterV4` `0xC827…4a46` (Sepolia) after on-chain
  verify (`PMV4-Deposit-4.5.0`, `isTokenSupported(pnts)==true`). Corrected "Mycelian" → "Mycelium".
- **[E2E ACCEPTANCE]** (#209) live Sepolia on-chain proof — deployed a guardianed v0.20.2 account and ran
  install (`sigsRequired=1`) + uninstall (`sigsRequired=2`) with real guardian signatures through the SDK
  encoders; the deployed `AirAccountExtension` accepted both. Tx: deploy `0xff29fa49…`, install
  `0xc21e55bd…`, uninstall `0x71741963…` (all `status=0x1`). Evidence:
  [`docs/onchain-evidence/v0.20.2-module-governance.md`](docs/onchain-evidence/v0.20.2-module-governance.md),
  re-runnable script `tests/regression/onchain-evidence/v0202-module-install-e2e.ts`.

## [0.29.0] - 2026-06-28
**SDK Code Integrity Hash**: `cf5ad31f8e44b3f2ce51d091e6705a5f7c7e53e0ae1469b1f00fbd90bb99c3c2`
*(Excludes metadata/markdown to ensure stability / 排除文档文件以确保哈希稳定)*

**Upstream sync: lowercase the account in contact-binding KMS calls (#193 / KMS v0.27.2).**

- **[FIX]** the contact-binding client now lowercases the `account` before every KMS call (begin/confirm/
  getContacts/unbind — body, URL, and ceremony ctx). KMS v0.27.2 (AirAccount#137, names #129/#203) keys
  contacts by a LOWERCASE address; a checksummed (EIP-55) key silently fail-closed. Defense-in-depth like
  the DVT node — never depend on the KMS's own normalization. `submitDvtConfirmation` is unaffected (it
  sends `userOpHash`, not an account). DVT v1.6.0's confirmation API was verified field-for-field against
  the SDK — already aligned, no change.

## [0.27.0] - 2026-06-26
**SDK Code Integrity Hash**: `2f1ef077b6f754c68022b86ad556e990c060ff87afec20e7b077284a8e55795c`
*(Excludes metadata/markdown to ensure stability / 排除文档文件以确保哈希稳定)*

**Contact binding + out-of-band approval — notification-binding client & approve helper (#193).**

- **[ADDED] browser-safe KMS contact-binding client** (`@aastar/sdk/airaccount`):
  `createContactBindingClient({ kmsEndpoint, apiKey, ceremony })` → `beginContactBinding` /
  `confirmContactBinding` / `getContacts` / `removeContact` over the live KMS v0.27.0 endpoints. Owner
  WebAuthn ceremony supplied by the caller (sent in the capitalized `WebAuthn:{ChallengeId,Credential}`
  field); per-request fetch timeout; email rejects loudly until `begin_email_binding` opens.
- **[ADDED] out-of-band approve helper**: `submitDvtConfirmation(node, userOpHash, passkey)` POSTs to
  `/signature/confirm` with the passkey as **`AuthenticationResponseJSON` passed AS-IS** (never
  flattened — the node/KMS verifier needs `id`/`rawId`/`type`). `confirmationCredentialRequest(userOpHash,
  {rpId,...})` builds the `navigator.credentials.get` challenge = the 32-byte userOpHash (WYSIWYS).
  `userOpHash` is the pendingId; idempotent across quorum nodes. (Validator#124 / #126.)
- **[DOCS]** corrected: `setTierLimits`/`setWeightConfig`/`addGuardian`/`modifyTierLimitsWithGuardians`
  are strict `onlyOwner` — a DIRECT owner tx, NOT a 4337 UserOp (#382).

## [0.26.18] - 2026-06-26
**SDK Code Integrity Hash**: `982e0c9598d04fd7ea6096ce78d09681efb15b2337cc79c258b6ee37fae025b3`
*(Excludes metadata/markdown to ensure stability / 排除文档文件以确保哈希稳定)*

**Browser bundle: drop the Node-only `CryptoUtil` AES leak (#189).**

- **[FIX] no more `node:crypto` AES in a browser bundle** — the airaccount main barrel re-exported the
  internal, unused `CryptoUtil` (aes-256-gcm / scrypt / createCipheriv); as a public re-export,
  `sideEffects:false` could not tree-shake it, so it leaked into `@aastar/sdk/kms` consumers' browser
  builds (YAA found 3 AES chunks). Removed from the barrel — `/kms`, `/airaccount`, and the root index
  dist now contain **0 AES chunks**.
- **[BREAKING] (minor)** `CryptoUtil` is no longer exported from `@aastar/airaccount` / `@aastar/sdk/kms`.
  It has no SDK consumer; import it directly from the source path in Node code if ever needed.
- Reminder: import the tiering APIs (`resolveTransfer`, `TIER_PROFILES`, `pollDvtConfirmation`) from
  the browser-safe `@aastar/sdk/airaccount` (0 `node:crypto`). `@aastar/sdk/kms` is Node-only
  (`KmsManager` uses `createHash`); browser code should use the axios-based `KmsHttpClient`.

## [0.26.17] - 2026-06-26
**SDK Code Integrity Hash**: `5bc2041a283eeec2e51f839e44e7ab64b75b6ca28f8c16fbba49e40e66b87e27`
*(Excludes metadata/markdown to ensure stability / 排除文档文件以确保哈希稳定)*

**Guardian-loosening end-to-end + AirAccount v0.20.1 (#188 / #176 phase 5).**

- **[ADDED] `modifyTierLimitsGuardianDigestFromChain({client, account, ...})`** — reads the account's
  `tierLimitNonce()` then builds the guardian challenge digest in one call. Closes the #188 end-to-end
  gap now that the account exposes the getter (airaccount-contract#132 / v0.20.1).
- **[CHANGED] AirAccount addresses → v0.20.1 (Sepolia)**: impl/extension/factory/agentRegistry
  redeployed with the additive `tierLimitNonce()` getter; `tierLimitNonce()` added to the merged
  `AAStarAirAccountV7` ABI. (BLS/Validator/etc. reused.)
- **Verified on live Sepolia v0.20.1** (end-to-end, real tx): deploy account with 2 ECDSA guardians →
  `setTierLimits(low)` → SDK reads nonce + builds digest → 2 guardians sign → `modifyTierLimitsWithGuardians`
  RAISES the limits (tier1 0.01→1 ETH, tier2 0.1→5 ETH; nonce 0→1).
  account `0xF92692354C0FA30075D24b78dFeb1f4caBF04722`, tx `0x285040e88ed76f702ad24e028747456dcb9f034aeae3fac92daee9f3d9d6ba44`.

## [0.26.16] - 2026-06-26
**SDK Code Integrity Hash**: `869b82d3fe21d07907b039c5d1cf50c82dd151fd8719b7d172b0b8e446615518`
*(Excludes metadata/markdown to ensure stability / 排除文档文件以确保哈希稳定)*

**Browser-safe `@aastar/sdk/airaccount` + per-request poll timeout (#189 / #176).**

- **[CHANGED] `@aastar/sdk/airaccount` is now browser-safe** — re-exports the `@aastar/airaccount` MAIN
  entry (resolveTransfer / TIER_PROFILES / encodeSetTierLimits / modifyTierLimitsGuardianDigest /
  pollDvtConfirmation / passkey / client), NOT `/server` (Node-only). Use `@aastar/sdk/kms` for the
  Node DVT signer surface. (The 0.26.14 missing-`.d.ts` regression — #189 — was already fixed in 0.26.15.)
- **[CHANGED] `sideEffects: false`** on `@aastar/sdk` + `@aastar/airaccount` so a consumer's bundler
  tree-shakes the Node-only `CryptoUtil` (`node:crypto`) out of a browser build that imports only the
  tiering APIs. (`@aastar/core` keeps side effects — it has a `node-init` config-loading import.)
- **[ADDED] per-request fetch timeout** in `getDvtConfirmationStatus`/`pollDvtConfirmation`
  (`requestTimeoutMs`, default 15s; merged with the caller signal, with an old-browser fallback) so a
  hung node read times out + retries instead of stalling the poll.

## [0.26.15] - 2026-06-26
**SDK Code Integrity Hash**: `b8f75bf4a98e4eabd299a1a5dbed05b85465088309bea377af6c314f17c6ad17`
*(Excludes metadata/markdown to ensure stability / 排除文档文件以确保哈希稳定)*

**Out-of-band confirmation polling + guardian-loosening digest (#176 phase 4/5).**

- **[BREAKING] `WeightConfig` → `TierWeightConfig`** (the tier-profile weight type added in 0.26.14).
  The bare name collided with the weighted-signature `WeightConfig` in the kms subpath and broke the
  umbrella dts build; a back-compat alias re-triggers the collision, so the rename is required (no
  alias). Update imports if you used the 0.26.14 `WeightConfig`.
- **[ADDED] out-of-band confirmation poll** (`@aastar/sdk/airaccount`): `getDvtConfirmationStatus` +
  `pollDvtConfirmation` (poll-only; never calls `/confirm` — that's the user's independent channel).
  Resilient (a transient error doesn't end the 10-min window), abortable, validates the userOpHash.
  Pairs with the existing `DvtPendingConfirmationError`. (#124 / Phase 4)
- **[ADDED] `modifyTierLimitsGuardianDigest`** — the byte-exact hash each guardian signs to authorize
  RAISING tier limits (`modifyTierLimitsWithGuardians`); reuses core's `GUARDIAN_SIG_VERSION` /
  `opDataModifyTierLimits`. (#188 / Phase 5; end-to-end pending a `tierLimitNonce()` getter —
  airaccount-contract#131.)

## [0.26.14] - 2026-06-26
**SDK Code Integrity Hash**: `71c0dbb85eeb9d4419c714f9ea10541753be1026464747bd220e4501530d585f`
*(Excludes metadata/markdown to ensure stability / 排除文档文件以确保哈希稳定)*

**Tier profiles + Layer-1 policy preview (#176 phase 3 + 4).**

- **[ADDED] tier profiles** (`@aastar/sdk/airaccount`): `TIER_PROFILES` (web3-newbie / trader /
  conservative) + frozen `DEFAULT_WEIGHT_CONFIG` (per-profile copy) + encoders `encodeSetTierLimits` /
  `encodeSetWeightConfig` / `encodeModifyTierLimitsWithGuardians` and `profileSetupCalls(account,
  profile)` to ARM a fresh account after `createAccountWithDefaults` (both factory paths leave tiers
  at 0 → `requiredTier` 0 → tiering silently off, the #176 root cause).
- **[ADDED] `resolveTransfer` Layer-1 policy preview** — pass `policyRegistry` + `target` for
  `policy:{willPass,decision,limitValue}` (what the DVT signer checks on-chain via `checkPolicy`).
  Best-effort (a registry read failure never breaks the core result); requires an explicit `target`
  (no self-transfer false-positive).
- **Note:** the Layer-1 PolicyRegistry read/write is the existing `policyRegistryActions` in
  `@aastar/core`. Layer-2 (node env) + out-of-band confirm are signer-side.

## [0.26.13] - 2026-06-25
**SDK Code Integrity Hash**: `e2f18f5edfd7d5a3c097e0d4835a6e5c805913b51b8cea1e580afef1e2fdcbd4`
*(Excludes metadata/markdown to ensure stability / 排除文档文件以确保哈希稳定)*

**Two-phase Tier-3 guardian co-sign + fail-fast (#176 phase 2).**

- **[ADDED] `prepareTransfer` returns `{ tier, requiredSigs:{passkey,bls,guardian} }`** so the UI knows
  up front whether a transfer needs a guardian co-sign.
- **[ADDED] `submitPreparedTransfer` accepts an optional `guardianSigner`** (collected at submit time —
  the usual browser device-passkey flow) and threads it into the signature. A **Tier-3 transfer
  without a guardian fail-fasts before consuming the assertion or spending gas** (the account would
  reject an incomplete signature on-chain). Tier 3 here = the account tier (cumulative spend >
  tier2Limit), which IS guardian-enabled — distinct from the daily-limit hard cap.
- **[CHORE]** unified the tier→signatures mapping to a single `sigsForTier` source (no drift); tier≥3
  comparison for consistency.

## [0.26.12] - 2026-06-25
**SDK Code Integrity Hash**: `e124566c3eef5ca0fac44290e92c8c76499328aa5a03b41ca4b97ed1c2d14ae0`
*(Excludes metadata/markdown to ensure stability / 排除文档文件以确保哈希稳定)*

**`resolveTransfer` correctness fixes (#176 phase 1, verified against the contracts).**

- **[FIX] daily-limit overage is a HARD block, not a Tier-3 promotion.** `AAStarGlobalGuard.recordSpend`
  reverts `DailyLimitExceeded` with NO guardian bypass, so exceeding the daily allowance now sets
  `blockReason` (wait for the daily reset — the limit is monotonic, only lowerable) instead of wrongly
  promoting to Tier 3. The 0.26.11 model (and the consumer doc it came from) had this backwards.
- **[FIX] tier is judged on CUMULATIVE daily spend** (`todaySpent + amount`), matching the account's
  `_enforceGuard` (`requiredTier(guard.todaySpent() + value)`). Judging on the amount alone
  under-estimated the tier → `InsufficientTier` revert.
- **[ADDED] `hasGuard`** — whether any tier/daily limit is actually enforced for the asset.

## [0.26.11] - 2026-06-25
**SDK Code Integrity Hash**: `c14b1206392abb354758b73cffe0f98a0c5e09808e9168e580ea745b4320bd81`
*(Excludes metadata/markdown to ensure stability / 排除文档文件以确保哈希稳定)*

**`resolveTransfer` — unified ETH+ERC20 tiered-transfer decision API (#176 phase 1).**

- **[ADDED] `resolveTransfer({ client, account, token?, amount, guard? })`** (`@aastar/sdk/airaccount`,
  read-only, browser-safe) → `{ tier, requiredSigs:{passkey,bls,guardian}, asset, limits, hasGuard,
  reason, blockReason }`. One call returns the transfer branch so a consumer never hand-judges tiers.
  Combines the two INDEPENDENT on-chain mechanisms as their MAX — the account tier
  (`tier1Limit`/`tier2Limit`) and the Guard daily allowance (ETH `dailyLimit`, or per-token
  `tokenConfigs`+`tokenTodaySpent`). Exceeding the daily allowance forces Tier 3 (a guardian co-sign)
  even at account-tier 0 — the case #176 hit. `hasGuard` flags whether any limit is actually enforced
  (so `tier:1 + hasGuard:false` reads as "unprotected", not "small amount").
- Consumers can use it as an immediate submit gate (fail-fast: don't submit until `requiredSigs` are
  gathered) ahead of the phase-2 co-sign wiring.

## [0.26.10] - 2026-06-25
**SDK Code Integrity Hash**: `e355a5bd6f21912c9514f6b818946d05d00588c886145cc7efb07dc18df178ca`
*(Excludes metadata/markdown to ensure stability / 排除文档文件以确保哈希稳定)*

**Silent-stub cleanup — 5 more placeholder paths eliminated (#169 retrospective, continued).**

The broadened `check:stubs` guard found 5 more silent stubs of the #169 class (placeholder values
silently used/returned). All fixed:
- **[FIX] `ProtocolClient.executeWithProof`** submitted `proof='0x'` + empty `repUsers`/`newScores`/
  `epoch` to a SLASHING call (ignoring `signatures`) → now throws (proof aggregation not wired).
- **[FIX] `UserClient.executeGasless`** passed the call target as the V4 gas token → now takes an
  explicit `gasToken` and throws for V4 without it (threaded through `UserLifecycle` gasless config).
- **[FIX] `UserLifecycle.checkEligibility`** returned `true` unconditionally → now throws.
- **[FIX] `ProtocolGovernance.getProtocolParams`** `treasury` was approximated as `registry.owner()`
  → now reads the real `SuperPaymaster.treasury()`.
- **[FIX] `UserLifecycle.getMyReputation`** `level` was always `0n` → now derived from the Registry's
  `levelThresholds`. The read-by-index loop breaks ONLY on a contract revert (out-of-bounds), and
  re-throws network/RPC errors (a `catch{break}` would silently under-report the level — the #169
  pattern again, caught in review).
- **[DEV] `check:stubs`** markers broadened (arg-placeholder / `Placeholder:` / mock-placeholder).

## [0.26.9] - 2026-06-25
**SDK Code Integrity Hash**: `bf04ef4e9cb516edbb8ec150a03d095b0f1c502afbd4ab51f10529fd60ebc074`
*(Excludes metadata/markdown to ensure stability / 排除文档文件以确保哈希稳定)*

**Gasless paymaster resolution — no silent default (#169 retrospective).**

- **[FIX] `UserLifecycle.executeGaslessTx`** resolved the paymaster ADDRESS via a placeholder
  (`registry.SUPER_PAYMASTER()` for every policy). Now CREDIT → SuperPaymaster; TOKEN/SPONSORED → an
  explicit `gasless.paymasterAddress` (new optional field) or the chain's canonical PaymasterV4.
  An **unset `gasless.policy` now throws** instead of silently routing to V4 (the dangerous case Codex
  flagged — it would succeed silently when a canonical V4 exists).
- **[DEV] `pnpm run check:stubs`** — a silent-stub guard that greps shipped `src/` for placeholder
  markers (the kind that shipped `roleData='0x'` in #169) and fails the build. Plus a test-plan
  "contract-coupled write paths" section (stubs throw, unit tests validate args, write paths need
  on-chain/simulate tests).

## [0.26.8] - 2026-06-25
**SDK Code Integrity Hash**: `9c7363dd56a2b930167c1e5d7c83202206ec8dfa484805ad0c2fd041e8c6da22`
*(Excludes metadata/markdown to ensure stability / 排除文档文件以确保哈希稳定)*

**Community registration `roleData` encoding — fixes the bare `registerRole` revert (#169).**

- **[ADDED] `encodeCommunityRoleData({name, ensName?, website?, description?, logoURI?, stakeAmount})`**
  (`@aastar/core`) — abi-encodes the Registry's `CommunityRoleData` struct for
  `registerRole(ROLE_COMMUNITY, user, roleData)`. The deployed Registry decodes `roleData`, so passing
  `'0x'` made that decode revert with NO reason (the bare `execution reverted` a funded EOA hit on
  self-registration — an already-registered caller hit `RoleAlreadyGranted` first, before the decode).
- **[FIX] `CommunityClient.launchCommunity`** built `roleData='0x'` ("Simplified - needs proper
  encoding") → now uses `encodeCommunityRoleData`. Same bug #169 hit.
- **Clarification:** the deployed Registry has NO on-chain `registerRoleSelf`; the SDK's
  `registerRoleSelf` action is a deprecated wrapper over `registerRole(roleId, caller, data)`. Use
  `registerRole(roleId, yourAddress, roleData)` for self-registration.

## [0.26.7] - 2026-06-24
**SDK Code Integrity Hash**: `00afe86000ef4819d85d250af234d6f5ca0a7f035b8f144c6dbe0c02d42c4070`
*(Excludes metadata/markdown to ensure stability / 排除文档文件以确保哈希稳定)*

**EIP-3009 `ReceiveWithAuthorization` + audit-fix sale stack (#165). REQUIRED for gasless** — without it
the relayer's signature verification fails (USDC invalid).

- **[CHANGED] `buyGasless` EIP-3009 primaryType `TransferWithAuthorization` → `ReceiveWithAuthorization`.**
  The audited BuyHelper now calls `receiveWithAuthorization` (`msg.sender` must == `to` — closes an
  EIP-3009 front-running hole). Signed fields unchanged (from/to/value/validAfter/validBefore/nonce);
  only the typehash changes. The relay reconstructs with the same fields → digests match.
- **[CHANGED] Sepolia sale stack** (audit-fix redeploy): SaleContractV2 `0xA563fA13`, APNTsSaleContract
  `0x9cF028D1`, BuyHelper `0x8d08fBD8` (also the BuyIntent domain `verifyingContract`). Canonical payout
  unchanged — on-chain verified `getPayoutToken()` → GToken `0x20a051…` / aPNTs `0x9e66B457…`.
  `buyTokensFor`/`buyAPNTsFor` unchanged. Refreshed BuyHelper ABI (+`sweepToken`).
- **[DEV] ABI/deployment maintenance tooling** (not shipped to consumers): `check:abi-drift`, unified
  `abi:sync`/`abi:triage`, `address:sync`, + the `.claude/skills/abi-sync` & `address-sync` skills.

## [0.26.6] - 2026-06-23
**SDK Code Integrity Hash**: `335319fc7df9dcfaf5e6072fe8862455cf4fb5314fd712909d779ae78f572d40`
*(Excludes metadata/markdown to ensure stability / 排除文档文件以确保哈希稳定)*

**buySelfPay `recipient` — deliver self-paid tokens to another address (e.g. an AirAccount) (#145 gap 2).**

- **[ADDED] `SelfPayParams.recipient?: Address`** — routes through the new `buyTokensFor` / `buyAPNTsFor`
  sale functions so a self-pay buy (USDC **or USDT**) can deliver aPNTs/GToken straight into an
  AirAccount instead of the payer. Omitted = pay to self. (aPNTs still rejects `minOut` — no on-chain
  slippage param.)
- **[CHANGED] Sepolia sale stack** (launch#21 redeploy with the `*For` functions): SaleContractV2
  `0x86aC0278…`, APNTsSaleContract `0x1cE31924…`, BuyHelper `0xF78f8984…`. Refreshed those ABIs.
  Canonical payout unchanged — `getPayoutToken()` on-chain still resolves GToken `0x20a051…` /
  aPNTs `0x9e66B457…`.

## [0.26.5] - 2026-06-23
**SDK Code Integrity Hash**: `4a1fe97bcd869aff6bfa3db26e8c0252f701bf7986e20eb047cf5ac5d238174f`
*(Excludes metadata/markdown to ensure stability / 排除文档文件以确保哈希稳定)*

**GuardClient (AAStarGlobalGuard) + upstream ABI completeness gate.**

- **[ADDED] `GuardClient`** (`@aastar/core`, browser-safe): read + manage an account's
  AAStarGlobalGuard (per-account spending limits / tiered policy). Reads `getConfig` / `getTokenConfig`
  / `getTokenTodaySpent`; management (`encodeAddTokenConfig` / `encodeDecreaseDailyLimit` /
  `encodeDecreaseTokenDailyLimit` / `encodeSetStrictMode`) returns a `GuardCall {to,value,data}` to
  submit via `account.execute` as a UserOp (Guard writes are `onlyAccount`). `AAStarGlobalGuardABI` exported.
- **[ADDED] missing ABIs** `RailgunParser` / `UniswapV3Parser` → AirAccount now 14/14.
- **[ADDED] `pnpm run check:abi`** (chained into `audit:abi`): fails if any upstream concrete contract
  lacks an SDK ABI (so a missing one — like AAStarGlobalGuard had been — is caught automatically).
  Coverage: SuperPaymaster 16/16, AirAccount 14/14, launch 4/4.

## [0.26.4] - 2026-06-23
**SDK Code Integrity Hash**: `5735b2065985fe6419dcf19714a54c1756decdceb7f6a3ba27fd2c64900cdad5`
*(Excludes metadata/markdown to ensure stability / 排除文档文件以确保哈希稳定)*

**viem is now a `peerDependency` (#145).** `@aastar/sdk` pinned `viem 2.43.3` as a `dependency`, so a
consumer on a newer viem (e.g. 2.47.x) ended up with a second nested viem → a `tsc` "two different
viem types" error when passing their `PublicClient` / `WalletClient` to `TokenSaleClient` (and other
viem-typed APIs), forcing `as any`.

- **[CHANGED]** `viem`: `dependencies` → `peerDependencies (">=2.43.0 <3")` (+ a `devDependency` for the
  SDK's own build). tsup already externalizes viem (dist `.d.ts` `import … from 'viem'`), so the
  consumer's single viem now resolves the SDK types — no more cast.
- **[ACTION REQUIRED]** consumers must have `viem` in their own dependencies (`pnpm add viem`); almost
  all already do (they construct the viem clients they pass in). No runtime/behavior change otherwise.

## [0.26.3] - 2026-06-22
**SDK Code Integrity Hash**: `c68fdc48ab842a8b69617f9bf8ba19259e0923318982fa823cd88038334468fb`
*(Excludes metadata/markdown to ensure stability / 排除文档文件以确保哈希稳定)*

**DVT testnet default config (signing + relay + keeper) + official community PaymasterV4s + gasless polish.**

- **[ADDED] `DVT_CONFIG` + `getDvtConfig` / `checkDvtConnectivity` (`@aastar/core`):** the 3 live AAStar
  testnet DVT nodes (dvt1/2/3.aastar.io — BLS signing + gasless relay + price keeper) are now the
  default testnet config, in an `environments.{sepolia,mainnet}` schema so mainnet is a fill-block +
  flip-`active` (or `AASTAR_DVT_ENV` env var) zero-code switch. `checkDvtConnectivity()` is a startup
  self-test (per node: `/health` + `/node/info` nodeId match + `/relay/health`). Live-verified 3/3 ok.
- **[CHANGED] single-source gasless relay pool:** `TokenSaleClient.buyGasless` load-balances across
  `getDvtRelayerUrlsForChain(chainId)` (the DVT config) with the Cloudflare Worker as the final
  fallback (removed the duplicated `LAUNCH_SALE_ADDRESSES.relayerUrls`). **Verified live**: a $5 aPNTs
  gasless buy through a DVT relay (tx `0x89121665…`, zero gas, aPNTs delivered).
- **[ADDED] official community PaymasterV4 keys:** `aPNTsPaymasterV4` (AAStar → aPNTs) /
  `PNTsPaymasterV4` (Mycelian → pnts) on all chains; Sepolia `paymasterV4` fixed to the AAStar
  aPNTs instance `0x957852…` (was a non-aPNTs proxy), verified on-chain (factory + isTokenSupported).
- **[FIX] aPNTs self-pay rejects `minOut`** (APNTsSaleContract.buyAPNTs has no slippage param — was
  silently dropped; use buyGasless for aPNTs slippage). Refreshed stale token-sale test addresses.

## [0.26.2] - 2026-06-22
**SDK Code Integrity Hash**: `faa6e3cbe3fee53da7c584d016b9f458803d9fae0c80dfb5db1b7dd22267dd38`
*(Excludes metadata/markdown to ensure stability / 排除文档文件以确保哈希稳定)*

**Two-phase transfer for strict device-passkey signing.** `executeTransfer` is one-shot
(build → sign → submit) and takes the assertion as input, so a browser/device-passkey frontend
signs before the SDK knows `userOpHash` → it can only commit the raw nonce, which KMS strict mode
rejects. New two-phase API where the SDK owns payload selection + the WYSIWYS commitment.

- **[ADDED] `TransferManager.prepareTransfer(userId, params)`** → `{ transferId, challengeId,
  publicKeyOptions, userOpHash }`: builds the UserOp, computes the EXACT digest the single owner
  signature will sign, starts the KMS ceremony, and returns `publicKeyOptions` whose `challenge` is
  already the commitment. The frontend just runs `navigator.credentials.get`.
- **[ADDED] `TransferManager.submitPreparedTransfer(userId, { transferId, webAuthnAssertion })`** —
  signs with the device-passkey assertion (the committed digest matches) + submits. Single-use record.
- **[ADDED] `ISignerAdapter.beginCeremony` (optional)** — `KmsSignerAdapter` computes
  `commitChallenge(nonce, hashMessage(message))`; the SDK owns the payload so the frontend never guesses.
- **The committed payload is TIER-AWARE** (why the SDK must own it): ECDSA / Tier-1 →
  `hashMessage(userOpHash)`; Tier-2/3 → `hashMessage(keccak256(messagePoint))` (Tier-2/3 omit the
  userOpHash owner ECDSA — the one owner signature is the messagePoint signature). messagePoint is a
  deterministic `hashToCurve(userOpHash)`, so the binding to the transaction is preserved (no replay).
- **[FIX]** `transferId` now uses a CSPRNG (`randomUUID`) instead of `Math.random`.
- Strict-mode device-passkey transfers (AirAccount #354) are now reachable; 4-round adversarial review.

## [0.26.1] - 2026-06-22
**SDK Code Integrity Hash**: `566b37ccb8f753370c8525eeecb7f81e0b82e77013d1cc0a6d81396598033a7b`
*(Excludes metadata/markdown to ensure stability / 排除文档文件以确保哈希稳定)*

**Mint commitment v2 (label-based) — aligns KMS v0.26.0.** Corrects the mint binding from 0.26.0:
the KMS redefined the key-mint commitment (`create_agent_key` / `create_p256_session_key` /
`refresh_agent_credential`), so the 0.26.0 v1 digest (index/ttl/subject) is obsolete.

- **[CHANGED] `mintDigest()`** → v2: `create-agent` = `SHA-256("AA-AGENT-MINT-v2" ‖ walletId[16B UUID]
  ‖ SHA-256(label))`; `create-p256` = `SHA-256("AA-P256-SESSION-MINT-v2" ‖ walletId ‖ SHA-256(label))`;
  `refresh-agent` = `SHA-256("AA-AGENT-REFRESH-v2" ‖ walletId ‖ agentIndex[u32 BE])`. create now binds
  the caller's `label` (not the server-assigned index → no index race); create vs refresh use distinct
  tags (a refresh gesture can't be replayed as a mint).
- **[ADDED] auto-commit** in `createAgentKeyWithCeremony` / `createP256SessionKeyWithCeremony` /
  `refreshAgentCredentialWithCeremony` (refresh parses `agentIndex` from `keyId` via an anchored
  `<uuid>:<index>` regex). KAT-locked to the KMS vectors; live-verified vs kms.aastar.io v0.26.0 (E2E 10/10).
- **Note:** KMS v0.26.0 also shortens `MAX_AGENT_JWT_TTL` to 24h (agent/P256 credentials now expire
  daily) — frontends must handle re-mint + `expiresAt`. KMS proto 0.6.0→0.7.0 (label/is_refresh).

## [0.26.0] - 2026-06-22
**SDK Code Integrity Hash**: `35c5ef1420326cac27dff6661fbee58073f75238ee4a5b88f4c24c3cfef869ed`
*(Excludes metadata/markdown to ensure stability / 排除文档文件以确保哈希稳定)*

**KMS strict-mode readiness: WYSIWYS payload commitment over EVERY signing/mint op.** Completes
the SDK side of the AirAccount #63 strict-challenge flip — once strict is on, the KMS hard-rejects
any signing/mint ceremony whose WebAuthn challenge is not `SHA-256(nonce ‖ payload_digest)`. All
four commitment families are implemented and verified (live against kms.aastar.io and/or the
KMS-locked test vectors).

- **[ADDED] commitment over all signing ops (#133/#136/#137):** `signHashWithCeremony` (payload =
  hash) and `signTypedDataWithCeremony` (payload = EIP-712 digest via new `eip712Digest()`)
  auto-bind the commitment; `KmsSigner` ceremony `commitPayload` defaults to `true`. The three
  payment convenience signers bind their fixed-schema EIP-712 digest (exported
  `micropaymentVoucherDigest` / `gTokenAuthorizationDigest` / `x402PaymentDigest`).
- **[ADDED] grant-session commitment (#137, AirAccount #112):** `grantSessionFinalHash()` —
  byte-identical to `SessionKeyValidator.buildGrantHash` (verified vs the LIVE contract via an E2E
  oracle, incl. non-empty `callTargets`/`selectorAllowlist` pad-32 packing).
- **[ADDED] mint commitment (#138, AirAccount #115):** `mintDigest()` for `create_agent_key` /
  `create_p256_session_key` — `SHA256(tag ‖ walletId ‖ index ‖ ttlSecs ‖ SHA256(subject))`,
  KAT-locked to the KMS vectors.
- **[ADDED] `KmsSignerAdapter`** (the `ISignerAdapter`↔KMS bridge), `ExecuteTransferParams.webAuthnAssertion`,
  `SignerAuthContext`, ceremony wrappers for non-signing ops (delete/unfreeze/changePasskey),
  monotonic `signCount` (anti-clone), and `commitChallenge()` (exported; 32-byte payload enforced).
- **Hardening:** `signWithCeremony` (/Sign) documented non-strict; `u256()` guards uint256 fields;
  legacy raw-passkey signing is `@deprecated`/opt-in only (no silent path). 3-round Codex review on
  the grant + mint PRs.

## [0.25.0] - 2026-06-21
**SDK Code Integrity Hash**: `c8ae1c0c61c29f5cbcb018198daab036d126b0cd6ca90bdcbff5496d5cbeb8be`
*(Excludes metadata/markdown to ensure stability / 排除文档文件以确保哈希稳定)*

**KMS WebAuthn-ceremony signing (transfer/BLS) + MushroomDAO launch token sale.** Two feature
lines, both proven on Sepolia.

### KMS: transfer/BLS signing migrated off legacy raw passkey → WebAuthn ceremony
- **[FIX]** `KmsSigner` signs via the challenge-bound WebAuthn ceremony (`signHashWithWebAuthn`)
  instead of the legacy `signHash(Passkey)` that KMS v0.20.0+ rejects (400, "no challenge
  binding — replayable"). This is the root-cause fix for `executeTransfer` (Tier-2 BLS) 500s.
- **[ADDED]** `KmsSignerAdapter` (the `ISignerAdapter`↔KMS bridge), `ExecuteTransferParams.webAuthnAssertion`,
  `SignerAuthContext` (legacy `PasskeyAssertionContext` @deprecated | `WebAuthnCeremonyContext`),
  `KmsManager.createKmsSignerWithCeremony`, `GuardChecker` wired into `AirAccountServerClient`
  (makes `useAirAccountTiering:true` reachable).
- **[PERF]** BLS Tier-2/3 skip the unused owner-ECDSA over userOpHash (`aaSignature`) — one fewer
  owner signature / ceremony gesture per tiered transfer.
- **[ADDED]** `commitChallenge(nonce, payload)` = `SHA-256(nonce‖hash)` (WYSIWYS, AirAccount #68),
  exported; commitment is **opt-in** (`commitPayload`, default raw nonce). Live KMS still verifies the
  raw nonce host-side, so commitment is held until the KMS host is aligned (AirAccount #110).
- **Proven live (kms.aastar.io):** raw-nonce ceremony SignHash returns a signature; legacy is
  rejected (`scripts/kms_ceremony_e2e.ts`). 5-round Codex review (PR #131) + #133.

### Tokens: aPoints + governance-token sale (`@aastar/tokens`)
- **[ADDED]** `TokenSaleClient` — abstraction of the `launch.mushroom.cv/join` page: `getPrices`,
  `quote`, `getBalances`, `getPayoutToken`, `buySelfPay`, `buyGasless` (EIP-3009 + EIP-712 BuyIntent
  → relayer) + `usd()`. ABIs `SaleContractV2`/`APNTsSaleContract`/`BuyHelper`/`ERC20` added to
  `@aastar/core`; `LAUNCH_SALE_ADDRESSES` (separate from `CANONICAL_ADDRESSES`).
- **[CHANGED]** Path A: the Sepolia sale stack was redeployed bound to the **canonical** SuperPaymaster
  GToken (`0x20a051…`) / aPNTs (`0x9e66B…`); `LAUNCH_SALE_ADDRESSES` now points to it (SaleV2
  `0x29eE47…`, APNTsSale `0x136654…`, BuyHelper `0x0EA2AE…`). Payout token resolved on-chain — never
  duplicated.
- **Proven on-chain:** self-pay + gasless buys (`scripts/launch_sale_e2e.ts`).

## [0.24.2] - 2026-06-20
**SDK Code Integrity Hash**: `9b41f1f3515237e9572254ebc605dbcc708b7c2c363d4e0964c085abb9dc9e52`
*(Excludes metadata/markdown to ensure stability / 排除文档文件以确保哈希稳定)*

**`@aastar/email` onboarding + umbrella subpath.** Patch release wiring up the existing
Resend-based email utility for first-time use and exposing it from the all-in-one package.

- **[ADDED]** `packages/email/README.md` — newbie guide: get a Resend API key, set
  `RESEND_API_KEY`, verify a sending domain (SPF/DKIM/DMARC) vs. the `onboarding@resend.dev`
  test address, install, send the first email; full `send` / `sendBatch` / `fromEnv` API and an
  agent idempotency-key example.
- **[ADDED]** `@aastar/sdk/email` subpath export — `import { ResendMailer } from '@aastar/sdk/email'`.
  Exposed as a dedicated subpath (NOT the root barrel) so `resend` stays out of every
  `import '@aastar/sdk'` consumer's bundle, mirroring the React-only `@aastar/sdk/dapp` pattern.
- **[ADDED]** `resend` as an **optional** `peerDependency` of `@aastar/sdk` (the direct
  `@aastar/email` package still pulls `resend` automatically as a normal dependency).
- **[ADDED]** `RESEND_API_KEY` to `env.template`.
- Verified: `@aastar/email` build + 16 unit tests pass; umbrella build emits
  `email.{js,cjs,d.ts,d.cts}`; root bundle has 0 `resend` references.

## [0.24.1] - 2026-06-20

**Gap B completion: one-call deploy + validator-router wiring (`deployAndWireValidator`).** 0.24.0
shipped `ensureValidatorRouter` (the explicit post-deploy wire step); a router-delegated account
(BLS 0x01 / cumulative / session-key) still needed a separate manual deploy + manual wire. The
factory's lazy first-UserOp deploy can't bootstrap such an account (its own algorithm can't validate
until the router is set), so there was no one-call path.

- **`AccountManager.deployAndWireValidator(userId, { walletClient, router? })`** → `{ deployTx?, validator }`:
  deploys via `factory.createAccount(owner, salt, config)` (config rebuilt byte-identically from the
  persisted record ⇒ same CREATE2 address) when the account has no code, waits for the deploy receipt,
  then `setValidator(router)` and waits for THAT receipt — so the account is on-chain-READY when the
  call returns. No-op for inline algIds (ECDSA/P256/COMBINED_T1) or an already-wired account. Both txs
  go through the caller-supplied owner/deployer `WalletClient`.
- **On-chain proven (Sepolia, no DVT):** a fresh BLS-only account
  `0x73Db0B7e932469C449E87B8B2Ab68b8c2Bfc4cdD` via ONE `deployAndWireValidator` call — deploy tx
  `0x967e1e2a…`, setValidator tx `0x4e44181d…`, on-chain `validator() == 0xfcDfd17a…` (canonical router).
  Helper: `tests/regression/onchain-evidence/gap-b-deploy-wire-e2e.ts`. +3 unit tests (64/64 in the
  account-manager suite).

## [0.24.0] - 2026-06-20

**DVT through-EntryPoint completion + validator-router wiring + default testnet nodes.** Closes the
last open item of the v0.20.0 acceptance (the DVT BLS path proven THROUGH `EntryPoint.handleOps`,
`UserOperationEvent success=true`) and ships the supporting SDK surface. Backward-compatible (additive).

- **`encodeBLSAccountSignature` (`@aastar/core`)** — the account-level `ALG_BLS` (0x01) signature for
  `EntryPoint.handleOps`: `[0x01][nodeIdsLength(32)][nodeIds(N×32)][blsSig(256)][ownerECDSA(65)]` per
  contract `_validateTripleSignature`. The trailing 65 bytes are the owner's EIP-191 sig over
  `userOpHash` (recovered==owner), so `ALG_BLS` is BLS **+ owner co-sign**, not BLS-only. (The earlier
  `[0x01]‖verifierProof` was missing the length prefix + owner sig.) Real on-chain handleOps proven:
  tx `0xc01eae6f…` (`UserOperationEvent success=true`).
- **`DEFAULT_DVT_NODES` / `getDefaultDvtNodes(chainId)` (`@aastar/core`)** — AAStar's always-on testnet
  DVT nodes (`dvt1/2/3.aastar.io`, independent production keys, registered on `AAStarBLSAlgorithm`
  `0xAF525A…`). Source of truth: `YetAnotherAA-Validator/deploy/sdk-dvt-config.testnet.json`.
- **`needsValidatorRouter` (`@aastar/core`) + `AccountManager.ensureValidatorRouter(userId, { router?,
  walletClient? })`** — router-delegated algIds (BLS 0x01, T2/T3 0x04/0x05, weighted 0x07, session 0x08)
  require `setValidator(router)` (the factory does NOT auto-wire it; `validator()==0` ⇒ BLS validation
  returns 1). `ensureValidatorRouter` resolves the canonical `aaStarValidator`, verifies the account is
  deployed + `validator()==0`, and sends `setValidator` via a caller-supplied owner wallet.
- **Upstream sync: DVT `v1.4.0` → `v1.5.0`** (radar 4/4; wire-format unchanged — v1.5.0 adds the
  always-on testnet nodes + clone-and-deploy package).
- Full v0.23.0/v0.20.0 business-feature acceptance recorded (`docs/onchain-evidence/v0.23.0-acceptance.md`):
  all 10 scenario rows FEATURE-MET (decoded-revert + post-state + 2-round Codex challenge).

## [0.23.0] - 2026-06-20

**Feature (#118): P-256 (passkey) MAIN-account creation in the server-client (the path YAA uses).**
The server-client `AccountManager` could previously only deploy ECDSA-guardian accounts
(`createAccountWithDefaults`), with no way to inject `InitConfig.guardianP256X/Y` — so a KMS-custodied
/ counterfactual owner could not install a passkey guardian AT DEPLOY time. New method
`AccountManager.createAccountWithP256Guardians(userId, { p256Guardians, ecdsaGuardians?, dailyLimit,
approvedAlgIds?, minDailyLimit?, salt?, entryPointVersion? })` (and a `p256Guardians` option on
`createAccount`) builds the full 8-field `InitConfig` via core `buildInitConfig` (reused, not
hand-rolled), predicts the address via the factory's full-config `getAddress(owner, salt, config)`, and
persists the resolved config on the account record. New shared helpers `account-init-config.ts`
(`buildFullInitConfig`, `toGuardianSpecs`, `initConfigToTuple`, `serializeGuardianSpecs`,
`initConfigFromRecord`) let `transfer-manager` rebuild the BYTE-IDENTICAL initCode at first-UserOp
deploy time (config-hash-in-salt ⇒ deployed address == predicted address).

- **Acceptance-hash semantics (verified vs `AAStarAirAccountFactoryV7.sol`):** the full-config
  `createAccount` path performs NO guardian-acceptance signature check — for P-256 OR ECDSA guardians.
  Front-run protection is the `keccak256(InitConfig)`-in-CREATE2-salt binding; P-256 guardians are an
  owner-bootstrap (no quorum, no acceptance ceremony, #110④). This differs from
  `createAccountWithGuardians()`, whose owner-only-salt `createAccountWithDefaults` path still requires
  ECDSA `ACCEPT_GUARDIAN` signatures.
- **Fix (#118 H1): wrong P-256 algId in `buildInitConfig`.** `core/actions/initConfig.ts` defined the
  passkey constant as `0x01` (= `ALG_BLS`), so the default full-config `approvedAlgIds` for a P-256
  account was `[0x02, 0x01]` = [ECDSA, BLS] — it wrongly whitelisted BLS and OMITTED P-256. Corrected to
  `ALG_P256 = 0x03` (`AAStarAirAccountBase.sol:46`, route match `:604`); the default is now `[0x02, 0x03]`
  (ECDSA owner + P-256, never BLS). Unit tests assert the default contains 0x02 & 0x03 and NOT 0x01.
- **Fix (#118 M2): salt persisted as a lossless decimal string.** A `number | bigint` salt could
  truncate (large JS number) or fail JSON serialization (bigint); the deploy-time `BigInt(account.salt)`
  rebuild would then diverge from the predicted CREATE2 salt and strand funds. The P-256 path now rejects
  an unsafe-integer number salt and persists `salt` as a decimal string, reconstructed losslessly for
  both prediction and deploy. Round-trip unit test with a >2^53 salt; the on-chain run uses one too.
- **Fix (#118 M1 / latent ABI selector bug).** The local human-readable `AIRACCOUNT_FACTORY_ABI` declared
  `InitConfig.TokenConfig` as `(uint256,uint256,uint256)` while the deployed v0.20.0 factory packs it as
  `(uint128 tier1Limit, uint128 tier2Limit, uint256 dailyLimit)` (#82). The type string feeds the 4-byte
  selector, so `getAddress`/`createAccount`/`getAddressWithChainId` reverted on the live factory (the
  existing ECDSA `createAccount`/basic-create paths too). Corrected to the canonical JSON ABI; the
  selector-parity unit test now PINS the deployed factory's actual selectors (`getAddress 0x3989c6b8`,
  `createAccount 0x5512953b`, `getAddressWithChainId 0x203df583`) so both SDK ABI sources drifting
  together still fails the test.
- **On-chain (Sepolia):** `createAccountWithP256Guardians` deployed account
  `0x2727282d1E822e8Ae18750393636915ab1bbba72` WITH a passkey guardian (tx
  `0x5e98c3fa…2308e1c8`, status 0x1) using a >2^53 salt and default `approvedAlgIds == [0x02, 0x03]`;
  on-chain `getGuardianP256Key(0)` == the installed `(x, y)`, `guardianCount() == 1`. See
  `docs/onchain-evidence/v0.20.0.md`.

## [0.22.0] - 2026-06-20

**Feature (#110 Batch 2): P-256 (WebAuthn passkey) guardians.** Replaces the 8 `NOT_IMPLEMENTED`
stubs from 0.21.0 with real implementations. New core crypto module `crypto/p256Guardian.ts`
(re-exported by `@aastar/sdk`): `buildP256GuardianChallenge`, `encodeWebAuthnAssertion` (5-field
abi.encode, fixed `webauthn.get` prefix, low-S), `coseToP256XY` (COSE_Key + compressed/uncompressed
SEC1, enforced kty/crv), per-op opData builders, `signP256GuardianAssertion` (software authenticator).
The 8 `airAccountExtension` wrappers (`addP256Guardian`, `proposeRecoveryWithSig`, …, mixed-sig) are
real, with `getStorageAt`-based mixed-sig nonce getters. `buildInitConfig` wires P-256 guardians
through the high-level InitConfig; passkey-guardian creation is guardian-sig-free owner bootstrap.
All encodings byte-verified against `AirAccountExtension.sol`. **On-chain**: `proposeRecoveryWithSig`
landed status 0x1 on Sepolia (the contract's EIP-7212 verification of the SDK challenge+assertion
passed). Codex 2-round APPROVE. Also bumps the KMS pin `openapi 0.23.1 → 0.23.2` (api in-sync).

## [0.21.1] - 2026-06-20

**Fix (#115): PaymasterClient V4 — account-type-aware UserOp signing.** V4 signed UserOps with a
raw 65-byte ECDSA sig; v0.20.0 AirAccount `_validateSignature` routes on `signature[0]` as an algId
prefix, so a raw sig whose first byte == `0x02` (ALG_ECDSA) misroutes → **intermittent AA24**. A new
`signUserOpHash` helper centralizes all 5 sign sites (incl. the internal gas-estimate pass); pass
`airAccountSig: true` (new option on `estimateUserOperationGas` / `submitGaslessUserOperation`) to emit
the deterministic `[0x02][r][s][v]` (66-byte) format for v0.20.0 AirAccounts. Default unchanged
(raw-65) for SimpleAccount and other account types. Codex-reviewed (2 rounds, APPROVE).

## [0.21.0] - 2026-06-20

On-chain acceptance (Sepolia): the v0.20.0 `createAccount` 8-field-`InitConfig` encoding is
**decode-verified** across 3 independent paths (recovery `createAccount`, `createAgentAccount`, an
isolated gasless-config `createAccount`) — see `docs/onchain-evidence/v0.20.0.md`. Codex-reviewed (5 rounds, APPROVE).

**Upstream sync — v0.20.0 foundation (Batch 1; non-breaking).** Detect → upgrade → vendor the
infra pins; the P-256 / WebAuthn guardian feature itself is Batch 2 (stubbed here).

- **AirAccount contracts `v0.19.0-beta.2` → `v0.20.0`** (full Sepolia redeploy 2026-06-20).
  - **Addresses**: all 11 AirAccount Sepolia addresses in `CANONICAL_ADDRESSES[11155111]` realigned
    to the v0.20.0 deploy (factory `0x99C9300d…`, impl `0xd51db7eB…`, extension `0x5529f508…`),
    sourced from `airaccount-contract/docs/DEPLOYMENT-v0.20.0.md`. OP / OP-Sepolia untouched.
  - **ABIs**: re-vendored `AAStarAirAccountV7.json` + `AirAccountExtension.json` from the upstream
    full ABI (diamond-lite merged surface).
  - **#30 recovery relocation**: the 4 ECDSA recovery selectors (`proposeRecovery` / `approveRecovery`
    / `executeRecovery` / `cancelRecovery`) are no longer on the V7 ABI — they live in
    `AirAccountExtension`, reached via the account `fallback`→`delegatecall` (selectors + semantics
    unchanged). The server `RecoveryService` already encodes them against the account address, so no
    wrapper becomes ABI-absent.
  - **Events**: `RecoveryProposed` / `RecoveryApproved` / `RecoveryCancelVoted` gained a trailing
    `uint8 guardianIdx` (topic0 changed); vendored ABIs + the AirAccount event-ABI constants updated.
  - **REMOVE_GUARDIAN signing payload (Batch-1 breaking; spec §6.4 / #120 [HIGH])**: the guardian-signed
    `opData` is now `abi.encode(nonce, index, guardianToRemove, p256X, p256Y)` (was `(nonce, guardianToRemove)`).
    This affects the **plain ECDSA** removal path too (extra `index` + two `bytes32(0)` key words). Added
    `RecoveryService.buildRemoveGuardianHash(...)` (the SDK had no removal-signing helper before — only the
    `encodeRemoveGuardian` calldata encoder, which is unaffected) returning the raw `_guardianOpHash` challenge
    for guardians to `personal_sign`; golden-vector tests included. Source: `airaccount-contract`
    `docs/p256-guardian-spec.md` §6.4 + `AAStarAirAccountBase.removeGuardian`.
  - **P-256 / WebAuthn guardian = Batch 2**: `getRecoveryNonce` and `getGuardianP256Key` ship as real
    view reads; `addP256Guardian`, `addP256GuardianWithMixedSigs`, `addGuardianWithMixedSigs`,
    `proposeRecoveryWithSig`, `approveRecoveryWithSig`, `cancelRecoveryWithSig`,
    `removeGuardianWithMixedSigs`, `modifyTierLimitsWithMixedGuardians` are `NOT_IMPLEMENTED` stubs
    pointing at Batch 2 (`packages/core/src/actions/airAccountExtension.ts`).
- **KMS `openapi 0.23.0` → `0.23.1`** (doc-only pin; API/wire verified in-sync).
- **DVT `v1.3.0` → `v1.4.0`** (doc-only pin; wire-format unchanged — per-IP rate-limit + confirm flow
  are server-side, tracked in #82).
- **Radar fix**: the AirAccount address anchor in `scripts/upstream/upstream-radar.ts` now prefers the
  dedicated `docs/DEPLOYMENT-v<latest>.md` "Core addresses" table over CHANGELOG "Deployed" tables, so
  a release that does not republish a Deployed table no longer reads an older table and false-flags drift.
- Also closed three pre-existing doc-coverage gaps surfaced by the re-vendor: `buildGrantHash` /
  `buildP256GrantHash` (SessionKeyValidator views) and `createAccountWithDefaults` (factory write).

_No package versions bumped — that is the separate release step._

## [0.20.8] - 2026-06-18

**Address bug fix (single source of truth).** `@aastar/airaccount` carried its own hardcoded copy of protocol contract addresses, stale at `v0.17.2-beta.4`, while `@aastar/core` `CANONICAL_ADDRESSES` (the authority) was at `v0.19.0-beta.2` (Sepolia full redeploy). The airaccount server used the stale copy internally.

- `AIRACCOUNT_ADDRESSES` current Sepolia fields now **derive from `@aastar/core` `CANONICAL_ADDRESSES[11155111]`** — factory `0x52c5190E`, accountImpl `0x7fe62d51`, delegate/extension/agentRegistry/validatorRouter/BLS/sessionKey/forceExit/calldataParser realigned to v0.19.0-beta.2. Legacy/deprecated factory addresses retained for historical account recovery.
- Added `@aastar/core` as an `@aastar/airaccount` dependency + an anti-drift test asserting the derived fields equal `CANONICAL_ADDRESSES` (CI fails if they ever diverge again).
- Audit: confirmed `airaccount` was the ONLY package not sourcing addresses from `@aastar/core`; all others already do.

**SDK Code Integrity Hash**: `1b43e81d4cc394b44ed39665749d678666d9e7571054619f8da09aa64b04fec1`

## [0.20.7] - 2026-06-18

**viem-only — `ethers` fully removed.** Published with deps `viem` + `@simplewebauthn/browser` + `axios` (no ethers), Apache-2.0.

- **ethers → viem migration**: `@aastar/airaccount` (the last ethers consumer) migrated 100% to viem — provider hub, signer hub, all 16 services, BLS packing, signatures. Byte-for-byte equivalence proven by a differential parity layer, now ethers-free golden-fixture tests. `ethers` removed as a dependency everywhere (incl. root devDep + on-chain evidence scripts).
- **Passkey client decoupled from the YAA backend**: `YAAAClient` → `AirAccountClient`, `YAAAServerClient` → `AirAccountServerClient` (deprecated aliases kept). Passkey routes parameterized (`DEFAULT_PASSKEY_ROUTES`, overridable); dead `api.yetanotheraa.com` default removed. Official hosted Relying-Party will be `auth.aastar.io` (served by aNode).
- **Hardening**: typed wrappers for high-risk contract reads (gas budget, fund-custody address, guard allow/deny gates, session-key grant hashes); uint256 args enforced as `bigint`.
- Builds on **0.20.6** (repaired published `.d.ts` types + browser-build fix) and **0.20.5** (single-package `@aastar/sdk/kms` subpath + seamless multi-chain address auto-resolution).
- Tooling: SDK anvil business-regression harness repaired (address sync + honest pass/fail); TypeDoc API-doc generation restored.

**SDK Code Integrity Hash**: `55018672abdf24b1c9a66235c8f9f72d9e0c410ea6e1e5c9701fbca17bd68d5f`

## [0.20.1] - 2026-06-16

Upstream sync (radar-driven, detect→upgrade→test). Four upstreams moved on 2026-06-16:

- **SuperPaymaster** fresh Sepolia redeploy — 17 addresses re-synced + xPNTsToken `setSpenderDailyCapFor`/`spenderDailyCapOverride` (ABI + wrappers + tests).
- **KMS** openapi 0.22.0 → 0.23.0 (coverage already 100%; pin only).
- **AirAccount contracts** v0.18.0-beta.2 → v0.19.0-beta.2 — **FULL Sepolia redeploy**: although v0.19 has no new Solidity logic, the `ACCOUNT_VERSION`/`FACTORY_VERSION` bump to `"0.19.0"` changed bytecode and redeployed **all 11 addresses** (factory `0x52c5190E`, impl `0x7fe62d51`, BLS verifier `AAStarBLSAlgorithm 0xA9EE4f8A`→`0x68c381Ad`, aggregator `0x77f7bf95`, validator-router, session-key/force-exit/delegate/extension/agent-registry/calldata-parser). The DVT real-node E2E verifier was repointed to the new `AAStarBLSAlgorithm`.
- **DVT** (YetAnotherAA-Validator) v1.2.0 → v1.3.0 — new opt-in `POST /signature/sign` `{ status: "pending_confirmation", userOpHash }` response (CONFIRM_ENABLED high-value ops, released via `POST /signature/confirm`). The SDK now surfaces it as a typed `DvtPendingConfirmationError` from the co-sign assembly path instead of silently dropping the node; the full confirm-flow client remains tracked in #82.

Radar fix: the AirAccount address anchor now tracks the **latest upstream CHANGELOG deploy table** (a fixed version-specific E2E doc silently false-greened the v0.19 redeploy); self-contradiction now compares same-version docs only.

Compatible upstreams: AirAccount v0.19.0-beta.2 / SuperPaymaster v5.4.0-beta.1 (2026-06-16 redeploy) / KMS openapi 0.23.0 / DVT v1.3.0.

## [0.20.0] - 2026-06-16

> Compatible upstream versions: **AirAccount contracts v0.18.0-beta.2 · SuperPaymaster v5.4.0-beta.1 · KMS openapi 0.22.0 · DVT (YetAnotherAA-Validator) v1.2.0**.
> (Numbered 0.20.0 — `[0.19.0]` was already used by an earlier, unreleased CHANGELOG entry below.)

### Highlights this cycle
- **100% upstream ABI/API coverage** (KMS / SuperPaymaster / AirAccount), enforced by `scripts/coverage/check-doc-coverage.ts` + an ABI-absent-wrapper audit. Closed across waves: SuperPaymaster pre-flight/price/BLS-timelock reads, the governance/admin surface (Registry/BLSAggregator/DVTValidator/GTokenStaking/MicroPaymentChannel/ReputationSystem), the full AirAccount account/factory/session/agent surface, xPNTsToken finance, KMS `/UnfreezeKey`, and the KMS TEE remote-attestation endpoints (`/attestation` + `.well-known/attestation-measurements*`, #37/#12/#87).
- **AirAccount contracts synced to v0.18.0-beta.2** (full Sepolia redeploy — all 11 addresses updated to the E2E-verified beta.2 deployment, incl. the DVT verifier `AAStarBLSAlgorithm 0xA9EE4f8A`; re-vendored the 2 ABIs that changed: `+guardSetStrictMode` on the account, `-g2Add` on AAStarBLSAlgorithm); `microPaymentChannel` Sepolia config drift fixed.
- **issue #30 — 65+ ABI-absent wrappers repaired**: every action wrapper that called a `functionName` absent from its ABI (v5.x removed/renamed fns; would revert on-chain) was re-verified and fixed — RENAMED where the ABI has the fn, or made to THROW `NOT_IMPLEMENTED` where genuinely removed. `x402.ts` switched to `X402FacilitatorABI`.
- **DVT v1 client aggregation (#63)**: `dvtWire.ts` assembles the combined signature in the verifier's exact `[tier][P256][nodeIds][blsSig]` wire (byte-for-byte vs live Sepolia txs); an SDK-driven real-node E2E proves on-chain `AAStarBLSAlgorithm.validate = 0`.
- **Beta4 — agent on-chain lifecycle**: complete viem agent surface (`agentRegistry` + `airAccountFactory`) + a Sepolia E2E with real tx hashes (createAgentAccount → registerAgent → revokeAgent).
- **YAA #52 (Beta3.1)**: `issueXPNTs` fix, `checkResources`, batch SBT mint, registry queries + `getCommunityProfile` (event back-trace), `configureSBTRules`/`getCommunityStats`, `getMySBTId` fix; + repaired pre-existing dangling getters.
- **WebAuthn #49 challenge-binding (#58)**: TA-nonce → `clientDataJSON` ceremony across the KMS server-side signing paths (mainnet prerequisite before `ENFORCE_TA_CHALLENGE=true`).
- **AirAccount v0.18 + SuperPaymaster v5.4 ABI/address sync**; new `policyRegistry` / `x402Facilitator` / `timelockController` / `agentValidationRegistry` keys; `microPaymentChannel` + `pnts` realigned to the live deployments.
- **Docs**: README "Integration Infrastructure & Upstream Version Pins" (4 stacks) + mandatory `docs/RELEASE-CHECKLIST.md`.

### SuperPaymaster v5.4.0-beta.1 sync (chore/sync-superpaymaster-v5.4)

#### Added
- **`X402Facilitator` ABI** (`@aastar/core` `packages/core/src/abis/X402Facilitator.json`) +
  `X402FacilitatorABI` / `X402FacilitatorArtifact` exports. x402 micropayment settlement
  entrypoint (verify/settle EIP-3009 authorizations + direct xPNTs, operator/facilitator fees).
- **`x402Facilitator`** and **`timelockController`** keys added to `CANONICAL_ADDRESSES` for all
  chains (real on Sepolia `11155111`, zero on `10` / `11155420`). Sepolia x402Facilitator
  `0xFe95a77e4Db593E6EA88000Aad9cD1230BAB4512`, timelockController `0x6cEc100c9CDc6ee7D9EDe0533edD3554E641DdBF`.
  The x402 facilitator address is now resolvable from the SDK (previously absent everywhere).

#### Changed
- Re-synced `SuperPaymaster.json`, `Registry.json`, `PolicyRegistry.json` ABIs from the
  SuperPaymaster repo (v5.4 god-split / L-C surface).
- Fixed stale Sepolia addresses: SP impl comment `0xEB2C9Cb…` → **`0xE84Ae83E…`**;
  `registryImpl` in root `config.sepolia.json` `0x1bd28f89…` → **`0x0B5ce703…`**; added
  `x402Facilitator` / `policyRegistry` / `timelockController` and updated stale `spImpl` in
  `config.sepolia.json`.
- `@aastar/core` `0.18.0` → `0.18.1`.

### KMS v0.20.0 + ERC-8004 SDK integration (feat/kms-v0.20.0-integration)

#### ⚠ BREAKING CHANGES
- **`WebAuthnAssertion`** fields renamed from camelCase to **PascalCase** —
  `challengeId` → **`ChallengeId`**, `credential` → **`Credential`** — to match the KMS
  wire format (the server struct uses `#[serde(rename = "ChallengeId" / "Credential")]`).
  Any code constructing a `WebAuthnAssertion` literal must update the field casing.
  The previous camelCase shape never matched the server and would have been rejected.
- **`KmsBeginGrantSessionAuthResponse`** fields likewise PascalCased: `challengeId` →
  **`ChallengeId`**, `options` → **`Options`** (matches `AuthenticationOptionsResponse`).
- **`KmsSignGrantSessionRequest` / `KmsSignP256GrantSessionRequest`**: `contractScope`
  and `selectorScope` are now **`string`** (was `number`) — the KMS server types are
  `String` (`selectorScope` is a bytes4 hex); numeric values failed server deserialization.
- **Default KMS endpoint** is now `https://kms.aastar.io` (was `https://kms1.aastar.io`).

#### Added
- `KmsHttpClient` — shared KMS HTTP transport (`post`/`get`/`amzPost`/`postWithBearer`).
- `KmsManager` key methods: `sign` (message/EIP-155 tx), `getPublicKey`, `deriveAddress`,
  `listKeys`, `deleteKey`, `changePasskey`; `signTypedDataWithWebAuthn` now posts full
  EIP-712 typed data to `/kms/SignTypedData`; `beginWebAuthnAuth` uses `/BeginAuthentication`.
- `KmsAgentService` (agent TEE-JWT lifecycle), `KmsSessionService` (P256 session keys),
  `KmsPaymentSigner` (Micropayment / GToken EIP-3009 / x402 signers), `KmsMonitorService`
  (health/version/queueStatus/rollbackCounter/stats + `@internal` adminPurgeKey).
- `ERC8004Service` — ERC-8004 agent identity calldata encoders + chain-derived registry addresses.

## [0.19.0] - 2026-03-30

### Breaking Changes
- `AIRACCOUNT_ADDRESSES.sepolia.factory` now points to M7 r6 (`0x42f82d77...`).
  Existing M7 r5 accounts will have different CREATE2 addresses under the new factory.
  Old r5 factory address is preserved as `factoryM7r5Prev` for reference.

### Added
- `AccountManager.buildGuardianAcceptanceHash(owner, salt, factoryAddress, chainId, dailyLimit)` —
  computes the raw keccak256 guardian acceptance hash (guardians sign via `personal_sign`);
  `dailyLimit` is bound into the hash (M9 C-3 front-run fix); `salt` accepts `number | bigint`
- `AccountManager.createAccountWithGuardians(params)` — creates an account with
  two explicit user guardians + community guardian (v0.7+ only); throws for v0.6
- `AccountRecord` new optional fields: `dailyLimit`, `guardian1`, `guardian1Sig`,
  `guardian2`, `guardian2Sig` — persisted for deterministic initCode reconstruction
- `createAccount` accepts new optional `dailyLimit: bigint` parameter; written into
  the factory config so initCode stays identical across process restarts
- `TransferManager`: guardian accounts use `createAccountWithDefaults` for initCode
  (fixes sender/initCode mismatch that would cause bundlers to reject first UserOp)

## [0.18.0] - 2026-03-27

### M7 r5 SDK Upgrade (feat/m7-sdk-upgrade)

#### ⚠ BREAKING CHANGES
- **`AIRACCOUNT_ADDRESSES.sepolia.factory`** now points to the **M7 r5** factory contract (`0xa0007c5db27548d8c1582773856db1d123107383`). The previous M5 address has been renamed to **`factoryM5`** (`0xd72a236d84be6c388a8bc7deb64afd54704ae385`). Any existing code referencing `.factory` will now target the M7 contract, producing **different CREATE2 account addresses**. This affects counterfactual address derivation and asset routing for accounts created via the old factory.
  - Migration: use `.factoryM7` (explicit) or `.factoryM5` (legacy M5 accounts).
- **`SessionKeyService` constructor** no longer has default address values for `sessionKeyValidatorAddress` and `agentSessionKeyValidatorAddress`. Both addresses must now be passed explicitly to avoid cross-network address mismatches.
- **`SessionKeyService.encodeGrantAgentSession`** signature changed: the unused `account` parameter has been removed. Contract uses `msg.sender`; the first argument is now `sessionKey`.

#### Features
- M7 r5 contract addresses and ABIs (`compositeValidator`, `tierGuardHook`, `agentSessionKeyValidator`, `accountImpl`)
- F6 `GuardStateReader` — ETH and per-token spending state
- F7 OAPD address derivation (`getOapdAddress`, `getOapdAddressWithChainId`)
- F4 EIP-1193/6963 — `AirAccountEIP1193Provider`, `announceAirAccount()`, `watchProviders()`
- F4 `personal_sign` and `eth_signTypedData_v4` support in `AirAccountEIP1193Provider`
- F1 Hardware wallets — `connectLedger()` (WebHID ECDSA) + `createYubiKeySigner()` (WebAuthn P256, Tier 2/3)
- F2 Helios — `createHeliosTransport()` (a16z WASM light client viem transport)
- F3 ENS — `resolveEns()`, `lookupAddress()`, `resolveEnsVerified()`

## [0.17.0] - 2026-03-24

### V5.3 Agent Economy SDK
- **[FEATURE]** **@aastar/x402**: x402 payment client — EIP-3009 signing, payment header encode/decode, x402Fetch auto-retry
- **[FEATURE]** **@aastar/channel**: MicroPaymentChannel client — EIP-712 voucher signing, channel lifecycle management
- **[FEATURE]** **@aastar/cli**: CLI tool — `aastar x402/channel/agent` commands
- **[FEATURE]** **Core L1 Actions**: `x402Actions`, `agentActions`, `channelActions` — three new action factories
- **[SYNC]** SuperPaymaster ABI synced to V5.3.0 (x402 settlement, agent sponsorship, facilitator fees)
- **[ADDED]** MicroPaymentChannel ABI
- **[ADDED]** Address constants: microPaymentChannel, agentIdentityRegistry, agentReputationRegistry (Sepolia deployed)

## [0.24.1] - 2026-06-20
**SDK Code Integrity Hash**: `024642f426c83addcf4a1db7264a1858e89835c4752b83010ea0e5182e30bf76`
*(Excludes metadata/markdown to ensure stability / 排除文档文件以确保哈希稳定)*
### ⛽ Gas Fee Strategy (PaymasterClient)
- **[FIX]** **Testnet/Mainnet Split Gas Pricing**:
  - Testnets (Sepolia, OP-Sepolia, Anvil, chainId 11155111/11155420/31337): apply `0.5 Gwei` floor on `maxPriorityFeePerGas` / `1.0 Gwei` floor on `maxFeePerGas`. Fixes `WaitForUserOperationReceiptTimeoutError` caused by Alchemy bundler's minimum fee requirement being higher than OP Sepolia's near-zero network fee.
  - Mainnet: pure dynamic `estimateFeesPerGas() × 1.2` (reduced from 1.5× — saves ~20% on reported maxFee while maintaining sufficient overhead for OP FIFO sequencer).
  - Strategy applied in both `estimateUserOperationGas` and `submitGaslessUserOperation`.
  - Added diagnostic log: `[PaymasterClient] Gas Pricing: TESTNET (0.5 Gwei floor) | priority=... maxFee=...`
- **[FIX]** **Retry Loop Extended**: max attempts 3→5 (`attempt < 4` guard), handles compound PVG + fee bump errors within a single retry pass.

### 🧰 Keeper (Price Updater)
- **[FIX]** **`cast send` Hang Prevention**: `runCastSend()` now applies a hard 90-second `SIGKILL` timeout. Previously `--timeout 60` only controlled receipt polling, not the subprocess itself—causing the keeper to block indefinitely when Alchemy rate-limited `eth_estimateGas`.
- **[FIX]** **Explicit Gas Price**: before each `sendUpdate`, keeper fetches `getGasPrice()` and passes it via `--gas-price` to `cast send`, eliminating cast's own `eth_estimateGas` call (which was the source of the hang).
- **[IMPROVED]** Print on-chain `priceStalenessThreshold()` for both SuperPaymaster and PaymasterV4 during INIT.
- **[IMPROVED]** Keeper anomaly docs: Chainlink stale + external/Chainlink deviation + external short-term volatility alerts documented.

### 🌐 Network Config
- **[FIX]** OP Sepolia `blockExplorer` URL changed from `optimism-sepolia.blockscout.com` → `sepolia-optimism.etherscan.io`. Affects all scripts/tests that use `getTxUrl('op-sepolia', ...)`.

### 📊 Analytics (Paper3 / Paper7)
- **[ADDED]** `packages/analytics/data/paper_gas_op_mainnet/2026-02-17/`: PaymasterV4 (n=36) and SuperPaymaster (n=43) baseline CSVs with strict single-UserOp + ERC20-transfer filter.
- **[ADDED]** `packages/analytics/data/paper_gas_op_mainnet/2026-02-18/`: Relaxed-filter datasets with sender field; `super_t2_sender.csv` (n=50) satisfies Paper3 SuperPaymaster sample target.
- **[ADDED]** `packages/analytics/data/industry_paymaster_baselines.csv`: Alchemy Gas Manager (n=50, mean=257k gas) and Pimlico ERC-20 PM (n=50, mean=387k gas) on-chain baselines for industry comparison.
- **[ADDED]** `packages/analytics/data/gasless_metrics_detailed.csv`: 21 records with full L1/L2 fee decomposition (L2GasUsed, L1GasUsed, L1FeesPaid, L2FeesPaid, ActualGasUsed).
- **[ADDED]** Paper7 exclusive datasets: credit cycle JSON records and liquidity velocity simulation CSVs under `data/paper7_exclusive/`.
- **[ADDED]** `packages/analytics/run_paper7_exclusive_data.sh` for Paper7 data pipeline.
- **[CHANGED]** `gasless_data_collection.csv` (v1): +31 rows; `gasless_data_collection_v2.csv`: +28 rows including T1=22, T2_SP_Credit=22, T5=20.
- **[ADDED]** `scripts/collect_paymaster_baselines.ts`: reproducible on-chain event collection with `--strict-transfer`, `--single-userop`, `--n`, `--append`, `--dedupe` flags.
- **[ADDED]** `scripts/collect_eoa_erc20_baseline.ts`: raw EOA ERC20 transfer baseline for comparison.
- **[ADDED]** `scripts/compute_cost_summary.ts`: aggregation script for cost breakdown tables.

### 📚 Docs
- **[CHANGED]** Regenerated API markdown output under `docs/api/`.
- **[ADDED]** `docs/guide/keeper.md`: keeper quickstart, anomaly detection, Telegram setup.

### 🗂️ Analytics Consolidation
- **[REFACTOR]** Moved all data collection scripts from `scripts/` root into `packages/analytics/scripts/` (git mv, history preserved):
  `collect_paymaster_baselines`, `collect_eoa_erc20_baseline`, `collect_industry_baseline`, `compute_cost_summary`, `gasless-collect`, `paper7-exclusive-data`, `paper7_credit_loop`, `paper7_reputation_credit`, `run_analytics_coordinator`, `run_paper7_exclusive_data.sh`, `fetch-tx-hashes`
- **[ADDED]** `packages/analytics/docs/OP_Mainnet_Gas_Analysis_Report.md`: gas cost evidence for Paper3/Paper7 (L1/L2 breakdown, PVG analysis, industry comparison, Mermaid pie charts).
- **[UPDATED]** `packages/analytics/README.md`: new directory tree, updated all command paths to `packages/analytics/scripts/...`.
- **Note**: Root shell scripts (`run-keeper-main.sh`, `run-optimism-tx-data.sh`, etc.) are unaffected — they only call `scripts/l4-*.ts` and `scripts/keeper.ts` which remain in place.

### 🔒 SDK Integrity
**SDK Code Integrity Hash**: `cebb1de2edab0fb63cd47684ab977488410262fa50e485045abc5901894a3f6f`
*(Excludes metadata/markdown to ensure stability / 排除文档文件以确保哈希稳定)*


## [0.16.22] - 2026-02-11
**SDK Code Integrity Hash**: `89da8c80ebe6ad8b06adbd4946a00817b18ae79296550709b20bd9ca3af424f9`
*(Excludes metadata/markdown to ensure stability / 排除文档文件以确保哈希稳定)*

### 🌍 Multi-Chain & Infrastructure
- **[FEATURE]** **Optimism Mainnet Canonical Addresses**:
  - Embedded canonical contract addresses for Optimism (Chain ID: 10) in `@aastar/core`.
  - `NETWORK=optimism` now resolves `CHAIN_ID=10` by default when `CHAIN_ID` is not provided.

## [0.16.21] - 2026-02-11
**SDK Code Integrity Hash**: `8d5b71dda17e2cb746e4a70a98020b9c7a4f2b390a82804f7e5924b0bf5a51d5`
*(Excludes metadata/markdown to ensure stability / 排除文档文件以确保哈希稳定)*

### ⚡ Gasless Execution
- **[FIX]** **Paymaster V4 Cached Price Staleness**:
  - `PaymasterClient` now treats stale `cachedPrice` as invalid.
  - Testnets auto-refresh via `updatePrice()` when needed; mainnet requires a running keeper.
- **[FIX]** **Native UserOp Gas Defaults**:
  - Reduced `UserOpScenarioType.NATIVE` `verificationGasLimit` to a more realistic default.

### 🧰 Tooling & Regression
- **[ADDED]** EIP-2537 precompile verification script and historical check dataset.

## [0.16.20] - 2026-02-07
**SDK Code Integrity Hash**: `0a9c8a4a778bb1b64fac6fd29d8a61b2f9b02566f33b2de65e2c26e536f9fff8`
*(Excludes metadata/markdown to ensure stability / 排除文档文件以确保哈希稳定)*

### 🌍 Infrastructure & Distribution
- **[FEATURE]** **Canonical Address Solidification**: 
  - Hardcoded canonical contract addresses for Sepolia and OP Sepolia within `@aastar/core`.
  - SDK is now self-contained and ready for NPM distribution without requiring local JSON configuration files.
  - Maintained三级优先级 (ENV > Local Config > Canonical Defaults) to support flexible development.
- **[FIX]** **SuperPaymaster Price Refresh**: 
  - Fixed "UserOperation expired" errors by enabling automated owner-based price refreshes in `l4-setup.ts`.
  - Added Chainlink fallback logic for robust price synchronization on testnets.

### 🛡️ Integrity
- **[ADDED]** **SDK Source Integrity Monitoring**: 
  - Introduced a unique SHA-256 hash for the entire SDK source tree to ensure verifiable releases.

## [0.16.17] - 2026-02-07

### 🌍 Infrastructure & Compatibility
- **[FEATURE]** **Universal Browser Support**:
  - Refactored `@aastar/core` to support dual entry points via `package.json` exports.
  - **Browser**: Adds `dist/index.js` (Pure ESM) which is free of Node.js specific code (`createRequire`, `fs`), ensuring seamless integration with Vite/Next.js.
  - **Node.js**: Adds `dist/index.node.js` which automatically loads local `config.{network}.json` for backward compatibility.
  - Refactored `constants.ts` to support dynamic configuration injection via `applyConfig()`.

## 🛡️ SDK Integrity Verification

> [!IMPORTANT]
> **Security First**: To ensure you are using an official release and protect your private keys, always verify the integrity of the SDK code immediately after installation.

**Current Code Integrity Hash (v0.19.0)**:
`b39aef2a020061c37725d0e80295774dadadc7ff964fef723287bfc71520dbb5`

To verify, run this stable command (excludes non-code markdown files):
```bash
git ls-files -z | grep -zvE '\.md$' | xargs -0 sha256sum | sha256sum
```
The resulting hash must match the one listed in the [Changelog](./CHANGELOG.md).

## [0.16.14] - 2026-01-24

### 🌍 Multi-Chain & Infrastructure
- **[FEATURE]** **Standardized Config Loader**: 
  - Restructured `config.ts` to implement a robust multi-chain loading priority.
  - Internal Protocol Contracts (Registry, Paymasters, GToken) now strictly prioritize `config.{network}.json`.
  - Infrastructure Contracts (EntryPoint, PriceFeed) and URLs (RPC, Bundler) are now sourced primarily from `.env.{network}`.
- **[FIX]** **Hardcoded Dependencies Cleanup**: 
  - Successfully removed all remaining hardcoded `0x` addresses and `sepolia` string literals across all `tests/` and `examples/` scripts.
  - Every script now supports the `--network` parameter for dynamic environment switching.
- **[REPAIR]** **Reputation Activity Metrics**: Corrected the `opName` lookup string in `l4-reputation-tiers.ts` to align with the latest `l4-setup.ts` state files.

### ⚡ Gasless Execution Efficiency
- **[IMPROVED]** **SuperPaymaster Verification Tuning**: 
  - Implemented "Dynamic Nominal Gas Tuning" in `SuperPaymasterClient` to optimize `paymasterVerificationGasLimit`.
  - Resolved "Efficiency too low" (AA30) errors on Alchemy/Optimism-Sepolia by maintaining a strict balance between execution safety and bundler efficiency ratios (>= 0.4).

## [0.16.13] - 2026-01-23

### 🛡️ Security & Stability
- **[SECURITY]** **Strict Address Resolution**: 
  - Enforced strict environment variable lookup for third-party contract addresses (`entryPoint`, `simpleAccountFactory`, `priceFeed`) on non-Anvil networks.
  - Eliminated fallback to outdated `config.json` files to prevent deployment misconfigurations.
- **[SECURITY]** **Token Transfer Limits**:
  - Updated ABI to reflect new `MAX_SINGLE_TX_LIMIT` enforcement in `xPNTsToken`. SDK transactions respecting standard limits will continue to work; anomalous high-value transfers may now revert at the contract level.
- **[SECURITY]** **Operator Firewall**:
  - Updated ABI to reflect `autoApprovedSpenders` logic. 

### ⚙️ Core Improvements
- **[FIX]** **xPNTsToken Initialization**: Adjusted factory logic to support EIP-1167 Minimal Clones using `initialize()` pattern.
- **[SYNC]** **Contract ABIs**: Synchronized all ABIs with `SuperPaymaster` `v3.6.3`, including new governance functions `renounceFactory` and `emergencyRevokePaymaster`.


## [0.16.11] - 2026-01-19

### 📊 Gas Analytics & Reporting (New Package)
- **[NEW]** Added `@aastar/analytics` package for comprehensive gas analysis.
- **[FEATURE]** `CostCalculator`: Calculates true L1/L2 gas costs, protocol profit (10% premium + buffer), and user savings.
- **[FEATURE]** `AttributionAnalyzer`: Simulates L2 costs (Optimism model) to provide "Apple-to-Apple" competitiveness comparisons.
- **[REPORT]** `gas-analyzer-v4.ts`: Generates detailed reports showing ~28% protocol profit margin and ~400x savings vs. Ethereum L1.

### SDK & Core Enhancements
- **[FIX]** **Anni Gasless Fix**: Updated `l4-setup.ts` to use `updatePriceDVT` for refreshing stale SuperPaymaster price cache, preventing "UserOperation expired" errors.
- **[FIX]** **Duplicate Build Fix**: Resolved merge conflicts and duplicate identifiers in `packages/core` actions (e.g., `contracts.ts`, `actions/index.ts`).
- **[FIX]** **Build System**: Removed residual `*.test.ts` files in modification directories to ensure clean `tsc` builds.

### Regression & Testing
- **[IMPROVED]** `L4 Regression`: Full automation for Setup -> Funding -> Gasless Transactions -> Analytics.
- **[FEATURE]** `DVT Price Update`: Integrated DVT signature generation in test setup to simulate authenticated price updates.

- **[BREAKING]** Decoupled development and production build configurations.
  - Added `tsconfig.build.json` for strictly clean production builds (`pnpm build`).
  - Updated root `tsconfig.json` to retain `paths` mappings for rapid development (`tsx`).
  - Updated all `packages/*/tsconfig.json` to extend the build configuration.
- Fixed `packages/core` build output to correctly generate type definitions (`.d.ts`).

### SDK Core (`@aastar/core`)
- **[CHANGED]** `BaseClient` visibility update.
  - Changed `client` and `getStartPublicClient` from `protected` to `public` to allow easier extension and debugging in consuming applications.
- **[Check]** Standardized ABI exports.
  - Updated `abis/index.ts` to support both array-based and object-based (`{ abi: [] }`) ABI JSON formats, resolving compatibility issues with external artifacts.

### SDK Operator (`@aastar/operator`)
- **[FIXED]** ABI Property Access.
  - Fixed runtime error where `PaymasterOperatorClient` attempted to access `.abi` on a raw ABI array. Now uses the standardized `PaymasterABI` export.

### SDK EndUser (`@aastar/enduser`)
- **[FIXED]** `UserClient` build failure due to `BaseClient` visibility issues.

### Testing & Regression
- **[ADDED]** `run_sdk_regression.sh` now supports a strict `sepolia` environment mode with correct `.env` loading (`set -a`).
- **[ADDED]** `extract_v3_abis.sh` integration for reliable ABI synchronization from the SuperPaymaster project.
