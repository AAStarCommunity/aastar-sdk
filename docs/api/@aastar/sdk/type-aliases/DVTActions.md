```ts
type DVTActions = object;
```

Defined in: [packages/core/src/actions/dvt.ts:4](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/dvt.ts#L4)

## Properties

### createSlashProposal()

```ts
createSlashProposal: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/dvt.ts:5](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/dvt.ts#L5)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `address`: `Address`; `level`: `number`; `operator`: `Address`; `reason`: `string`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.address` | `Address` |
| `args.level` | `number` |
| `args.operator` | `Address` |
| `args.reason` | `string` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### executeSlashWithProof()

```ts
executeSlashWithProof: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/dvt.ts:7](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/dvt.ts#L7)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `address`: `Address`; `epoch`: `bigint`; `newScores`: `bigint`[]; `proof`: [`Hex`](https://viem.sh/docs/); `proposalId`: `bigint`; `repUsers`: `Address`[]; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.address` | `Address` |
| `args.epoch` | `bigint` |
| `args.newScores` | `bigint`[] |
| `args.proof` | [`Hex`](https://viem.sh/docs/) |
| `args.proposalId` | `bigint` |
| `args.repUsers` | `Address`[] |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### isValidator()

```ts
isValidator: (args) => Promise<boolean>;
```

Defined in: [packages/core/src/actions/dvt.ts:8](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/dvt.ts#L8)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `address`: `Address`; `user`: `Address`; \} |
| `args.address` | `Address` |
| `args.user` | `Address` |

#### Returns

`Promise`\<`boolean`\>

***

### signSlashProposal()

```ts
signSlashProposal: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/dvt.ts:6](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/dvt.ts#L6)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `address`: `Address`; `proposalId`: `bigint`; `signature`: [`Hex`](https://viem.sh/docs/); \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.address` | `Address` |
| `args.proposalId` | `bigint` |
| `args.signature` | [`Hex`](https://viem.sh/docs/) |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>
