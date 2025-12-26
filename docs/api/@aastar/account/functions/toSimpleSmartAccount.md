> **toSimpleSmartAccount**(`parameters`): `Promise`\<[`SimpleSmartAccount`](../type-aliases/SimpleSmartAccount.md)\>

Defined in: [packages/account/src/accounts/simple.ts:22](https://github.com/AAStarCommunity/aastar-sdk/blob/1e464e07d70938a0d2026a0fe8dd301cb780e6eb/packages/account/src/accounts/simple.ts#L22)

## Parameters

### parameters

#### client

`any`

#### entryPoint

\{ `address`: `` `0x${string}` ``; `version`: `"0.6"` \| `"0.7"`; \}

#### entryPoint.address

`` `0x${string}` ``

#### entryPoint.version

`"0.6"` \| `"0.7"`

#### factoryAddress

`` `0x${string}` ``

#### index?

`bigint`

#### owner

\{ `address`: `` `0x${string}` ``; `nonceManager?`: [`NonceManager`](https://viem.sh/docs/index.html); `publicKey`: `` `0x${string}` ``; `sign?`: (`parameters`) => `Promise`\<`` `0x${string}` ``\>; `signAuthorization?`: (`parameters`) => `Promise`\<[`SignAuthorizationReturnType`](https://viem.sh/docs/index.html)\>; `signMessage`: (`__namedParameters`) => `Promise`\<`` `0x${string}` ``\>; `signTransaction`: \<`serializer`, `transaction`\>(`transaction`, `options?`) => `Promise`\<`` `0x${string}` ``\>; `signTypedData`: \<`typedData`, `primaryType`\>(`parameters`) => `Promise`\<`` `0x${string}` ``\>; `source`: `string`; `type`: `"local"`; \}

#### owner.address

`` `0x${string}` ``

#### owner.nonceManager?

[`NonceManager`](https://viem.sh/docs/index.html)

#### owner.publicKey

`` `0x${string}` ``

#### owner.sign?

(`parameters`) => `Promise`\<`` `0x${string}` ``\>

#### owner.signAuthorization?

(`parameters`) => `Promise`\<[`SignAuthorizationReturnType`](https://viem.sh/docs/index.html)\>

#### owner.signMessage

(`__namedParameters`) => `Promise`\<`` `0x${string}` ``\>

#### owner.signTransaction

\<`serializer`, `transaction`\>(`transaction`, `options?`) => `Promise`\<`` `0x${string}` ``\>

#### owner.signTypedData

\<`typedData`, `primaryType`\>(`parameters`) => `Promise`\<`` `0x${string}` ``\>

#### owner.source

`string`

#### owner.type

`"local"`

#### salt?

`bigint`

## Returns

`Promise`\<[`SimpleSmartAccount`](../type-aliases/SimpleSmartAccount.md)\>
