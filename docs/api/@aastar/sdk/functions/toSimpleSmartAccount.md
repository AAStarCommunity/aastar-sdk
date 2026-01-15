```ts
function toSimpleSmartAccount(parameters): Promise<SimpleSmartAccount>;
```

Defined in: [packages/account/src/accounts/simple.ts:22](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/account/src/accounts/simple.ts#L22)

## Parameters

| Parameter | Type |
| ------ | ------ |
| `parameters` | \{ `client`: `any`; `entryPoint`: \{ `address`: `` `0x${string}` ``; `version`: `"0.6"` \| `"0.7"`; \}; `factoryAddress`: `` `0x${string}` ``; `index?`: `bigint`; `owner`: \{ `address`: `` `0x${string}` ``; `nonceManager?`: [`NonceManager`](https://viem.sh/docs/); `publicKey`: `` `0x${string}` ``; `sign?`: (`parameters`) => `Promise`\<`` `0x${string}` ``\>; `signAuthorization?`: (`parameters`) => `Promise`\<[`SignAuthorizationReturnType`](https://viem.sh/docs/)\>; `signMessage`: (`__namedParameters`) => `Promise`\<`` `0x${string}` ``\>; `signTransaction`: \<`serializer`, `transaction`\>(`transaction`, `options?`) => `Promise`\<`` `0x${string}` ``\>; `signTypedData`: \<`typedData`, `primaryType`\>(`parameters`) => `Promise`\<`` `0x${string}` ``\>; `source`: `string`; `type`: `"local"`; \}; `salt?`: `bigint`; \} |
| `parameters.client` | `any` |
| `parameters.entryPoint` | \{ `address`: `` `0x${string}` ``; `version`: `"0.6"` \| `"0.7"`; \} |
| `parameters.entryPoint.address` | `` `0x${string}` `` |
| `parameters.entryPoint.version` | `"0.6"` \| `"0.7"` |
| `parameters.factoryAddress` | `` `0x${string}` `` |
| `parameters.index?` | `bigint` |
| `parameters.owner` | \{ `address`: `` `0x${string}` ``; `nonceManager?`: [`NonceManager`](https://viem.sh/docs/); `publicKey`: `` `0x${string}` ``; `sign?`: (`parameters`) => `Promise`\<`` `0x${string}` ``\>; `signAuthorization?`: (`parameters`) => `Promise`\<[`SignAuthorizationReturnType`](https://viem.sh/docs/)\>; `signMessage`: (`__namedParameters`) => `Promise`\<`` `0x${string}` ``\>; `signTransaction`: \<`serializer`, `transaction`\>(`transaction`, `options?`) => `Promise`\<`` `0x${string}` ``\>; `signTypedData`: \<`typedData`, `primaryType`\>(`parameters`) => `Promise`\<`` `0x${string}` ``\>; `source`: `string`; `type`: `"local"`; \} |
| `parameters.owner.address` | `` `0x${string}` `` |
| `parameters.owner.nonceManager?` | [`NonceManager`](https://viem.sh/docs/) |
| `parameters.owner.publicKey` | `` `0x${string}` `` |
| `parameters.owner.sign?` | (`parameters`) => `Promise`\<`` `0x${string}` ``\> |
| `parameters.owner.signAuthorization?` | (`parameters`) => `Promise`\<[`SignAuthorizationReturnType`](https://viem.sh/docs/)\> |
| `parameters.owner.signMessage` | (`__namedParameters`) => `Promise`\<`` `0x${string}` ``\> |
| `parameters.owner.signTransaction` | \<`serializer`, `transaction`\>(`transaction`, `options?`) => `Promise`\<`` `0x${string}` ``\> |
| `parameters.owner.signTypedData` | \<`typedData`, `primaryType`\>(`parameters`) => `Promise`\<`` `0x${string}` ``\> |
| `parameters.owner.source` | `string` |
| `parameters.owner.type` | `"local"` |
| `parameters.salt?` | `bigint` |

## Returns

`Promise`\<[`SimpleSmartAccount`](../type-aliases/SimpleSmartAccount.md)\>
