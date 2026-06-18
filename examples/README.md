# AAStar SDK — Examples

Starter examples built on the **published single package** [`@aastar/sdk`](https://www.npmjs.com/package/@aastar/sdk)
(and its `@aastar/sdk/dapp` + `@aastar/sdk/kms` subpaths). They show the intended
consumer story end-to-end: **email + passkey → smart account → gasless transaction**.

## The two starters

| Example | What it is | Use it when |
| --- | --- | --- |
| [`embed-widget/`](./embed-widget) | A **minimal drop-in widget** — the "minimal YAA". One box: email register → account address → balance → one gasless tx button. Ships as a React component **and** a vanilla `<script>`/iframe embed. | You have an **existing website** and want to add AAStar accounts with the least possible surface area. |
| [`starter-site/`](./starter-site) | A **full template-swappable site** (routing + landing + account dashboard). Brand/colors/copy abstracted behind `src/config.ts`. | You're **starting a new site** and want a complete, brandable scaffold to build on. |

**(a) embed-widget vs (b) starter-site:** the widget is a single component you drop into
something that already exists; the starter-site is a whole app you take over and rebrand.
Both call the exact same SDK APIs underneath.

### Which SDK surfaces they use

- `createEndUserClient` (`@aastar/sdk`) — read-only client; addresses auto-resolve from `chain.id`.
- `KMS.YAAAClient` (`@aastar/sdk`, also `@aastar/sdk/kms`) — email/passkey register, login, tx verify.
- `useCreditScore` (`@aastar/sdk/dapp`) — on-chain credit limit React hook (starter-site).
- `getCanonicalAddresses` (`@aastar/sdk`) — resolve canonical contract addresses by chain id.

## Running

Each example is **standalone** (its own `package.json`, depends on the published
`@aastar/sdk@0.20.6`) and is **not** part of the monorepo pnpm workspace, so install it
on its own:

```bash
cd examples/embed-widget   # or examples/starter-site
cp .env.example .env.local
pnpm install --ignore-workspace
pnpm dev
```

Both typecheck/build with no live infrastructure. To actually transact you need a live
AirAccount/KMS backend, a registered SuperPaymaster operator, and an RPC URL — see each
example's `.env.example` and README "Live-infra TODOs".

## Advanced / production reference: YetAnotherAA (YAA)

These two examples are deliberately small. For a **full, production-grade reference
implementation** of an AAStar-powered app — the complete YAA — see the official repo:

- **YetAnotherAA**: https://github.com/AAStarCommunity/YetAnotherAA

Do not treat the examples here as a re-implementation of YAA; YAA is the canonical
advanced reference. The widget here is intentionally the "minimal YAA".

## Roadmap for examples

Future, **feature-specific** examples (operator onboarding, community/xPNTs deployment,
DVT, x402, analytics, etc.) will live in a dedicated repo:

- **AAStarCommunity/aastar-examples** (planned)

This `examples/` directory in the SDK monorepo stays focused on the two canonical
"getting started" starters above (plus the existing low-level L1–L3 script demos).
