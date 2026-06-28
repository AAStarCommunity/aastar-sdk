# Integration — gasless purchase via the DVT relay pool (no centralized Worker)

**Closes #148.** The gasless purchase path (`@aastar/tokens` `TokenSaleClient.buyGasless`) no longer
depends on a single centralized Cloudflare Worker. It now posts to the **decentralized DVT relay pool**
(AAStar's testnet nodes), wire-compatible with the legacy Worker — for most callers, nothing to change.

## What runs the relay
The gasless `POST /v3/relay` capability was moved into the DVT node (YetAnotherAA-Validator #98/#99).
Each node runs its own independent operator hot-wallet, so the pool has no single point of failure:

```
POST https://dvt1.aastar.io/v3/relay
POST https://dvt2.aastar.io/v3/relay
POST https://dvt3.aastar.io/v3/relay
GET  https://dvt{1,2,3}.aastar.io/relay/health   → {"status":"ok","operator":"0x…"}
```

## How the SDK uses it (already wired)
`TokenSaleClient.buyGasless` builds its relayer candidate list from the **single source of truth**
`getDvtRelayerUrlsForChain(chainId)` (`@aastar/core`, sourced from `DVT_CONFIG` where
`capabilities.relay` is true — the same node list as DVT co-signing, `packages/core/src/dvt.ts`):

- **Load-balanced** across the pool with a random start (round-robin-ish spread).
- **Automatic failover** to the next node on `5xx` / network errors.
- The legacy Worker (`addrs.relayerUrl`) is appended only as a **final fallback**.

```ts
import { TokenSaleClient } from '@aastar/tokens';

const sale = new TokenSaleClient({ chainId: 11155111, walletClient });
// Zero-gas: signs EIP-3009 (USDC) + an EIP-712 BuyIntent, posts to a DVT node's /v3/relay,
// returns the relayer-submitted tx hash after on-chain confirmation.
await sale.buyGasless({ token: 'GTOKEN', usdAmount: usd(5) });
```

## Overriding the relayer
Pin a specific relayer (e.g. a self-hosted DVT node) — the override wins over the pool:

```ts
await sale.buyGasless({ token: 'GTOKEN', usdAmount: usd(5), relayerUrl: 'https://my-node.example/' });
```

## Wire contract
Request/response are **identical** to the old Worker (EIP-3009 v/r/s + the EIP-712 `BuyIntent`), so an
operator can run a DVT node as a drop-in relayer. Health: `GET /relay/health` → `{status, operator}`.

## Related
- DVT node config / co-sign pool: `packages/core/src/dvt.ts` (`DVT_CONFIG`, `getDvtRelayerUrlsForChain`).
- Default DVT testnet integration: #153. x402 facilitator (same "DVT node runs the service" pattern):
  [YetAnotherAA-Validator#130](https://github.com/AAStarCommunity/YetAnotherAA-Validator/issues/130)
  + [`docs/x402-facilitator-migration.md`](./x402-facilitator-migration.md).
