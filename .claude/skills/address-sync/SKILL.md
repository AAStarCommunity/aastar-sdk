---
name: address-sync
description: Sync the SDK to upstream contract DEPLOYMENTS (new networks / mainnet / production launches / redeploys) — the companion to abi-sync. Use when SuperPaymaster / AirAccount / the launch sale stack deploys a new chain (especially MAINNET) or redeploys, or to audit mainnet-readiness. The contract ABI is usually identical mainnet-vs-testnet so abi-sync stays silent; THIS drives the address book, config, DVT/KMS env, on-chain verification, and release that a real deployment needs.
---

# address-sync — upstream deployment / address sync

`abi-sync` keeps the contract **interface** in step. This keeps the **deployed addresses + network
config** in step — the part that actually changes on a mainnet/production launch. **A mainnet launch
does NOT show up in abi-sync** (same bytecode → same ABI); it shows up here.

## What a deployment needs (NOT covered by abi-sync)

1. **Address book** — `CANONICAL_ADDRESSES[chainId]` (1 Ethereum / 10 Optimism), the launch sale
   stack in `LAUNCH_SALE_ADDRESSES[chainId]`, and `config.<network>.json`.
2. **On-chain verification on the target chain** — the acceptance, never the deployment file.
3. **DVT env** — `environments.mainnet` in `packages/core/src/dvt.ts` (nodes + relayer URLs + addrs).
4. **KMS** — point to the production KMS endpoint (config-driven, not the hard-coded testnet host).
5. **Network/RPC** — mainnet chain defs + RPC plumbing.
6. **A release** — a runtime change → new npm version of `@aastar/sdk`.

## Upstream deployment sources (heterogeneous)

| Repo | where addresses live |
|---|---|
| SuperPaymaster | `deployments/config.<network>.json` (clean) |
| AirAccount | `broadcast/<script>.s.sol/<chainId>/run-latest.json` + `.env.<network>` |
| launch (sale) | `contracts/broadcast/<script>/<chainId>/` + `.env.<network>` + the launch team's report |

## Procedure

1. **Scan.** `pnpm run address:sync`
   - Per upstream: the chainIds it has deployment artifacts for, vs the SDK's CANONICAL / LAUNCH_SALE
     books. Flags a chain deployed upstream but missing from the SDK (a mainnet launch flags 🔴 here).
   - Flags mainnet-readiness gaps (DVT `environments.mainnet = null`, no LAUNCH_SALE mainnet group).
   - Clean → nothing to do.

2. **Get the deployed addresses** for the new chain — from the upstream's deployment source above
   (prefer SuperPaymaster's `deployments/config.<net>.json`; for the sale stack, the launch team's
   redeploy report / `.env`). Do NOT guess.

3. **Fill the SDK address book.**
   - `CANONICAL_ADDRESSES[chainId]` (registry, superPaymaster, paymasterV4/impl, GToken, SBT, …).
   - `LAUNCH_SALE_ADDRESSES[chainId]` (saleGToken, saleAPNTs, buyHelper, usdc/usdt, payout tokens).
   - `config.<network>.json` (mirror the upstream's config).

4. **Verify on-chain (the acceptance).** Against the target chain's RPC, read and confirm:
   `version()`, `owner()`, paymaster `isTokenSupported(token)`, sale `getPayoutToken()` resolves the
   canonical token, factory/clone wiring. **Trust the chain, not the deployment file** — a wrong
   mainnet address is the worst failure mode. (Methodology: like the Sepolia 0x957852 clone check.)

5. **DVT env.** Fill `environments.mainnet` in `dvt.ts` (mainnet dvt nodes + `/v3/relay` URLs +
   contract addresses); set `active` (or document `AASTAR_DVT_ENV`). Run `checkDvtConnectivity()`
   against the mainnet nodes.

6. **KMS.** Set the production KMS endpoint via config (server `config.ts` KMS URL) — confirm it's not
   pinned to `kms.aastar.io` testnet.

7. **ABI re-check.** `pnpm run abi:sync` — a mainnet contract may be a NEWER version than testnet; if
   so the drift scan catches it (provided the upstream `out/` is the mainnet build) → refresh + triage.

8. **Verify + release.**
   ```
   pnpm run check:addresses     # SDK config.*.json ⇄ CANONICAL agree
   pnpm run address:sync        # PASS (gap closed)
   pnpm run abi:sync            # PASS
   pnpm -r build && pnpm -r test
   ```
   Then bump + publish `@aastar/sdk` (see the release flow); CHANGELOG entry naming the new network +
   the on-chain verification (tx/addresses).

## Notes

- This is DETECTION + a checklist; the address values + on-chain verification are inherently
  human-confirmed (a mainnet address can't be auto-trusted).
- Pair with `abi-sync`: on a launch, run BOTH — interface (abi-sync) and deployment (address-sync).
- Stage only touched files (NEVER `git add -A`; verify no `docs/api/` staged). Mainnet support is a
  shippable change → a `feat/…` branch + release, not just the `enhancement` accumulator.
