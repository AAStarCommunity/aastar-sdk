```ts
type EntryPointActions = object;
```

Defined in: [packages/core/src/actions/entryPoint.ts:9](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/entryPoint.ts#L9)

## Properties

### addStake()

```ts
addStake: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/entryPoint.ts:16](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/entryPoint.ts#L16)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `amount`: `bigint`; `unstakeDelaySec`: `number`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.amount` | `bigint` |
| `args.unstakeDelaySec` | `number` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### balanceOf()

```ts
balanceOf: (args) => Promise<bigint>;
```

Defined in: [packages/core/src/actions/entryPoint.ts:10](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/entryPoint.ts#L10)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account`: `Address`; \} |
| `args.account` | `Address` |

#### Returns

`Promise`\<`bigint`\>

***

### delegateAndRevert()

```ts
delegateAndRevert: (args) => Promise<void>;
```

Defined in: [packages/core/src/actions/entryPoint.ts:25](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/entryPoint.ts#L25)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `data`: [`Hex`](https://viem.sh/docs/); `target`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.data` | [`Hex`](https://viem.sh/docs/) |
| `args.target` | `Address` |

#### Returns

`Promise`\<`void`\>

***

### depositTo()

```ts
depositTo: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/entryPoint.ts:11](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/entryPoint.ts#L11)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account`: `Address`; `amount`: `bigint`; `txAccount?`: [`Account`](https://viem.sh/docs/) \| `Address`; \} |
| `args.account` | `Address` |
| `args.amount` | `bigint` |
| `args.txAccount?` | [`Account`](https://viem.sh/docs/) \| `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### eip712Domain()

```ts
eip712Domain: () => Promise<any>;
```

Defined in: [packages/core/src/actions/entryPoint.ts:34](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/entryPoint.ts#L34)

#### Returns

`Promise`\<`any`\>

***

### getCurrentUserOpHash()

```ts
getCurrentUserOpHash: () => Promise<Hash>;
```

Defined in: [packages/core/src/actions/entryPoint.ts:35](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/entryPoint.ts#L35)

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### getDepositInfo()

```ts
getDepositInfo: (args) => Promise<{
  deposit: bigint;
  stake: bigint;
  staked: boolean;
  unstakeDelaySec: number;
  withdrawTime: number;
}>;
```

Defined in: [packages/core/src/actions/entryPoint.ts:13](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/entryPoint.ts#L13)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account`: `Address`; \} |
| `args.account` | `Address` |

#### Returns

`Promise`\<\{
  `deposit`: `bigint`;
  `stake`: `bigint`;
  `staked`: `boolean`;
  `unstakeDelaySec`: `number`;
  `withdrawTime`: `number`;
\}\>

***

### getDomainSeparatorV4()

```ts
getDomainSeparatorV4: () => Promise<Hex>;
```

Defined in: [packages/core/src/actions/entryPoint.ts:36](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/entryPoint.ts#L36)

#### Returns

`Promise`\<[`Hex`](https://viem.sh/docs/)\>

***

### getNonce()

```ts
getNonce: (args) => Promise<bigint>;
```

Defined in: [packages/core/src/actions/entryPoint.ts:12](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/entryPoint.ts#L12)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `key`: `bigint`; `sender`: `Address`; \} |
| `args.key` | `bigint` |
| `args.sender` | `Address` |

#### Returns

`Promise`\<`bigint`\>

***

### getPackedUserOpTypeHash()

```ts
getPackedUserOpTypeHash: () => Promise<Hex>;
```

Defined in: [packages/core/src/actions/entryPoint.ts:37](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/entryPoint.ts#L37)

#### Returns

`Promise`\<[`Hex`](https://viem.sh/docs/)\>

***

### getSenderAddress()

```ts
getSenderAddress: (args) => Promise<Address>;
```

Defined in: [packages/core/src/actions/entryPoint.ts:29](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/entryPoint.ts#L29)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `initCode`: [`Hex`](https://viem.sh/docs/); \} |
| `args.initCode` | [`Hex`](https://viem.sh/docs/) |

#### Returns

`Promise`\<`Address`\>

***

### getUserOpHash()

```ts
getUserOpHash: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/entryPoint.ts:28](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/entryPoint.ts#L28)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `op`: `any`; \} |
| `args.op` | `any` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### handleAggregatedOps()

```ts
handleAggregatedOps: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/entryPoint.ts:23](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/entryPoint.ts#L23)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `beneficiary`: `Address`; `opsPerAggregator`: `any`[]; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.beneficiary` | `Address` |
| `args.opsPerAggregator` | `any`[] |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### handleOps()

```ts
handleOps: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/entryPoint.ts:22](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/entryPoint.ts#L22)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `beneficiary`: `Address`; `ops`: `any`[]; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.beneficiary` | `Address` |
| `args.ops` | `any`[] |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### incrementNonce()

```ts
incrementNonce: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/entryPoint.ts:31](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/entryPoint.ts#L31)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `key`: `bigint`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.key` | `bigint` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### innerHandleOp()

```ts
innerHandleOp: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/entryPoint.ts:24](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/entryPoint.ts#L24)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `callData`: [`Hex`](https://viem.sh/docs/); `context`: [`Hex`](https://viem.sh/docs/); `opInfo`: `any`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.callData` | [`Hex`](https://viem.sh/docs/) |
| `args.context` | [`Hex`](https://viem.sh/docs/) |
| `args.opInfo` | `any` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### nonceSequenceNumber()

```ts
nonceSequenceNumber: (args) => Promise<bigint>;
```

Defined in: [packages/core/src/actions/entryPoint.ts:32](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/entryPoint.ts#L32)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `key`: `bigint`; `sender`: `Address`; \} |
| `args.key` | `bigint` |
| `args.sender` | `Address` |

#### Returns

`Promise`\<`bigint`\>

***

### senderCreator()

```ts
senderCreator: () => Promise<Address>;
```

Defined in: [packages/core/src/actions/entryPoint.ts:30](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/entryPoint.ts#L30)

#### Returns

`Promise`\<`Address`\>

***

### supportsInterface()

```ts
supportsInterface: (args) => Promise<boolean>;
```

Defined in: [packages/core/src/actions/entryPoint.ts:33](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/entryPoint.ts#L33)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `interfaceId`: [`Hex`](https://viem.sh/docs/); \} |
| `args.interfaceId` | [`Hex`](https://viem.sh/docs/) |

#### Returns

`Promise`\<`boolean`\>

***

### unlockStake()

```ts
unlockStake: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/entryPoint.ts:17](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/entryPoint.ts#L17)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### version

```ts
version: EntryPointVersion;
```

Defined in: [packages/core/src/actions/entryPoint.ts:39](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/entryPoint.ts#L39)

***

### withdrawStake()

```ts
withdrawStake: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/entryPoint.ts:18](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/entryPoint.ts#L18)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `withdrawAddress`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.withdrawAddress` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### withdrawTo()

```ts
withdrawTo: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/entryPoint.ts:19](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/entryPoint.ts#L19)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `amount`: `bigint`; `withdrawAddress`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.amount` | `bigint` |
| `args.withdrawAddress` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>
