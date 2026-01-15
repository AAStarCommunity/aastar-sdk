```ts
type AccountActions = object;
```

Defined in: [packages/core/src/actions/account.ts:5](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/account.ts#L5)

## Properties

### addDeposit()

```ts
addDeposit: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/account.ts:10](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/account.ts#L10)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### entryPoint()

```ts
entryPoint: () => Promise<Address>;
```

Defined in: [packages/core/src/actions/account.ts:9](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/account.ts#L9)

#### Returns

`Promise`\<`Address`\>

***

### execute()

```ts
execute: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/account.ts:6](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/account.ts#L6)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `dest`: `Address`; `func`: [`Hex`](https://viem.sh/docs/); `value`: `bigint`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.dest` | `Address` |
| `args.func` | [`Hex`](https://viem.sh/docs/) |
| `args.value` | `bigint` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### executeBatch()

```ts
executeBatch: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/account.ts:7](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/account.ts#L7)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `dest`: `Address`[]; `func`: [`Hex`](https://viem.sh/docs/)[]; `value`: `bigint`[]; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.dest` | `Address`[] |
| `args.func` | [`Hex`](https://viem.sh/docs/)[] |
| `args.value` | `bigint`[] |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### getDeposit()

```ts
getDeposit: () => Promise<bigint>;
```

Defined in: [packages/core/src/actions/account.ts:12](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/account.ts#L12)

#### Returns

`Promise`\<`bigint`\>

***

### getNonce()

```ts
getNonce: () => Promise<bigint>;
```

Defined in: [packages/core/src/actions/account.ts:8](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/account.ts#L8)

#### Returns

`Promise`\<`bigint`\>

***

### initialize()

```ts
initialize: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/account.ts:16](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/account.ts#L16)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `owner`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.owner` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### owner()

```ts
owner: () => Promise<Address>;
```

Defined in: [packages/core/src/actions/account.ts:13](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/account.ts#L13)

#### Returns

`Promise`\<`Address`\>

***

### proxiableUUID()

```ts
proxiableUUID: () => Promise<Hex>;
```

Defined in: [packages/core/src/actions/account.ts:18](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/account.ts#L18)

#### Returns

`Promise`\<[`Hex`](https://viem.sh/docs/)\>

***

### supportsInterface()

```ts
supportsInterface: (args) => Promise<boolean>;
```

Defined in: [packages/core/src/actions/account.ts:19](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/account.ts#L19)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `interfaceId`: [`Hex`](https://viem.sh/docs/); \} |
| `args.interfaceId` | [`Hex`](https://viem.sh/docs/) |

#### Returns

`Promise`\<`boolean`\>

***

### UPGRADE\_INTERFACE\_VERSION()

```ts
UPGRADE_INTERFACE_VERSION: () => Promise<string>;
```

Defined in: [packages/core/src/actions/account.ts:20](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/account.ts#L20)

#### Returns

`Promise`\<`string`\>

***

### upgradeToAndCall()

```ts
upgradeToAndCall: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/account.ts:17](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/account.ts#L17)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `data`: [`Hex`](https://viem.sh/docs/); `newImplementation`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.data` | [`Hex`](https://viem.sh/docs/) |
| `args.newImplementation` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### withdrawDepositTo()

```ts
withdrawDepositTo: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/account.ts:11](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/account.ts#L11)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `amount`: `bigint`; `withdrawAddress`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.amount` | `bigint` |
| `args.withdrawAddress` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>
