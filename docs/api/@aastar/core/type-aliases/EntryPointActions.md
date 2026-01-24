> **EntryPointActions** = `object`

Defined in: [packages/core/src/actions/entryPoint.ts:11](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/entryPoint.ts#L11)

## Properties

### balanceOf()

> **balanceOf**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/entryPoint.ts:12](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/entryPoint.ts#L12)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account`: `Address`; \} |
| `args.account` | `Address` |

#### Returns

`Promise`\<`bigint`\>

***

### depositTo()

> **depositTo**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/entryPoint.ts:13](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/entryPoint.ts#L13)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account`: `Address`; `amount`: `bigint`; `txAccount?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; \} |
| `args.account` | `Address` |
| `args.amount` | `bigint` |
| `args.txAccount?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### entryPointAddress

> **entryPointAddress**: `Address`

Defined in: [packages/core/src/actions/entryPoint.ts:16](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/entryPoint.ts#L16)

***

### getDepositInfo()

> **getDepositInfo**: (`args`) => `Promise`\<\{ `deposit`: `bigint`; `stake`: `bigint`; `staked`: `boolean`; `unstakeDelaySec`: `number`; `withdrawTime`: `number`; \}\>

Defined in: [packages/core/src/actions/entryPoint.ts:15](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/entryPoint.ts#L15)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account`: `Address`; \} |
| `args.account` | `Address` |

#### Returns

`Promise`\<\{ `deposit`: `bigint`; `stake`: `bigint`; `staked`: `boolean`; `unstakeDelaySec`: `number`; `withdrawTime`: `number`; \}\>

***

### getNonce()

> **getNonce**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/entryPoint.ts:14](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/entryPoint.ts#L14)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `key`: `bigint`; `sender`: `Address`; \} |
| `args.key` | `bigint` |
| `args.sender` | `Address` |

#### Returns

`Promise`\<`bigint`\>
