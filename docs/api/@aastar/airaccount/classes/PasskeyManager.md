Defined in: [packages/airaccount/src/auth/passkey/passkey.manager.ts:51](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/auth/passkey/passkey.manager.ts#L51)

## Constructors

### Constructor

> **new PasskeyManager**(`baseURL`, `tokenProvider?`, `routes?`): `PasskeyManager`

Defined in: [packages/airaccount/src/auth/passkey/passkey.manager.ts:55](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/auth/passkey/passkey.manager.ts#L55)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `baseURL` | `string` |
| `tokenProvider?` | () => `string` \| `null` |
| `routes?` | `Partial`\<[`PasskeyRoutes`](../interfaces/PasskeyRoutes.md)\> |

#### Returns

`PasskeyManager`

## Methods

### addDevice()

> **addDevice**(`params`): `Promise`\<[`PasskeyInfo`](../interfaces/PasskeyInfo.md)\>

Defined in: [packages/airaccount/src/auth/passkey/passkey.manager.ts:161](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/auth/passkey/passkey.manager.ts#L161)

Add a new device (Passkey) to existing account

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `params` | \{ `email`: `string`; `password?`: `string`; \} |
| `params.email` | `string` |
| `params.password?` | `string` |

#### Returns

`Promise`\<[`PasskeyInfo`](../interfaces/PasskeyInfo.md)\>

***

### authenticate()

> **authenticate**(`params?`): `Promise`\<\{ `token`: `string`; `user`: `any`; \}\>

Defined in: [packages/airaccount/src/auth/passkey/passkey.manager.ts:113](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/auth/passkey/passkey.manager.ts#L113)

Complete Passkey Login/Authentication Flow

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `params?` | [`PasskeyAuthenticationParams`](../interfaces/PasskeyAuthenticationParams.md) |

#### Returns

`Promise`\<\{ `token`: `string`; `user`: `any`; \}\>

***

### register()

> **register**(`params`): `Promise`\<\{ `passkey`: [`PasskeyInfo`](../interfaces/PasskeyInfo.md); `token`: `string`; `user`: `any`; \}\>

Defined in: [packages/airaccount/src/auth/passkey/passkey.manager.ts:86](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/auth/passkey/passkey.manager.ts#L86)

Complete Passkey Registration Flow

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `params` | [`PasskeyRegistrationParams`](../interfaces/PasskeyRegistrationParams.md) |

#### Returns

`Promise`\<\{ `passkey`: [`PasskeyInfo`](../interfaces/PasskeyInfo.md); `token`: `string`; `user`: `any`; \}\>

***

### verifyTransaction()

> **verifyTransaction**(`params`): `Promise`\<`any`\>

Defined in: [packages/airaccount/src/auth/passkey/passkey.manager.ts:133](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/auth/passkey/passkey.manager.ts#L133)

Verify a transaction (Sign UserOpHash) with Passkey
Returns the verification credential needed for the transaction

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `params` | [`TransactionVerificationParams`](../interfaces/TransactionVerificationParams.md) |

#### Returns

`Promise`\<`any`\>
