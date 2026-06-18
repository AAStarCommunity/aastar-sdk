> **ResolvedAPNTsToken** = `object`

Defined in: [packages/core/src/actions/superPaymaster.ts:62](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/superPaymaster.ts#L62)

Runtime-resolved aPNTs token state read live from the SuperPaymaster contract.

The contract exposes the currently active token via `APNTS_TOKEN()` and an
upcoming (timelocked) token via `pendingAPNTsToken()` / `pendingAPNTsTokenEta()`.
Consumers should prefer `active` and may surface `pending` to warn about an
upcoming migration.

## Properties

### active

> **active**: `Address`

Defined in: [packages/core/src/actions/superPaymaster.ts:64](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/superPaymaster.ts#L64)

Currently active aPNTs token address, read from `APNTS_TOKEN()`.

***

### fallbackUsed

> **fallbackUsed**: `boolean`

Defined in: [packages/core/src/actions/superPaymaster.ts:70](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/superPaymaster.ts#L70)

True only when `active` came from the explicit `fallback` option after a failed chain read.

***

### pending

> **pending**: `Address`

Defined in: [packages/core/src/actions/superPaymaster.ts:66](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/superPaymaster.ts#L66)

aPNTs token queued for migration; `zeroAddress` when none is queued.

***

### pendingEta

> **pendingEta**: `bigint`

Defined in: [packages/core/src/actions/superPaymaster.ts:68](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/superPaymaster.ts#L68)

Unix-second ETA when the pending change becomes executable; `0n` when none is queued.
