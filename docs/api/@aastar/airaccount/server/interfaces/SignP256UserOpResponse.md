Defined in: [packages/airaccount/src/server/services/kms-session-service.ts:41](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/server/services/kms-session-service.ts#L41)

## Properties

### keyId

> **keyId**: `string`

Defined in: [packages/airaccount/src/server/services/kms-session-service.ts:42](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/server/services/kms-session-service.ts#L42)

***

### pubKeyX

> **pubKeyX**: `string`

Defined in: [packages/airaccount/src/server/services/kms-session-service.ts:43](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/server/services/kms-session-service.ts#L43)

***

### pubKeyY

> **pubKeyY**: `string`

Defined in: [packages/airaccount/src/server/services/kms-session-service.ts:44](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/server/services/kms-session-service.ts#L44)

***

### signature

> **signature**: `string`

Defined in: [packages/airaccount/src/server/services/kms-session-service.ts:49](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/server/services/kms-session-service.ts#L49)

149-byte P256 session-key wire format (hex):
[0x08][account(20)][keyX(32)][keyY(32)][r(32)][s(32)].
