# Upstream Sync — Monitoring & Upgrade Playbook

The AAStar SDK is a thin, **version-pinned** integration layer over four upstream
stacks. When any upstream cuts a release, the SDK's vendored ABIs / pinned
versions / contract addresses / API references go stale and on-chain calls
silently break (wrong selector, stale address, incompatible wire format). This
doc explains **how drift is detected** and **how to upgrade** when it is found.

It complements [RELEASE-CHECKLIST.md](./RELEASE-CHECKLIST.md): the checklist is the
gate you must pass to ship; this doc is the radar that tells you *when* you need to.

## The four upstreams and their anchors

| Upstream | Repo | Truth lives in | SDK anchor |
|---|---|---|---|
| **AirAccount** (contracts) | `AAStarCommunity/airaccount-contract` | latest git tag · `docs/e2e/E2E_TESTDATA_v*.md` + `docs/deployment-v0.18.md` · ABIs in `abi/<C>.full.json` / `out/` | README pin · `packages/core/src/addresses.ts` · `abis/AAStarAirAccount*.json`, `AgentRegistry/SessionKeyValidator/ForceExitModule/AirAccountExtension/AAStarBLSAlgorithm.json` |
| **SuperPaymaster** | `AAStarCommunity/SuperPaymaster` | latest git tag · `deployments/config.sepolia.json` · `abis/` + `out/` | `CANONICAL_ADDRESSES` SP keys · `abis/{SuperPaymaster,Registry,PolicyRegistry,X402Facilitator,BLSAggregator,DVTValidator,GTokenStaking,MySBT,ReputationSystem,xPNTsToken,xPNTsFactory,PaymasterFactory,MicroPaymentChannel}.json` |
| **KMS** | `AAStarCommunity/AirAccount` | `kms/docs/api/openapi.yaml` (`info.version` + path set) | `packages/airaccount/src/server/services/kms-*.ts` path strings |
| **DVT** (validator nodes) | `AAStarCommunity/YetAnotherAA-Validator` | latest git tag · `src/utils/bls.util.ts` (`BLS_DST`) · `hash-to-g2.golden.spec.ts` | `packages/core/src/crypto/dvtWire.ts` + `hashToField.ts` (`BLS_POP_DST`) |

## How detection works

Two complementary detectors:

### 1. Local radar — `scripts/upstream/upstream-radar.ts` (authoritative)

Runs against the 4 upstream repos checked out **side-by-side** on your machine
(`/Users/jason/Dev/aastar/{airaccount-contract,SuperPaymaster,AirAccount,YetAnotherAA-Validator}`).
For each upstream it checks 4 anchors and a best-effort self-contradiction scan:

- **version** — SDK pin (parsed from the README table + `addresses.ts` header) vs the
  upstream's latest git tag (for KMS: vs `openapi.yaml` `info.version`).
- **ABIs** — for each vendored ABI, it diffs the **function-name set** against the
  upstream ABI. Resolution order: `abi/<C>.full.json` (merged proxy+extension ABI) →
  `abis/<C>.json` → `out/<C>.sol/<C>.json`. Reports:
  - `+coverage-gap` — upstream has a function the SDK lacks.
  - `-absent-wrapper` — the SDK ABI has a function the upstream dropped (the **#30**
    class: a wrapper would call a selector the deployed contract no longer has).
- **addresses** — `CANONICAL_ADDRESSES[11155111]` (Sepolia) vs the upstream deploy
  record (SP `config.sepolia.json` · AirAccount `E2E_TESTDATA_*`).
- **API (KMS)** — every `openapi.yaml` path referenced by a `kms-*.ts` service.
- **self-contradiction** (best-effort, labelled) — e.g. the upstream's own two
  deployment docs disagree on a contract address; a repo version constant ≠ its tag.

```bash
pnpm run upstream:check                       # full report, exits non-zero on any drift
pnpm exec tsx scripts/upstream/upstream-radar.ts --upstream superpaymaster
pnpm exec tsx scripts/upstream/upstream-radar.ts --json     # machine output for CI/tooling
pnpm run upstream:rehearse                    # + run the gates + print an upgrade worklist
```

`--rehearse` additionally runs the real gates (`check:addresses`, the doc-coverage
checker, `@aastar/core` build) and prints a concrete **upgrade worklist** — which SDK
files a sync PR would touch per detected drift. It is a **dry-run; it never modifies
any SDK file.**

### 2. GitHub watcher — `.github/workflows/upstream-watch.yml` (advisory)

A scheduled (daily 06:00 UTC) + manual (`workflow_dispatch`) Action. CI has no
local upstream checkouts, so it can't run the full radar; instead it uses `gh api`
to fetch each upstream's **latest release/tag**, compares it to the README pin, and
opens/updates a tracking issue (`upstream drift: …`) when an upstream moved ahead.
It is **advisory only — it never fails the build.** It exists to nudge a human to
run the local radar.

## The upgrade flow

When drift is found (locally or via the watcher issue):

1. **Pull** the relevant upstream repo(s) to latest.
2. **Radar** — `pnpm run upstream:check` to see exactly what drifted.
3. **Rehearse** — `pnpm run upstream:rehearse` for the file-level worklist + gate status.
4. **Update the 4 anchors** (per the worklist):
   - **ABIs** → re-vendor changed `*.json` into `packages/core/src/abis/`.
   - **version pin** → README Integration table + `addresses.ts` header comment.
   - **addresses** → `CANONICAL_ADDRESSES` in `addresses.ts` + the `config.*.json`.
   - **API / wire** → `kms-*.ts` path strings · `dvtWire.ts`/`hashToField.ts`.
   - If a **self-contradiction** is flagged, resolve it *in the upstream repo* first —
     decide which value is authoritative — then sync.
5. **Gates** — run the [RELEASE-CHECKLIST.md](./RELEASE-CHECKLIST.md) §2 gates:
   `pnpm run check:addresses`, the doc-coverage checker (100%), the ABI-absent-wrapper
   audit, `pnpm -r build`, `pnpm -r test`. Re-run `pnpm run upstream:check` until it
   exits 0.
6. **Release** — follow [RELEASE-CHECKLIST.md](./RELEASE-CHECKLIST.md) §3 (version bump,
   CHANGELOG, tag, release notes stating the upstream versions this release targets).

```
watcher issue ──┐
                ├─► upstream:check ─► upstream:rehearse ─► update 4 anchors ─► RELEASE-CHECKLIST gates ─► release
local notice  ──┘
```

## Interpreting common findings

- **`-absent-wrapper`** is the most dangerous: a wrapper now calls a selector the
  deployed contract dropped → guaranteed on-chain revert. Fix before anything else.
- **`addresses` drift after a full upstream redeploy** is common — a same-version
  redeploy (the git tag didn't move, but `config.sepolia.json` did). The version
  anchor stays green while addresses go red; trust the address anchor.
- **`self-contradiction` on AirAccount docs** usually means an older `deployment-v*.md`
  lingers next to the newer `E2E_TESTDATA_*` record. The SDK tracks the E2E (latest)
  values; the stale doc should be reconciled upstream.

## Sync log

| date | upstreams synced | PR | on-chain evidence |
|---|---|---|---|
| 2026-06-30 | AirAccount contracts **v0.21.0 → v0.22.0** (#156 — **breaking factory ABI**: `createAccount` 3→8 args (+ownerP256X/Y, nonce, deadline, ownerSig), `getAddress`/`getAddressWithChainId` 3→5 args (+ownerP256X/Y); passkey + validator wired **AT BIRTH**; account ABI `initialize` 4→6 + `validatorRouter()`) · KMS openapi 0.27.2→0.27.3 · DVT v1.6.0→v1.7.0 (**separate upstreams, NOT in this sync**) | #245 (sync) · #247 (initCode fail-loud + E2E) | radar AirAccount **abis: in-sync**. Factory wrapper `createAccount`/`getAddress`/`getAddressWithChainId` gained OPTIONAL `ownerP256X/Y` (+nonce/deadline/ownerSig for createAccount) = direct-mode defaults (backward-compat) + `createNonces(owner)`. Account ABI re-vendored (+`validatorRouter`, `initialize` 6-arg); `AIRACCOUNT_FACTORY_ABI` const + selector-parity test → v0.22.0 selectors (`0x5f6314a2`/`0xbd4bcf83`/`0xaf799fc6`). Addresses → v0.22.0 (factory `0x0eb0E7a6…`, impl `0x1cE314…`, ext `0xF736C2…`, agentRegistry `0x19d89A…` — all on-chain verified); README pin → v0.22.0. initCode-deploy now **fails loud** (createAccount direct mode needs msg.sender==owner; KMS-relay ownerSig tracked #246). **Live Sepolia E2E PASSED (3 paths)**: WebAuthn passkey-at-birth `0x7c4589…` `validateUserOp(0x0a)==0`; guardian tier-raise `0x749A23…` tx `0x7c3becc5…`; raw-P256 `0x6eC46a…` `validateUserOp(0x05)==0` (evidence `docs/onchain-evidence/v0.22.0.md`). Released `@aastar/sdk@0.30.0`. |
| 2026-06-28 | AirAccount contracts **v0.20.0 → v0.20.2** (P-256 mixed-sig module governance #127; `installModule`/`uninstallModule` relocated to AirAccountExtension — **breaking guardian-sig encoding**, see below) · SuperPaymaster **v5.4.0-beta.1-redeploy → v5.4.1-rc.1** (two-step slash guard #249 + BLS_AGGREGATOR wiring #S3; FULL Sepolia redeploy ~18 addr) · KMS **openapi 0.23.2 → 0.26.1** (server-side lowercase normalization — SDK already aligned in 0.27.1; api in-sync) · DVT **v1.5.0 → v1.6.0** (wire-format unchanged; radar 4/4) | #210 | radar 4/4 in-sync; `installModule`/`uninstallModule` rewritten to v0.20.2 `abi.encode(uint8[] signerIdxs, bytes[] sigs[, bytes moduleInitData])` + `GUARDIAN_SIG_VERSION=4` digest (inner, no EIP-191 prefix) with on-chain `moduleManagementNonce()` (#75); also `proposeModuleInstall`/`setModuleInstallTimelock` encoders + ECDSA & **P-256** guardian challenge builders — 20 byte-exact/golden tests. New SP `queueSlash`/`cancelSlash`/`initBLSAggregator` wrapped (slash flow now requires `queueSlash` first). **On-chain (Sepolia)**: all synced contracts deployed · `superPaymaster.version()=="SuperPaymaster-5.4.1"` · Mycelium `PNTsPaymasterV4` `0xC827…4a46` adopted (`PMV4-Deposit-4.5.0`, `isTokenSupported(pnts)==true`). Codex-reviewed (fixed a double-EIP-191 HIGH). **Live Sepolia E2E PASSED** (#209): guardianed account `0xC8Db9624…`, install `sigsRequired=1` tx `0xc21e55bd…` + uninstall `sigsRequired=2` tx `0x71741963…` accepted by the deployed AirAccountExtension (evidence `docs/onchain-evidence/v0.20.2-module-governance.md`). |
| 2026-06-20 | DVT **v1.4.0 → v1.5.0** (wire-format unchanged — always-on testnet nodes + clone-and-deploy; radar 4/4) · AirAccount v0.20.0 / KMS 0.23.2 / SuperPaymaster v5.4.0-beta.1-redeploy (in-sync) — released as `@aastar/sdk@0.24.0` | #123 (BLS handleOps + DEFAULT_DVT_NODES) · #124 (ensureValidatorRouter) | [`docs/onchain-evidence/v0.23.0-acceptance.md`](./onchain-evidence/v0.23.0-acceptance.md) — **all 10 acceptance rows FEATURE-MET** incl. DVT through `EntryPoint.handleOps` (`UserOperationEvent success=true`, tx `0xc01eae6f…`) + `validate==0` + ECDSA-rejected; 2-round Codex FEATURE-MET challenge |
| 2026-06-20 | AirAccount contracts **v0.20.0** (P-256 guardian + 8-field `InitConfig`, breaking) · KMS **openapi 0.23.1** · DVT **v1.4.0** · SuperPaymaster v5.4.0-beta.1-redeploy (in-sync) | #112 (sync) · #113 (process + evidence) | [`docs/onchain-evidence/v0.20.0.md`](./onchain-evidence/v0.20.0.md) — **5/5 contract surfaces decode-verified** (recovery, sponsored-gasless, session, weighted-sig, agent-lifecycle); surfaced + fixed the v0.20.0 algId-prefix ECDSA UserOp-signature break (AA24). KMS create→sign BLOCKED (no `KMS_E2E_API_KEY`); DVT BLS BLOCKED (upstream #93). P-256 guardian feature deferred to Batch 2 (#110) |
