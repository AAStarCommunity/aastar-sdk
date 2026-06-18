Defined in: [packages/airaccount/src/auth/passkey/passkey.manager.ts:21](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/auth/passkey/passkey.manager.ts#L21)

Configurable backend routes for the passkey (WebAuthn) flows.

These default paths are the standardized contract served by AAStar's
`@aastar/passkey-server` (any compatible RP exposing the same endpoints).
They are NOT specific to any single backend. Consumers pointing at a
different backend can override individual paths without changing code.

## Properties

### deviceBegin

> **deviceBegin**: `string`

Defined in: [packages/airaccount/src/auth/passkey/passkey.manager.ts:31](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/auth/passkey/passkey.manager.ts#L31)

POST — begin adding a new device (passkey). Default: `/auth/device/passkey/begin`

***

### deviceComplete

> **deviceComplete**: `string`

Defined in: [packages/airaccount/src/auth/passkey/passkey.manager.ts:33](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/auth/passkey/passkey.manager.ts#L33)

POST — complete adding a new device (passkey). Default: `/auth/device/passkey/complete`

***

### loginBegin

> **loginBegin**: `string`

Defined in: [packages/airaccount/src/auth/passkey/passkey.manager.ts:27](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/auth/passkey/passkey.manager.ts#L27)

POST — begin passkey login/authentication. Default: `/auth/passkey/login/begin`

***

### loginComplete

> **loginComplete**: `string`

Defined in: [packages/airaccount/src/auth/passkey/passkey.manager.ts:29](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/auth/passkey/passkey.manager.ts#L29)

POST — complete passkey login/authentication. Default: `/auth/passkey/login/complete`

***

### registerBegin

> **registerBegin**: `string`

Defined in: [packages/airaccount/src/auth/passkey/passkey.manager.ts:23](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/auth/passkey/passkey.manager.ts#L23)

POST — begin passkey registration. Default: `/auth/passkey/register/begin`

***

### registerComplete

> **registerComplete**: `string`

Defined in: [packages/airaccount/src/auth/passkey/passkey.manager.ts:25](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/auth/passkey/passkey.manager.ts#L25)

POST — complete passkey registration. Default: `/auth/passkey/register/complete`

***

### transactionVerifyBegin

> **transactionVerifyBegin**: `string`

Defined in: [packages/airaccount/src/auth/passkey/passkey.manager.ts:35](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/auth/passkey/passkey.manager.ts#L35)

POST — begin transaction verification. Default: `/auth/transaction/verify/begin`
