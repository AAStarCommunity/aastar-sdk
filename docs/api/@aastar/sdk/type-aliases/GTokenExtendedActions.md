```ts
type GTokenExtendedActions = object;
```

Defined in: [packages/core/src/actions/gtokenExtended.ts:5](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/actions/gtokenExtended.ts#L5)

## Properties

### burn()

```ts
burn: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/gtokenExtended.ts:10](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/actions/gtokenExtended.ts#L10)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: `Account` \| `Address`; `amount`: `bigint`; \} |
| `args.account?` | `Account` \| `Address` |
| `args.amount` | `bigint` |

#### Returns

`Promise`\<`Hash`\>

***

### burnFrom()

```ts
burnFrom: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/gtokenExtended.ts:11](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/actions/gtokenExtended.ts#L11)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: `Account` \| `Address`; `amount`: `bigint`; `from`: `Address`; \} |
| `args.account?` | `Account` \| `Address` |
| `args.amount` | `bigint` |
| `args.from` | `Address` |

#### Returns

`Promise`\<`Hash`\>

***

### cap()

```ts
cap: () => Promise<bigint>;
```

Defined in: [packages/core/src/actions/gtokenExtended.ts:14](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/actions/gtokenExtended.ts#L14)

#### Returns

`Promise`\<`bigint`\>

***

### mint()

```ts
mint: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/gtokenExtended.ts:9](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/actions/gtokenExtended.ts#L9)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: `Account` \| `Address`; `amount`: `bigint`; `to`: `Address`; \} |
| `args.account?` | `Account` \| `Address` |
| `args.amount` | `bigint` |
| `args.to` | `Address` |

#### Returns

`Promise`\<`Hash`\>

***

### minter()

```ts
minter: () => Promise<Address>;
```

Defined in: [packages/core/src/actions/gtokenExtended.ts:15](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/actions/gtokenExtended.ts#L15)

#### Returns

`Promise`\<`Address`\>

***

### owner()

```ts
owner: () => Promise<Address>;
```

Defined in: [packages/core/src/actions/gtokenExtended.ts:24](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/actions/gtokenExtended.ts#L24)

#### Returns

`Promise`\<`Address`\>

***

### pause()

```ts
pause: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/gtokenExtended.ts:19](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/actions/gtokenExtended.ts#L19)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: `Account` \| `Address`; \} |
| `args.account?` | `Account` \| `Address` |

#### Returns

`Promise`\<`Hash`\>

***

### paused()

```ts
paused: () => Promise<boolean>;
```

Defined in: [packages/core/src/actions/gtokenExtended.ts:21](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/actions/gtokenExtended.ts#L21)

#### Returns

`Promise`\<`boolean`\>

***

### renounceOwnership()

```ts
renounceOwnership: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/gtokenExtended.ts:26](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/actions/gtokenExtended.ts#L26)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: `Account` \| `Address`; \} |
| `args.account?` | `Account` \| `Address` |

#### Returns

`Promise`\<`Hash`\>

***

### setMinter()

```ts
setMinter: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/gtokenExtended.ts:16](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/actions/gtokenExtended.ts#L16)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: `Account` \| `Address`; `minter`: `Address`; \} |
| `args.account?` | `Account` \| `Address` |
| `args.minter` | `Address` |

#### Returns

`Promise`\<`Hash`\>

***

### transferOwnership()

```ts
transferOwnership: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/gtokenExtended.ts:25](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/actions/gtokenExtended.ts#L25)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: `Account` \| `Address`; `newOwner`: `Address`; \} |
| `args.account?` | `Account` \| `Address` |
| `args.newOwner` | `Address` |

#### Returns

`Promise`\<`Hash`\>

***

### unpause()

```ts
unpause: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/gtokenExtended.ts:20](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/actions/gtokenExtended.ts#L20)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: `Account` \| `Address`; \} |
| `args.account?` | `Account` \| `Address` |

#### Returns

`Promise`\<`Hash`\>
