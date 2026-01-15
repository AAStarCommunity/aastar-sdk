Defined in: [packages/account/src/index.ts:40](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/account/src/index.ts#L40)

UserOperation Client for handling high-level flows

## Constructors

### Constructor

```ts
new UserOpClient(): UserOpClient;
```

#### Returns

`UserOpClient`

## Methods

### estimateGas()

```ts
static estimateGas(
   bundler, 
   op, 
entryPoint): Promise<any>;
```

Defined in: [packages/account/src/index.ts:41](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/account/src/index.ts#L41)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `bundler` | `any` |
| `op` | `any` |
| `entryPoint` | `` `0x${string}` `` |

#### Returns

`Promise`\<`any`\>

***

### getReceipt()

```ts
static getReceipt(bundler, hash): Promise<any>;
```

Defined in: [packages/account/src/index.ts:55](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/account/src/index.ts#L55)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `bundler` | `any` |
| `hash` | `` `0x${string}` `` |

#### Returns

`Promise`\<`any`\>

***

### sendUserOp()

```ts
static sendUserOp(
   bundler, 
   op, 
entryPoint): Promise<any>;
```

Defined in: [packages/account/src/index.ts:48](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/account/src/index.ts#L48)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `bundler` | `any` |
| `op` | `any` |
| `entryPoint` | `` `0x${string}` `` |

#### Returns

`Promise`\<`any`\>
