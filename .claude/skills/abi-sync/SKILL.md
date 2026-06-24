---
name: abi-sync
description: Sync the SDK against the upstream contract repos (SuperPaymaster / AirAccount / launch) and update the SDK accordingly. Use when an upstream contract changed or was redeployed, when adding a new contract, or as periodic ABI maintenance. Drives the full flow — scan for missing/drifted ABIs, refresh them, triage each change (low-freq → expose via ABI; high-freq → wrap/adjust a client), update addresses, and verify with build + tests.
---

# abi-sync — upstream ABI sync + SDK update

The SDK wraps three upstream contract repos. They change independently (functions added, signatures
changed, contracts redeployed). This skill keeps the SDK in step: **scan → refresh ABIs → decide what
to wrap → update code → verify**. Two layers:

- **ABI layer** (raw `packages/core/src/abis/*.json`) — must be complete + match upstream.
- **Wrapping layer** (clients/actions) — consumer-facing flows get a wrapper; the rest are reached via
  the exported ABI + viem directly. **Do NOT try to wrap every function** — only the high-frequency,
  consumer-facing ones.

## Upstream repos (sibling checkouts)

| Level | repo (sibling) | what |
|---|---|---|
| SuperPaymaster | `../SuperPaymaster` | paymaster, registry, GToken, SBT, xPNTs, DVT, x402 |
| AirAccount | `../airaccount-contract` | 4337 account V7, guard, validators, session, extension, parsers |
| launch (sale) | `../../mycelium/launch` | SaleContractV2, APNTsSaleContract, BuyHelper |

KMS is an HTTP API (no on-chain ABI) — out of scope for this skill (wrapped in `@aastar/airaccount`).

## Procedure

1. **Fresh upstream.** Make sure the sibling repos are checked out and **`forge build`-ed** (the
   scan reads `out/<C>.sol/<C>.json`). If a repo is absent, that level is skipped — note it.

2. **Scan.** `pnpm run abi:sync`
   - Reports **missing** contracts (upstream-concrete, not in SDK) and **drifted** ABIs (SDK copy ≠
     upstream signature set), plus the exact added/removed functions/events/errors.
   - Clean → nothing to do, stop here.

3. **Refresh the raw ABIs.** `pnpm run abi:sync --fix`
   - Copies missing ABIs + overwrites drifted ones from upstream `out/`.
   - For each **new** contract it copied: add the import + export to `packages/core/src/abis/index.ts`
     (mirror an existing entry: `import XData from './X.json' with { type: 'json' };` +
     `export const XABI = (XData as any).abi || XData;`).
   - `git diff packages/core/src/abis/` to review.

4. **Triage the changes.** `pnpm run abi:triage`
   - Classifies each changed function and says whether it's already referenced in SDK source:
     - **LOW** (admin/governance/internal: `set*`, `pause`, `withdraw`, `upgrade*`, `initialize`, …)
       → **expose via the ABI only.** No wrapper. Done.
     - **HIGH** (consumer-facing: `buy`, `transfer`, `mint`, `stake`, `open/close/settle`, `grantSession`,
       common `get*` reads, …) → **wrap or adjust** a client/action method.
     - **REVIEW** → judge by hand.
   - Exit code 1 if a function was **removed upstream but still used in SDK source** (breakage).

5. **Act on the triage.**
   - HIGH + *not* referenced → add a client/action method (match the surrounding package's pattern,
     e.g. `TokenSaleClient`, `GuardClient`, `*Actions`) + a unit test.
   - HIGH + *already referenced* → open that file, check whether the signature changed, adjust the
     call (args/types) + test. (Example: launch added `buyTokensFor` → `SelfPayParams.recipient`.)
   - REMOVED + still used → fix/remove the wrapper.
   - LOW → no code change.

6. **Addresses (if redeployed).** Update `LAUNCH_SALE_ADDRESSES` / `CANONICAL_ADDRESSES` in
   `packages/core/src/addresses.ts`, then on-chain verify (read `version()` / `owner()` /
   `getPayoutToken()` etc. — trust the chain, not the deployment file). Run `pnpm run check:addresses`.

7. **Verify.** All must pass before committing:
   ```
   pnpm -r build
   pnpm -r test
   pnpm run check:abi          # completeness gate
   pnpm run check:abi-drift    # value-drift gate
   pnpm run abi:sync           # PASS
   pnpm run check:addresses
   ```

8. **Commit.** Stage only the touched files (NEVER `git add -A` — it sweeps ~1200 docs/api files;
   verify `git diff --cached --name-only | grep -c docs/api/` == 0). Default to the `enhancement`
   branch for accumulating maintenance, or a `feat/…` branch if it's a shippable change.

## Notes

- The drift scan excludes standard/external contracts (EntryPoint, SimpleAccount, ERC20, … — sourced
  from official ERC-4337/OZ, not our repos) and a documented `KNOWN_DRIFT` allowlist
  (`AAStarAirAccountV7` intentionally merges the AirAccountExtension surface). If a NEW intentional
  divergence appears, add it to `KNOWN_DRIFT` in `scripts/abi-sync.ts` + `scripts/check-abi-drift.ts`
  with a reason — don't silence it blindly.
- Triage is heuristic. Confirm each HIGH/LOW call; when unsure, prefer exposing the ABI over a
  speculative wrapper nobody asked for.
