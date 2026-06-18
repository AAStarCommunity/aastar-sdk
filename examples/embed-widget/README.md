# AAStar Embed Widget

A **minimal drop-in account widget** that an existing website can embed in minutes.
It is the "minimal YAA": email + passkey register → a smart account address → show
balance → one gasless transaction button. Nothing else.

Built entirely on the published **`@aastar/sdk`** package (and its `@aastar/sdk/dapp`
+ `@aastar/sdk/kms` surfaces). No AAStar internals are imported.

## What it does

1. **Email register** via `KMS.YAAAClient.passkey.register({ email, username })`
   (triggers a WebAuthn / biometric prompt). Returns the user's smart account address.
2. **Read account state** via `createEndUserClient({ chain, transport })` — address +
   native balance. Reads are public, so no signer is needed in the browser.
3. **One gasless tx** via `YAAAClient.passkey.verifyTransaction(...)` + a POST to the
   AirAccount backend (`usePaymaster: true`), sponsored by a SuperPaymaster operator.

## SDK APIs used (all real, no invented surface)

| API | From | Used for |
| --- | --- | --- |
| `KMS.YAAAClient` | `@aastar/sdk` (root) | email/passkey register, login, tx verify |
| `createEndUserClient` | `@aastar/sdk` (root) | read-only client (balance, address prediction) |
| `EndUserClient.getBalance` | viem public actions | native balance |
| `EndUserClient.createSmartAccount` | `@aastar/sdk` | predict AA address from an owner EOA |

> `@aastar/sdk/dapp` React hooks (`useSuperPaymaster`, `useCreditScore`,
> `EvaluationPanel`) are demonstrated in the larger **starter-site** example; this
> widget keeps its dependency surface intentionally tiny.

## Run (React demo harness)

```bash
cd examples/embed-widget
cp .env.example .env.local        # then edit values
pnpm install --ignore-workspace   # examples are standalone, not in the monorepo workspace
pnpm dev                          # http://localhost:5173
```

`pnpm typecheck` / `pnpm build` validate the code without live infra.

## Use as a React component

```tsx
import { AAStarWidget } from 'aastar-embed-widget/src/AAStarWidget';

<AAStarWidget
  apiURL="https://api.your-backend.com/v1"
  chainName="sepolia"
  operator="0xYourOperator"
/>
```

(In a real consumer you'd copy `src/AAStarWidget.tsx` + `src/lib/*` + `src/config.ts`
into your app, or publish them as your own package.)

## Use on a non-React site (vanilla `<script>`)

Build the self-contained IIFE bundle (React is bundled in):

```bash
pnpm run build:embed   # outputs dist-embed/aastar-widget.iife.js
```

Then on any HTML page:

```html
<div id="aastar-root"></div>
<script src="/aastar-widget.iife.js"></script>
<script>
  AAStarWidget.mount('#aastar-root', {
    apiURL: 'https://api.your-backend.com/v1',
    chainName: 'sepolia',
    operator: '0xYourOperator',
  });
</script>
```

### iframe isolation (optional)

If you want full style/JS isolation from the host page, host the built demo (or a page
that calls `AAStarWidget.mount`) and embed it as an iframe:

```html
<iframe src="https://your-widget-host.example/" width="400" height="420"
        style="border:0" allow="publickey-credentials-get; publickey-credentials-create">
</iframe>
```

> The `allow` attribute is required for WebAuthn/passkeys to work inside an iframe.

## Configuration

All config comes from `VITE_*` env vars (see `.env.example`) and can be overridden per
`mount(...)` call. Resolution lives in `src/config.ts`.

| Var | Meaning |
| --- | --- |
| `VITE_AIRACCOUNT_API_URL` | KMS/AirAccount backend base URL |
| `VITE_BLS_SEED_NODES` | comma-separated BLS signer endpoints |
| `VITE_CHAIN` | `sepolia` \| `optimism` \| `optimismSepolia` |
| `VITE_RPC_URL` | JSON-RPC URL for balance reads |
| `VITE_SP_OPERATOR` | SuperPaymaster operator that sponsors gas |

## Browser build notes

Built against `@aastar/sdk@0.20.6`, which fixed the earlier browser-build blocker (the
bundle no longer pulls Node's `module`/`createRequire`). The only remaining browser
accommodation is standard Vite practice: `vite.config.ts` defines `process.env` to `{}`
because the SDK reads a few `process.env.*` vars (CHAIN_ID, test addresses) at module-eval
time for its optional config layer.

Vite may still print warnings that `crypto`/`fs` named imports were externalized — those are
the SDK's server-only paths (KMS encryption, file IO) and are not invoked by the
register/balance/gasless-via-backend flow. The build succeeds.

## Security

Everything in this widget runs in the browser and is **public**. Never put a private
key or secret in `.env*` or in `mount()` options. Signing happens via WebAuthn passkeys
through the KMS backend — the private key never touches the page.

## Live-infra TODOs

This is a fully-typed, building scaffold. To make it transact end-to-end you need:

- A running **AirAccount/KMS backend** at `VITE_AIRACCOUNT_API_URL` (register/login +
  a `/transfer` endpoint). The exact `/transfer` path/body and the user object's
  address field are backend-defined — see the `TODO`s in `src/lib/kms.ts`.
- A funded/registered **SuperPaymaster operator** (`VITE_SP_OPERATOR`) on the target chain.
- A reliable **RPC URL** for the chain.
