# AAStar Starter Site

A full, **template-swappable** website built on `@aastar/sdk`. Same capabilities as the
embed widget (email/passkey auth → smart account → gasless tx) plus **routing** and an
**account dashboard**. Swap brand, colors, and copy in one file: `src/config.ts`.

## Pages

- `/` **Home** — hero/landing (all copy from `config.ts`).
- `/login` **Login** — email + passkey register / sign-in.
- `/dashboard` **Dashboard** — smart account address, native balance, on-chain credit
  limit, and a gasless transaction form. Redirects to `/login` when signed out.

## SDK APIs used (all real)

| API | From | Used for |
| --- | --- | --- |
| `KMS.YAAAClient` | `@aastar/sdk` (root) | email/passkey register, login, tx verify |
| `createEndUserClient` | `@aastar/sdk` (root) | read-only client (balance, address) |
| `getCanonicalAddresses` | `@aastar/sdk` (root, re-exported from core) | resolve Registry address by chain id |
| `useCreditScore` | `@aastar/sdk/dapp` | on-chain credit limit (React hook) |

## Run

```bash
cd examples/starter-site
cp .env.example .env.local        # then edit values
pnpm install --ignore-workspace   # standalone; not part of the monorepo workspace
pnpm dev                          # http://localhost:5173
```

`pnpm typecheck` / `pnpm build` validate the code without live infra.

## Make it your own (template swap)

Open `src/config.ts`:

- `brand.name`, `brand.tagline`, `brand.logoEmoji`
- `brand.colors.*` — primary/bg/surface/text/muted/border
- `brand.copy.*` — every visible string (hero, CTA, login, dashboard titles)

No component hard-codes a color or string; everything reads from `brand`. Runtime
config (backend URL, chain, RPC, operator) is separate and env-driven (`runtime`).

## Configuration

Same `VITE_*` variables as the embed widget — see `.env.example`.

## Browser build notes

Built against `@aastar/sdk@0.20.6`. As in the embed widget, the only browser accommodation
is the standard `define: { 'process.env': '{}' }` in `vite.config.ts` (the SDK reads a few
`process.env.*` vars at module-eval time).

`@aastar/sdk@0.20.6` also fixed the dapp subpath's type declarations, so `useCreditScore`
and `useSuperPaymaster` from `@aastar/sdk/dapp` are now properly typed — the previous local
type shim has been removed.

## Security

All code runs in the browser and is public. Never commit a private key or secret.
Signing happens via WebAuthn passkeys through the KMS backend.

## Live-infra TODOs

Same as the embed widget: a running AirAccount/KMS backend, a registered SuperPaymaster
operator, and an RPC URL. See the `TODO`s in `src/lib/kms.ts`. The credit-limit read on
the dashboard also needs a Registry deployed on the selected chain (auto-resolved by
chain id, but returns 0 if the contract is absent).
