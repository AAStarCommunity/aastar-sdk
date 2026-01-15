```ts
type AggregatorActions = object;
```

Defined in: [packages/core/src/actions/aggregator.ts:4](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/actions/aggregator.ts#L4)

## Properties

### getBLSThreshold()

```ts
getBLSThreshold: (args) => Promise<bigint>;
```

Defined in: [packages/core/src/actions/aggregator.ts:7](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/actions/aggregator.ts#L7)

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

Defined in: [packages/core/src/actions/aggregator.ts:5](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/actions/aggregator.ts#L5)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: `Account` \| `Address`; `address`: `Address`; `publicKey`: `Hex`; \} |
| `args.account?` | `Account` \| `Address` |
| `args.address` | `Address` |
| `args.publicKey` | `Hex` |

#### Returns

`Promise`\<`Hash`\>

***

### setBLSThreshold()

```ts
setBLSThreshold: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/aggregator.ts:6](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/actions/aggregator.ts#L6)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: `Account` \| `Address`; `address`: `Address`; `threshold`: `number`; \} |
| `args.account?` | `Account` \| `Address` |
| `args.address` | `Address` |
| `args.threshold` | `number` |

#### Returns

`Promise`\<`Hash`\>
