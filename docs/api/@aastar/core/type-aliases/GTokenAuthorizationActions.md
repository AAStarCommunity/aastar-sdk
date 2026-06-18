> **GTokenAuthorizationActions** = [`GTokenActions`](GTokenActions.md) & `object`

Defined in: [packages/core/src/actions/gTokenAuthorization.ts:12](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/gTokenAuthorization.ts#L12)

## Type Declaration

### authorizationState()

> **authorizationState**: (`args`) => `Promise`\<[`AuthorizationState`](../enumerations/AuthorizationState.md)\>

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `authorizer`: `Address`; `nonce`: [`Hex`](https://viem.sh/docs/index.html); `token`: `Address`; \} |
| `args.authorizer` | `Address` |
| `args.nonce` | [`Hex`](https://viem.sh/docs/index.html) |
| `args.token` | `Address` |

#### Returns

`Promise`\<[`AuthorizationState`](../enumerations/AuthorizationState.md)\>

### CANCEL\_AUTHORIZATION\_TYPEHASH()

> **CANCEL\_AUTHORIZATION\_TYPEHASH**: (`args`) => `Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `token`: `Address`; \} |
| `args.token` | `Address` |

#### Returns

`Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

### cancelAuthorization()

> **cancelAuthorization**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `authorizer`: `Address`; `nonce`: [`Hex`](https://viem.sh/docs/index.html); `signature`: [`Hex`](https://viem.sh/docs/index.html); `token`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.authorizer` | `Address` |
| `args.nonce` | [`Hex`](https://viem.sh/docs/index.html) |
| `args.signature` | [`Hex`](https://viem.sh/docs/index.html) |
| `args.token` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

### DOMAIN\_SEPARATOR()

> **DOMAIN\_SEPARATOR**: (`args`) => `Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `token`: `Address`; \} |
| `args.token` | `Address` |

#### Returns

`Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

### factory()

> **factory**: (`args`) => `Promise`\<`Address`\>

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `token`: `Address`; \} |
| `args.token` | `Address` |

#### Returns

`Promise`\<`Address`\>

### MAX\_AUTH\_VALIDITY()

> **MAX\_AUTH\_VALIDITY**: (`args`) => `Promise`\<`bigint`\>

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `token`: `Address`; \} |
| `args.token` | `Address` |

#### Returns

`Promise`\<`bigint`\>

### mySBT()

> **mySBT**: (`args`) => `Promise`\<`Address`\>

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `token`: `Address`; \} |
| `args.token` | `Address` |

#### Returns

`Promise`\<`Address`\>

### RECEIVE\_WITH\_AUTHORIZATION\_TYPEHASH()

> **RECEIVE\_WITH\_AUTHORIZATION\_TYPEHASH**: (`args`) => `Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `token`: `Address`; \} |
| `args.token` | `Address` |

#### Returns

`Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

### receiveWithAuthorization()

> **receiveWithAuthorization**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `from`: `Address`; `nonce`: [`Hex`](https://viem.sh/docs/index.html); `signature`: [`Hex`](https://viem.sh/docs/index.html); `to`: `Address`; `token`: `Address`; `validAfter`: `bigint`; `validBefore`: `bigint`; `value`: `bigint`; `xPNTsToken`: `Address`; \} | - |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` | - |
| `args.from` | `Address` | - |
| `args.nonce` | [`Hex`](https://viem.sh/docs/index.html) | - |
| `args.signature` | [`Hex`](https://viem.sh/docs/index.html) | - |
| `args.to` | `Address` | - |
| `args.token` | `Address` | - |
| `args.validAfter` | `bigint` | - |
| `args.validBefore` | `bigint` | - |
| `args.value` | `bigint` | - |
| `args.xPNTsToken` | `Address` | RC-2 access hint — NOT signed; pass address(0) to use SBT path only. See trust model above. |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

### setMySBT()

> **setMySBT**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `mySBT`: `Address`; `token`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.mySBT` | `Address` |
| `args.token` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

### TRANSFER\_WITH\_AUTHORIZATION\_TYPEHASH()

> **TRANSFER\_WITH\_AUTHORIZATION\_TYPEHASH**: (`args`) => `Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `token`: `Address`; \} |
| `args.token` | `Address` |

#### Returns

`Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

### transferWithAuthorization()

> **transferWithAuthorization**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `from`: `Address`; `nonce`: [`Hex`](https://viem.sh/docs/index.html); `signature`: [`Hex`](https://viem.sh/docs/index.html); `to`: `Address`; `token`: `Address`; `validAfter`: `bigint`; `validBefore`: `bigint`; `value`: `bigint`; `xPNTsToken`: `Address`; \} | - |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` | - |
| `args.from` | `Address` | - |
| `args.nonce` | [`Hex`](https://viem.sh/docs/index.html) | - |
| `args.signature` | [`Hex`](https://viem.sh/docs/index.html) | - |
| `args.to` | `Address` | - |
| `args.token` | `Address` | - |
| `args.validAfter` | `bigint` | - |
| `args.validBefore` | `bigint` | - |
| `args.value` | `bigint` | - |
| `args.xPNTsToken` | `Address` | RC-2 access hint — NOT signed; pass address(0) to use SBT path only. See trust model above. |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>
