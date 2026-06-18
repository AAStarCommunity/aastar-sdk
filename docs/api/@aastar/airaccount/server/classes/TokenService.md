Defined in: [packages/airaccount/src/server/services/token-service.ts:27](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/token-service.ts#L27)

Token service — extracted from NestJS TokenService.
Only on-chain queries and calldata generation (no preset token list).

## Constructors

### Constructor

> **new TokenService**(`ethereum`): `TokenService`

Defined in: [packages/airaccount/src/server/services/token-service.ts:28](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/token-service.ts#L28)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `ethereum` | [`EthereumProvider`](EthereumProvider.md) |

#### Returns

`TokenService`

## Methods

### generateTransferCalldata()

> **generateTransferCalldata**(`to`, `amount`, `decimals`): `string`

Defined in: [packages/airaccount/src/server/services/token-service.ts:74](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/token-service.ts#L74)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `to` | `string` |
| `amount` | `string` |
| `decimals` | `number` |

#### Returns

`string`

***

### getFormattedTokenBalance()

> **getFormattedTokenBalance**(`tokenAddress`, `walletAddress`): `Promise`\<[`TokenBalance`](../interfaces/TokenBalance.md)\>

Defined in: [packages/airaccount/src/server/services/token-service.ts:64](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/token-service.ts#L64)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `tokenAddress` | `string` |
| `walletAddress` | `string` |

#### Returns

`Promise`\<[`TokenBalance`](../interfaces/TokenBalance.md)\>

***

### getTokenBalance()

> **getTokenBalance**(`tokenAddress`, `walletAddress`): `Promise`\<`string`\>

Defined in: [packages/airaccount/src/server/services/token-service.ts:48](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/token-service.ts#L48)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `tokenAddress` | `string` |
| `walletAddress` | `string` |

#### Returns

`Promise`\<`string`\>

***

### getTokenInfo()

> **getTokenInfo**(`tokenAddress`): `Promise`\<[`TokenInfo`](../interfaces/TokenInfo.md)\>

Defined in: [packages/airaccount/src/server/services/token-service.ts:30](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/token-service.ts#L30)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `tokenAddress` | `string` |

#### Returns

`Promise`\<[`TokenInfo`](../interfaces/TokenInfo.md)\>

***

### validateToken()

> **validateToken**(`tokenAddress`): `Promise`\<\{ `error?`: `string`; `isValid`: `boolean`; `token?`: [`TokenInfo`](../interfaces/TokenInfo.md); \}\>

Defined in: [packages/airaccount/src/server/services/token-service.ts:85](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/token-service.ts#L85)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `tokenAddress` | `string` |

#### Returns

`Promise`\<\{ `error?`: `string`; `isValid`: `boolean`; `token?`: [`TokenInfo`](../interfaces/TokenInfo.md); \}\>
