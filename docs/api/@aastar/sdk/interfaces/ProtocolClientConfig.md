Defined in: [packages/operator/src/ProtocolClient.ts:5](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/operator/src/ProtocolClient.ts#L5)

Base configuration for all L2 Business Clients

## Extends

- [`ClientConfig`](ClientConfig.md)

## Properties

### blsAggregatorAddress?

> `optional` **blsAggregatorAddress**: `` `0x${string}` ``

Defined in: [packages/operator/src/ProtocolClient.ts:7](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/operator/src/ProtocolClient.ts#L7)

***

### client

> **client**: [`WalletClient`](WalletClient.md)

Defined in: [packages/core/src/clients/types.ts:12](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/clients/types.ts#L12)

Viem WalletClient for write operations.
Must have an account attached.

#### Inherited from

[`ClientConfig`](ClientConfig.md).[`client`](ClientConfig.md#client)

***

### dvtValidatorAddress

> **dvtValidatorAddress**: `` `0x${string}` ``

Defined in: [packages/operator/src/ProtocolClient.ts:6](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/operator/src/ProtocolClient.ts#L6)

***

### entryPointAddress?

> `optional` **entryPointAddress**: `` `0x${string}` ``

Defined in: [packages/core/src/clients/types.ts:47](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/clients/types.ts#L47)

#### Inherited from

[`ClientConfig`](ClientConfig.md).[`entryPointAddress`](ClientConfig.md#entrypointaddress)

***

### ethUsdPriceFeedAddress?

> `optional` **ethUsdPriceFeedAddress**: `` `0x${string}` ``

Defined in: [packages/core/src/clients/types.ts:46](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/clients/types.ts#L46)

#### Inherited from

[`ClientConfig`](ClientConfig.md).[`ethUsdPriceFeedAddress`](ClientConfig.md#ethusdpricefeedaddress)

***

### gTokenAddress?

> `optional` **gTokenAddress**: `` `0x${string}` ``

Defined in: [packages/core/src/clients/types.ts:32](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/clients/types.ts#L32)

GToken contract address.
Required for operations involving token approvals and transfers.

#### Inherited from

[`ClientConfig`](ClientConfig.md).[`gTokenAddress`](ClientConfig.md#gtokenaddress)

***

### gTokenStakingAddress?

> `optional` **gTokenStakingAddress**: `` `0x${string}` ``

Defined in: [packages/core/src/clients/types.ts:38](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/clients/types.ts#L38)

GTokenStaking contract address.
Required for role registration that involves staking.

#### Inherited from

[`ClientConfig`](ClientConfig.md).[`gTokenStakingAddress`](ClientConfig.md#gtokenstakingaddress)

***

### paymasterFactoryAddress?

> `optional` **paymasterFactoryAddress**: `` `0x${string}` ``

Defined in: [packages/core/src/clients/types.ts:44](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/clients/types.ts#L44)

PaymasterFactory contract address.
Required for deploying new PaymasterV4 instances.

#### Inherited from

[`ClientConfig`](ClientConfig.md).[`paymasterFactoryAddress`](ClientConfig.md#paymasterfactoryaddress)

***

### publicClient?

> `optional` **publicClient**: [`PublicClient`](PublicClient.md)

Defined in: [packages/core/src/clients/types.ts:20](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/clients/types.ts#L20)

Optional PublicClient for read operations.
If not provided, one will be derived from the WalletClient or created internally if possible (but usually explicit is better).
Currently L1 actions use PublicClient | WalletClient, so WalletClient is enough for both if it has a provider.
However, explicitly accepting PublicClient encourages separation.

#### Inherited from

[`ClientConfig`](ClientConfig.md).[`publicClient`](ClientConfig.md#publicclient)

***

### registryAddress?

> `optional` **registryAddress**: `` `0x${string}` ``

Defined in: [packages/core/src/clients/types.ts:26](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/clients/types.ts#L26)

Registry contract address.
Essential for looking up other contracts if not provided explicitly.

#### Inherited from

[`ClientConfig`](ClientConfig.md).[`registryAddress`](ClientConfig.md#registryaddress)

***

### superPaymasterAddress?

> `optional` **superPaymasterAddress**: `` `0x${string}` ``

Defined in: [packages/operator/src/ProtocolClient.ts:8](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/operator/src/ProtocolClient.ts#L8)

***

### xpntsFactoryAddress?

> `optional` **xpntsFactoryAddress**: `` `0x${string}` ``

Defined in: [packages/core/src/clients/types.ts:45](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/clients/types.ts#L45)

#### Inherited from

[`ClientConfig`](ClientConfig.md).[`xpntsFactoryAddress`](ClientConfig.md#xpntsfactoryaddress)
