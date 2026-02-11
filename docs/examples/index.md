# Complete Examples Overview

This section contains end-to-end examples of how to use the AAStar SDK for various roles and use cases.

## Available Examples

- **[Operator Flow](./operator-flow)**: Staking and managing a SuperPaymaster.
- **[Community Flow](./community-flow)**: Registering a community and setting up reputation rules.
- **[End User Flow](./enduser-flow)**: Sending gasless transactions using community credit.
- **[Multi-Chain Setup](./multi-chain)**: Configuring and using the SDK across different networks.

## More “Real” Examples (Scripts)

Besides the markdown examples above, the SDK repo also contains runnable scripts that cover more edge-cases and full regression flows:

- **Regression Testing Guide**: `/guide/docs/Regression_Testing_Guide`
- **L4 Manual Test CheatSheet**: `/guide/docs/L4_Manual_Test_CheatSheet`
- **Sepolia Env Reference**: `/guide/docs/SEPOLIA_ENV_REFERENCE`
- **Lifecycle API (L3) Developer Guide**: `/guide/docs/L3_Lifecycle_Developer_Guide`

## Running Examples Locally

To actually run scripts/examples, clone the SDK repo and run them from the monorepo root. Most examples can be run against a local Anvil instance. Ensure you have the [AAStar Contracts](https://github.com/AAStarCommunity/SuperPaymaster) deployed locally first.

```bash
pnpm install
pnpm build
pnpm run example:local
```
