Defined in: [operator/src/PaymasterOperatorClient.ts:5](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/operator/src/PaymasterOperatorClient.ts#L5)

Base configuration for all L2 Business Clients

## Extends

- [`ClientConfig`](../../sdk/interfaces/ClientConfig.md)

## Properties

### client

> **client**: [`WalletClient`](../../sdk/interfaces/WalletClient.md)

Defined in: core/dist/clients/types.d.ts:11

Viem WalletClient for write operations.
Must have an account attached.

#### Inherited from

[`ClientConfig`](../../sdk/interfaces/ClientConfig.md).[`client`](../../sdk/interfaces/ClientConfig.md#client)

***

### entryPointAddress?

> `optional` **entryPointAddress**: `` `0x${string}` ``

Defined in: core/dist/clients/types.d.ts:41

#### Inherited from

[`ClientConfig`](../../sdk/interfaces/ClientConfig.md).[`entryPointAddress`](../../sdk/interfaces/ClientConfig.md#entrypointaddress)

***

### ethUsdPriceFeedAddress?

> `optional` **ethUsdPriceFeedAddress**: `` `0x${string}` ``

Defined in: core/dist/clients/types.d.ts:40

#### Inherited from

[`ClientConfig`](../../sdk/interfaces/ClientConfig.md).[`ethUsdPriceFeedAddress`](../../sdk/interfaces/ClientConfig.md#ethusdpricefeedaddress)

***

### gTokenAddress?

> `optional` **gTokenAddress**: `` `0x${string}` ``

Defined in: core/dist/clients/types.d.ts:28

GToken contract address.
Required for operations involving token approvals and transfers.

#### Inherited from

[`ClientConfig`](../../sdk/interfaces/ClientConfig.md).[`gTokenAddress`](../../sdk/interfaces/ClientConfig.md#gtokenaddress)

***

### gTokenStakingAddress?

> `optional` **gTokenStakingAddress**: `` `0x${string}` ``

Defined in: core/dist/clients/types.d.ts:33

GTokenStaking contract address.
Required for role registration that involves staking.

#### Inherited from

[`ClientConfig`](../../sdk/interfaces/ClientConfig.md).[`gTokenStakingAddress`](../../sdk/interfaces/ClientConfig.md#gtokenstakingaddress)

***

### paymasterFactoryAddress?

> `optional` **paymasterFactoryAddress**: `` `0x${string}` ``

Defined in: core/dist/clients/types.d.ts:38

PaymasterFactory contract address.
Required for deploying new PaymasterV4 instances.

#### Inherited from

[`ClientConfig`](../../sdk/interfaces/ClientConfig.md).[`paymasterFactoryAddress`](../../sdk/interfaces/ClientConfig.md#paymasterfactoryaddress)

***

### publicClient?

> `optional` **publicClient**: [`PublicClient`](../../sdk/interfaces/PublicClient.md)

Defined in: core/dist/clients/types.d.ts:18

Optional PublicClient for read operations.
If not provided, one will be derived from the WalletClient or created internally if possible (but usually explicit is better).
Currently L1 actions use PublicClient | WalletClient, so WalletClient is enough for both if it has a provider.
However, explicitly accepting PublicClient encourages separation.

#### Inherited from

[`ClientConfig`](../../sdk/interfaces/ClientConfig.md).[`publicClient`](../../sdk/interfaces/ClientConfig.md#publicclient)

***

### registryAddress?

> `optional` **registryAddress**: `` `0x${string}` ``

Defined in: core/dist/clients/types.d.ts:23

Registry contract address.
Essential for looking up other contracts if not provided explicitly.

#### Inherited from

[`ClientConfig`](../../sdk/interfaces/ClientConfig.md).[`registryAddress`](../../sdk/interfaces/ClientConfig.md#registryaddress)

***

### superPaymasterAddress

> **superPaymasterAddress**: `` `0x${string}` ``

Defined in: [operator/src/PaymasterOperatorClient.ts:6](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/operator/src/PaymasterOperatorClient.ts#L6)

***

### tokenAddress?

> `optional` **tokenAddress**: `` `0x${string}` ``

Defined in: [operator/src/PaymasterOperatorClient.ts:7](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/operator/src/PaymasterOperatorClient.ts#L7)

***

### xpntsFactoryAddress?

> `optional` **xpntsFactoryAddress**: `` `0x${string}` ``

Defined in: core/dist/clients/types.d.ts:39

#### Inherited from

[`ClientConfig`](../../sdk/interfaces/ClientConfig.md).[`xpntsFactoryAddress`](../../sdk/interfaces/ClientConfig.md#xpntsfactoryaddress)
