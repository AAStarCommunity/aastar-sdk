Defined in: [packages/airaccount/src/server/services/session-key-service.ts:62](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/session-key-service.ts#L62)

## Properties

### account

> **account**: `string`

Defined in: [packages/airaccount/src/server/services/session-key-service.ts:64](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/session-key-service.ts#L64)

Account that owns the session

***

### callTargets?

> `optional` **callTargets**: `string`[]

Defined in: [packages/airaccount/src/server/services/session-key-service.ts:80](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/session-key-service.ts#L80)

Allowed destination addresses ([] = any). Session struct field.

***

### contractScope?

> `optional` **contractScope**: `string`

Defined in: [packages/airaccount/src/server/services/session-key-service.ts:72](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/session-key-service.ts#L72)

address(0) = any destination allowed

***

### expiry

> **expiry**: `number`

Defined in: [packages/airaccount/src/server/services/session-key-service.ts:70](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/session-key-service.ts#L70)

Expiry unix timestamp (max 7 days from now)

***

### keyX

> **keyX**: `string`

Defined in: [packages/airaccount/src/server/services/session-key-service.ts:66](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/session-key-service.ts#L66)

P256 public key X coordinate (0x-prefixed 32-byte hex)

***

### keyY

> **keyY**: `string`

Defined in: [packages/airaccount/src/server/services/session-key-service.ts:68](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/session-key-service.ts#L68)

P256 public key Y coordinate (0x-prefixed 32-byte hex)

***

### ownerSig?

> `optional` **ownerSig**: `string`

Defined in: [packages/airaccount/src/server/services/session-key-service.ts:84](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/session-key-service.ts#L84)

Owner signature over buildP256GrantHash() — omit if calling directly from the owner EOA

***

### selectorAllowlist?

> `optional` **selectorAllowlist**: `string`[]

Defined in: [packages/airaccount/src/server/services/session-key-service.ts:82](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/session-key-service.ts#L82)

Allowed selectors ([] = any). Session struct field.

***

### selectorScope?

> `optional` **selectorScope**: `string`

Defined in: [packages/airaccount/src/server/services/session-key-service.ts:74](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/session-key-service.ts#L74)

bytes4(0) = any selector allowed

***

### velocityLimit?

> `optional` **velocityLimit**: `number`

Defined in: [packages/airaccount/src/server/services/session-key-service.ts:76](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/session-key-service.ts#L76)

Max calls per velocityWindow (0 = unlimited). Session struct field.

***

### velocityWindow?

> `optional` **velocityWindow**: `number`

Defined in: [packages/airaccount/src/server/services/session-key-service.ts:78](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/session-key-service.ts#L78)

Velocity window in seconds (0 = no window). Session struct field.
