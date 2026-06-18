> **AssetPolicy** = `object`

Defined in: [packages/core/src/actions/policyRegistry.ts:21](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/policyRegistry.ts#L21)

Per-(sender, asset) amount policy. Native-unit amounts (no USD oracle).

## Properties

### configured

> **configured**: `boolean`

Defined in: [packages/core/src/actions/policyRegistry.ts:31](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/policyRegistry.ts#L31)

false => no policy for this (sender, asset) => UNRESTRICTED (opt-in).

***

### dailyLimit

> **dailyLimit**: `bigint`

Defined in: [packages/core/src/actions/policyRegistry.ts:27](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/policyRegistry.ts#L27)

Cumulative spend over `windowSeconds` => REJECT when exceeded.

***

### dvtTriggerAmount

> **dvtTriggerAmount**: `bigint`

Defined in: [packages/core/src/actions/policyRegistry.ts:23](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/policyRegistry.ts#L23)

Single-tx amount >= this => REQUIRE_DVT; 0 => amount-based trigger DISABLED.

***

### perTxHardCap

> **perTxHardCap**: `bigint`

Defined in: [packages/core/src/actions/policyRegistry.ts:25](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/policyRegistry.ts#L25)

Single-tx amount > this => REJECT (enforced only when configured).

***

### windowSeconds

> **windowSeconds**: `bigint`

Defined in: [packages/core/src/actions/policyRegistry.ts:29](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/policyRegistry.ts#L29)

Daily-limit window length in seconds; 0 => DEFAULT_WINDOW (1 day).
