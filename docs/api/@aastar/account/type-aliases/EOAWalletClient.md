> **EOAWalletClient** = [`WalletClient`](https://viem.sh/docs/index.html) & `object`

Defined in: [packages/account/src/eoa.ts:4](https://github.com/AAStarCommunity/aastar-sdk/blob/d8cd895cb4a9df5d4a11f5b902321a50bc6200f9/packages/account/src/eoa.ts#L4)

## Type Declaration

### getAddress()

> **getAddress**: () => `Address`

#### Returns

`Address`

### sendTransaction()

> **sendTransaction**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `data?`: [`Hex`](https://viem.sh/docs/index.html); `to`: `Address`; `value?`: `bigint`; \} |
| `args.data?` | [`Hex`](https://viem.sh/docs/index.html) |
| `args.to` | `Address` |
| `args.value?` | `bigint` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>
