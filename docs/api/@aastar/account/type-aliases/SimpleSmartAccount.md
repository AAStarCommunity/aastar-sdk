> **SimpleSmartAccount** = [`LocalAccount`](https://viem.sh/docs/index.html) & `object`

Defined in: [packages/account/src/accounts/simple.ts:15](https://github.com/AAStarCommunity/aastar-sdk/blob/d8cd895cb4a9df5d4a11f5b902321a50bc6200f9/packages/account/src/accounts/simple.ts#L15)

## Type Declaration

### entryPoint

> **entryPoint**: `Address`

### getDummySignature()

> **getDummySignature**: () => `Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

#### Returns

`Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

### getInitCode()

> **getInitCode**: () => `Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

#### Returns

`Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

### signUserOperation()

> **signUserOperation**: (`userOp`) => `Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `userOp` | `any` |

#### Returns

`Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>
