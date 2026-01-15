```ts
type AggregatorActions = object;
```

Defined in: [packages/core/src/actions/aggregator.ts:4](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/aggregator.ts#L4)

## Properties

### getBLSThreshold()

```ts
getBLSThreshold: (args) => Promise<bigint>;
```

Defined in: [packages/core/src/actions/aggregator.ts:7](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/aggregator.ts#L7)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `address`: `Address`; \} |
| `args.address` | `Address` |

#### Returns

`Promise`\<`bigint`\>

***

### registerBLSPublicKey()

```ts
registerBLSPublicKey: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/aggregator.ts:5](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/aggregator.ts#L5)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `address`: `Address`; `publicKey`: [`Hex`](https://viem.sh/docs/); \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.address` | `Address` |
| `args.publicKey` | [`Hex`](https://viem.sh/docs/) |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### setBLSThreshold()

```ts
setBLSThreshold: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/aggregator.ts:6](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/aggregator.ts#L6)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `address`: `Address`; `threshold`: `number`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.address` | `Address` |
| `args.threshold` | `number` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>
