Defined in: [packages/airaccount/src/auth/passkey/passkey.manager.ts:13](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/auth/passkey/passkey.manager.ts#L13)

## Constructors

### Constructor

> **new PasskeyManager**(`baseURL`, `tokenProvider?`): `PasskeyManager`

Defined in: [packages/airaccount/src/auth/passkey/passkey.manager.ts:16](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/auth/passkey/passkey.manager.ts#L16)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `baseURL` | `string` |
| `tokenProvider?` | () => `string` \| `null` |

#### Returns

`PasskeyManager`

## Methods

### addDevice()

> **addDevice**(`params`): `Promise`\<[`PasskeyInfo`](../interfaces/PasskeyInfo.md)\>

Defined in: [packages/airaccount/src/auth/passkey/passkey.manager.ts:114](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/auth/passkey/passkey.manager.ts#L114)

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

Defined in: [packages/airaccount/src/auth/passkey/passkey.manager.ts:66](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/auth/passkey/passkey.manager.ts#L66)

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

Defined in: [packages/airaccount/src/auth/passkey/passkey.manager.ts:39](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/auth/passkey/passkey.manager.ts#L39)

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

Defined in: [packages/airaccount/src/auth/passkey/passkey.manager.ts:86](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/auth/passkey/passkey.manager.ts#L86)

Verify a transaction (Sign UserOpHash) with Passkey
Returns the verification credential needed for the transaction

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `params` | [`TransactionVerificationParams`](../interfaces/TransactionVerificationParams.md) |

#### Returns

`Promise`\<`any`\>
