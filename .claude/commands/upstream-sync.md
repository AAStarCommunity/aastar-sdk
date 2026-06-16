---
description: Detect → upgrade → test the four upstream infra pins (AirAccount / SuperPaymaster / KMS / DVT) and prep a release
---

Run the upstream-drift radar for this SDK's four pinned infrastructure stacks
(AirAccount contracts, SuperPaymaster, KMS, DVT/YetAnotherAA-Validator) and drive
the full detect → upgrade → test → publish loop. This wraps `scripts/upstream/upstream-radar.ts`.

## 1. Detect

Run the radar and report the per-upstream table (version / ABIs / addresses / API-or-wire /
self-contradiction):

```bash
pnpm run upstream:check        # exits non-zero on any drift
pnpm run upstream:rehearse     # same + real gates + a file-level upgrade worklist (no mutation)
```

The four local repos at `/Users/jason/Dev/aastar/{airaccount-contract,SuperPaymaster,AirAccount,YetAnotherAA-Validator}`
are the first-hand source — keep them at their latest dev/tag before reading. A moving git
tag is NOT sufficient evidence: SuperPaymaster and AirAccount have both done **tag-invisible
full Sepolia redeploys** (every address changed without the tag moving). Trust the upstream's
own latest CHANGELOG "Deployed" table / openapi `info.version` / deployment record over the tag.

## 2. Assess real impact (not just the address)

On any drift, work out the *interface* consequence before deciding 要不要改/怎么改:
- **addresses** — did the contract redeploy (new bytecode → new address), or just a doc edit?
- **ABIs** — added function = coverage gap to wrap; removed/renamed = an ABI-absent-wrapper that would revert on-chain (issue #30 class).
- **API / wire** — KMS openapi path changes; DVT `/signature/sign` response shapes (e.g. v1.3.0 `pending_confirmation`) and the combined-sig byte layout.
- If two upstream docs disagree, that's **their** bug — file an issue upstream; do NOT silently patch their repo to green our check.

## 3. Upgrade + test

Apply the sync (addresses in `packages/core/src/addresses.ts` = single source of truth;
ABIs vendored under `packages/core/src/abis/`; README + `addresses.ts` header pins; CHANGELOG).
Then re-run **every** gate until all green:

```bash
pnpm -r build
pnpm run upstream:check          # exit 0, all in-sync
pnpm run check:addresses         # all config.*.json match canonical
pnpm exec tsx scripts/coverage/check-doc-coverage.ts   # 100%
pnpm -r test                     # 0 failures
```

Validate every changed address with viem `getAddress` (strict EIP-55).

## 4. Review + release — guardrails (do NOT skip)

- Self-review, then a strict adversarial **Codex** review (`codex:codex-rescue`); iterate until it approves.
- Open a PR; hand off for **independent** approval. **Never self-approve, never self-merge, never
  relax branch protection** (no `--admin`, no disabling `enforce_admins`).
- **Never cut a release while any drift is unresolved** or any gate is red. `npm publish` is
  human-gated (requires the maintainer's `npm login`).
- Record the upstream version-sync in `docs/RELEASE-CHECKLIST.md` as a required release step.

$ARGUMENTS
