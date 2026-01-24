Defined in: [enduser/src/UserClient.ts:7](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/enduser/src/UserClient.ts#L7)

Base configuration for all L2 Business Clients

## Extends

- [`ClientConfig`](../../core/interfaces/ClientConfig.md)

## Properties

### accountAddress

> **accountAddress**: `` `0x${string}` ``

Defined in: [enduser/src/UserClient.ts:8](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/enduser/src/UserClient.ts#L8)

***

### client

> **client**: [`WalletClient`](../../core/interfaces/WalletClient.md)

Defined in: core/dist/clients/types.d.ts:11

Viem WalletClient for write operations.
Must have an account attached.

#### Inherited from

[`ClientConfig`](../../core/interfaces/ClientConfig.md).[`client`](../../core/interfaces/ClientConfig.md#client)

***

### entryPointAddress?

> `optional` **entryPointAddress**: `` `0x${string}` ``

Defined in: [enduser/src/UserClient.ts:10](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/enduser/src/UserClient.ts#L10)

#### Overrides

[`ClientConfig`](../../core/interfaces/ClientConfig.md).[`entryPointAddress`](../../core/interfaces/ClientConfig.md#entrypointaddress)

***

### ethUsdPriceFeedAddress?

> `optional` **ethUsdPriceFeedAddress**: `` `0x${string}` ``

Defined in: core/dist/clients/types.d.ts:40

#### Inherited from

[`ClientConfig`](../../core/interfaces/ClientConfig.md).[`ethUsdPriceFeedAddress`](../../core/interfaces/ClientConfig.md#ethusdpricefeedaddress)

***

### gTokenAddress?

> `optional` **gTokenAddress**: `` `0x${string}` ``

Defined in: [enduser/src/UserClient.ts:14](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/enduser/src/UserClient.ts#L14)

GToken contract address.
Required for operations involving token approvals and transfers.

#### Overrides

[`ClientConfig`](../../core/interfaces/ClientConfig.md).[`gTokenAddress`](../../core/interfaces/ClientConfig.md#gtokenaddress)

***

### gTokenStakingAddress?

> `optional` **gTokenStakingAddress**: `` `0x${string}` ``

Defined in: [enduser/src/UserClient.ts:12](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/enduser/src/UserClient.ts#L12)

GTokenStaking contract address.
Required for role registration that involves staking.

#### Overrides

[`ClientConfig`](../../core/interfaces/ClientConfig.md).[`gTokenStakingAddress`](../../core/interfaces/ClientConfig.md#gtokenstakingaddress)

***

### paymasterFactoryAddress?

> `optional` **paymasterFactoryAddress**: `` `0x${string}` ``

Defined in: core/dist/clients/types.d.ts:38

PaymasterFactory contract address.
Required for deploying new PaymasterV4 instances.

#### Inherited from

[`ClientConfig`](../../core/interfaces/ClientConfig.md).[`paymasterFactoryAddress`](../../core/interfaces/ClientConfig.md#paymasterfactoryaddress)

***

### publicClient?

> `optional` **publicClient**: [`PublicClient`](../../core/interfaces/PublicClient.md)

Defined in: core/dist/clients/types.d.ts:18

Optional PublicClient for read operations.
If not provided, one will be derived from the WalletClient or created internally if possible (but usually explicit is better).
Currently L1 actions use PublicClient | WalletClient, so WalletClient is enough for both if it has a provider.
However, explicitly accepting PublicClient encourages separation.

#### Inherited from

[`ClientConfig`](../../core/interfaces/ClientConfig.md).[`publicClient`](../../core/interfaces/ClientConfig.md#publicclient)

***

### registryAddress?

> `optional` **registryAddress**: `` `0x${string}` ``

Defined in: [enduser/src/UserClient.ts:13](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/enduser/src/UserClient.ts#L13)

Registry contract address.
Essential for looking up other contracts if not provided explicitly.

#### Overrides

[`ClientConfig`](../../core/interfaces/ClientConfig.md).[`registryAddress`](../../core/interfaces/ClientConfig.md#registryaddress)

***

### sbtAddress?

> `optional` **sbtAddress**: `` `0x${string}` ``

Defined in: [enduser/src/UserClient.ts:9](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/enduser/src/UserClient.ts#L9)

***

### superPaymasterAddress?

> `optional` **superPaymasterAddress**: `` `0x${string}` ``

Defined in: [enduser/src/UserClient.ts:11](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/enduser/src/UserClient.ts#L11)

***

### xpntsFactoryAddress?

> `optional` **xpntsFactoryAddress**: `` `0x${string}` ``

Defined in: core/dist/clients/types.d.ts:39

#### Inherited from

[`ClientConfig`](../../core/interfaces/ClientConfig.md).[`xpntsFactoryAddress`](../../core/interfaces/ClientConfig.md#xpntsfactoryaddress)
