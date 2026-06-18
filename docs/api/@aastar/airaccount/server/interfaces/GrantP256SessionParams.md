Defined in: [packages/airaccount/src/server/services/session-key-service.ts:63](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/server/services/session-key-service.ts#L63)

## Properties

### account

> **account**: `string`

Defined in: [packages/airaccount/src/server/services/session-key-service.ts:65](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/server/services/session-key-service.ts#L65)

Account that owns the session

***

### callTargets?

> `optional` **callTargets**: `string`[]

Defined in: [packages/airaccount/src/server/services/session-key-service.ts:81](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/server/services/session-key-service.ts#L81)

Allowed destination addresses ([] = any). Session struct field.

***

### contractScope?

> `optional` **contractScope**: `string`

Defined in: [packages/airaccount/src/server/services/session-key-service.ts:73](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/server/services/session-key-service.ts#L73)

address(0) = any destination allowed

***

### expiry

> **expiry**: `number`

Defined in: [packages/airaccount/src/server/services/session-key-service.ts:71](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/server/services/session-key-service.ts#L71)

Expiry unix timestamp (max 7 days from now)

***

### keyX

> **keyX**: `string`

Defined in: [packages/airaccount/src/server/services/session-key-service.ts:67](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/server/services/session-key-service.ts#L67)

P256 public key X coordinate (0x-prefixed 32-byte hex)

***

### keyY

> **keyY**: `string`

Defined in: [packages/airaccount/src/server/services/session-key-service.ts:69](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/server/services/session-key-service.ts#L69)

P256 public key Y coordinate (0x-prefixed 32-byte hex)

***

### ownerSig?

> `optional` **ownerSig**: `string`

Defined in: [packages/airaccount/src/server/services/session-key-service.ts:85](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/server/services/session-key-service.ts#L85)

Owner signature over buildP256GrantHash() — omit if calling directly from the owner EOA

***

### selectorAllowlist?

> `optional` **selectorAllowlist**: `string`[]

Defined in: [packages/airaccount/src/server/services/session-key-service.ts:83](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/server/services/session-key-service.ts#L83)

Allowed selectors ([] = any). Session struct field.

***

### selectorScope?

> `optional` **selectorScope**: `string`

Defined in: [packages/airaccount/src/server/services/session-key-service.ts:75](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/server/services/session-key-service.ts#L75)

bytes4(0) = any selector allowed

***

### velocityLimit?

> `optional` **velocityLimit**: `number`

Defined in: [packages/airaccount/src/server/services/session-key-service.ts:77](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/server/services/session-key-service.ts#L77)

Max calls per velocityWindow (0 = unlimited). Session struct field.

***

### velocityWindow?

> `optional` **velocityWindow**: `number`

Defined in: [packages/airaccount/src/server/services/session-key-service.ts:79](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/server/services/session-key-service.ts#L79)

Velocity window in seconds (0 = no window). Session struct field.
