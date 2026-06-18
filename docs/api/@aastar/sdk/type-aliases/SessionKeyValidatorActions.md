> **SessionKeyValidatorActions** = `object`

Defined in: [packages/core/src/actions/sessionKeyValidator.ts:13](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/sessionKeyValidator.ts#L13)

## Properties

### checkSessionScope()

> **checkSessionScope**: (`args`) => `Promise`\<`void`\>

Defined in: [packages/core/src/actions/sessionKeyValidator.ts:15](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/sessionKeyValidator.ts#L15)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account`: `Address`; `dest`: `Address`; `selector`: [`Hex`](https://viem.sh/docs/index.html); `sessionKeyOrHash`: [`Hex`](https://viem.sh/docs/index.html); `sessionType`: `number`; \} |
| `args.account` | `Address` |
| `args.dest` | `Address` |
| `args.selector` | [`Hex`](https://viem.sh/docs/index.html) |
| `args.sessionKeyOrHash` | [`Hex`](https://viem.sh/docs/index.html) |
| `args.sessionType` | `number` |

#### Returns

`Promise`\<`void`\>

***

### grantNonces()

> **grantNonces**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/sessionKeyValidator.ts:16](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/sessionKeyValidator.ts#L16)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account`: `Address`; `key`: `Address`; \} |
| `args.account` | `Address` |
| `args.key` | `Address` |

#### Returns

`Promise`\<`bigint`\>

***

### grantNonces\_p256()

> **grantNonces\_p256**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/sessionKeyValidator.ts:17](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/sessionKeyValidator.ts#L17)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account`: `Address`; `keyHash`: [`Hex`](https://viem.sh/docs/index.html); \} |
| `args.account` | `Address` |
| `args.keyHash` | [`Hex`](https://viem.sh/docs/index.html) |

#### Returns

`Promise`\<`bigint`\>

***

### recordCallForVelocity()

> **recordCallForVelocity**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/sessionKeyValidator.ts:21](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/sessionKeyValidator.ts#L21)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account`: `Address`; `sessionKeyOrHash`: [`Hex`](https://viem.sh/docs/index.html); `sessionType`: `number`; `signer?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; \} |
| `args.account` | `Address` |
| `args.sessionKeyOrHash` | [`Hex`](https://viem.sh/docs/index.html) |
| `args.sessionType` | `number` |
| `args.signer?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### sessionKeyCount()

> **sessionKeyCount**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/sessionKeyValidator.ts:18](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/sessionKeyValidator.ts#L18)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account`: `Address`; \} |
| `args.account` | `Address` |

#### Returns

`Promise`\<`bigint`\>

***

### sessionStates\_p256()

> **sessionStates\_p256**: (`args`) => `Promise`\<[`P256SessionState`](P256SessionState.md)\>

Defined in: [packages/core/src/actions/sessionKeyValidator.ts:19](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/sessionKeyValidator.ts#L19)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account`: `Address`; `keyHash`: [`Hex`](https://viem.sh/docs/index.html); \} |
| `args.account` | `Address` |
| `args.keyHash` | [`Hex`](https://viem.sh/docs/index.html) |

#### Returns

`Promise`\<[`P256SessionState`](P256SessionState.md)\>
