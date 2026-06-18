Defined in: [packages/enduser/src/UserLifecycle.ts:10](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/enduser/src/UserLifecycle.ts#L10)

Base configuration for all L2 Business Clients

## Extends

- [`ClientConfig`](ClientConfig.md)

## Properties

### accountAddress

> **accountAddress**: `` `0x${string}` ``

Defined in: [packages/enduser/src/UserLifecycle.ts:11](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/enduser/src/UserLifecycle.ts#L11)

***

### client

> **client**: [`WalletClient`](WalletClient.md)

Defined in: [packages/core/src/clients/types.ts:12](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/clients/types.ts#L12)

Viem WalletClient for write operations.
Must have an account attached.

#### Inherited from

[`ClientConfig`](ClientConfig.md).[`client`](ClientConfig.md#client)

***

### entryPointAddress

> **entryPointAddress**: `` `0x${string}` ``

Defined in: [packages/enduser/src/UserLifecycle.ts:16](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/enduser/src/UserLifecycle.ts#L16)

#### Overrides

[`ClientConfig`](ClientConfig.md).[`entryPointAddress`](ClientConfig.md#entrypointaddress)

***

### ethUsdPriceFeedAddress?

> `optional` **ethUsdPriceFeedAddress**: `` `0x${string}` ``

Defined in: [packages/core/src/clients/types.ts:46](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/clients/types.ts#L46)

#### Inherited from

[`ClientConfig`](ClientConfig.md).[`ethUsdPriceFeedAddress`](ClientConfig.md#ethusdpricefeedaddress)

***

### gasless?

> `optional` **gasless**: [`GaslessConfig`](GaslessConfig.md)

Defined in: [packages/enduser/src/UserLifecycle.ts:17](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/enduser/src/UserLifecycle.ts#L17)

***

### gTokenAddress

> **gTokenAddress**: `` `0x${string}` ``

Defined in: [packages/enduser/src/UserLifecycle.ts:14](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/enduser/src/UserLifecycle.ts#L14)

GToken contract address.
Required for operations involving token approvals and transfers.

#### Overrides

[`ClientConfig`](ClientConfig.md).[`gTokenAddress`](ClientConfig.md#gtokenaddress)

***

### gTokenStakingAddress

> **gTokenStakingAddress**: `` `0x${string}` ``

Defined in: [packages/enduser/src/UserLifecycle.ts:15](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/enduser/src/UserLifecycle.ts#L15)

GTokenStaking contract address.
Required for role registration that involves staking.

#### Overrides

[`ClientConfig`](ClientConfig.md).[`gTokenStakingAddress`](ClientConfig.md#gtokenstakingaddress)

***

### paymasterFactoryAddress?

> `optional` **paymasterFactoryAddress**: `` `0x${string}` ``

Defined in: [packages/core/src/clients/types.ts:44](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/clients/types.ts#L44)

PaymasterFactory contract address.
Required for deploying new PaymasterV4 instances.

#### Inherited from

[`ClientConfig`](ClientConfig.md).[`paymasterFactoryAddress`](ClientConfig.md#paymasterfactoryaddress)

***

### publicClient?

> `optional` **publicClient**: [`PublicClient`](PublicClient.md)

Defined in: [packages/core/src/clients/types.ts:20](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/clients/types.ts#L20)

Optional PublicClient for read operations.
If not provided, one will be derived from the WalletClient or created internally if possible (but usually explicit is better).
Currently L1 actions use PublicClient | WalletClient, so WalletClient is enough for both if it has a provider.
However, explicitly accepting PublicClient encourages separation.

#### Inherited from

[`ClientConfig`](ClientConfig.md).[`publicClient`](ClientConfig.md#publicclient)

***

### registryAddress

> **registryAddress**: `` `0x${string}` ``

Defined in: [packages/enduser/src/UserLifecycle.ts:12](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/enduser/src/UserLifecycle.ts#L12)

Registry contract address.
Essential for looking up other contracts if not provided explicitly.

#### Overrides

[`ClientConfig`](ClientConfig.md).[`registryAddress`](ClientConfig.md#registryaddress)

***

### sbtAddress

> **sbtAddress**: `` `0x${string}` ``

Defined in: [packages/enduser/src/UserLifecycle.ts:13](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/enduser/src/UserLifecycle.ts#L13)

***

### xpntsFactoryAddress?

> `optional` **xpntsFactoryAddress**: `` `0x${string}` ``

Defined in: [packages/core/src/clients/types.ts:45](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/clients/types.ts#L45)

#### Inherited from

[`ClientConfig`](ClientConfig.md).[`xpntsFactoryAddress`](ClientConfig.md#xpntsfactoryaddress)
