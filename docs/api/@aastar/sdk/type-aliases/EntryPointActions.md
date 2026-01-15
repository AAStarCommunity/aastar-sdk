```ts
type EntryPointActions = object;
```

Defined in: [packages/core/src/actions/entryPoint.ts:9](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/actions/entryPoint.ts#L9)

## Properties

### addStake()

```ts
addStake: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/entryPoint.ts:16](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/actions/entryPoint.ts#L16)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: `Account` \| `Address`; `amount`: `bigint`; `unstakeDelaySec`: `number`; \} |
| `args.account?` | `Account` \| `Address` |
| `args.amount` | `bigint` |
| `args.unstakeDelaySec` | `number` |

#### Returns

`Promise`\<`Hash`\>

***

### balanceOf()

```ts
balanceOf: (args) => Promise<bigint>;
```

Defined in: [packages/core/src/actions/entryPoint.ts:10](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/actions/entryPoint.ts#L10)

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

Defined in: [packages/core/src/actions/entryPoint.ts:25](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/actions/entryPoint.ts#L25)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: `Account` \| `Address`; `data`: `Hex`; `target`: `Address`; \} |
| `args.account?` | `Account` \| `Address` |
| `args.data` | `Hex` |
| `args.target` | `Address` |

#### Returns

`Promise`\<`void`\>

***

### depositTo()

```ts
depositTo: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/entryPoint.ts:11](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/actions/entryPoint.ts#L11)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account`: `Address`; `amount`: `bigint`; `txAccount?`: `Account` \| `Address`; \} |
| `args.account` | `Address` |
| `args.amount` | `bigint` |
| `args.txAccount?` | `Account` \| `Address` |

#### Returns

`Promise`\<`Hash`\>

***

### eip712Domain()

```ts
eip712Domain: () => Promise<any>;
```

Defined in: [packages/core/src/actions/entryPoint.ts:34](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/actions/entryPoint.ts#L34)

#### Returns

`Promise`\<`any`\>

***

### getCurrentUserOpHash()

```ts
getCurrentUserOpHash: () => Promise<Hash>;
```

Defined in: [packages/core/src/actions/entryPoint.ts:35](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/actions/entryPoint.ts#L35)

#### Returns

`Promise`\<`Hash`\>

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

Defined in: [packages/core/src/actions/entryPoint.ts:13](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/actions/entryPoint.ts#L13)

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

Defined in: [packages/core/src/actions/entryPoint.ts:36](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/actions/entryPoint.ts#L36)

#### Returns

`Promise`\<`Hex`\>

***

### getNonce()

```ts
getNonce: (args) => Promise<bigint>;
```

Defined in: [packages/core/src/actions/entryPoint.ts:12](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/actions/entryPoint.ts#L12)

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

Defined in: [packages/core/src/actions/entryPoint.ts:37](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/actions/entryPoint.ts#L37)

#### Returns

`Promise`\<`Hex`\>

***

### getSenderAddress()

```ts
getSenderAddress: (args) => Promise<Address>;
```

Defined in: [packages/core/src/actions/entryPoint.ts:29](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/actions/entryPoint.ts#L29)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `initCode`: `Hex`; \} |
| `args.initCode` | `Hex` |

#### Returns

`Promise`\<`Address`\>

***

### getUserOpHash()

```ts
getUserOpHash: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/entryPoint.ts:28](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/actions/entryPoint.ts#L28)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `op`: `any`; \} |
| `args.op` | `any` |

#### Returns

`Promise`\<`Hash`\>

***

### handleAggregatedOps()

```ts
handleAggregatedOps: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/entryPoint.ts:23](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/actions/entryPoint.ts#L23)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: `Account` \| `Address`; `beneficiary`: `Address`; `opsPerAggregator`: `any`[]; \} |
| `args.account?` | `Account` \| `Address` |
| `args.beneficiary` | `Address` |
| `args.opsPerAggregator` | `any`[] |

#### Returns

`Promise`\<`Hash`\>

***

### handleOps()

```ts
handleOps: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/entryPoint.ts:22](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/actions/entryPoint.ts#L22)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: `Account` \| `Address`; `beneficiary`: `Address`; `ops`: `any`[]; \} |
| `args.account?` | `Account` \| `Address` |
| `args.beneficiary` | `Address` |
| `args.ops` | `any`[] |

#### Returns

`Promise`\<`Hash`\>

***

### incrementNonce()

```ts
incrementNonce: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/entryPoint.ts:31](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/actions/entryPoint.ts#L31)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: `Account` \| `Address`; `key`: `bigint`; \} |
| `args.account?` | `Account` \| `Address` |
| `args.key` | `bigint` |

#### Returns

`Promise`\<`Hash`\>

***

### innerHandleOp()

```ts
innerHandleOp: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/entryPoint.ts:24](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/actions/entryPoint.ts#L24)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: `Account` \| `Address`; `callData`: `Hex`; `context`: `Hex`; `opInfo`: `any`; \} |
| `args.account?` | `Account` \| `Address` |
| `args.callData` | `Hex` |
| `args.context` | `Hex` |
| `args.opInfo` | `any` |

#### Returns

`Promise`\<`Hash`\>

***

### nonceSequenceNumber()

```ts
nonceSequenceNumber: (args) => Promise<bigint>;
```

Defined in: [packages/core/src/actions/entryPoint.ts:32](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/actions/entryPoint.ts#L32)

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

Defined in: [packages/core/src/actions/entryPoint.ts:30](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/actions/entryPoint.ts#L30)

#### Returns

`Promise`\<`Address`\>

***

### supportsInterface()

```ts
supportsInterface: (args) => Promise<boolean>;
```

Defined in: [packages/core/src/actions/entryPoint.ts:33](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/actions/entryPoint.ts#L33)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `interfaceId`: `Hex`; \} |
| `args.interfaceId` | `Hex` |

#### Returns

`Promise`\<`boolean`\>

***

### unlockStake()

```ts
unlockStake: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/entryPoint.ts:17](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/actions/entryPoint.ts#L17)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: `Account` \| `Address`; \} |
| `args.account?` | `Account` \| `Address` |

#### Returns

`Promise`\<`Hash`\>

***

### version

```ts
version: EntryPointVersion;
```

Defined in: [packages/core/src/actions/entryPoint.ts:39](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/actions/entryPoint.ts#L39)

***

### withdrawStake()

```ts
withdrawStake: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/entryPoint.ts:18](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/actions/entryPoint.ts#L18)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: `Account` \| `Address`; `withdrawAddress`: `Address`; \} |
| `args.account?` | `Account` \| `Address` |
| `args.withdrawAddress` | `Address` |

#### Returns

`Promise`\<`Hash`\>

***

### withdrawTo()

```ts
withdrawTo: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/entryPoint.ts:19](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/actions/entryPoint.ts#L19)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: `Account` \| `Address`; `amount`: `bigint`; `withdrawAddress`: `Address`; \} |
| `args.account?` | `Account` \| `Address` |
| `args.amount` | `bigint` |
| `args.withdrawAddress` | `Address` |

#### Returns

`Promise`\<`Hash`\>
