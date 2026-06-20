# Changelog

All notable changes to this project will be documented in this file.

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

## [0.21.1] - 2026-06-20
**SDK Code Integrity Hash**: `5d6558019480022f7367e5d1562dea0c4c54c034b3e6e86d2c7211c2cca4e1b9`
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
