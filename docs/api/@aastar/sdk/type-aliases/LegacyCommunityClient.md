> **LegacyCommunityClient** = [`Client`](https://viem.sh/docs/index.html)\<[`Transport`](https://viem.sh/docs/index.html), [`Chain`](https://viem.sh/docs/index.html), [`Account`](https://viem.sh/docs/index.html) \| `undefined`\> & [`PublicActions`](https://viem.sh/docs/index.html)\<[`Transport`](https://viem.sh/docs/index.html), [`Chain`](https://viem.sh/docs/index.html), [`Account`](https://viem.sh/docs/index.html) \| `undefined`\> & [`WalletActions`](https://viem.sh/docs/index.html)\<[`Chain`](https://viem.sh/docs/index.html), [`Account`](https://viem.sh/docs/index.html) \| `undefined`\> & [`RegistryActions`](RegistryActions.md) & [`SBTActions`](SBTActions.md) & `object`

Defined in: [packages/sdk/src/clients/community.ts:32](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/sdk/src/clients/community.ts#L32)

## Type Declaration

### getCommunityInfo()

> **getCommunityInfo**: (`accountAddress`) => `Promise`\<\{ `communityData`: \{ `description`: `string`; `ensName`: `string`; `name`: `string`; `website`: `string`; \} \| `null`; `hasRole`: `boolean`; `tokenAddress`: `Address` \| `null`; \}\>

Query community registration status and token information
Returns null if not registered, otherwise returns community details

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `accountAddress` | `Address` |

#### Returns

`Promise`\<\{ `communityData`: \{ `description`: `string`; `ensName`: `string`; `name`: `string`; `website`: `string`; \} \| `null`; `hasRole`: `boolean`; `tokenAddress`: `Address` \| `null`; \}\>

### launch()

> **launch**: (`args`) => `Promise`\<\{ `tokenAddress`: `Address`; `txs`: [`Hex`](https://viem.sh/docs/index.html)[]; \}\>

High-level API to launch a community with automatic roleData generation

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `description?`: `string`; `logoURI?`: `string`; `name`: `string`; `tokenName`: `string`; `tokenSymbol`: `string`; `website?`: `string`; \} |
| `args.description?` | `string` |
| `args.logoURI?` | `string` |
| `args.name` | `string` |
| `args.tokenName` | `string` |
| `args.tokenSymbol` | `string` |
| `args.website?` | `string` |

#### Returns

`Promise`\<\{ `tokenAddress`: `Address`; `txs`: [`Hex`](https://viem.sh/docs/index.html)[]; \}\>
