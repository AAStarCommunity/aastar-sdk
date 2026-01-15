```ts
type GTokenExtendedActions = object;
```

Defined in: [packages/core/src/actions/gtokenExtended.ts:5](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/gtokenExtended.ts#L5)

## Properties

### burn()

```ts
burn: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/gtokenExtended.ts:10](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/gtokenExtended.ts#L10)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `amount`: `bigint`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.amount` | `bigint` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### burnFrom()

```ts
burnFrom: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/gtokenExtended.ts:11](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/gtokenExtended.ts#L11)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `amount`: `bigint`; `from`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.amount` | `bigint` |
| `args.from` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### cap()

```ts
cap: () => Promise<bigint>;
```

Defined in: [packages/core/src/actions/gtokenExtended.ts:14](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/gtokenExtended.ts#L14)

#### Returns

`Promise`\<`bigint`\>

***

### mint()

```ts
mint: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/gtokenExtended.ts:9](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/gtokenExtended.ts#L9)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `amount`: `bigint`; `to`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.amount` | `bigint` |
| `args.to` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### minter()

```ts
minter: () => Promise<Address>;
```

Defined in: [packages/core/src/actions/gtokenExtended.ts:15](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/gtokenExtended.ts#L15)

#### Returns

`Promise`\<`Address`\>

***

### owner()

```ts
owner: () => Promise<Address>;
```

Defined in: [packages/core/src/actions/gtokenExtended.ts:24](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/gtokenExtended.ts#L24)

#### Returns

`Promise`\<`Address`\>

***

### pause()

```ts
pause: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/gtokenExtended.ts:19](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/gtokenExtended.ts#L19)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### paused()

```ts
paused: () => Promise<boolean>;
```

Defined in: [packages/core/src/actions/gtokenExtended.ts:21](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/gtokenExtended.ts#L21)

#### Returns

`Promise`\<`boolean`\>

***

### renounceOwnership()

```ts
renounceOwnership: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/gtokenExtended.ts:26](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/gtokenExtended.ts#L26)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### setMinter()

```ts
setMinter: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/gtokenExtended.ts:16](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/gtokenExtended.ts#L16)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `minter`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.minter` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### transferOwnership()

```ts
transferOwnership: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/gtokenExtended.ts:25](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/gtokenExtended.ts#L25)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `newOwner`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.newOwner` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### unpause()

```ts
unpause: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/gtokenExtended.ts:20](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/gtokenExtended.ts#L20)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>
