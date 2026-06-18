Defined in: [packages/sdk/src/utils/funding.ts:39](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/sdk/src/utils/funding.ts#L39)

智能充值参数

## Extends

- [`FundingParams`](FundingParams.md)

## Properties

### chain

> **chain**: [`Chain`](https://viem.sh/docs/index.html)

Defined in: [packages/sdk/src/utils/funding.ts:11](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/sdk/src/utils/funding.ts#L11)

链配置

#### Inherited from

[`FundingParams`](FundingParams.md).[`chain`](FundingParams.md#chain)

***

### minETH?

> `optional` **minETH**: `string`

Defined in: [packages/sdk/src/utils/funding.ts:41](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/sdk/src/utils/funding.ts#L41)

最小 ETH 余额阈值

***

### rpcUrl

> **rpcUrl**: `string`

Defined in: [packages/sdk/src/utils/funding.ts:9](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/sdk/src/utils/funding.ts#L9)

RPC URL

#### Inherited from

[`FundingParams`](FundingParams.md).[`rpcUrl`](FundingParams.md#rpcurl)

***

### supplierKey

> **supplierKey**: `` `0x${string}` ``

Defined in: [packages/sdk/src/utils/funding.ts:13](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/sdk/src/utils/funding.ts#L13)

资金提供者私钥

#### Inherited from

[`FundingParams`](FundingParams.md).[`supplierKey`](FundingParams.md#supplierkey)

***

### targetAddress

> **targetAddress**: `` `0x${string}` ``

Defined in: [packages/sdk/src/utils/funding.ts:15](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/sdk/src/utils/funding.ts#L15)

目标地址

#### Inherited from

[`FundingParams`](FundingParams.md).[`targetAddress`](FundingParams.md#targetaddress)

***

### targetETH?

> `optional` **targetETH**: `string`

Defined in: [packages/sdk/src/utils/funding.ts:43](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/sdk/src/utils/funding.ts#L43)

目标 ETH 充值金额

***

### token?

> `optional` **token**: `object`

Defined in: [packages/sdk/src/utils/funding.ts:45](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/sdk/src/utils/funding.ts#L45)

Token 配置（可选）

#### address

> **address**: `` `0x${string}` ``

#### minBalance?

> `optional` **minBalance**: `string`

#### targetAmount?

> `optional` **targetAmount**: `string`
