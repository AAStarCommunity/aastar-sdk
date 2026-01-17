> **SimpleSmartAccount** = [`LocalAccount`](https://viem.sh/docs/index.html) & `object`

Defined in: [packages/account/src/accounts/simple.ts:15](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/account/src/accounts/simple.ts#L15)

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

##### userOp

`any`

#### Returns

`Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>
