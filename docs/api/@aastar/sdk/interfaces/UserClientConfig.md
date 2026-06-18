Defined in: [packages/enduser/src/UserClient.ts:6](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/enduser/src/UserClient.ts#L6)

Base configuration for all L2 Business Clients

## Extends

- [`ClientConfig`](ClientConfig.md)

## Properties

### accountAddress

> **accountAddress**: `` `0x${string}` ``

Defined in: [packages/enduser/src/UserClient.ts:7](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/enduser/src/UserClient.ts#L7)

***

### bundlerClient?

> `optional` **bundlerClient**: `any`

Defined in: [packages/enduser/src/UserClient.ts:14](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/enduser/src/UserClient.ts#L14)

***

### client

> **client**: [`WalletClient`](WalletClient.md)

Defined in: [packages/core/src/clients/types.ts:12](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/clients/types.ts#L12)

Viem WalletClient for write operations.
Must have an account attached.

#### Inherited from

[`ClientConfig`](ClientConfig.md).[`client`](ClientConfig.md#client)

***

### entryPointAddress?

> `optional` **entryPointAddress**: `` `0x${string}` ``

Defined in: [packages/enduser/src/UserClient.ts:9](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/enduser/src/UserClient.ts#L9)

#### Overrides

[`ClientConfig`](ClientConfig.md).[`entryPointAddress`](ClientConfig.md#entrypointaddress)

***

### ethUsdPriceFeedAddress?

> `optional` **ethUsdPriceFeedAddress**: `` `0x${string}` ``

Defined in: [packages/core/src/clients/types.ts:46](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/clients/types.ts#L46)

#### Inherited from

[`ClientConfig`](ClientConfig.md).[`ethUsdPriceFeedAddress`](ClientConfig.md#ethusdpricefeedaddress)

***

### gTokenAddress?

> `optional` **gTokenAddress**: `` `0x${string}` ``

Defined in: [packages/enduser/src/UserClient.ts:13](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/enduser/src/UserClient.ts#L13)

GToken contract address.
Required for operations involving token approvals and transfers.

#### Overrides

[`ClientConfig`](ClientConfig.md).[`gTokenAddress`](ClientConfig.md#gtokenaddress)

***

### gTokenStakingAddress?

> `optional` **gTokenStakingAddress**: `` `0x${string}` ``

Defined in: [packages/enduser/src/UserClient.ts:11](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/enduser/src/UserClient.ts#L11)

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

### registryAddress?

> `optional` **registryAddress**: `` `0x${string}` ``

Defined in: [packages/enduser/src/UserClient.ts:12](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/enduser/src/UserClient.ts#L12)

Registry contract address.
Essential for looking up other contracts if not provided explicitly.

#### Overrides

[`ClientConfig`](ClientConfig.md).[`registryAddress`](ClientConfig.md#registryaddress)

***

### sbtAddress?

> `optional` **sbtAddress**: `` `0x${string}` ``

Defined in: [packages/enduser/src/UserClient.ts:8](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/enduser/src/UserClient.ts#L8)

***

### superPaymasterAddress?

> `optional` **superPaymasterAddress**: `` `0x${string}` ``

Defined in: [packages/enduser/src/UserClient.ts:10](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/enduser/src/UserClient.ts#L10)

***

### xpntsFactoryAddress?

> `optional` **xpntsFactoryAddress**: `` `0x${string}` ``

Defined in: [packages/core/src/clients/types.ts:45](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/clients/types.ts#L45)

#### Inherited from

[`ClientConfig`](ClientConfig.md).[`xpntsFactoryAddress`](ClientConfig.md#xpntsfactoryaddress)
