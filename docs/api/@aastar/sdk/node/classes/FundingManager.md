Defined in: [packages/sdk/src/utils/funding.ts:65](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/sdk/src/utils/funding.ts#L65)

资金管理器
提供 ETH 和 ERC20 Token 的充值、验证等工具函数

## Constructors

### Constructor

```ts
new FundingManager(): FundingManager;
```

#### Returns

`FundingManager`

## Methods

### batchFundETH()

```ts
static batchFundETH(params, targets): Promise<FundingResult[]>;
```

Defined in: [packages/sdk/src/utils/funding.ts:236](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/sdk/src/utils/funding.ts#L236)

批量充值 ETH

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `params` | `Omit`\<[`FundingParams`](../interfaces/FundingParams.md), `"targetAddress"`\> | 基础参数 |
| `targets` | `object`[] | 目标地址和金额数组 |

#### Returns

`Promise`\<`FundingResult`[]\>

充值结果数组

***

### batchFundToken()

```ts
static batchFundToken(
   params, 
   tokenAddress, 
targets): Promise<FundingResult[]>;
```

Defined in: [packages/sdk/src/utils/funding.ts:261](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/sdk/src/utils/funding.ts#L261)

批量充值 Token

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `params` | `Omit`\<[`FundingParams`](../interfaces/FundingParams.md), `"targetAddress"`\> | 基础参数 |
| `tokenAddress` | `` `0x${string}` `` | Token 合约地址 |
| `targets` | `object`[] | 目标地址和金额数组 |

#### Returns

`Promise`\<`FundingResult`[]\>

充值结果数组

***

### ensureFunding()

```ts
static ensureFunding(params): Promise<FundingResult[]>;
```

Defined in: [packages/sdk/src/utils/funding.ts:184](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/sdk/src/utils/funding.ts#L184)

智能充值：检查余额，不足时自动充值

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `params` | `EnsureFundingParams` | 充值参数 |

#### Returns

`Promise`\<`FundingResult`[]\>

充值结果数组

***

### fundWithETH()

```ts
static fundWithETH(params): Promise<FundingResult>;
```

Defined in: [packages/sdk/src/utils/funding.ts:96](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/sdk/src/utils/funding.ts#L96)

充值 ETH 到目标地址

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `params` | `FundETHParams` | 充值参数 |

#### Returns

`Promise`\<`FundingResult`\>

充值结果

***

### fundWithToken()

```ts
static fundWithToken(params): Promise<FundingResult>;
```

Defined in: [packages/sdk/src/utils/funding.ts:126](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/sdk/src/utils/funding.ts#L126)

充值 ERC20 Token 到目标地址

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `params` | `FundTokenParams` | 充值参数 |

#### Returns

`Promise`\<`FundingResult`\>

充值结果

***

### getETHBalance()

```ts
static getETHBalance(params): Promise<bigint>;
```

Defined in: [packages/sdk/src/utils/funding.ts:158](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/sdk/src/utils/funding.ts#L158)

检查 ETH 余额

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `params` | [`FundingParams`](../interfaces/FundingParams.md) | 基础参数 |

#### Returns

`Promise`\<`bigint`\>

ETH 余额（wei）

***

### getTokenBalance()

```ts
static getTokenBalance(params, tokenAddress): Promise<bigint>;
```

Defined in: [packages/sdk/src/utils/funding.ts:169](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/sdk/src/utils/funding.ts#L169)

检查 ERC20 Token 余额

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `params` | [`FundingParams`](../interfaces/FundingParams.md) | 基础参数 |
| `tokenAddress` | `` `0x${string}` `` | Token 合约地址 |

#### Returns

`Promise`\<`bigint`\>

Token 余额
