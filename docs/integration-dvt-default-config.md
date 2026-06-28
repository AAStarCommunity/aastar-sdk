# Integration — AAStar DVT triple as the default config + connectivity self-test (#153)

**Closes #153.** The SDK ships AAStar's 3 live testnet DVT nodes as the **default testnet config**, exposes
a **startup connectivity self-test**, and uses an **environment-grouped schema** so switching to mainnet is
a zero-code change (fill one block + flip `active`).

## The 3 nodes (Sepolia, live)
Each node provides all three capabilities behind one base URL:

| Node | URL | nodeId |
|---|---|---|
| dvt1 | `https://dvt1.aastar.io` | `0x2df775b9…c319c53f` |
| dvt2 | `https://dvt2.aastar.io` | `0xd907ad72…bacd201` |
| dvt3 | `https://dvt3.aastar.io` | `0xd4f95436…9f17a60e` |

Source of truth: `packages/core/src/dvt.ts` (`DVT_CONFIG`), mirroring the DVT repo
`deploy/sdk-dvt-config.testnet.json`.

## The triple — how the SDK uses each capability
| Capability | Endpoint | SDK entry |
|---|---|---|
| **BLS co-sign** | `POST /signature/sign` | `getDvtConfig()` / `DEFAULT_DVT_NODES` — the DVT signing flow (proven on-chain: `validate()==0`) |
| **Gasless relay** | `POST /v3/relay` | `getDvtRelayerUrlsForChain(chainId)` → `TokenSaleClient.buyGasless` (load-balanced + failover; see [integration-dvt-gasless-relay.md](./integration-dvt-gasless-relay.md)) |
| **Price keeper** | server-side, no client API | nothing to call — nodes keep the paymaster `cachedPrice` fresh so gasless quotes don't go stale |

## Connectivity self-test
```ts
import { checkDvtConnectivity } from '@aastar/core';

const results = await checkDvtConnectivity();          // active env (sepolia); never throws
for (const r of results) {
  if (!r.ok) console.warn(`DVT node ${r.url} degraded:`, r.errors);
}
```
Per node it checks `GET /health` (status + capabilities), `GET /node/info` (nodeId matches config),
and `GET /relay/health` — returning `{ ok, reachable, healthOk, relayOk, nodeIdMatch, capabilities, errors }`
so the caller can warn or fail over.

**Live acceptance (2026-06-28):** `checkDvtConnectivity('sepolia')` → **3/3 nodes fully OK**
(dvt1/2/3 all `reachable, health=ok, relay=ok, nodeIdMatch=ok`, capabilities `{ keeper:true, relay:true }`).

## Mainnet — zero-code switch standard
`DVT_CONFIG` is grouped by environment with an `active` key:
```ts
// packages/core/src/dvt.ts
export const DVT_CONFIG = {
  active: "sepolia",
  environments: {
    sepolia: { chainId: 11155111, validator, entryPoint, dvtNodes:[…], capabilities:{dvtSigning,relay,keeper} },
    mainnet: null, // fill this block, then either set active:"mainnet" or export AASTAR_DVT_ENV=mainnet
  },
};
```
To go to mainnet: fill `environments.mainnet` (URLs + validator/entryPoint addresses + capabilities) and
**either** set `active: "mainnet"` **or** set `AASTAR_DVT_ENV=mainnet` at runtime (a zero-release switch).
`getDvtConfig()` precedence: explicit arg > `AASTAR_DVT_ENV` > `DVT_CONFIG.active`.

Unit tests: `packages/core/src/dvt.test.ts` (8 cases — defaults, mainnet-not-configured guard, relay URLs,
env-var override, `checkDvtConnectivity` health/nodeId/relay). Related: gasless relay #148, x402 facilitator
([YetAnotherAA-Validator#130](https://github.com/AAStarCommunity/YetAnotherAA-Validator/issues/130)).
