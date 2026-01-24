Defined in: [packages/core/src/clients/types.ts:7](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/clients/types.ts#L7)

Base configuration for all L2 Business Clients

## Extended by

- [`CommunityClientConfig`](../../enduser/interfaces/CommunityClientConfig.md)
- [`UserClientConfig`](../../enduser/interfaces/UserClientConfig.md)

## Properties

### client

> **client**: [`WalletClient`](WalletClient.md)

Defined in: [packages/core/src/clients/types.ts:12](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/clients/types.ts#L12)

Viem WalletClient for write operations.
Must have an account attached.

***

### entryPointAddress?

> `optional` **entryPointAddress**: `` `0x${string}` ``

Defined in: [packages/core/src/clients/types.ts:47](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/clients/types.ts#L47)

***

### ethUsdPriceFeedAddress?

> `optional` **ethUsdPriceFeedAddress**: `` `0x${string}` ``

Defined in: [packages/core/src/clients/types.ts:46](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/clients/types.ts#L46)

***

### gTokenAddress?

> `optional` **gTokenAddress**: `` `0x${string}` ``

Defined in: [packages/core/src/clients/types.ts:32](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/clients/types.ts#L32)

GToken contract address.
Required for operations involving token approvals and transfers.

***

### gTokenStakingAddress?

> `optional` **gTokenStakingAddress**: `` `0x${string}` ``

Defined in: [packages/core/src/clients/types.ts:38](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/clients/types.ts#L38)

GTokenStaking contract address.
Required for role registration that involves staking.

***

### paymasterFactoryAddress?

> `optional` **paymasterFactoryAddress**: `` `0x${string}` ``

Defined in: [packages/core/src/clients/types.ts:44](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/clients/types.ts#L44)

PaymasterFactory contract address.
Required for deploying new PaymasterV4 instances.

***

### publicClient?

> `optional` **publicClient**: [`PublicClient`](PublicClient.md)

Defined in: [packages/core/src/clients/types.ts:20](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/clients/types.ts#L20)

Optional PublicClient for read operations.
If not provided, one will be derived from the WalletClient or created internally if possible (but usually explicit is better).
Currently L1 actions use PublicClient | WalletClient, so WalletClient is enough for both if it has a provider.
However, explicitly accepting PublicClient encourages separation.

***

### registryAddress?

> `optional` **registryAddress**: `` `0x${string}` ``

Defined in: [packages/core/src/clients/types.ts:26](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/clients/types.ts#L26)

Registry contract address.
Essential for looking up other contracts if not provided explicitly.

***

### xpntsFactoryAddress?

> `optional` **xpntsFactoryAddress**: `` `0x${string}` ``

Defined in: [packages/core/src/clients/types.ts:45](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/clients/types.ts#L45)
