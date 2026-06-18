Defined in: [packages/airaccount/src/client.ts:5](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/client.ts#L5)

## Properties

### apiURL

> **apiURL**: `string`

Defined in: [packages/airaccount/src/client.ts:14](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/client.ts#L14)

Backend RP (relying party) API URL — required, no default.

AAStar's official hosted RP will be `https://auth.aastar.io` (served by
aNode, see AAStarCommunity/YetAnotherAA-Validator#81). You can also point
this at your own backend implementing the standardized passkey contract
(see `@aastar/passkey-server` / [PasskeyRoutes](PasskeyRoutes.md)).

***

### bls

> **bls**: [`BLSConfig`](BLSConfig.md)

Defined in: [packages/airaccount/src/client.ts:26](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/client.ts#L26)

BLS Configuration

***

### passkeyRoutes?

> `optional` **passkeyRoutes**: `Partial`\<[`PasskeyRoutes`](PasskeyRoutes.md)\>

Defined in: [packages/airaccount/src/client.ts:24](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/client.ts#L24)

Optional overrides for the passkey backend route paths.

Defaults to the standardized `@aastar/passkey-server` contract
(`/auth/passkey/*`). Override individual paths to point at a backend that
exposes different routes without changing SDK code.

***

### tokenProvider()?

> `optional` **tokenProvider**: () => `string` \| `null`

Defined in: [packages/airaccount/src/client.ts:16](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/client.ts#L16)

Function to get the current auth token (JWT)

#### Returns

`string` \| `null`
