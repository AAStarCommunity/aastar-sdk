# x402 Facilitator — migration to DVT (SDK side of the contract)

**Status:** proposed (2026-06-28) · **DVT tracking issue:** [YetAnotherAA-Validator#130](https://github.com/AAStarCommunity/YetAnotherAA-Validator/issues/130)

## Why
Today `packages/x402` is **client-only**: the SDK signs an x402 payment authorization and *calls* a
facilitator HTTP API, but no one *runs* the facilitator (the role that holds an operator key, verifies the
payment off-chain, and submits the on-chain settlement). We are moving the **facilitator service** to
**DVT nodes** as an opt-in module — same pattern as DVT's `relay` module (the SDK just repoints a URL).
This keeps the SDK thin (sign + discover + call) and puts the privileged, key-holding, tx-submitting role
on operators who already run that infra.

## What stays in the SDK (the interface contract)
- `packages/x402/src/facilitator.ts` — `FacilitatorClient` is the **reference client** the DVT service must
  satisfy. The facilitator HTTP API (x402 v2, Coinbase-compatible):
  - `POST /x402/verify`  → `{ isValid, invalidReason?, payer? }`
  - `POST /x402/settle`  → `{ success, transaction?, network?, payer?, errorReason? }`
  - `GET  /x402/supported` → `{ kinds: [{ x402Version, scheme:"exact", network:"eip155:<chainId>", extra:{ assets, feeBPS, facilitatorContract } }] }`
- `packages/x402/src/X402Client.ts` — `createPayment` / `settleViaFacilitator` / `x402Fetch`.
- `packages/x402/src/eip3009.ts` — EIP-3009 signing (and the verify logic DVT will port server-side).
- `packages/core/src/actions/x402.ts` — on-chain `X402Facilitator` wrapper (used by self-facilitated callers).

## On-chain permission model (why it's permissioned)
`X402Facilitator.settleX402PaymentDirect/Payment` require the **caller** (the facilitator node's operator
EOA) to (1) hold `ROLE_PAYMASTER_SUPER` and (2) be in `xPNTs.approvedFacilitators(caller)`. So a facilitator
only works for assets whose community has approved that operator. Discovery must therefore match
`(network, asset, community)` to an approved facilitator — not "any node".

## Planned SDK changes (land when DVT ships the module)
- Add `DEFAULT_X402_FACILITATORS` in `packages/core/src/crypto/` mirroring `DEFAULT_DVT_NODES`:
  ```ts
  // { [chainId]: [{ url, operator, supportedAssets }] }
  // e.g. 11155111: [{ url: "https://dvt1.aastar.io/x402", operator: "0x…", supportedAssets: ["0xE6579A90…" /* pnts */] }]
  ```
  Built-in defaults, **overridable** via `new X402Client({ facilitator: { url } })`.
- `X402Client` selects a facilitator by `(network, asset)` from the default list (or the override) and calls
  its `/x402/*` endpoints.

## Open agreement items (tracked in DVT#130)
- Base path (`/x402/...`) + the `/supported.extra` schema (assets / feeBPS / facilitatorContract).
- Auth-header scheme (`FacilitatorConfig.createAuthHeaders`).
- Operator-provisioning runbook (`ROLE_PAYMASTER_SUPER` + `approvedFacilitators`) — who grants, where documented.

> Real facilitator URLs/operators are filled into `DEFAULT_X402_FACILITATORS` only after the DVT module is
> deployed on dvt1/2/3.aastar.io; until then this is a design contract.
