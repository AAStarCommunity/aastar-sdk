Defined in: [packages/airaccount/src/server/services/session-key-service.ts:27](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/session-key-service.ts#L27)

## Properties

### account

> **account**: `string`

Defined in: [packages/airaccount/src/server/services/session-key-service.ts:29](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/session-key-service.ts#L29)

Account that owns the session

***

### callTargets?

> `optional` **callTargets**: `string`[]

Defined in: [packages/airaccount/src/server/services/session-key-service.ts:43](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/session-key-service.ts#L43)

Allowed destination addresses ([] = any). Session struct field.

***

### contractScope?

> `optional` **contractScope**: `string`

Defined in: [packages/airaccount/src/server/services/session-key-service.ts:35](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/session-key-service.ts#L35)

address(0) = any destination allowed

***

### expiry

> **expiry**: `number`

Defined in: [packages/airaccount/src/server/services/session-key-service.ts:33](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/session-key-service.ts#L33)

Expiry unix timestamp (max 7 days from now)

***

### ownerSig?

> `optional` **ownerSig**: `string`

Defined in: [packages/airaccount/src/server/services/session-key-service.ts:47](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/session-key-service.ts#L47)

Owner signature over buildGrantHash() — omit if calling directly from account

***

### selectorAllowlist?

> `optional` **selectorAllowlist**: `string`[]

Defined in: [packages/airaccount/src/server/services/session-key-service.ts:45](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/session-key-service.ts#L45)

Allowed selectors ([] = any). Session struct field.

***

### selectorScope?

> `optional` **selectorScope**: `string`

Defined in: [packages/airaccount/src/server/services/session-key-service.ts:37](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/session-key-service.ts#L37)

bytes4(0) = any selector allowed

***

### sessionKey

> **sessionKey**: `string`

Defined in: [packages/airaccount/src/server/services/session-key-service.ts:31](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/session-key-service.ts#L31)

The session key address (ephemeral EOA)

***

### velocityLimit?

> `optional` **velocityLimit**: `number`

Defined in: [packages/airaccount/src/server/services/session-key-service.ts:39](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/session-key-service.ts#L39)

Max calls per velocityWindow (0 = unlimited). Session struct field.

***

### velocityWindow?

> `optional` **velocityWindow**: `number`

Defined in: [packages/airaccount/src/server/services/session-key-service.ts:41](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/session-key-service.ts#L41)

Velocity window in seconds (0 = no window). Session struct field.
