Defined in: [packages/airaccount/src/server/services/kms-monitor-service.ts:64](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/server/services/kms-monitor-service.ts#L64)

Machine-readable runtime statistics (v0.20.0). Pass-through; the response is
not strongly typed. Known top-level fields:
  - `wallets`  — wallet / key counts
  - `tx`       — transaction / signing counts
  - `queue`    — queue depth and timing metrics
  - `warnings` — active operational warnings

## Indexable

\[`k`: `string`\]: `unknown`
