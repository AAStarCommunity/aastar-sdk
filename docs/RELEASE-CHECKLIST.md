# Release Checklist — @aastar/sdk

**MANDATORY** on every release, and **whenever any upstream cuts a new GitHub release**
(AirAccount contracts / SuperPaymaster / KMS). The SDK's value depends on staying in
lockstep with these three; a silent version drift breaks on-chain calls (wrong
ABI/selector) or points at stale addresses.

The SDK's compatibility is anchored to upstream by **four artifacts** — keep all four in sync:
**ABI files · version pin · contract addresses · API docs (openapi)**.

---

## 1. Upstream version sync — REQUIRED, do this FIRST

For **each** upstream (AirAccount contracts, SuperPaymaster, KMS, **DVT validator nodes**):

- [ ] **Check the upstream's latest GitHub release/tag.** Record the version + release URL.
- [ ] **ABI files** — re-vendor any changed contract ABI into `packages/core/src/abis/`
      (from the upstream's `abis/` or forge `out/`). No inline `parseAbi` for contract calls.
- [ ] **Contract addresses** — update `packages/core/src/addresses.ts` (`CANONICAL_ADDRESSES`)
      and the per-network `config.*.json` from the upstream deploy record.
- [ ] **API docs** — for KMS, bump the `openapi.yaml` version reference and wire any NEW
      endpoint in a `packages/airaccount/src/server/services/kms-*.ts` service.
- [ ] **DVT wire** — if the validator/`AAStarBLSAlgorithm` changes the combined-sig
      wire (tier/nodeIds/G2 layout), update `packages/core/src/crypto/dvtWire.ts` and
      re-assert the golden vectors byte-for-byte against the node + a live on-chain tx.
- [ ] **Version pin** — update the **Integration Infrastructure** table in `README.md`
      AND the `addresses.ts` header comment with the exact upstream version targeted.

## 2. Verify (gates)

- [ ] `pnpm run check:addresses` — no Sepolia drift (config.*.json ⇄ CANONICAL_ADDRESSES).
- [ ] `pnpm exec tsx scripts/coverage/check-doc-coverage.ts` — **coverage 100%**
      (every upstream ABI/API function has an SDK wrapper).
- [ ] **ABI-absent-wrapper audit** — no action wrapper calls a `functionName` that is
      absent from its ABI (the issue #30 class — these revert on-chain). The renamed/removed
      functions in a new upstream release are the usual culprits.
- [ ] `pnpm -r build` clean · `pnpm -r test` green.

## 3. Release

- [ ] Bump `@aastar/core` (+ affected packages) version.
- [ ] Update `CHANGELOG.md`.
- [ ] Tag + GitHub release. The release notes MUST state the three upstream versions this
      SDK release is compatible with (AirAccount vX, SuperPaymaster vY, KMS openapi vZ).
- [ ] If addresses come from an unmerged upstream deploy-record branch, hold the **npm publish**
      until that record lands on the upstream's `main` (note it in the release).

---

> Rationale: the SDK is a thin, ABI/address/API-pinned integration layer over AirAccount,
> SuperPaymaster, and KMS. Treating "sync to the latest upstream release" as an explicit,
> verifiable release gate (not an afterthought) is what keeps `@aastar/sdk` trustworthy.
